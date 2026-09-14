// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam session glue — bridges @rox/core's optical codec to React state.
 *
 * Sender side: build a BeamSession from text (first cut; file picking
 * needs a dev build + expo-document-picker) and step through fountain
 * symbols for QR rendering.
 *
 * Receiver side: feed scanned strings into a BeamReceiver; it decodes
 * header/symbol frames, peels, verifies SHA-256, and reports progress.
 */

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
	decodeFrame,
	encodeHeaderFrame,
	encodeSymbolFrame,
	generateSymbol,
	type OpticalHeader,
	type PeelResult,
	peelSymbols,
	splitIntoPieces,
	TEXT_ENCODING,
} from "@rox/core";

const PIECE_SIZE = 120;

/** Verified receive outcome surfaced to the completion screen. */
export interface BeamResult {
	sha256: string;
	suggestedName: string;
	text: string;
}

/** Symmetric sender handle: header + deterministic symbol generator. */
export interface BeamSession {
	header: OpticalHeader;
	/** QR payload string (base64 text encoding) for a loop position. */
	qrPayloadAt: (index: number) => string;
	/** Total symbols to loop through per cycle (>= pieces for safety). */
	streamLength: number;
	/** Symbol frame bytes for a position in the loop. */
	symbolFrameAt: (index: number) => Uint8Array;
}

/** Build a beam session from UTF-8 text. */
export function createBeamSession(text: string): BeamSession {
	const file = Buffer.from(text, "utf8");
	const sha256 = createHash("sha256").update(file).digest("hex");
	const { pieceCount, pieces } = splitIntoPieces(
		new Uint8Array(file),
		PIECE_SIZE
	);
	// Random-ish but stable-per-session file id from the content hash.
	const fileId = sha256.slice(0, 16);
	const header: OpticalHeader = {
		fileId,
		originalLength: file.byteLength,
		pieceCount,
		pieceSize: PIECE_SIZE,
		sha256,
	};
	// Stream length: peeling needs more overhead at small piece counts
	// (verified empirically: 9-piece messages complete around 2-4x the
	// piece count; asymptotic 1.15x needs much larger K). The loop wraps,
	// so the receiver keeps collecting on later cycles regardless.
	const streamLength = Math.max(Math.ceil(pieceCount * 3), 20);

	const headerFrame = Buffer.from(
		encodeHeaderFrame(header, TEXT_ENCODING)
	).toString("base64");

	return {
		header,
		qrPayloadAt(index: number): string {
			if (index < 0) {
				return headerFrame;
			}
			const seed = index + 1;
			const symbol = generateSymbol(pieces, seed);
			const frame = encodeSymbolFrame(
				{ payload: Buffer.from(symbol.payload).toString("base64"), seed },
				TEXT_ENCODING
			);
			return Buffer.from(frame).toString("base64");
		},
		streamLength,
		symbolFrameAt(index: number): Uint8Array {
			const seed = index + 1;
			const symbol = generateSymbol(pieces, seed);
			return encodeSymbolFrame(
				{ payload: Buffer.from(symbol.payload).toString("base64"), seed },
				TEXT_ENCODING
			);
		},
	};
}

/**
 * Receiver accumulator. QR scans arrive as base64(frame) strings; we
 * decode, keep the header, collect symbols, and re-peel on each new
 * symbol until the file reconstructs and verifies.
 */
export class BeamReceiver {
	private header: OpticalHeader | null = null;
	private readonly symbols: { payload: Uint8Array; seed: number }[] = [];

	get progress(): { collected: number; needed: number; decoded: number } {
		const needed = this.header?.pieceCount ?? 0;
		const peel = this.header ? this.tryPeel() : null;
		return {
			collected: this.symbols.length,
			decoded: peel?.decodedPieces ?? 0,
			needed,
		};
	}

	get isComplete(): boolean {
		return this.completedFile !== null;
	}

	get result(): BeamResult | null {
		if (this.completedFile === null || this.header === null) {
			return null;
		}
		return {
			sha256: this.header.sha256,
			suggestedName: `beam-${this.header.fileId}.txt`,
			text: Buffer.from(this.completedFile).toString("utf8"),
		};
	}

	private completedFile: Uint8Array | null = null;

	/** Ingest one scanned QR payload; returns true when transfer completes. */
	ingest(payload: string): boolean {
		if (this.completedFile !== null) {
			return true;
		}
		let frame: Uint8Array;
		try {
			frame = new Uint8Array(Buffer.from(payload, "base64"));
		} catch {
			return false;
		}
		let decoded: ReturnType<typeof decodeFrame>;
		try {
			decoded = decodeFrame(frame);
		} catch {
			// Not a Rox frame (foreign QR) — ignore.
			return false;
		}
		if (decoded.type === "header") {
			// A restart of the sender's loop resets the transfer (new run).
			if (this.header?.fileId !== decoded.header.fileId) {
				this.header = decoded.header;
				this.symbols.length = 0;
			}
			return false;
		}
		if (typeof decoded.symbol.payload === "string") {
			// Text-encoded symbol: unwrap base64 to raw XOR bytes.
			this.symbols.push({
				payload: new Uint8Array(Buffer.from(decoded.symbol.payload, "base64")),
				seed: decoded.symbol.seed,
			});
		} else {
			this.symbols.push({
				payload: decoded.symbol.payload,
				seed: decoded.symbol.seed,
			});
		}
		const peel = this.tryPeel();
		if (peel?.file) {
			const sha = createHash("sha256").update(peel.file).digest("hex");
			if (sha === this.header?.sha256) {
				this.completedFile = peel.file;
				return true;
			}
		}
		return false;
	}

	private tryPeel(): PeelResult | null {
		if (this.header === null) {
			return null;
		}
		return peelSymbols(this.symbols, this.header);
	}
}
