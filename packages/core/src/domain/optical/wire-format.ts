// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optical wire format — the frames that ride inside QR codes.
 *
 * A transfer is announced by one HEADER frame (file identity and
 * chunking parameters), followed by an endless stream of SYMBOL frames
 * (fountain-coded payloads). Frames are length-prefixed and carry an
 * encoding flag so the same logical frame can ride a QR either as raw
 * bytes (raw-pixel decoders, byte-mode QR) or as base64 text (native
 * barcode scanners that only expose string payloads).
 *
 * Layout (big-endian):
 *   offset 0:  u8  magic "R" (0x52) — fast sanity check after QR decode
 *   offset 1:  u8  frameType (1 = header, 2 = symbol)
 *   offset 2:  u8  encoding   (0 = binary, 1 = base64 text payload)
 *   offset 3:  u8  reserved  (0)
 *   offset 4:  u32 frame payload length (bytes, excluding this header)
 *   offset 8:  payload
 *
 * Header payload:
 *   16 bytes fileId (hex-encoded on the wire as ASCII in text mode;
 *   raw 8 bytes when binary — both carry the same 16-hex-char id, see
 *   encoding rules below) + u32 pieceCount + u32 pieceSize +
 *   u32 originalLength + 32 bytes sha256.
 *
 * To keep ONE layout for both encodings, identity and hash fields are
 * always hex ASCII inside the payload: fileId = 16 ASCII chars, sha256
 * = 64 ASCII chars. Header payload length is therefore
 * 16 + 4 + 4 + 4 + 64 = 92 bytes regardless of encoding flag.
 *
 * Symbol payload (binary encoding):
 *   u32 seed + pieceSize bytes of XOR payload.
 * Symbol payload (text encoding):
 *   u32 seed + base64(payload) — the base64 string is stored in the
 *   frame payload after the seed; decoders detect it by the flag.
 */

import { z } from "zod";

export const FRAME_MAGIC = 0x52; // "R"
export const HEADER_FRAME_TYPE = 1;
export const SYMBOL_FRAME_TYPE = 2;
export const BINARY_ENCODING = 0;
export const TEXT_ENCODING = 1;

/** Byte length of the fixed frame preamble (magic..payload length). */
export const FRAME_PREAMBLE_BYTES = 8;
/** Byte length of a header payload (fileId16 + 3×u32 + sha256-64, ASCII). */
export const HEADER_PAYLOAD_BYTES = 92;

const FILE_ID_BYTES = 16;
const U32_BYTES = 4;

