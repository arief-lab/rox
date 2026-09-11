// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * ProtomuxTransport — the pairing signaling transport.
 *
 * Implements the Transport port from @rox/core over a protomux
 * "rox/pairing" channel on a Hyperswarm connection. This is the real
 * peer channel that replaces the LocalTransport self-transfer pair:
 * the seeder and the receiver can now live in separate processes on
 * separate machines.
 *
 * Drive replication shares the same underlying connection: the session
 * attaches the drive's core replicators to the same Protomux instance
 * (metadata core immediately; blobs core once the header download opens
 * it). This transport carries only JSON signaling frames.
 */

import type {
	Transport,
	TransportCloseEvent,
	TransportMessage,
	TransportState,
} from "@rox/core";

/** The protocol string identifying Rox's pairing channel on a mux. */
export const PAIRING_PROTOCOL = "rox/pairing";

interface RawSocketLike {
	destroy(): unknown;
	once(event: string, handler: (...args: unknown[]) => void): unknown;
}

interface ChannelLike {
	open(): unknown;
	close(): unknown;
	addMessage(opts: {
		encoding: unknown;
		onmessage?: (data: unknown) => void;
	}): { send: (data: unknown) => void };
}

interface MuxLike {
	stream: RawSocketLike;
	createChannel(opts: { protocol: string; onclose?: () => void }): ChannelLike;
}

type MessageHandler = (event: TransportMessage) => void;
type CloseHandler = (event: TransportCloseEvent) => void;

export interface ProtomuxTransportOptions {
	/** The protomux instance multiplexing the peer connection. */
	mux: MuxLike;
	/** Called when the underlying connection closes. */
	onSocketClose?: (reason: string) => void;
}

/**
 * One side's handle on the shared pairing channel. Both peers create
 * one; sends land on the other's onmessage handlers.
 */
export class ProtomuxTransport implements Transport {
	private readonly options: ProtomuxTransportOptions;
	private readonly handlers = new Set<MessageHandler>();
	private readonly closeHandlers = new Set<CloseHandler>();
	private stateValue: TransportState = "connecting";
	private closeReasonValue: string | null = null;
	private readonly messageApi: { send: (data: unknown) => void };
	private readonly channel: ChannelLike;

	constructor(options: ProtomuxTransportOptions) {
		this.options = options;
		this.channel = this.options.mux.createChannel({
			onclose: () => this.handleClosed("peer closed the pairing channel"),
			protocol: PAIRING_PROTOCOL,
		});
		this.messageApi = this.channel.addMessage({
			encoding: getJsonEncoding(),
			onmessage: (data) => this.handleIncoming(data),
		});
		this.channel.open();
		this.options.mux.stream.once("close", () =>
			this.handleClosed("connection closed"),
		);
		this.options.mux.stream.once("error", (err: unknown) => {
			this.handleClosed(`connection error: ${String(err)}`);
		});
		// The channel may already be open (remote opened first).
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
		if (typeof data !== "string") {
			throw new Error("ProtomuxTransport carries JSON signaling only");
		}
		this.messageApi.send(data);
	}

	onmessage(handler: MessageHandler): () => void {
		this.handlers.add(handler);
		return () => this.handlers.delete(handler);
	}

	onclose(handler: CloseHandler): () => void {
		this.closeHandlers.add(handler);
		return () => this.closeHandlers.delete(handler);
	}

	close(reason?: string): void {
		this.handleClosed(reason ?? "local close");
		this.channel.close();
		this.options.mux.stream.destroy();
	}

	private handleIncoming(data: unknown): void {
		if (typeof data !== "string") {
			return;
		}
		const event: TransportMessage = { data };
		for (const handler of this.handlers) {
			handler(event);
		}
	}

	private handleClosed(reason: string): void {
		if (this.stateValue === "closed") {
			return;
		}
		this.stateValue = "closed";
		this.closeReasonValue = reason;
		const event: TransportCloseEvent = { reason };
		for (const handler of this.closeHandlers) {
			handler(event);
		}
		this.options.onSocketClose?.(reason);
	}
}

/**
 * compact-encoding is a hyperswarm/hypercore transitive dep resolved at
 * runtime; require it lazily so the module graph stays clean.
 */
let jsonEncoding: unknown = null;
function getJsonEncoding(): unknown {
	if (!jsonEncoding) {
		jsonEncoding = (require("compact-encoding") as { json: unknown }).json;
	}
	return jsonEncoding;
}
