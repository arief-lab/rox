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

export {
  encodeSignal,
  parseSignal,
  acceptedSchema,
  offerSchema,
  releaseSchema,
} from "./signaling";
export type {
  HyperAccepted,
  HyperOffer,
  HyperRelease,
  HyperSignal,
} from "./signaling";
export { HyperTransferMachine } from "./hyper-transfer-machine";
export type { HyperTransferState } from "./hyper-transfer-machine";
