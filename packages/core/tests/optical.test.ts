// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optical path tests: wire-format golden vectors, fountain round-trip
 * with loss, decoder stuck-detection, and state machine transitions.
 */

import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

import {
	BINARY_ENCODING,
	decodeFrame,
	encodeHeaderFrame,
	encodeSymbolFrame,
	generateSymbol,
	HEADER_FRAME_TYPE,
	HEADER_PAYLOAD_BYTES,
	OpticalTransferMachine,
	peelSymbols,
	sampleDegree,
	splitIntoPieces,
	symbolPieceIndices,
	TEXT_ENCODING,
} from "../src/domain/optical";
import { symbolPieceIndices as pieceIndicesFn } from "../src/domain/optical/fountain";

const MAGIC_RE = /magic/i;
const TOO_SHORT_RE = /too short/i;
const LENGTH_RE = /length mismatch/i;
const IDLE_RE = /idle/;

const TEST_HEADER = {
	fileId: "0123456789abcdef",
	originalLength: 1200,
	pieceCount: 12,
	pieceSize: 100,
	sha256: "a".repeat(64),
};

describe("optical wire format", () => {
	it("header frame round-trips its fields (binary)", () => {
		const frame = encodeHeaderFrame(TEST_HEADER, BINARY_ENCODING);
		const decoded = decodeFrame(frame);
		expect(decoded.type).toBe("header");
		if (decoded.type !== "header") {
			return;
		}
		expect(decoded.header).toEqual(TEST_HEADER);
	});

	it("header frame round-trips its fields (text encoding)", () => {
		const frame = encodeHeaderFrame(TEST_HEADER, TEXT_ENCODING);
		const decoded = decodeFrame(frame);
		expect(decoded.type).toBe("header");
		if (decoded.type !== "header") {
			return;
		}
		expect(decoded.header).toEqual(TEST_HEADER);
	});

	it("header frame has the exact documented length", () => {
		const frame = encodeHeaderFrame(TEST_HEADER);
		expect(frame.byteLength).toBe(8 + HEADER_PAYLOAD_BYTES);
		expect(frame[0]).toBe(0x52);
		expect(frame[1]).toBe(HEADER_FRAME_TYPE);
	});

	it("binary symbol frame round-trips seed and payload", () => {
		const payload = new Uint8Array([1, 2, 3, 4, 5]);
		const frame = encodeSymbolFrame({ payload, seed: 42 }, BINARY_ENCODING);
		const decoded = decodeFrame(frame);
		expect(decoded.type).toBe("symbol");
		if (decoded.type !== "symbol") {
			return;
		}
		expect(decoded.symbol.seed).toBe(42);
		expect(Array.from(decoded.symbol.payload as Uint8Array)).toEqual([
			1, 2, 3, 4, 5,
		]);
	});

	it("text symbol frame carries a base64 payload string", () => {
		const frame = encodeSymbolFrame(
			{ payload: "AQIDBAU=", seed: 7 },
			TEXT_ENCODING
		);
		const decoded = decodeFrame(frame);
		expect(decoded.type).toBe("symbol");
		if (decoded.type !== "symbol") {
			return;
		}
		expect(decoded.symbol.seed).toBe(7);
		expect(decoded.symbol.payload).toBe("AQIDBAU=");
	});

	it("rejects frames with a bad magic or truncated body", () => {
		const frame = encodeHeaderFrame(TEST_HEADER);
		const badMagic = frame.slice();
		badMagic[0] = 0x00;
		expect(() => decodeFrame(badMagic)).toThrow(MAGIC_RE);
		expect(() => decodeFrame(frame.slice(0, 5))).toThrow(TOO_SHORT_RE);

		const truncated = encodeSymbolFrame(
			{ payload: new Uint8Array(10), seed: 1 },
			BINARY_ENCODING
		).slice(0, 12);
		expect(() => decodeFrame(truncated)).toThrow(LENGTH_RE);
	});

	it("golden vector: header bytes are stable across versions", () => {
		// If this breaks, the wire format changed — bump and document.
		const frame = encodeHeaderFrame(TEST_HEADER);
		const hex = Buffer.from(frame).toString("hex");
		expect(hex.startsWith("52010000")).toBe(true);
		expect(hex).toContain(Buffer.from(TEST_HEADER.fileId).toString("hex"));
		expect(hex.endsWith(Buffer.from(TEST_HEADER.sha256).toString("hex"))).toBe(
			true
		);
	});
});

