// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transfer session over IPC — the renderer-facing data plane.
 *
 * Wires the Hyperdrive adapter to the renderer via typed IPC channels:
 *  - `transfer:send`    — seed a file, returns { driveKey, topic }
 *  - `transfer:receive` — replicate an offered drive, returns saved path
 *  - `transfer:cancel`  — stop seeding / abort receiving
 * Progress and errors stream back on `transfer:event`.
 *
 * For slice 1 the two sides of a transfer run in the same app process
 * (self-transfer demo). When pairing lands, `transport` becomes the
 * real peer channel and these channels stay identical for the renderer.
 */

import path from "node:path";
import { HyperTransferMachine, type Transport } from "@rox/core";
import { app, ipcMain } from "electron";

import { HyperReceiver, HyperSeeder, pumpSignals } from "./hyper-adapter";

type TransferEvent =
	| { type: "state"; kind: string }
	| { type: "error"; message: string }
	| { type: "done"; path?: string };

const storageDir = path.join(app.getPath("userData"), "transfer");

/**
 * Minimal in-process Transport pair so the seeder and receiver can
 * exchange signaling without a real peer connection (self-transfer
 * demo mode). Replaced by a real peer Transport once pairing lands.
 */
class LocalTransport implements Transport {
	readonly state = "open" as const;
	closeReason: string | null = null;
	private readonly handlers = new Set<
		(event: { data: string | ArrayBuffer }) => void
	>();
	/** The opposite side this transport sends into. */
	private peer: LocalTransport | null = null;

	/** Cross-wire two transports so sends land on each other's handlers. */
	static pair(): [LocalTransport, LocalTransport] {
		const a = new LocalTransport();
		const b = new LocalTransport();
		a.peer = b;
		b.peer = a;
		return [a, b];
	}

	send(data: string | ArrayBuffer): void {
		// Sending delivers to the *peer's* message handlers.
		this.peer?.dispatch(data);
	}

	onmessage(
		handler: (event: { data: string | ArrayBuffer }) => void
	): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	onclose(): () => void {
		return () => undefined;
	}

	close(): void {
		this.handlers.clear();
	}

	private dispatch(data: string | ArrayBuffer): void {
		for (const handler of this.handlers) {
			handler({ data });
		}
	}
}

export function registerTransferHandlers(win: Electron.BrowserWindow): void {
	const [peerTransport, selfTransport] = LocalTransport.pair();
	const machine = new HyperTransferMachine();
	const seeder = new HyperSeeder(storageDir, peerTransport);
	const receiver = new HyperReceiver(storageDir, peerTransport);

	const emit = (event: TransferEvent): void => {
		if (!win.isDestroyed()) {
			win.webContents.send("transfer:event", event);
		}
	};
	const emitState = (): void =>
		emit({ kind: machine.getState().kind, type: "state" });

	// React to signaling coming back from the peer side.
	pumpSignals(selfTransport, (signal) => {
		if (signal.type === "hyper-accepted") {
			emitState();
		}
	});

	ipcMain.handle("transfer:send", async (_event, filePath: string) => {
		try {
			// The seeder itself transitions to offering on its own machine;
			// mirror the state here for renderer-facing progress.
			machine.startOffering("pending", "pending", filePath);
			emitState();
			const result = await seeder.seed(filePath);
			return { ok: true as const, ...result };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			machine.fail(message);
			emitState();
			emit({ message, type: "error" });
			return { error: message, ok: false as const };
		}
	});

	ipcMain.handle(
		"transfer:receive",
		async (_event, driveKey: string, topic: string) => {
			try {
				machine.startReceiving(driveKey, topic);
				emitState();
				const savedPath = await receiver.receive(
					driveKey,
					topic,
					path.join(storageDir, "downloads")
				);
				machine.complete();
				emitState();
				emit({ path: savedPath, type: "done" });
				return { ok: true as const, path: savedPath };
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				machine.fail(message);
				emitState();
				emit({ message, type: "error" });
				return { error: message, ok: false as const };
			}
		}
	);

	ipcMain.handle("transfer:cancel", async () => {
		machine.cancel();
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
	});
}
