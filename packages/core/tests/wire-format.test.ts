// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "bun:test";

import {
	CHUNK_SIZE,
	decodeChunk,
	decodeQrOffer,
	encodeChunk,
	encodeQrOffer,
	parseControlMessage,
} from "../src/index";

/**
 * Golden-value regression tests for the wire formats.
 *
 * The hardcoded bytes/strings below MUST NOT change: peers running
 * different app versions must stay interoperable (TASK-2). If a test
 * fails after an intentional format change, that change requires a
 * protocol version bump and a migration plan — not a quiet test edit.
 */

describe("chunk frame wire format", () => {
	// Frame layout: [fileIdLen: u32 LE][fileId][offset: u32 LE][length: u32 LE][payload]
	const FILE_ID = "123e4567-e89b-42d3-a456-426614174000";
	const PAYLOAD = "hello";

	function makeChunk() {
		const payload = new TextEncoder().encode(PAYLOAD);
		return {
			fileId: FILE_ID,
			length: payload.byteLength,
			offset: 1024,
			payload: payload.buffer.slice(
				payload.byteOffset,
				payload.byteOffset + payload.byteLength
			),
		};
	}

	it("encodes a known chunk to hardcoded golden bytes", () => {
		const frame = encodeChunk(makeChunk());
		expect(Buffer.from(frame).toString("hex")).toBe(
			"2400000031323365343536372d653839622d343264332d613435362d343236363134313734303030000400000500000068656c6c6f"
		);
	});

	it("round-trips encode → decode", () => {
		const chunk = makeChunk();
		const decoded = decodeChunk(encodeChunk(chunk));
		expect(decoded.fileId).toBe(chunk.fileId);
		expect(decoded.offset).toBe(chunk.offset);
		expect(decoded.length).toBe(chunk.length);
		expect(new TextDecoder().decode(decoded.payload)).toBe(PAYLOAD);
	});

	it("round-trips a max-size (CHUNK_SIZE) chunk", () => {
		const payload = new Uint8Array(CHUNK_SIZE).fill(0xab);
		const chunk = {
			fileId: "f".repeat(36),
			length: CHUNK_SIZE,
			offset: 4_000_000_000,
			payload: payload.buffer.slice(0),
		};
		const decoded = decodeChunk(encodeChunk(chunk));
		expect(decoded.length).toBe(CHUNK_SIZE);
		expect(new Uint8Array(decoded.payload)[0]).toBe(0xab);
	});
});

describe("control messages", () => {
	it("parses a start message", () => {
		const msg = parseControlMessage(
			'{"type":"start","fileId":"abc","name":"f.txt","totalSize":10}'
		);
		expect(msg).toEqual({
			fileId: "abc",
			name: "f.txt",
			totalSize: 10,
			type: "start",
		});
	});

	it("parses a cancel message and rejects unknown types", () => {
		expect(parseControlMessage('{"type":"cancel","fileId":"abc"}')).toEqual({
			fileId: "abc",
			type: "cancel",
		});
		expect(() => parseControlMessage('{"type":"other"}')).toThrow();
	});
});

describe("rox1 QR offer payload", () => {
	const DRIVE_KEY = "a".repeat(64);
	const TOPIC =
		"ee88edb9b394b5f953673f951dd9c4670be76c09a56dbba6b6836abe97eddd20";

	it("encodes to the fixed rox1:<64><64> layout", () => {
		const payload = encodeQrOffer({ driveKey: DRIVE_KEY, topic: TOPIC });
		expect(payload).toBe(`rox1:${DRIVE_KEY}${TOPIC}`);
		expect(payload).toBe(
			"rox1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaee88edb9b394b5f953673f951dd9c4670be76c09a56dbba6b6836abe97eddd20"
		);
	});

	it("decodes the golden payload back to the same fields", () => {
		const decoded = decodeQrOffer(
			"rox1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaee88edb9b394b5f953673f951dd9c4670be76c09a56dbba6b6836abe97eddd20"
		);
		expect(decoded.driveKey).toBe(DRIVE_KEY);
		expect(decoded.topic).toBe(TOPIC);
		expect(decoded.name).toBeUndefined();
	});

	it("round-trips an offer with a percent-encoded name", () => {
		const payload = encodeQrOffer({
			driveKey: DRIVE_KEY,
			name: "Arif's laptop 😊",
			topic: TOPIC,
		});
		const decoded = decodeQrOffer(payload);
		expect(decoded.name).toBe("Arif's laptop 😊");
	});

	describe("sender id segment", () => {
		const SENDER_ID = "0123456789abcdef";

		it("round-trips senderId alongside driveKey and topic", () => {
			const payload = encodeQrOffer({
				driveKey: DRIVE_KEY,
				senderId: SENDER_ID,
				topic: TOPIC,
			});
			expect(payload).toBe(`rox1:${DRIVE_KEY}${TOPIC}:sender=${SENDER_ID}`);
			expect(decodeQrOffer(payload)).toEqual({
				driveKey: DRIVE_KEY,
				senderId: SENDER_ID,
				topic: TOPIC,
			});
		});

		it("round-trips senderId and name together", () => {
			const decoded = decodeQrOffer(
				encodeQrOffer({
					driveKey: DRIVE_KEY,
					name: "laptop",
					senderId: SENDER_ID,
					topic: TOPIC,
				})
			);
			expect(decoded.senderId).toBe(SENDER_ID);
			expect(decoded.name).toBe("laptop");
		});

		it("ignores a malformed sender segment (legacy tolerance)", () => {
			const decoded = decodeQrOffer(
				`rox1:${DRIVE_KEY}${TOPIC}:sender=zzz,name=laptop`
			);
			expect(decoded.senderId).toBeUndefined();
			expect(decoded.name).toBe("laptop");
		});
	});

	it("rejects foreign payloads, truncation, and bad hex", () => {
		expect(() => decodeQrOffer("https://example.com")).toThrow();
		expect(() => decodeQrOffer("rox1:short")).toThrow();
		expect(() => decodeQrOffer(`rox1:${"z".repeat(128)}`)).toThrow();
	});
});
