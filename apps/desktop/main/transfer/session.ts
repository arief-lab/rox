// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer session over IPC — the renderer-facing data plane.
 *
 * Wires the Hyperdrive adapter to the renderer via typed IPC channels:
 *  - `transfer:send`    — seed a file, returns { driveKey, topic }
 *  - `transfer:receive` — join the offer topic, replicate, save
 *  - `transfer:cancel`  — stop seeding / abort receiving
 *  - `transfer:release` — stop announcing after the receiver is done
 * Progress and errors stream back on `transfer:event`.
 *
 * Pairing (TASK-3): both peers join the offer topic on ONE shared
 * Hyperswarm. When a connection opens, a ProtomuxTransport (rox/pairing
 * channel) is created and driven by whichever role is active. Signals
 * (hyper-offer/accepted/release) flow over the peer connection; drive
 * replication multiplexes on the same socket. The sender attaches its
 * drive replication to every incoming connection.
 */

import { Buffer } from "node:buffer";
import path from "node:path";

import { encodeSignal, type HyperOffer, HyperTransferMachine } from "@rox/core";
import { app, ipcMain } from "electron";
import Protomux from "protomux";

import { HyperReceiver, HyperSeeder, pumpSignals } from "./hyper-adapter";
import { ProtomuxTransport } from "./protomux-transport";

type TransferEvent =
	| { type: "state"; kind: string }
	| { type: "error"; message: string }
	| { type: "done"; path?: string }
	| { type: "peer"; status: "connected" | "disconnected"; reason?: string };

const getStorageDir = (): string =>
	path.join(app.getPath("userData"), "transfer");

