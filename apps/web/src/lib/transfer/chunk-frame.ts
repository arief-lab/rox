// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Chunk frame format and control messages for the Transfer layer.
 *
 * The PRD specifies the chunk frame as:
 *   { fileId: string, offset: number, length: number, payload: ArrayBuffer }
 *
 * Binary format on the wire (little-endian, packed):
 *   [fileIdLen: u32 LE][fileId: utf8 bytes][offset: u32 LE][length: u32 LE][payload: bytes]
 *
 * Control messages (file start) are sent as JSON strings over the same
 * Transport. The receiver distinguishes them by checking the message type.
 */

/** Per-chunk upper bound. The PRD sets this to 16 KB. */
export const CHUNK_SIZE = 16 * 1024;

/** A single chunk of a file in flight. */
export interface Chunk {
  /** UUID assigned per Transfer, included in every chunk so the receiver
   *  can reassemble one file at a time without an out-of-band handshake. */
  fileId: string;
  /** Bytes in this chunk's payload (≤ CHUNK_SIZE). */
  length: number;
  /** Byte offset within the file (u32). */
  offset: number;
  /** The bytes themselves. */
  payload: ArrayBuffer;
}

/** Sent once at the start of a Transfer, before any chunks. */
export interface StartMessage {
  fileId: string;
  name: string;
  totalSize: number;
  type: "start";
}

/**
 * Sent by the sender when the user cancels an in-flight Transfer. The
 * receiver aborts the current reassembly and rejects the receive
 * promise (so the Inbox stays untouched per the PRD invariant). The
 * DataChannel stays open so subsequent transfers on the same session
 * are not affected.
 */
export interface CancelMessage {
  fileId: string;
  type: "cancel";
}

const START_MARKER = "start" as const;
const CANCEL_MARKER = "cancel" as const;

/** Type guard for a cancel message. */
export function isCancelMessage(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === CANCEL_MARKER
    );
  } catch {
    return false;
  }
}

/** Decode a cancel message from a JSON string. Throws on malformed input. */
export function decodeCancel(text: string): CancelMessage {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { type?: unknown }).type !== CANCEL_MARKER
  ) {
    throw new Error("Not a cancel message");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.fileId !== "string") {
    throw new Error("Cancel message missing fileId");
  }
  return { type: CANCEL_MARKER, fileId: obj.fileId };
}

/**
 * Serialise a chunk to an ArrayBuffer for the Transport.
 * Layout: [fileIdLen: u32 LE][fileId: utf8][offset: u32 LE][length: u32 LE][payload].
 */
export function encodeChunk(chunk: Chunk): ArrayBuffer {
  const fileIdBytes = new TextEncoder().encode(chunk.fileId);
  const totalLength = 12 + fileIdBytes.length + chunk.payload.byteLength;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);
  view.setUint32(0, fileIdBytes.length, true);
  new Uint8Array(buffer, 4, fileIdBytes.length).set(fileIdBytes);
  view.setUint32(4 + fileIdBytes.length, chunk.offset, true);
  view.setUint32(8 + fileIdBytes.length, chunk.length, true);
  new Uint8Array(buffer, 12 + fileIdBytes.length, chunk.payload.byteLength).set(
    new Uint8Array(chunk.payload)
  );
  return buffer;
}

/**
 * Deserialise a chunk from an ArrayBuffer. Throws on malformed input.
 */
export function decodeChunk(buffer: ArrayBuffer): Chunk {
  const view = new DataView(buffer);
  if (buffer.byteLength < 12) {
    throw new Error("Chunk frame too short");
  }
  const fileIdLen = view.getUint32(0, true);
  if (buffer.byteLength < 12 + fileIdLen) {
    throw new Error("Chunk frame truncated (fileId)");
  }
  const fileId = new TextDecoder().decode(new Uint8Array(buffer, 4, fileIdLen));
  const offset = view.getUint32(4 + fileIdLen, true);
  const length = view.getUint32(8 + fileIdLen, true);
  if (buffer.byteLength !== 12 + fileIdLen + length) {
    throw new Error(
      `Chunk frame length mismatch: expected ${12 + fileIdLen + length}, got ${buffer.byteLength}`
    );
  }
  const payload = buffer.slice(12 + fileIdLen, 12 + fileIdLen + length);
  return { fileId, offset, length, payload };
}

/** Encode a start message as a JSON string (for the Transport). */
export function encodeStart(
  fileId: string,
  name: string,
  totalSize: number
): string {
  const msg: StartMessage = { type: START_MARKER, fileId, name, totalSize };
  return JSON.stringify(msg);
}

/** Encode a cancel message as a JSON string (for the Transport). */
export function encodeCancel(fileId: string): string {
  const msg: CancelMessage = { type: CANCEL_MARKER, fileId };
  return JSON.stringify(msg);
}

/** Decode a start message from a JSON string. Throws on malformed input. */
export function decodeStart(text: string): StartMessage {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { type?: unknown }).type !== START_MARKER
  ) {
    throw new Error("Not a start message");
  }
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.fileId !== "string" ||
    typeof obj.name !== "string" ||
    typeof obj.totalSize !== "number"
  ) {
    throw new Error("Start message missing required fields");
  }
  return {
    type: START_MARKER,
    fileId: obj.fileId,
    name: obj.name,
    totalSize: obj.totalSize,
  };
}
