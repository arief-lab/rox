// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "bun:test";

import {
	acceptedSchema,
	encodeSignal,
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
		expect(parseSignal(encodeSignal({ ...base, type: "hyper-accepted" }))).toEqual({
			...base,
			type: "hyper-accepted",
		});
		expect(parseSignal(encodeSignal({ ...base, type: "hyper-release" }))).toEqual({
			...base,
			type: "hyper-release",
		});
	});

	it("rejects malformed offers", () => {
		expect(() =>
			parseSignal(
				JSON.stringify({ driveKey: "nothex", topic: "b".repeat(64), type: "hyper-offer" }),
			),
		).toThrow();
		expect(() => parseSignal(JSON.stringify({ type: "hyper-offer" }))).toThrow();
	});

	it("acceptedSchema validates driveKey shape", () => {
		expect(
			acceptedSchema.safeParse({ driveKey: "a".repeat(64), type: "hyper-accepted" })
				.success,
		).toBe(true);
		expect(
			acceptedSchema.safeParse({ driveKey: "zz", type: "hyper-accepted" }).success,
		).toBe(false);
	});
});
