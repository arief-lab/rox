import { RealTransport } from "./transport";
import type { Transport } from "./types";
import { waitForIceGatheringComplete } from "./wait-for-ice";

/**
 * Offerer-side WebRTC seam.
 *
 * Creates an RTCPeerConnection, opens a DataChannel, and generates the
 * local offer SDP. Returns a handle that the UI uses to:
 * 1. Display the offer SDP as a QR code (via the `offerSdp` field).
 * 2. Complete the handshake once the answerer pastes their answer
 *    (via the `accept` function, which sets the remote description
 *    and returns the connected Transport).
 *
 * The DataChannel is configured as `{ ordered: false }` per the PRD —
 * reliable + unordered, so the Transfer layer can reassemble chunks by
 * `offset` without stalling on out-of-order delivery.
 *
 * Waits for ICE gathering to complete before returning the SDP — see
 * `waitForIceGatheringComplete` for why this is required.
 */
export async function createOffer(): Promise<{
  offerSdp: string;
  accept: (answerSdp: string) => Promise<Transport>;
}> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = pc.createDataChannel("p2p", { ordered: false });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);
  const offerSdp = pc.localDescription?.sdp ?? "";
  return {
    offerSdp,
    accept: async (answerSdp: string): Promise<Transport> => {
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      return new RealTransport(pc, channel);
    },
  };
}
