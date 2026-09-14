// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Hyper domain index — the public surface of the Hyperdrive transfer path.
 *
 * The desktop adapter (apps/desktop/main) glues these primitives to the
 * real hyperdrive/hyperswarm packages. This package declares only the
 * signaling protocol and state machine so it stays transport-free and
 * testable — the `hyperdrive` and `hyperswarm` npm deps belong to the
 * adapter layer, not to core.
 */

import { createHash } from "node:crypto";

export type { HyperTransferState } from "./hyper-transfer-machine";
export { HyperTransferMachine } from "./hyper-transfer-machine";
export type { QrOffer } from "./qr-offer";
export { decodeQrOffer, encodeQrOffer } from "./qr-offer";
export type {
	HyperAccepted,
	HyperOffer,
	HyperRelease,
	HyperSignal,
	PairAccept,
	PairHello,
	PairPing,
	PairPong,
	PairReject,
} from "./signaling";
export {
	acceptedSchema,
	encodeSignal,
	offerSchema,
	pairAcceptSchema,
	pairHelloSchema,
	pairPingSchema,
	pairPongSchema,
	pairRejectSchema,
	pairSafetyCode,
	parseSignal,
	releaseSchema,
} from "./signaling";

/**
 * The well-known LAN discovery topic every Rox instance joins while
 * open. Connections on this topic exchange `pair-hello` (identity) and
 * `pair-ping`/`pair-pong` (liveness) so the UI can list nearby devices
 * before any file is chosen. Hashed (not literal) so scanners see only
 * an opaque topic.
 */
export const DISCOVERY_TOPIC = createHash("sha256")
	.update("rox-discovery-v1")
	.digest("hex");
