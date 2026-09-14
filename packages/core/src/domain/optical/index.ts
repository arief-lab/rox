// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Optical domain index — the public surface of the fountain-coded QR
 * transfer path (screen to camera, no network).
 *
 * Pure and transport-free like domain/hyper: QR rendering and camera
 * decoding belong to the app adapters. The wire format is dual-encoding
 * by design (binary for raw-pixel decoders, base64 text for native
 * barcode scanners), so both camera paths ride the same frames.
 */

export {
	type GeneratedSymbol,
	generateSymbol,
	type PeelResult,
	peelSymbols,
	sampleDegree,
	splitIntoPieces,
	symbolPieceIndices,
} from "./fountain";
export type { OpticalTransferState } from "./transfer-machine";
export { OpticalTransferMachine } from "./transfer-machine";
export type {
	DecodedFrame,
	OpticalHeader,
	OpticalSymbol,
} from "./wire-format";
export {
	BINARY_ENCODING,
	decodeFrame,
	encodeHeaderFrame,
	encodeSymbolFrame,
	FRAME_MAGIC,
	FRAME_PREAMBLE_BYTES,
	HEADER_FRAME_TYPE,
	HEADER_PAYLOAD_BYTES,
	opticalHeaderSchema,
	opticalSymbolSchema,
	TEXT_ENCODING,
} from "./wire-format";
