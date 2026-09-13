import type { IpcRendererEvent } from "electron";
import { contextBridge, ipcRenderer, webUtils } from "electron";

/** Events streamed back from the main process during a transfer. */
export type TransferEvent =
	| {
			type: "peer";
			status: "connected" | "disconnected";
			/** The paired device, once it has said hello. */
			device: { id: string; name: string } | null;
			/** True once both sides accepted the pairing. */
			confirmed: boolean;
			/** True when the local accept came from the trust list. */
			trusted: boolean;
	  }
	| { type: "state"; kind: string }
	| { type: "error"; message: string }
	| { type: "done"; path?: string }
	| {
			bytes: number;
			direction: "send" | "receive";
			total: number;
			type: "progress";
	  };

export type TransferResult<S> =
	| ({ ok: true } & S)
	| { ok: false; error: string };

const handler = {
	// ── Device identity (pairing) ─────────────────────────
	device: {
		get(): Promise<{
			ok: true;
			id: string;
			name: string;
		}> {
			return ipcRenderer.invoke("device:get");
		},
		setName(name: string): Promise<{ ok: true; name: string }> {
			return ipcRenderer.invoke("device:setName", name);
		},
	},

	// ── File discovery ─────────────────────────────────────
	files: {
		/** Native open dialog; resolves with an absolute path or null. */
		browse(): Promise<{ ok: true; path: string | null }> {
			return ipcRenderer.invoke("files:browse");
		},
		/** Filename substring search across common user folders. */
		search(query: string): Promise<{ ok: true; results: string[] }> {
			return ipcRenderer.invoke("files:search", query);
		},
	},
	/** Resolve an absolute path for a dropped/selected File (webUtils). */
	getPathForFile(file: File): string {
		return webUtils.getPathForFile(file);
	},

	// ── Recent-transfers history ─────────────────────────
	history: {
		clear(): Promise<{ ok: true }> {
			return ipcRenderer.invoke("history:clear");
		},
		list(): Promise<{
			ok: true;
			records: import("./transfer/history").TransferRecord[];
		}> {
			return ipcRenderer.invoke("history:list");
		},
	},
	on<T>(channel: string, callback: (...args: T[]) => void) {
		const subscription = (_event: IpcRendererEvent, ...args: T[]) =>
			callback(...args);
		ipcRenderer.on(channel, subscription);

		return () => {
			ipcRenderer.removeListener(channel, subscription);
		};
	},

	// ── Pairing confirmation ─────────────────────────
	pair: {
		accept(): Promise<{ ok: true }> {
			return ipcRenderer.invoke("pair:accept");
		},
		reject(): Promise<{ ok: true }> {
			return ipcRenderer.invoke("pair:reject");
		},
	},
	/** Show a received file in the system file manager. */
	revealItem(
		filePath: string
	): Promise<{ ok: true } | { ok: false; error: string }> {
		return ipcRenderer.invoke("shell:revealItem", filePath);
	},
	send<T>(channel: string, value?: T) {
		ipcRenderer.send(channel, value);
	},

	// ── Transfer (Hyperdrive path) ────────────────────────────────
	transfer: {
		cancel(): Promise<TransferResult<Record<string, never>>> {
			return ipcRenderer.invoke("transfer:cancel");
		},
		/** Subscribe to transfer events; returns an unsubscribe function. */
		onEvent(callback: (event: TransferEvent) => void): () => void {
			const listener = (_event: IpcRendererEvent, payload: TransferEvent) =>
				callback(payload);
			ipcRenderer.on("transfer:event", listener);
			return () => ipcRenderer.removeListener("transfer:event", listener);
		},
		/** Replicate an offered drive; resolves with the saved file path. */
		receive(
			driveKey: string,
			topic: string
		): Promise<TransferResult<{ path: string }>> {
			return ipcRenderer.invoke("transfer:receive", driveKey, topic);
		},
		release(): Promise<TransferResult<Record<string, never>>> {
			return ipcRenderer.invoke("transfer:release");
		},
		/** Seed a local file; resolves once the drive is announced. */
		sendFile(
			filePath: string
		): Promise<
			TransferResult<{ driveKey: string; senderId: string; topic: string }>
		> {
			return ipcRenderer.invoke("transfer:send", filePath);
		},
	},

	// ── Trusted devices ─────────────────────────
	trust: {
		list(): Promise<{
			ok: true;
			devices: import("./transfer/trusted-devices").TrustedDevice[];
		}> {
			return ipcRenderer.invoke("trust:list");
		},
		revoke(id: string): Promise<{ ok: boolean }> {
			return ipcRenderer.invoke("trust:revoke", id);
		},
	},
};

contextBridge.exposeInMainWorld("ipc", handler);

export type IpcHandler = typeof handler;
