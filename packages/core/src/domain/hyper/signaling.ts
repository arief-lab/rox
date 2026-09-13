// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Signaling messages exchanged over the Transport port to coordinate
 * a Hyperdrive-based transfer.
 *
 * Bulk data never flows through Transport in the Hyper path — the
 * sender seeds a Hyperdrive and the receiver replicates it directly
 * over Hyperswarm. Transport carries only these low-volume signaling
 * messages: drive keys, file metadata, and progress/cancel coordination.
 */

import { createHash } from "node:crypto";
import { z } from "zod";

/** Emitted by the sender once the drive is seeded and ready to replicate. */
export const offerSchema = z.object({
	/** The seeded Hyperdrive key (32-byte hex). The receiver replicates this. */
	driveKey: z.string().regex(/^[0-9a-f]{64}$/),
	/** Device name of the sender (for UI display). */
	name: z.string().optional(),
	/** Announce topic for Hyperswarm discovery (32-byte hex). */
	topic: z.string().regex(/^[0-9a-f]{64}$/),
	type: z.literal("hyper-offer"),
});

/** Emitted by the receiver when it has finished replicating the drive. */
export const acceptedSchema = z.object({
	driveKey: z.string().regex(/^[0-9a-f]{64}$/),
	type: z.literal("hyper-accepted"),
});

/**
 * Emitted by the receiver when it wants the sender to stop seeding
 * (drive fully received, or user dismissed the incoming file).
 */
export const releaseSchema = z.object({
	driveKey: z.string().regex(/^[0-9a-f]{64}$/),
	type: z.literal("hyper-release"),
});

/**
 * First message both sides send when a peer connection opens: device
 * display name + a short id so the UI can show WHO you're paired with
 * before any transfer starts. No trust decision — pairing here means
 * the two devices found each other and exchanged identity.
 */
export const pairHelloSchema = z.object({
	/** Short fingerprint of the local peer id (first 16 hex chars). */
	deviceId: z.string().regex(/^[0-9a-f]{16}$/),
	name: z.string().min(1).max(64),
	type: z.literal("pair-hello"),
});

/**
 * Emitted by BOTH sides once each has seen the other's hello and the
 * local user approved the pairing. A transfer may only start after
 * accept has flowed both directions.
 */
export const pairAcceptSchema = z.object({
	/** Short fingerprint echoing back the device being accepted. */
	deviceId: z.string().regex(/^[0-9a-f]{16}$/),
	type: z.literal("pair-accept"),
});

/** Emitted to decline a pairing; the receiving side should hang up. */
export const pairRejectSchema = z.object({
	deviceId: z.string().regex(/^[0-9a-f]{16}$/),
	type: z.literal("pair-reject"),
});

export type HyperOffer = z.infer<typeof offerSchema>;
export type HyperAccepted = z.infer<typeof acceptedSchema>;
export type HyperRelease = z.infer<typeof releaseSchema>;
export type PairHello = z.infer<typeof pairHelloSchema>;
export type PairAccept = z.infer<typeof pairAcceptSchema>;
export type PairReject = z.infer<typeof pairRejectSchema>;
export type HyperSignal =
	| HyperOffer
	| HyperAccepted
	| HyperRelease
	| PairHello
	| PairAccept
	| PairReject;

/** Serialize a signal for the Transport wire (JSON control channel). */
export function encodeSignal(signal: HyperSignal): string {
	return JSON.stringify(signal);
}

/**
 * Derive the pairing safety code both devices display during the
 * confirm stage. The code is a pure function of the sorted device ids,
 * so both sides compute the SAME value independently — if the words
 * match on both screens, the channel is not being intercepted (the id
 * pair is baked into the derivation, and each device knows its own
 * id, so a man-in-the-middle produces a different pair and thus a
 * different code on each side).
 *
 * Output: two 4-digit groups (e.g. "7314-2096") — 10^8 space, enough
 * to make MITM visually detectable without being tedious to read out.
 */
export function pairSafetyCode(deviceIdA: string, deviceIdB: string): string {
	const [first, second] = [deviceIdA, deviceIdB].sort();
	const digest = createHash("sha256")
		.update(`rox-pair-safety:${first}:${second}`)
		.digest();
	const group = (offset: number): number =>
		digest.readUInt32BE(offset) % 10_000;
	return `${String(group(0)).padStart(4, "0")}-${String(group(4)).padStart(4, "0")}`;
}

/** Parse and validate a signaling message. Throws on unknown shapes. */
export function parseSignal(raw: string): HyperSignal {
	const parsed: unknown = JSON.parse(raw);
	const type = (parsed as { type?: string } | null)?.type;
	switch (type) {
		case "hyper-offer":
			return offerSchema.parse(parsed);
		case "hyper-accepted":
			return acceptedSchema.parse(parsed);
		case "hyper-release":
			return releaseSchema.parse(parsed);
		case "pair-hello":
			return pairHelloSchema.parse(parsed);
		case "pair-accept":
			return pairAcceptSchema.parse(parsed);
		case "pair-reject":
			return pairRejectSchema.parse(parsed);
		default:
			throw new Error(`Unknown hyper signal type: ${String(type)}`);
	}
}