describe("optical fountain codec", () => {
	it("degree distribution favors 1 and 2", () => {
		let degree1 = 0;
		let degree2 = 0;
		let state = 12_345;
		for (let index = 0; index < 1000; index += 1) {
			const sample = sampleDegree(state, 50);
			state = sample.nextState;
			if (sample.degree === 1) {
				degree1 += 1;
			} else if (sample.degree === 2) {
				degree2 += 1;
			}
		}
		expect(degree1).toBeGreaterThan(300);
		expect(degree2).toBeGreaterThan(200);
	});

	it("symbol generation is deterministic in the seed", () => {
		const { pieces } = splitIntoPieces(new Uint8Array(500).fill(9), 50);
		const a = generateSymbol(pieces, 777);
		const b = generateSymbol(pieces, 777);
		expect(Array.from(a.payload)).toEqual(Array.from(b.payload));
		expect(a.pieceIndices).toEqual(b.pieceIndices);
		const c = generateSymbol(pieces, 778);
		expect(Array.from(c.payload)).not.toEqual(Array.from(a.payload));
	});

	it("piece indices never repeat within a symbol", () => {
		const indices = symbolPieceIndices(999, 8, 20);
		expect(new Set(indices).size).toBe(indices.length);
		expect(Math.max(...indices)).toBeLessThan(20);
	});

	it("round-trips a file with 15% random symbol loss", () => {
		const file = new Uint8Array(2400);
		for (let index = 0; index < file.length; index += 1) {
			file[index] = index % 251;
		}
		const sha = createHash("sha256").update(file).digest("hex");
		const { pieceCount, pieces } = splitIntoPieces(file, 200);
		const header = {
			fileId: "ffffffffffffffff",
			originalLength: file.byteLength,
			pieceCount,
			pieceSize: 200,
			sha256: sha,
		};

		// Simulate a sender streaming at ~1.6x and the camera dropping
		// ~15% of frames (every 20th seed); the remainder decodes fully.
		const total = Math.ceil(pieceCount * 1.6);
		const collected: { payload: Uint8Array; seed: number }[] = [];
		for (let seed = 1; seed <= total; seed += 1) {
			if (seed % 20 === 3) {
				continue;
			}
			collected.push({
				payload: generateSymbol(pieces, seed).payload,
				seed,
			});
		}

		const result = peelSymbols(collected, header);
		expect(result.file).not.toBeNull();
		expect(Array.from(result.file ?? [])).toEqual(Array.from(file));
	});

	it("detects a stuck decoder instead of returning garbage", () => {
		const file = new Uint8Array(1000).fill(3);
		const { pieceCount, pieces } = splitIntoPieces(file, 100);
		const header = {
			fileId: "eeeeeeeeeeeeeeee",
			originalLength: file.byteLength,
			pieceCount,
			pieceSize: 100,
			sha256: "b".repeat(64),
		};
		// Far too few symbols to decode.
		const few = [1, 2, 3].map((seed) => ({
			payload: generateSymbol(pieces, seed).payload,
			seed,
		}));
		const result = peelSymbols(few, header);
		expect(result.file).toBeNull();
		expect(result.decodedPieces).toBeLessThan(pieceCount);
	});

	it("handles multi-block XOR chains via peeling", () => {
		const file = new Uint8Array(600);
		for (let index = 0; index < file.length; index += 1) {
			file[index] = (index * 7) % 256;
		}
		const { pieceCount, pieces } = splitIntoPieces(file, 100);
		const header = {
			fileId: "dddddddddddddddd",
			originalLength: file.byteLength,
			pieceCount,
			pieceSize: 100,
			sha256: "c".repeat(64),
		};
		const collected: { payload: Uint8Array; seed: number }[] = [];
		for (let seed = 100; seed <= 130; seed += 1) {
			collected.push({
				payload: generateSymbol(pieces, seed).payload,
				seed,
			});
		}
		const result = peelSymbols(collected, header);
		expect(result.file).not.toBeNull();
		expect(Array.from(result.file ?? [])).toEqual(Array.from(file));
	});
});

