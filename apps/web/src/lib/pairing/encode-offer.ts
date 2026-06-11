import { encode as base64urlEncode } from "./base64url";
import type { PairingPayload } from "./types";

/**
 * Encodes a PairingPayload into a base64url string. The string is the data
 * that goes into the QR; the visual QR is rendered separately by the UI.
 */
export function encodeOffer(sdp: string, name?: string): string {
  const payload: PairingPayload = { sdp, name };
  return base64urlEncode(JSON.stringify(payload));
}
