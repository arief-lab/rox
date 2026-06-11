import type { Transport } from "@/lib/webrtc";
import { acceptOffer } from "@/lib/webrtc";
import { encodeOffer } from "./encode-offer";

/**
 * Answerer-side Pairing step 2: take the scanned offer SDP, generate the
 * WebRTC answer, and return the answer encoded for the clipboard plus a
 * Transport promise that resolves when the DataChannel opens.
 *
 * The answerer pastes `answerText` into their clipboard and hands it to
 * the offerer (out of band, typically by reading the offerer's screen).
 *
 * @param offerSdp - The SDP from the decoded offer (the QR payload).
 * @param name - Optional Device Name to embed in the answer payload.
 * @returns answerText ready for clipboard; transport resolves on DataChannel open.
 */
export async function generateAnswer(
  offerSdp: string,
  name?: string
): Promise<{ answerText: string; transport: Promise<Transport> }> {
  const { answerSdp, transport } = await acceptOffer(offerSdp);
  const answerText = encodeOffer(answerSdp, name);
  return { answerText, transport };
}
