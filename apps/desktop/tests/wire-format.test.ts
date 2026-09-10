// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

/**
 * The topic derivation must stay byte-identical across app versions
 * (TASK-2): a receiver derives the discovery topic from the drive key
 * in the offer, and both sides must land on the same value or peers
 * will never find each other. The golden hex below pins the current
 * rule: sha256("rox-topic:" + driveKeyHex) as lowercase hex.
 */

const GOLDEN_DRIVE_KEY = "a".repeat(64);
const GOLDEN_TOPIC =
	"ee88edb9b394b5f953673f951dd9c4670be76c09a56dbba6b6836abe97eddd20";

function topicFromDriveKey(driveKeyHex: string): string {
	return createHash("sha256").update(`rox-topic:${driveKeyHex}`).digest("hex");
}

describe("hyper discovery topic derivation", () => {
	it("matches the golden value for a known drive key", () => {
		expect(topicFromDriveKey(GOLDEN_DRIVE_KEY)).toBe(GOLDEN_TOPIC);
	});

	it("produces a 32-byte lowercase hex topic for arbitrary keys", () => {
		const topic = topicFromDriveKey("f".repeat(64));
		expect(topic).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic and key-sensitive", () => {
		expect(topicFromDriveKey(GOLDEN_DRIVE_KEY)).toBe(
			topicFromDriveKey(GOLDEN_DRIVE_KEY),
		);
		expect(topicFromDriveKey("b".repeat(64))).not.toBe(GOLDEN_TOPIC);
	});
});
