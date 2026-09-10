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

export type HyperOffer = z.infer<typeof offerSchema>;
export type HyperAccepted = z.infer<typeof acceptedSchema>;
export type HyperRelease = z.infer<typeof releaseSchema>;
export type HyperSignal = HyperOffer | HyperAccepted | HyperRelease;

/** Serialize a signal for the Transport wire (JSON control channel). */
export function encodeSignal(signal: HyperSignal): string {
	return JSON.stringify(signal);
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
		default:
			throw new Error(`Unknown hyper signal type: ${String(type)}`);
	}
}