/** Validated file metadata carried by every header frame. */
export const opticalHeaderSchema = z.object({
	/** 16-char lowercase hex identifier for this transfer. */
	fileId: z.string().regex(/^[0-9a-f]{16}$/),
	/** Exact byte length of the original file. */
	originalLength: z.number().int().positive(),
	/** Number of source pieces the file was split into. */
	pieceCount: z.number().int().positive(),
	/** Byte length of every piece except the last (which may be shorter). */
	pieceSize: z.number().int().positive(),
	/** Lowercase hex SHA-256 of the original file. */
	sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type OpticalHeader = z.infer<typeof opticalHeaderSchema>;

/** Non-negative 32-bit integer (zod v4 has no .uint()). */
const u32Schema = z.number().int().min(0).max(0xff_ff_ff_ff);

/** Payload-carrying frame: one fountain symbol. */
export const opticalSymbolSchema = z.object({
	/** XOR payload — raw bytes (binary) or base64 text (text encoding). */
	payload: z.union([z.instanceof(Uint8Array), z.string()]),
	/** Deterministic PRNG seed that generated this symbol. */
	seed: u32Schema,
});
export type OpticalSymbol = z.infer<typeof opticalSymbolSchema>;

/** How the payload bytes are represented inside the frame. */
export type FrameEncoding = typeof BINARY_ENCODING | typeof TEXT_ENCODING;

function writeU32(target: Uint8Array, offset: number, value: number): void {
	new DataView(target.buffer, target.byteOffset, target.byteLength).setUint32(
		offset,
		value,
		false
	);
}

function readU32(source: Uint8Array, offset: number): number {
	return new DataView(
		source.buffer,
		source.byteOffset,
		source.byteLength
	).getUint32(offset, false);
}

function encodeAscii(text: string): Uint8Array {
	const bytes = new Uint8Array(text.length);
	for (let index = 0; index < text.length; index += 1) {
		bytes[index] = text.charCodeAt(index);
	}
	return bytes;
}

function decodeAscii(bytes: Uint8Array, start: number, end: number): string {
	let text = "";
	for (let index = start; index < end; index += 1) {
		text += String.fromCharCode(bytes[index] ?? 0);
	}
	return text;
}

/** Encode a header's logical fields into its 92-byte payload. */
function headerToPayload(header: OpticalHeader): Uint8Array {
	const payload = new Uint8Array(HEADER_PAYLOAD_BYTES);
	payload.set(encodeAscii(header.fileId), 0);
	let offset = FILE_ID_BYTES;
	writeU32(payload, offset, header.pieceCount);
	offset += U32_BYTES;
	writeU32(payload, offset, header.pieceSize);
	offset += U32_BYTES;
	writeU32(payload, offset, header.originalLength);
	offset += U32_BYTES;
	payload.set(encodeAscii(header.sha256), offset);
	return payload;
}

/** Parse and validate a 92-byte header payload. */
function headerFromPayload(payload: Uint8Array): OpticalHeader {
	if (payload.byteLength !== HEADER_PAYLOAD_BYTES) {
		throw new Error(
			`Header payload must be ${HEADER_PAYLOAD_BYTES} bytes, got ${payload.byteLength}`
		);
	}
	return opticalHeaderSchema.parse({
		fileId: decodeAscii(payload, 0, FILE_ID_BYTES),
		originalLength: readU32(payload, FILE_ID_BYTES + 2 * U32_BYTES),
		pieceCount: readU32(payload, FILE_ID_BYTES),
		pieceSize: readU32(payload, FILE_ID_BYTES + U32_BYTES),
		sha256: decodeAscii(
			payload,
			FILE_ID_BYTES + 3 * U32_BYTES,
			payload.byteLength
		),
	});
}

/**
 * Serialize a header frame. `encoding` selects how the QR will carry
 * the payload — the frame layout is identical either way (hex fields
 * are ASCII in both), so text and binary transports interoperate.
 */
export function encodeHeaderFrame(
	header: OpticalHeader,
	encoding: FrameEncoding = BINARY_ENCODING
): Uint8Array {
	const payload = headerToPayload(header);
	return wrapFrame(HEADER_FRAME_TYPE, encoding, payload);
}

/**
 * Serialize a symbol frame. In text encoding the payload is base64
 * (produced by the caller from raw bytes); in binary encoding it is
 * the raw XOR bytes.
 */
export function encodeSymbolFrame(
	symbol: OpticalSymbol,
	encoding: FrameEncoding = BINARY_ENCODING
): Uint8Array {
	if (encoding === TEXT_ENCODING) {
		if (typeof symbol.payload !== "string") {
			throw new Error(
				"Text-encoding a symbol requires a base64 string payload"
			);
		}
		// Text symbol payload = u32 seed (raw) + base64 string. The seed
		// stays binary so both encodings share the seed layout; only the
		// XOR payload differs.
		const payload = new Uint8Array(U32_BYTES + symbol.payload.length);
		writeU32(payload, 0, symbol.seed);
		payload.set(encodeAscii(symbol.payload), U32_BYTES);
		return wrapFrame(SYMBOL_FRAME_TYPE, TEXT_ENCODING, payload);
	}
	if (!(symbol.payload instanceof Uint8Array)) {
		throw new Error("Binary-encoding a symbol requires Uint8Array payload");
	}
	// Binary symbol payload = u32 seed + raw XOR bytes.
	const payload = new Uint8Array(U32_BYTES + symbol.payload.byteLength);
	writeU32(payload, 0, symbol.seed);
	payload.set(symbol.payload, U32_BYTES);
	return wrapFrame(SYMBOL_FRAME_TYPE, BINARY_ENCODING, payload);
}

function wrapFrame(
	frameType: number,
	encoding: FrameEncoding,
	payload: Uint8Array
): Uint8Array {
	const frame = new Uint8Array(FRAME_PREAMBLE_BYTES + payload.byteLength);
	frame[0] = FRAME_MAGIC;
	frame[1] = frameType;
	frame[2] = encoding;
	frame[3] = 0;
	writeU32(frame, 4, payload.byteLength);
	frame.set(payload, FRAME_PREAMBLE_BYTES);
	return frame;
}

/** The result of decoding one frame off the wire. */
export type DecodedFrame =
	| { type: "header"; header: OpticalHeader }
	| { type: "symbol"; symbol: OpticalSymbol };

/**
 * Decode a frame from raw bytes (as delivered by a QR decoder). Text
 * encoding is returned with the payload as a base64 string; binary as
 * Uint8Array. Throws on magic/type/length mismatch or invalid fields.
 */
export function decodeFrame(frame: Uint8Array): DecodedFrame {
	if (frame.byteLength < FRAME_PREAMBLE_BYTES) {
		throw new Error(`Frame too short: ${frame.byteLength} bytes`);
	}
	if (frame[0] !== FRAME_MAGIC) {
		throw new Error(`Bad magic: 0x${(frame[0] ?? 0).toString(16)}`);
	}
	const [frameType, encoding] = [frame[1], frame[2]];
	const payloadLength = readU32(frame, 4);
	const expected = FRAME_PREAMBLE_BYTES + payloadLength;
	if (frame.byteLength !== expected) {
		throw new Error(
			`Length mismatch: preamble says ${expected}, frame is ${frame.byteLength}`
		);
	}
	const payload = frame.subarray(FRAME_PREAMBLE_BYTES);
	if (frameType === HEADER_FRAME_TYPE) {
		if (payload.byteLength !== HEADER_PAYLOAD_BYTES) {
			throw new Error("Header payload has the wrong length");
		}
		return { header: headerFromPayload(payload), type: "header" };
	}
	if (frameType === SYMBOL_FRAME_TYPE) {
		if (encoding === TEXT_ENCODING) {
			return {
				symbol: opticalSymbolSchema.parse({
					payload: decodeAscii(payload, U32_BYTES, payload.byteLength),
					seed: readU32(payload, 0),
				}),
				type: "symbol",
			};
		}
		if (payload.byteLength <= U32_BYTES) {
			throw new Error("Binary symbol payload too short for a seed");
		}
		return {
			symbol: opticalSymbolSchema.parse({
				payload: payload.slice(U32_BYTES),
				seed: readU32(payload, 0),
			}),
			type: "symbol",
		};
	}
	throw new Error(`Unknown frame type: ${String(frameType)}`);
}
