// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Beam glue tests: the sender/receiver pair must round-trip a message
 * through the same QR payload strings a real exchange would carry —
 * text-encoded frames, scanned in arbitrary order with duplicates and
 * a ~15% miss rate.
 */

import { describe, expect, it } from "bun:test";

import { BeamReceiver, createBeamSession } from "../lib/beam";

const MESSAGE = "Rox beam round-trip: the payload travels as light. ".repeat(
	20
);

const NAME_RE = /^beam-[0-9a-f]{16}\.txt$/;

describe("beam session <-> receiver", () => {
	it("round-trips text when the camera joins mid-loop, drops ~15%", () => {
		const session = createBeamSession(MESSAGE);
		const receiver = new BeamReceiver();

		// Camera joins at an arbitrary loop position; scans continuously
		// with ~15% misses across multiple cycles until done. The header
		// frame re-airs every loop, so joins always re-anchor.
		let rng = 99;
		let complete = receiver.ingest(session.qrPayloadAt(-1));
		for (let cycle = 0; cycle < 6 && !complete; cycle += 1) {
			const start = (cycle * 7) % session.streamLength;
			for (
				let offset = 0;
				offset < session.streamLength && !complete;
				offset += 1
			) {
				rng = (rng * 1_103_515_245 + 12_345) % 2_147_483_648;
				if (rng % 100 < 15) {
					continue; // camera missed this frame
				}
				const index = (start + offset) % session.streamLength;
				complete = receiver.ingest(session.qrPayloadAt(index));
			}
		}

		expect(complete).toBe(true);
		const { suggestedName, text } = receiver.result ?? {};
		expect(text).toBe(MESSAGE);
		expect(suggestedName).toMatch(NAME_RE);
	});

	it("ignores foreign QR payloads without corrupting state", () => {
		const session = createBeamSession("hello beam");
		const receiver = new BeamReceiver();

		expect(receiver.ingest("https://example.com/not-a-frame")).toBe(false);
		// base64 of garbage that does not start with the magic byte
		expect(receiver.ingest("b2ssIG5vdCBhIFJveCBmcmFtZQ==")).toBe(false);

		// The real stream still lands afterwards.
		let complete = false;
		for (let index = -1; index < session.streamLength; index += 1) {
			complete = receiver.ingest(session.qrPayloadAt(index));
		}
		expect(complete).toBe(true);
		expect(receiver.result?.text).toBe("hello beam");
	});

	it("reports progress before completion", () => {
		const session = createBeamSession("progress probe ".repeat(10));
		const receiver = new BeamReceiver();

		expect(receiver.progress.needed).toBe(0);
		receiver.ingest(session.qrPayloadAt(-1)); // header
		expect(receiver.progress.needed).toBe(session.header.pieceCount);
		expect(receiver.progress.collected).toBe(0);

		receiver.ingest(session.qrPayloadAt(0));
		receiver.ingest(session.qrPayloadAt(1));
		expect(receiver.progress.collected).toBe(2);
		expect(receiver.progress.decoded).toBeLessThan(receiver.progress.needed);
	});
});
