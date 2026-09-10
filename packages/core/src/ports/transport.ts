// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transport — the abstract data channel the rest of the app uses.
 *
 * The domain layer depends only on this shape. Concrete transports
 * (Pear/Hyperswarm in the desktop main process, WebRTC DataChannel in
 * the browser, an in-memory fake in tests) implement this interface,
 * making the transport seam fully substitutable.
 */

export type TransportState = "connecting" | "open" | "closing" | "closed";

export interface TransportMessage {
	data: string | ArrayBuffer;
}

export interface TransportCloseEvent {
	reason: string;
}

export interface Transport {
	/** Close the channel with an optional reason. Idempotent. */
	close: (reason?: string) => void;
	/** Reason the transport closed, if it did. */
	readonly closeReason: string | null;
	/** Subscribe to close events. Returns an unsubscribe function. */
	onclose: (handler: (event: TransportCloseEvent) => void) => () => void;
	/** Subscribe to incoming frames. Returns an unsubscribe function. */
	onmessage: (handler: (event: TransportMessage) => void) => () => void;
	/** Send a frame (binary chunk or JSON control message). Throws if not open. */
	send: (data: string | ArrayBuffer) => void;
	/** Current connection state of the underlying channel. */
	readonly state: TransportState;
}
