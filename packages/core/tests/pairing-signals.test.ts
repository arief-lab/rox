// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "bun:test";

const SAFETY_CODE_PATTERN = /^\d{4}-\d{4}$/;

import {
	acceptedSchema,
	encodeSignal,
	pairAcceptSchema,
	pairHelloSchema,
	pairRejectSchema,
	pairSafetyCode,
	parseSignal,
} from "../src/index";

/**
 * The pairing signaling vocabulary carried over the rox/pairing protomux
 * channel. These JSON shapes are wire format — see tests/wire-format
 * golden rules: changes need a protocol version bump.
 */

describe("pairing signal schemas", () => {
	it("round-trips a hyper-offer", () => {
		const signal = {
			driveKey: "a".repeat(64),
			name: "test.txt",
			topic: "b".repeat(64),
			type: "hyper-offer",
		} as const;
		const decoded = parseSignal(encodeSignal(signal));
		expect(decoded).toEqual(signal);
	});

	it("round-trips hyper-accepted and hyper-release", () => {
		const base = { driveKey: "a".repeat(64) } as const;
		expect(
			parseSignal(encodeSignal({ ...base, type: "hyper-accepted" }))
		).toEqual({
			...base,
			type: "hyper-accepted",
		});
		expect(
			parseSignal(encodeSignal({ ...base, type: "hyper-release" }))
		).toEqual({
			...base,
			type: "hyper-release",
		});
	});

	it("rejects malformed offers", () => {
		expect(() =>
			parseSignal(
				JSON.stringify({
					driveKey: "nothex",
					topic: "b".repeat(64),
					type: "hyper-offer",
				})
			)
		).toThrow();
		expect(() =>
			parseSignal(JSON.stringify({ type: "hyper-offer" }))
		).toThrow();
	});

	it("acceptedSchema validates driveKey shape", () => {
		expect(
			acceptedSchema.safeParse({
				driveKey: "a".repeat(64),
				type: "hyper-accepted",
			}).success
		).toBe(true);
		expect(
			acceptedSchema.safeParse({ driveKey: "zz", type: "hyper-accepted" })
				.success
		).toBe(false);
	});

	it("round-trips pair-hello / pair-accept / pair-reject", () => {
		const id = "0123456789abcdef";
		expect(
			parseSignal(
				encodeSignal({ deviceId: id, name: "laptop", type: "pair-hello" })
			)
		).toEqual({ deviceId: id, name: "laptop", type: "pair-hello" });
		expect(
			parseSignal(encodeSignal({ deviceId: id, type: "pair-accept" }))
		).toEqual({ deviceId: id, type: "pair-accept" });
		expect(
			parseSignal(encodeSignal({ deviceId: id, type: "pair-reject" }))
		).toEqual({ deviceId: id, type: "pair-reject" });
		expect(() =>
			pairHelloSchema.parse({ deviceId: "xyz", name: "l", type: "pair-hello" })
		).toThrow();
		expect(() =>
			pairAcceptSchema.parse({ deviceId: "xyz", type: "pair-accept" })
		).toThrow();
		expect(() =>
			pairRejectSchema.parse({ deviceId: "xyz", type: "pair-reject" })
		).toThrow();
	});

	describe("pairSafetyCode", () => {
		const idA = "0123456789abcdef";
		const idB = "fedcba9876543210";

		it("is symmetric — both devices derive the same code", () => {
			expect(pairSafetyCode(idA, idB)).toBe(pairSafetyCode(idB, idA));
		});

		it("has the DDDD-DDDD shape", () => {
			expect(pairSafetyCode(idA, idB)).toMatch(SAFETY_CODE_PATTERN);
		});

		it("differs for a different device pair (MITM changes the code)", () => {
			const idC = "aaaaaaaaaaaaaaaa";
			const legit = pairSafetyCode(idA, idB);
			const mitmA = pairSafetyCode(idA, idC);
			const mitmB = pairSafetyCode(idB, idC);
			// The attacker relays for both victims; each victim sees a code
			// derived with the attacker's id — the two screens disagree.
			expect(mitmA).not.toBe(legit);
			expect(mitmB).not.toBe(legit);
			expect(mitmA).not.toBe(mitmB);
		});
	});
});
