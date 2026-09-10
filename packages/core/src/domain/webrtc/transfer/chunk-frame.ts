// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Chunk frame format and control messages for the Transfer layer.
 *
 * Binary frame on the wire (little-endian, packed):
 *   [fileIdLen: u32 LE][fileId: utf8 bytes][offset: u32 LE][length: u32 LE][payload: bytes]
 *
 * Control messages (start/cancel) are sent as JSON strings over the
 * same Transport. The receiver distinguishes them by message type.
 */

/** Per-chunk upper bound. */
export const CHUNK_SIZE = 16 * 1024;

/** A single chunk of a file in flight. */
export interface Chunk {
	/** UUID assigned per transfer, included in every chunk so the receiver
	 * can reassemble one file at a time without an out-of-band handshake. */
	fileId: string;
	/** Bytes in this chunk's payload (≤ CHUNK_SIZE). */
	length: number;
	/** Byte offset within the file (u32). */
	offset: number;
	/** The bytes themselves. */
	payload: ArrayBuffer;
}

/** Sent once at the start of a transfer, before any chunks. */
export interface StartMessage {
	fileId: string;
	name: string;
	totalSize: number;
	type: "start";
}

/**
 * Sent by the sender when the user cancels an in-flight transfer. The
 * receiver aborts reassembly and rejects the receive promise (the inbox
 * stays untouched). The transport stays open so subsequent transfers on
 * the same session are unaffected.
 */
export interface CancelMessage {
	fileId: string;
	type: "cancel";
}

export type ControlMessage = StartMessage | CancelMessage;

/** True when a raw transport message is a JSON control message. */
export function isControlMessage(data: string | ArrayBuffer): data is string {
	return typeof data === "string" && data.startsWith('{"type":');
}

/** Parse a control message string, throwing on unknown shapes. */
export function parseControlMessage(raw: string): ControlMessage {
	const msg = JSON.parse(raw) as ControlMessage;
	if (msg.type !== "start" && msg.type !== "cancel") {
		throw new Error(
			`Unknown control message type: ${String((msg as { type?: string }).type)}`
		);
	}
	return msg;
}

/** Encode a chunk into the binary wire format. */
export function encodeChunk(chunk: Chunk): ArrayBuffer {
	const fileIdBytes = new TextEncoder().encode(chunk.fileId);
	const frame = new ArrayBuffer(
		12 + fileIdBytes.byteLength + chunk.payload.byteLength
	);
	const view = new DataView(frame);
	const bytes = new Uint8Array(frame);

	view.setUint32(0, fileIdBytes.byteLength, true);
	bytes.set(fileIdBytes, 4);
	view.setUint32(4 + fileIdBytes.byteLength, chunk.offset, true);
	view.setUint32(8 + fileIdBytes.byteLength, chunk.length, true);
	bytes.set(new Uint8Array(chunk.payload), 12 + fileIdBytes.byteLength);

	return frame;
}

/** Decode a binary wire frame back into a chunk. */
export function decodeChunk(frame: ArrayBuffer): Chunk {
	const view = new DataView(frame);
	const bytes = new Uint8Array(frame);

	const fileIdLen = view.getUint32(0, true);
	const fileId = new TextDecoder().decode(bytes.subarray(4, 4 + fileIdLen));
	const offset = view.getUint32(4 + fileIdLen, true);
	const length = view.getUint32(8 + fileIdLen, true);
	const payload = frame.slice(12 + fileIdLen, 12 + fileIdLen + length);

	return { fileId, length, offset, payload };
}
