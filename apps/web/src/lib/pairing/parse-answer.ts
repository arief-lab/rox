import { decodeOffer } from "./decode-qr";
import type { PairingPayload } from "./types";

/**
 * Offerer-side Pairing step 3: decode the answer text pasted from the
 * clipboard. The caller then passes `decoded.sdp` to the offerer's
 * `accept(answerSdp)` to complete the WebRTC handshake.
 *
 * This is a thin semantic alias for `decodeOffer` — the name makes the
 * offerer-side flow self-documenting (`parseAnswer` vs `decodeOffer`).
 *
 * @throws if the text is not a valid PairingPayload.
 */
export function parseAnswer(text: string): PairingPayload {
  return decodeOffer(text);
}
