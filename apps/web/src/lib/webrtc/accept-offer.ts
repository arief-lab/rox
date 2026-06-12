// SPDX-License-Identifier: AGPL-3.0-or-later
import { RealTransport } from "./transport";
import type { Transport } from "./types";
import { waitForIceGatheringComplete } from "./wait-for-ice";

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
 *
 * Waits for ICE gathering to complete before returning the SDP — see
 * `waitForIceGatheringComplete` for why this is required.
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
  await waitForIceGatheringComplete(pc);
  const transport = channelPromise.then(
    (channel) => new RealTransport(pc, channel)
  );
  return {
    answerSdp: pc.localDescription?.sdp ?? "",
    transport,
  };
}
