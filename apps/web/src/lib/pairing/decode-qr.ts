// SPDX-License-Identifier: AGPL-3.0-or-later
import { decode as base64urlDecode } from "./base64url";
import { isPairingPayload, type PairingPayload } from "./types";

export type DecodedOffer = PairingPayload;

/**
 * Decodes a string previously produced by {@link encodeOffer} back into a
 * PairingPayload. Throws on malformed input — the caller (UI or test) decides
 * how to surface the error.
 */
export function decodeOffer(text: string): DecodedOffer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64urlDecode(text));
  } catch {
    throw new Error("Pairing payload is not valid JSON");
  }
  if (!isPairingPayload(parsed)) {
    throw new Error(
      "Pairing payload is malformed: expected { sdp: string, name?: string }"
    );
  }
  return { sdp: parsed.sdp, name: parsed.name };
}
