// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * WebRTC domain index — the chunked transfer protocol for
 * DataChannel-based transports.
 *
 * This is the non-Pear path: bulk data flows as framed chunks through
 * the Transport port itself (used by WebRTC adapters where Hypercore
 * is unavailable, e.g. an Expo/native transport). The desktop Pear
 * path uses domain/hyper instead.
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