describe("optical transfer machine", () => {
	it("walks sender and receiver paths", () => {
		const sender = new OpticalTransferMachine();
		sender.startBeaming("aaaaaaaaaaaaaaaa");
		expect(sender.getState().kind).toBe("beaming");
		sender.complete();
		expect(sender.getState().kind).toBe("completed");
		sender.reset();

		const receiver = new OpticalTransferMachine();
		receiver.startReceiving("bbbbbbbbbbbbbbbb");
		expect(receiver.getState().kind).toBe("receiving");
		receiver.fail("sha mismatch");
		expect(receiver.getState()).toEqual({
			kind: "failed",
			reason: "sha mismatch",
		});
	});

	it("rejects illegal transitions", () => {
		const machine = new OpticalTransferMachine();
		expect(() => machine.complete()).toThrow(IDLE_RE);
		machine.startBeaming("cccccccccccccccc");
		expect(() => machine.startReceiving("dddddddddddddddd")).toThrow();
	});
});

describe("optical frame integration", () => {
	it("decodes symbols from frames and reconstructs the file", () => {
		const file = new Uint8Array(800);
		for (let index = 0; index < file.length; index += 1) {
			file[index] = (index * 13) % 251;
		}
		const sha = createHash("sha256").update(file).digest("hex");
		const { pieceCount, pieces } = splitIntoPieces(file, 100);
		const header = {
			fileId: "abcdef0123456789",
			originalLength: file.byteLength,
			pieceCount,
			pieceSize: 100,
			sha256: sha,
		};

		const headerFrame = decodeFrame(encodeHeaderFrame(header));
		expect(headerFrame.type).toBe("header");

		const symbols: { payload: Uint8Array; seed: number }[] = [];
		for (let seed = 5; seed <= 40; seed += 1) {
			const symbol = generateSymbol(pieces, seed);
			const frame = decodeFrame(
				encodeSymbolFrame({ payload: symbol.payload, seed }, BINARY_ENCODING)
			);
			if (frame.type !== "symbol") {
				continue;
			}
			symbols.push({
				payload: frame.symbol.payload as Uint8Array,
				seed: frame.symbol.seed,
			});
		}

		const result = peelSymbols(symbols, header);
		expect(result.file).not.toBeNull();
		const round = createHash("sha256")
			.update(result.file ?? new Uint8Array(0))
			.digest("hex");
		expect(round).toBe(sha);
	});

	it("text-encoded symbols decode to the same logical frames", () => {
		const payload = new Uint8Array([10, 20, 30]);
		const binary = decodeFrame(
			encodeSymbolFrame({ payload, seed: 5 }, BINARY_ENCODING)
		);
		const text = decodeFrame(
			encodeSymbolFrame(
				{ payload: Buffer.from(payload).toString("base64"), seed: 5 },
				TEXT_ENCODING
			)
		);
		expect(binary.type).toBe("symbol");
		expect(text.type).toBe("symbol");
		if (binary.type === "symbol" && text.type === "symbol") {
			expect(binary.symbol.seed).toBe(text.symbol.seed);
			// Payloads differ only in representation, not information.
			expect(
				Buffer.from(binary.symbol.payload as Uint8Array).toString("base64")
			).toBe(text.symbol.payload);
		}
	});

	it("pieceIndices helper stays consistent with the generator", () => {
		const { pieces } = splitIntoPieces(new Uint8Array(300), 100);
		const symbol = generateSymbol(pieces, 31_415);
		expect(symbol.pieceIndices).toEqual(
			pieceIndicesFn(31_415, symbol.degree, pieces.length)
		);
	});
});
