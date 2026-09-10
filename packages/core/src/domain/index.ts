// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Domain index — the public surface of the transfer domain.
 *
 * Consumers (adapters, app layers) import from here; nothing outside
 * this package may reach into domain internals directly.
 */

export {
  CHUNK_SIZE,
  decodeChunk,
  encodeChunk,
  isControlMessage,
  parseControlMessage,
} from "./transfer/chunk-frame";
export type { CancelMessage, Chunk, ControlMessage, StartMessage } from "./transfer/chunk-frame";
export { TransferMachine } from "./transfer/transfer-machine";
export type { TransferState } from "./transfer/transfer-machine";
