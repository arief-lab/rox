import { RealTransport } from "./transport";
import type { Transport } from "./types";

/**
 * Answerer-side WebRTC seam.
 *
 * Creates an RTCPeerConnection, sets the remote description to the
 * scanned offer SDP, generates the local answer, and sets the local
 * description. Returns:
 * - `answerSdp`: the SDP to encode for clipboard paste back to the offerer.
 * - `transport`: a Promise that resolves when the DataChannel opens
 *   (delivered via `ondatachannel`).
 *
 * The DataChannel arrives asynchronously after `setRemoteDescription`,
 * so the transport Promise is separate from the answer SDP.
 */
export async function acceptOffer(
  offerSdp: string
): Promise<{ answerSdp: string; transport: Promise<Transport> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channelPromise = new Promise<RTCDataChannel>((resolve) => {
    pc.ondatachannel = (event) => {
      resolve(event.channel);
    };
  });
  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  const transport = channelPromise.then(
    (channel) => new RealTransport(pc, channel)
  );
  return {
    answerSdp: pc.localDescription?.sdp ?? "",
    transport,
  };
}
