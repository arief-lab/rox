// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optical beam sender — the desktop "Beam via screen" data plane.
 *
 * Reads the chosen file in the main process (full Node), splits it into
 * fountain pieces via @rox/core's optical codec, and hands the renderer
 * a ready-to-loop list of QR payload strings (one base64 text frame per
 * QR, same wire format the native app scans — cross-device compatible).
 *
 * The renderer never touches the file bytes: payloads are precomputed
 * here and shipped over IPC once; the beam screen just cycles through
 * them fullscreen.
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
	encodeHeaderFrame,
	encodeSymbolFrame,
	generateSymbol,
	splitIntoPieces,
	TEXT_ENCODING,
} from "@rox/core";
import { ipcMain } from "electron";

/**
 * QR payload size ceiling. Version-40 QR holds ~2,953 bytes in byte
 * mode, but dense codes scan poorly off a screen — keep frames small
 * enough for a phone camera to read at arm's length. Must match the
 * piece size the native receiver assumes for text frames (120-byte
 * payloads base64 → ~164 chars + frame/seed overhead ≈ 250 chars).
 */
const PIECE_SIZE = 120;

/** Symbols per loop cycle: pieces × overhead for small-K peeling. */
const STREAM_OVERHEAD = 3;
const MIN_STREAM_LENGTH = 20;

export interface BeamPrepareResult {
	/** Base64 text frames, in loop order; index -1 (header) is frames[0]. */
	frames: string[];
	/** Suggested receiver filename. */
	name: string;
	/** Bytes of the original file (shown as progress context). */
	originalLength: number;
	/** Piece count the receiver needs to peel (progress denominator). */
	pieceCount: number;
}

/** Frame bytes → base64 string (the QR payload the phone scans). */
const toQrPayload = (frame: Uint8Array): string =>
	Buffer.from(frame).toString("base64");

export function registerBeamHandlers(): void {
	ipcMain.handle(
		"beam:prepare",
		(_event, filePath: string, name: string): BeamPrepareResult => {
			const file = new Uint8Array(readFileSync(filePath));
			const sha256 = createHash("sha256").update(file).digest("hex");
			const { pieceCount, pieces } = splitIntoPieces(file, PIECE_SIZE);
			const fileId = sha256.slice(0, 16);
			const header = {
				fileId,
				originalLength: file.byteLength,
				pieceCount,
				pieceSize: PIECE_SIZE,
				sha256,
			};

			// Header frame first, then the deterministic symbol loop.
			const frames = [toQrPayload(encodeHeaderFrame(header, TEXT_ENCODING))];
			const streamLength = Math.max(
				Math.ceil(pieceCount * STREAM_OVERHEAD),
				MIN_STREAM_LENGTH
			);
			for (let index = 0; index < streamLength; index += 1) {
				const seed = index + 1;
				const symbol = generateSymbol(pieces, seed);
				frames.push(
					toQrPayload(
						encodeSymbolFrame(
							{
								payload: Buffer.from(symbol.payload).toString("base64"),
								seed,
							},
							TEXT_ENCODING
						)
					)
				);
			}

			return { frames, name, originalLength: file.byteLength, pieceCount };
		}
	);
}
