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
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

import { encodeSignal, type HyperOffer, HyperTransferMachine } from "@rox/core";
import { app, ipcMain } from "electron";
import Store from "electron-store";
import Protomux from "protomux";
import { clearTransfers, listTransfers, recordTransfer } from "./history";
import { HyperReceiver, HyperSeeder, pumpSignals } from "./hyper-adapter";
import { getDeviceName, setDeviceName } from "./identity";
import { ProtomuxTransport } from "./protomux-transport";
import {
	isTrustedDevice,
	listTrustedDevices,
	trustDevice,
	untrustDevice,
} from "./trusted-devices";

type TransferEvent =
	| {
			/** True once BOTH sides have accepted the pairing. */
			confirmed: boolean;
			device: { id: string; name: string } | null;
			status: "connected" | "disconnected";
			/** True when the local accept came from the trust list. */
			trusted: boolean;
			type: "peer";
	  }
	| { type: "state"; kind: string }
	| { type: "error"; message: string }
	| { type: "done"; path?: string }
	| {
			type: "progress";
			direction: "send" | "receive";
			bytes: number;
			total: number;
	  };

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

	/**
	 * Poll the active transfer's byte counters and stream progress to
	 * the renderer. Runs until the role leaves its transferring phase;
	 * intervals keep a reference so overlapping transfers poll too.
	 */
	const startProgressPolling = (): void => {
		const tick = async (): Promise<void> => {
			const sending = sendMachine.getState().kind === "offering";
			const receiving = receiveMachine.getState().kind === "receiving";
			if (sending) {
				const progress = await seeder.uploadProgress();
				if (progress) {
					lastSent = progress;
					emit({
						bytes: progress.bytes,
						direction: "send",
						total: progress.total,
						type: "progress",
					});
				}
			}
			if (receiving) {
				const progress = await receiver.downloadProgress();
				if (progress) {
					lastReceived = progress;
					emit({
						bytes: progress.bytes,
						direction: "receive",
						total: progress.total,
						type: "progress",
					});
				}
			}
		};
		const interval = setInterval(() => {
			tick().catch(() => undefined);
		}, 500);
		// Stop once both roles are idle for a full poll cycle.
		const stopCheck = setInterval(() => {
			const active =
				sendMachine.getState().kind === "offering" ||
				receiveMachine.getState().kind === "receiving";
			if (!active) {
				clearInterval(interval);
				clearInterval(stopCheck);
			}
		}, 500);
	};
	const emitState = (): void => {
		const kind =
			sendMachine.getState().kind === "idle"
				? receiveMachine.getState().kind
				: sendMachine.getState().kind;
		emit({ kind, type: "state" });
	};

	// Last byte counts seen per direction — the denominator recorded in
	// history when a transfer completes (progress events stream totals).
	let lastSent = { bytes: 0, total: 0 };
	let lastReceived = { bytes: 0, total: 0 };
	/** Local path of the file currently being seeded. */
	let lastSentPath: string | null = null;

	// ── Pairing identity ─────────────────────────────────
	// Stable local peer id: fingerprint of a stored random seed.
	const identityStore = new Store<{
		peerId: string;
	}>({
		defaults: { peerId: randomBytes(32).toString("hex") },
		name: "peer-identity",
	});
	const peerId = identityStore.get("peerId");
	const localDevice = {
		id: createHash("sha256").update(peerId).digest("hex").slice(0, 16),
		name: getDeviceName(),
	};
	/** Device on the other end of the active connection (after hello). */
	let pairedDevice: { id: string; name: string } | null = null;
	/** Local user's decision for the active pairing (null = undecided). */
	let localDecision: boolean | null = null;
	/** Remote user's decision (null = undecided / not yet received). */
	let remoteDecision: boolean | null = null;
	/** True when the local accept came from the trust list, not the UI. */
	let autoAccepted = false;

	const pairingConfirmed = (): boolean =>
		localDecision === true && remoteDecision === true;

	/**
	 * Accept the pending pairing locally. Trusted devices skip the UI
	 * prompt entirely; explicit accepts land here too and persist trust
	 * so the NEXT handshake with this device is automatic.
	 */
	const acceptLocal = (fromTrustList = false): void => {
		localDecision = true;
		if (fromTrustList) {
			autoAccepted = true;
		} else if (pairedDevice) {
			// An explicit user accept establishes trust for next time;
			// trust-list accepts just refresh the last-seen name.
			trustDevice(pairedDevice.id, pairedDevice.name);
		}
		if (activePeer) {
			activePeer.send(
				encodeSignal({ deviceId: localDevice.id, type: "pair-accept" })
			);
			emitPeer("connected");
		}
	};

	/** Push the current pairing state to the renderer. */
	const emitPeer = (status: "connected" | "disconnected"): void => {
		emit({
			confirmed: pairingConfirmed(),
			device: pairedDevice,
			status,
			trusted: autoAccepted,
			type: "peer",
		});
	};

	/** Reset the pairing decision state for a new connection. */
	const resetPairing = (): void => {
		pairedDevice = null;
		localDecision = null;
		remoteDecision = null;
		autoAccepted = false;
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
				seeder.attachReplication(mux).catch(() => undefined);
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
		resetPairing();

		// Introduce ourselves; the peer's hello tells us who they are.
		peer.send(
			encodeSignal({
				deviceId: localDevice.id,
				name: localDevice.name,
				type: "pair-hello",
			})
		);
		// If we already approved this device earlier in the session, the
		// acceptance re-sends automatically so both sides can converge.
		if (localDecision === true) {
			peer.send(
				encodeSignal({ deviceId: localDevice.id, type: "pair-accept" })
			);
		}
		emitPeer("connected");

		peer.onclose(() => {
			if (activePeer === peer) {
				activePeer = null;
				activeMux = null;
				resetPairing();
				emitPeer("disconnected");
			}
		});

		// Route signals from the peer to their per-type handlers.
		// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: signal dispatch is flat if/else over a closed signal type; extracting per-type handlers would hide the pairing flow
		pumpSignals(peer, (signal) => {
			if (signal.type === "pair-hello") {
				// Identity exchange starts the pairing handshake.
				pairedDevice = { id: signal.deviceId, name: signal.name };
				if (isTrustedDevice(signal.deviceId)) {
					// Previously approved — skip the confirmation prompt.
					acceptLocal(true);
				}
				emitPeer("connected");
			} else if (signal.type === "pair-accept") {
				remoteDecision = signal.deviceId === pairedDevice?.id;
				emitPeer("connected");
			} else if (signal.type === "pair-reject") {
				// The peer declined — hang up immediately.
				peer.close("pairing rejected by remote device");
			} else if (signal.type === "hyper-offer") {
				// Offers from an unconfirmed pairing are ignored — the
				// user must accept the remote device first.
				if (!pairingConfirmed()) {
					emit({
						message: `Blocked a file offer from unpaired device ${signal.name ?? signal.driveKey.slice(0, 8)}`,
						type: "error",
					});
					return;
				}
				// Peer is sending to us — auto-receive over this connection.
				emit({ kind: "receiving", type: "state" });
				handleIncomingOffer(signal, peer, mux).catch(() => undefined);
			} else if (signal.type === "hyper-accepted") {
				emitState();
			} else if (signal.type === "hyper-release") {
				seeder.release().catch(() => undefined);
				sendMachine.complete();
				recordTransfer({
					bytes: lastSent.total,
					completedAt: Date.now(),
					direction: "send",
					name: path.basename(lastSentPath ?? ""),
					path: lastSentPath ?? "",
					peerName: pairedDevice?.name,
				});
				lastSentPath = null;
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
		mux: Protomux
	): Promise<void> => {
		try {
			receiveMachine.reset();
			receiveMachine.startReceiving(signal.driveKey, signal.topic);
			const savedPath = await receiver.receiveViaConnection(
				signal.driveKey,
				mux,
				storageDir
			);
			receiveMachine.complete();
			recordTransfer({
				bytes: lastReceived.total,
				completedAt: Date.now(),
				direction: "receive",
				name: path.basename(savedPath),
				path: savedPath,
				peerName: pairedDevice?.name,
			});
			emitState();
			emit({ path: savedPath, type: "done" });
			peer.send(
				encodeSignal({ driveKey: signal.driveKey, type: "hyper-accepted" })
			);
			peer.send(
				encodeSignal({ driveKey: signal.driveKey, type: "hyper-release" })
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
			lastSentPath = filePath;
			lastSent = { bytes: 0, total: 0 };
			emitState();
			const result = await seeder.seed(filePath);
			// Announce the derived topic so the receiver can find us.
			const hs = await getSwarm();
			await seeder.joinSwarm(hs);
			startProgressPolling();
			// The sender id rides in the QR payload so the receiver can
			// verify the pairing safety code before connecting.
			return { ok: true as const, senderId: localDevice.id, ...result };
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
				lastReceived = { bytes: 0, total: 0 };
				emitState();

				const hs = await getSwarm();
				// Announce client-side on the offer topic; the connection to
				// the seeder carries the offer signal AND the drive.
				hs.join(Buffer.from(topic, "hex"), {
					client: true,
					server: true,
				});
				await hs.flush();
				startProgressPolling();

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
					storageDir
				);
				receiveMachine.complete();
				recordTransfer({
					bytes: lastReceived.total,
					completedAt: Date.now(),
					direction: "receive",
					name: path.basename(savedPath),
					path: savedPath,
					peerName: pairedDevice?.name,
				});
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
		}
	);

	ipcMain.handle("transfer:cancel", () => {
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

	// ── Pairing identity ─────────────────────────────────
	/** Respond to the active pairing; accept=true confirms, else hang up. */
	const decidePairing = (accept: boolean): { ok: true } => {
		localDecision = accept;
		if (!activePeer) {
			return { ok: true };
		}
		if (accept) {
			acceptLocal();
		} else {
			if (pairedDevice) {
				activePeer.send(
					encodeSignal({ deviceId: pairedDevice.id, type: "pair-reject" })
				);
			}
			activePeer.close("pairing rejected locally");
		}
		return { ok: true };
	};

	ipcMain.handle("pair:accept", () => decidePairing(true));
	ipcMain.handle("pair:reject", () => decidePairing(false));

	// ── Trusted devices ──────────────────────────────
	ipcMain.handle("trust:list", () => ({
		devices: listTrustedDevices(),
		ok: true as const,
	}));

	ipcMain.handle("trust:revoke", (_event, id: string) => ({
		ok: untrustDevice(id),
	}));

	ipcMain.handle("device:get", () => ({
		ok: true as const,
		...localDevice,
	}));

	ipcMain.handle("device:setName", (_event, name: string) => {
		setDeviceName(name);
		localDevice.name = getDeviceName();
		return { name: localDevice.name, ok: true as const };
	});

	// ── Recent-transfers history ─────────────────────────────
	ipcMain.handle("history:list", () => ({
		ok: true as const,
		records: listTransfers(),
	}));

	ipcMain.handle("history:clear", () => {
		clearTransfers();
		return { ok: true as const };
	});

	app.on("before-quit", () => {
		seeder.destroy().catch(() => undefined);
		receiver.destroy().catch(() => undefined);
		swarm?.destroy().catch(() => undefined);
	});
}
