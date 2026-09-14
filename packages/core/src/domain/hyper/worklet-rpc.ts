// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Worklet RPC contract — the request/response seam between the React
 * Native host and the Bare worklet's transfer core.
 *
 * Reuses the pieces that already exist:
 *  - The channel is the @rox/core Transport port (BareTransport on the
 *    host side). One Transport, two message classes:
 *      1. RPC envelopes (this file) — host → worklet calls and replies
 *      2. HyperSignal JSON (signaling.ts, untouched) — worklet's
 *         peer-facing signaling, bridged 1:1 to the host as events
 *  - Zod schemas for every envelope, validated on decode exactly like
 *    parseSignal does for signaling.
 *  - The desktop session's IPC surface as the command vocabulary
 *    (transfer:send/receive/cancel/release, peers, device, state
 *    events) — the worklet is the native twin of that data plane, so
 *    the commands are the same words.
 *
 * Framing rides BareTransport's existing u32-LE length prefix; an
 * envelope is a single JSON object per frame:
 *   { v: 1, id: number, kind: "req", cmd: string, payload?: unknown }
 *   { v: 1, id: number, kind: "res", ok: true, result: unknown }
 *   { v: 1, id: number, kind: "res", ok: false, error: string }
 *   { v: 1, kind: "evt", event: string, payload?: unknown }
 *
 * `v` guards future wire changes; `id` correlates replies to requests
 * (the host may have several in flight — e.g. a long receive plus a
 * state poll). Events are fire-and-forget worklet → host pushes.
 */

import { z } from "zod";

export const RPC_VERSION = 1;

// ── Commands (host → worklet) ─────────────────────────────────

export const RpcCommands = {
	/** Local device identity (id + display name). */
	DEVICE_GET: "device:get",
	/** Set the local device display name. */
	DEVICE_SET_NAME: "device:setName",
	/** Join the discovery topic; returns current peers. */
	PEERS_DISCOVER: "peers:discover",
	/** Cancel any active transfer (both machines → cancelled). */
	TRANSFER_CANCEL: "transfer:cancel",
	/** Replicate an offered drive; resolves when the file is saved. */
	TRANSFER_RECEIVE: "transfer:receive",
	/** Stop seeding and release the drive resources. */
	TRANSFER_RELEASE: "transfer:release",
	/** Seed a file path (worklet-local cache) into a Hyperdrive. */
	TRANSFER_SEND: "transfer:send",
} as const;

export type RpcCommand = (typeof RpcCommands)[keyof typeof RpcCommands];

// ── Events (worklet → host, fire-and-forget) ──────────────────

export const RpcEvents = {
	/** Transfer finished; carries the saved file path. */
	DONE: "done",
	/** Recoverable error notice. */
	ERROR: "error",
	/** Nearby-peer list update. */
	PEERS: "peers",
	/** Byte progress sample { bytes, total, direction }. */
	PROGRESS: "progress",
	/** HyperSignal arriving from the peer (signaling.ts shape, raw). */
	SIGNAL: "signal",
	/** Transfer state-machine snapshot (HyperTransferState). */
	STATE: "state",
} as const;

export type RpcEvent = (typeof RpcEvents)[keyof typeof RpcEvents];

// ── Envelope schemas ──────────────────────────────────────────

const cmdSchema = z.enum([
	RpcCommands.TRANSFER_SEND,
	RpcCommands.TRANSFER_RECEIVE,
	RpcCommands.TRANSFER_CANCEL,
	RpcCommands.TRANSFER_RELEASE,
	RpcCommands.PEERS_DISCOVER,
	RpcCommands.DEVICE_GET,
	RpcCommands.DEVICE_SET_NAME,
]);

export const rpcRequestSchema = z.object({
	cmd: cmdSchema,
	id: z.number().int().nonnegative(),
	kind: z.literal("req"),
	payload: z.unknown().optional(),
	v: z.literal(RPC_VERSION),
});

export const rpcReplySchema = z.object({
	error: z.string().optional(),
	id: z.number().int().nonnegative(),
	kind: z.literal("res"),
	ok: z.boolean(),
	result: z.unknown().optional(),
	v: z.literal(RPC_VERSION),
});

export const rpcEventSchema = z.object({
	event: z.enum([
		RpcEvents.SIGNAL,
		RpcEvents.STATE,
		RpcEvents.PROGRESS,
		RpcEvents.DONE,
		RpcEvents.ERROR,
		RpcEvents.PEERS,
	]),
	kind: z.literal("evt"),
	payload: z.unknown().optional(),
	v: z.literal(RPC_VERSION),
});

export type RpcRequest = z.infer<typeof rpcRequestSchema>;
export type RpcReply = z.infer<typeof rpcReplySchema>;
export type RpcEventMessage = z.infer<typeof rpcEventSchema>;

export type RpcWire = RpcRequest | RpcReply | RpcEventMessage;

// ── Command payloads ──────────────────────────────────────────
// Typed here so host and worklet share one definition (the desktop
// session's handler signatures, mirrored).

export const sendPayloadSchema = z.object({
	/** Path INSIDE the worklet sandbox (app cache dir), readable by Bare. */
	deviceId: z.string().optional(),
	filePath: z.string().min(1),
});
export const receivePayloadSchema = z.object({
	driveKey: z.string().regex(/^[0-9a-f]{64}$/),
	topic: z.string().regex(/^[0-9a-f]{64}$/),
});
export const setNamePayloadSchema = z.object({
	name: z.string().min(1).max(64),
});

// ── Encode / decode ───────────────────────────────────────────
// Same JSON-string convention as encodeSignal/parseSignal: the
// Transport port already carries JSON control frames on desktop, so
// the worklet channel stays text-identical and debuggable.

export function encodeRpc(message: RpcWire): string {
	return JSON.stringify(message);
}

export function decodeRpc(raw: string): RpcWire {
	const parsed: unknown = JSON.parse(raw);
	const kind = (parsed as { kind?: string } | null)?.kind;
	switch (kind) {
		case "req":
			return rpcRequestSchema.parse(parsed);
		case "res":
			return rpcReplySchema.parse(parsed);
		case "evt":
			return rpcEventSchema.parse(parsed);
		default:
			throw new Error(`Unknown RPC frame kind: ${String(kind)}`);
	}
}

/**
 * Host-side helper: build a request envelope with a fresh id.
 * Ids are handed out by the caller's counter, not here, so the client
 * owns correlation.
 */
export function makeRequest(
	id: number,
	cmd: RpcCommand,
	payload?: unknown
): RpcRequest {
	return { cmd, id, kind: "req", payload, v: RPC_VERSION };
}

export function makeReplyOk(id: number, result?: unknown): RpcReply {
	return { id, kind: "res", ok: true, result, v: RPC_VERSION };
}

export function makeReplyError(id: number, error: string): RpcReply {
	return { error, id, kind: "res", ok: false, v: RPC_VERSION };
}

export function makeEvent(event: RpcEvent, payload?: unknown): RpcEventMessage {
	return { event, kind: "evt", payload, v: RPC_VERSION };
}
