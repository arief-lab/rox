// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * WorkletRpcClient — the host side of the worklet RPC seam.
 *
 * Wraps a Transport (BareTransport over worklet IPC) and speaks the
 * @rox/core worklet-rpc contract: correlated request/reply with
 * timeouts, plus event subscription for the worklet's pushes (peer
 * signaling, transfer state, progress).
 *
 * The public methods mirror the desktop session's IPC handlers
 * (transfer:send/receive/cancel/release, peers:discover, device:*) —
 * the native transfer UI drives this exactly like the desktop renderer
 * drives window.ipc, which is the whole point of the seam.
 */

import type { Transport } from "@rox/core";
import {
	decodeRpc,
	encodeRpc,
	type HyperSignal,
	makeRequest,
	parseSignal,
	type RpcCommand,
	RpcCommands,
	type RpcEvent,
	type RpcEventMessage,
	RpcEvents,
	type RpcWire,
} from "@rox/core";

/** Milliseconds to wait for a reply before rejecting. Generous: the
 * worklet does disk + network work inside transfer:send/receive. */
const REPLY_TIMEOUT_MS = 120_000;

export interface WorkletTransferResult {
	driveKey: string;
	senderId: string;
	topic: string;
}

/**
 * Copy a host-readable URI (image picker, expo-file-system, cache)
 * into the worklet sandbox and return a worklet-relative path for
 * transfer:send. The worklet's cwd IS the app sandbox, so bare-fs can
 * read the returned path directly.
 */
export async function stageFileForWorklet(
	sourceUri: string,
	fileName: string
): Promise<string> {
	const { File, Paths } = await import("expo-file-system");
	const dir = new File(Paths.cache, "rox-beam-staging");
	if (!dir.exists) {
		dir.create();
	}
	const dest = new File(dir, fileName);
	if (dest.exists) {
		dest.delete();
	}
	// Fetch → bytes → write: works for content:// URIs and file:// both.
	const response = await fetch(sourceUri);
	const bytes = new Uint8Array(await response.arrayBuffer());
	dest.write(bytes);
	return `rox-beam-staging/${fileName}`;
}

export interface WorkletPeer {
	id: string;
	name: string;
	trusted: boolean;
}

/** HyperTransferState re-exported for UI typing convenience. */
export type WorkletTransferState = import("@rox/core").HyperTransferState;

type SignalHandler = (signal: HyperSignal) => void;
type StateHandler = (state: WorkletTransferState) => void;
type ProgressHandler = (progress: {
	bytes: number;
	direction: "send" | "receive";
	total: number;
}) => void;
type DoneHandler = (path: string | null) => void;
type ErrorHandler = (message: string) => void;
type PeersHandler = (peers: WorkletPeer[]) => void;

export class WorkletRpcClient {
	private readonly transport: Transport;
	private nextId = 0;
	private readonly pending = new Map<
		number,
		{ reject: (error: Error) => void; resolve: (result: unknown) => void }
	>();
	private readonly unsubscribes: (() => void)[] = [];

	constructor(transport: Transport) {
		this.transport = transport;
		this.unsubscribes.push(
			this.transport.onmessage((event) => {
				this.handleFrame(event.data);
			})
		);
	}

	/** Tear down listeners (not the underlying transport). */
	dispose(): void {
		for (const unsubscribe of this.unsubscribes.splice(0)) {
			unsubscribe();
		}
	}

	// ── Command surface (mirrors desktop window.ipc.transfer) ──

	async sendFile(
		filePath: string,
		deviceId?: string
	): Promise<WorkletTransferResult> {
		const result = (await this.call(RpcCommands.TRANSFER_SEND, {
			deviceId,
			filePath,
		})) as WorkletTransferResult;
		return result;
	}

	receive(driveKey: string, topic: string): Promise<{ path: string }> {
		return this.call(RpcCommands.TRANSFER_RECEIVE, {
			driveKey,
			topic,
		}) as Promise<{ path: string }>;
	}

	async cancel(): Promise<void> {
		await this.call(RpcCommands.TRANSFER_CANCEL);
	}

	release(): Promise<void> {
		return this.call(RpcCommands.TRANSFER_RELEASE) as Promise<void>;
	}

	async discoverPeers(): Promise<WorkletPeer[]> {
		const result = (await this.call(RpcCommands.PEERS_DISCOVER)) as {
			peers: WorkletPeer[];
		};
		return result.peers;
	}

	// ── Event surface ─────────────────────────────────────────

	onSignal(handler: SignalHandler): () => void {
		return this.onEvent(RpcEvents.SIGNAL, (payload) => {
			handler(parseSignal(payload as string));
		});
	}

	onState(handler: StateHandler): () => void {
		return this.onEvent(RpcEvents.STATE, (payload) => {
			handler(payload as WorkletTransferState);
		});
	}

	onProgress(handler: ProgressHandler): () => void {
		return this.onEvent(RpcEvents.PROGRESS, (payload) => {
			handler(payload as Parameters<ProgressHandler>[0]);
		});
	}

	onDone(handler: DoneHandler): () => void {
		return this.onEvent(RpcEvents.DONE, (payload) => {
			handler((payload as { path?: string } | null)?.path ?? null);
		});
	}

	onError(handler: ErrorHandler): () => void {
		return this.onEvent(RpcEvents.ERROR, (payload) => {
			handler((payload as { message: string }).message);
		});
	}

	onPeers(handler: PeersHandler): () => void {
		return this.onEvent(RpcEvents.PEERS, (payload) => {
			handler((payload as { peers: WorkletPeer[] }).peers);
		});
	}

	// ── Internals ─────────────────────────────────────────────

	private call(command: RpcCommand, payload?: unknown): Promise<unknown> {
		const id = this.nextId;
		this.nextId += 1;
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`worklet rpc ${command} timed out`));
			}, REPLY_TIMEOUT_MS);
			this.pending.set(id, {
				reject: (error: Error) => {
					clearTimeout(timeout);
					reject(error);
				},
				resolve: (result: unknown) => {
					clearTimeout(timeout);
					resolve(result);
				},
			});
			this.transport.send(encodeRpc(makeRequest(id, command, payload)));
		});
	}

	private onEvent(
		event: RpcEvent,
		handler: (payload: unknown) => void
	): () => void {
		return this.transport.onmessage((message) => {
			const frame = this.tryDecode(message.data);
			if (
				frame !== null &&
				frame.kind === "evt" &&
				(frame as RpcEventMessage).event === event
			) {
				handler((frame as RpcEventMessage).payload);
			}
		});
	}

	private handleFrame(data: string | ArrayBuffer): void {
		const frame = this.tryDecode(data);
		if (frame === null) {
			return;
		}
		if (frame.kind === "res") {
			const pending = this.pending.get(frame.id);
			if (pending === undefined) {
				return;
			}
			this.pending.delete(frame.id);
			if (frame.ok) {
				pending.resolve(frame.result);
			} else {
				pending.reject(new Error(frame.error ?? "worklet rpc failed"));
			}
		}
		// Events are handled by the per-event onmessage subscriptions.
	}

	private tryDecode(data: string | ArrayBuffer): RpcWire | null {
		if (typeof data !== "string") {
			return null;
		}
		try {
			return decodeRpc(data);
		} catch {
			// Not an RPC frame (foreign JSON, noise) — ignore like the
			// BeamReceiver ignores non-Rox QR payloads.
			return null;
		}
	}
}