export function registerTransferHandlers(win: Electron.BrowserWindow): void {
	// One machine per role — send and receive can run concurrently and
	// their states must not fight each other.
	const storageDir = getStorageDir();
	const sendMachine = new HyperTransferMachine();
	const receiveMachine = new HyperTransferMachine();
	const seeder = new HyperSeeder(storageDir);
	const receiver = new HyperReceiver(storageDir);

	// The single Hyperswarm is created lazily by the first join. Incoming
	// connections spawn a ProtomuxTransport handed to whichever role is
	// waiting for a peer.
	let swarm: import("hyperswarm") | null = null;
	let activePeer: ProtomuxTransport | null = null;
	let activeMux: Protomux | null = null;
	let receiveResolve: ((signal: string) => void) | null = null;

	const emit = (event: TransferEvent): void => {
		if (!win.isDestroyed()) {
			win.webContents.send("transfer:event", event);
		}
	};
	const emitState = (): void => {
		const kind =
			sendMachine.getState().kind !== "idle"
				? sendMachine.getState().kind
				: receiveMachine.getState().kind;
		emit({ kind, type: "state" });
	};

	const getSwarm = async (): Promise<import("hyperswarm")> => {
		if (!swarm) {
			const { default: Hyperswarm } = await import("hyperswarm");
			swarm = new Hyperswarm();
			swarm.on("connection", (socket) => {
				const mux = Protomux.from(socket);
				const peer = new ProtomuxTransport({ mux });
				setActivePeer(peer, mux);

				// The seeder attaches its drive replication to every
				// connection (no-op when nothing is seeded).
				void seeder.attachReplication(mux);
			});
		}
		return swarm;
	};

	/** Route signals from the active peer to the role that awaits them. */
	const setActivePeer = (peer: ProtomuxTransport, mux: Protomux): void => {
		if (activePeer) {
			activePeer.close("superseded by a newer peer connection");
		}
		activePeer = peer;
		activeMux = mux;
		emit({ status: "connected", type: "peer" });

		peer.onclose((event) => {
			if (activePeer === peer) {
				activePeer = null;
				activeMux = null;
				emit({ reason: event.reason, status: "disconnected", type: "peer" });
			}
		});

		pumpSignals(peer, (signal) => {
			if (signal.type === "hyper-offer") {
				// Peer is sending to us — auto-receive over this connection.
				emit({ kind: "receiving", type: "state" });
				void handleIncomingOffer(signal, peer, mux);
			} else if (signal.type === "hyper-accepted") {
				emitState();
			} else if (signal.type === "hyper-release") {
				void seeder.release();
				sendMachine.complete();
				emitState();
			}
		});

		// If receive() is already waiting for a peer, wake it up.
		if (receiveResolve) {
			const resolve = receiveResolve;
			receiveResolve = null;
			resolve("peer-connected");
		}
	};

	const handleIncomingOffer = async (
		signal: HyperOffer,
		peer: ProtomuxTransport,
		mux: Protomux,
	): Promise<void> => {
		try {
			receiveMachine.reset();
			receiveMachine.startReceiving(signal.driveKey, signal.topic);
			const savedPath = await receiver.receiveViaConnection(
				signal.driveKey,
				mux,
				storageDir,
			);
			receiveMachine.complete();
			emitState();
			emit({ path: savedPath, type: "done" });
			peer.send(
				encodeSignal({ driveKey: signal.driveKey, type: "hyper-accepted" }),
			);
			peer.send(
				encodeSignal({ driveKey: signal.driveKey, type: "hyper-release" }),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (error instanceof Error) {
				console.error("[incoming-offer]", error.stack);
			}
			receiveMachine.fail(message);
			emitState();
			emit({ message, type: "error" });
		}
	};

	ipcMain.handle("transfer:send", async (_event, filePath: string) => {
		try {
			sendMachine.reset();
			sendMachine.startOffering("pending", "pending", filePath);
			emitState();
			const result = await seeder.seed(filePath);
			// Announce the derived topic so the receiver can find us.
			const hs = await getSwarm();
			await seeder.joinSwarm(hs);
			return { ok: true as const, ...result };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			sendMachine.fail(message);
			emitState();
			emit({ message, type: "error" });
			return { error: message, ok: false as const };
		}
	});

	ipcMain.handle(
		"transfer:receive",
		async (_event, driveKey: string, topic: string) => {
			try {
				receiveMachine.reset();
				receiveMachine.startReceiving(driveKey, topic);
				emitState();

				const hs = await getSwarm();
				// Announce client-side on the offer topic; the connection to
				// the seeder carries the offer signal AND the drive.
				hs.join(Buffer.from(topic, "hex"), {
					client: true,
					server: true,
				});
				await hs.flush();

				// Wait for the peer connection (setActivePeer resolves this).
				const connected = await new Promise<string>((resolve) => {
					if (activePeer) {
						resolve("peer-connected");
						return;
					}
					receiveResolve = resolve;
					setTimeout(() => resolve("timeout waiting for peer"), 60_000);
				});
				if (connected !== "peer-connected" || !activePeer || !activeMux) {
					throw new Error(connected);
				}

				const savedPath = await receiver.receiveViaConnection(
					driveKey,
					activeMux,
					storageDir,
				);
				receiveMachine.complete();
				emitState();
				emit({ path: savedPath, type: "done" });
				activePeer.send(encodeSignal({ driveKey, type: "hyper-accepted" }));
				activePeer.send(encodeSignal({ driveKey, type: "hyper-release" }));
				return { ok: true as const, path: savedPath };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (error instanceof Error) {
					console.error("[transfer:receive]", error.stack);
				}
				receiveMachine.fail(message);
				emitState();
				emit({ message, type: "error" });
				return { error: message, ok: false as const };
			}
		},
	);

	ipcMain.handle("transfer:cancel", async () => {
		if (sendMachine.getState().kind !== "idle") {
			sendMachine.cancel();
		}
		if (receiveMachine.getState().kind !== "idle") {
			receiveMachine.cancel();
		}
		emitState();
		return { ok: true as const };
	});

	ipcMain.handle("transfer:release", async () => {
		await seeder.release();
		return { ok: true as const };
	});

	app.on("before-quit", () => {
		void seeder.destroy();
		void receiver.destroy();
		void swarm?.destroy();
	});
}
