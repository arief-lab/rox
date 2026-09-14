// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * BareTransport — the native pairing signaling transport.
 *
 * Implements the Transport port from @rox/core over the Bare worklet's
 * IPC duplex stream. The worklet is the native data plane: the hyper
 * signaling machine runs inside Bare, and this adapter is the typed
 * pipe between it and React Native UI state — the native twin of the
 * desktop's ProtomuxTransport (same port, same domain, different host
 * shell).
 *
 * Framing: the IPC stream is a raw duplex of byte chunks with no
 * message boundaries. Transport.send() frames are length-prefixed
 * (u32 LE length + payload) on the wire; the receive side buffers and
 * splits frames so concurrent messages cannot interleave.
 */

import type {
	Transport,
	TransportCloseEvent,
	TransportMessage,
	TransportState,
} from "@rox/core";
import b4a from "b4a";

/** Minimal structural type of the worklet's IPC duplex (streamx). */
interface IpcDuplex {
	destroy: () => unknown;
	on: (event: string, handler: (...args: unknown[]) => void) => unknown;
	write: (data: Uint8Array) => unknown;
}

const LENGTH_PREFIX_BYTES = 4;

type MessageHandler = (event: TransportMessage) => void;
type CloseHandler = (event: TransportCloseEvent) => void;

export class BareTransport implements Transport {
	private readonly socket: IpcDuplex;
	private readonly messageHandlers = new Set<MessageHandler>();
	private readonly closeHandlers = new Set<CloseHandler>();
	private stateValue: TransportState = "connecting";
	private closeReasonValue: string | null = null;
	/** Accumulates raw stream bytes until full frames are present. */
	private buffer: Uint8Array = b4a.alloc(0);

	constructor(socket: IpcDuplex) {
		this.socket = socket;
		this.socket.on("data", (...args: unknown[]) => {
			const [chunk] = args;
			if (chunk instanceof Uint8Array) {
				this.buffer = b4a.concat([this.buffer, b4a.from(chunk)]);
				this.drainFrames();
			}
		});
		this.socket.on("close", () => {
			this.handleClosed("worklet IPC closed");
		});
		this.socket.on("error", (error: unknown) => {
			this.handleClosed(`worklet IPC error: ${String(error)}`);
		});
		// IPC is live as soon as the worklet started; no handshake needed.
		this.stateValue = "open";
	}

	get state(): TransportState {
		return this.stateValue;
	}

	get closeReason(): string | null {
		return this.closeReasonValue;
	}

	send(data: string | ArrayBuffer): void {
		if (this.stateValue !== "open") {
			throw new Error(`Transport is ${this.stateValue}, cannot send`);
		}
		const payload =
			typeof data === "string"
				? b4a.from(data)
				: b4a.from(new Uint8Array(data));
		// u32 LE length prefix, then the payload.
		const header = b4a.alloc(LENGTH_PREFIX_BYTES);
		const view = new DataView(header.buffer);
		view.setUint32(0, payload.byteLength, true);
		this.socket.write(b4a.concat([header, payload]));
	}

	onmessage(handler: MessageHandler): () => void {
		this.messageHandlers.add(handler);
		return () => {
			this.messageHandlers.delete(handler);
		};
	}

	onclose(handler: CloseHandler): () => void {
		this.closeHandlers.add(handler);
		return () => {
			this.closeHandlers.delete(handler);
		};
	}

	close(reason = "local close"): void {
		if (this.stateValue === "closed") {
			return;
		}
		this.socket.destroy();
		this.handleClosed(reason);
	}

	/** Split complete length-prefixed frames off the buffer. */
	private drainFrames(): void {
		for (;;) {
			if (this.buffer.byteLength < LENGTH_PREFIX_BYTES) {
				return;
			}
			const length = new DataView(
				this.buffer.buffer,
				this.buffer.byteOffset
			).getUint32(0, true);
			const end = LENGTH_PREFIX_BYTES + length;
			if (this.buffer.byteLength < end) {
				return;
			}
			const payload = this.buffer.subarray(LENGTH_PREFIX_BYTES, end);
			this.buffer = this.buffer.subarray(end);
			const event: TransportMessage = { data: b4a.toString(payload) };
			for (const handler of this.messageHandlers) {
				handler(event);
			}
		}
	}

	private handleClosed(reason: string): void {
		if (this.stateValue === "closed") {
			return;
		}
		this.stateValue = "closed";
		this.closeReasonValue = reason;
		for (const handler of this.closeHandlers) {
			handler({ reason });
		}
	}
}
