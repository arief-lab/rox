import { RealTransport } from "./transport";
import type { Transport } from "./types";

export type SessionRole = "offerer" | "answerer";

export interface CreateSessionParams {
  /**
   * The SDP this peer will set as its local description. For an offerer
   * this is the offer SDP; for an answerer it is the answer SDP.
   */
  localSdp: string;
  /**
   * The SDP this peer will set as the remote description. For an offerer
   * this is the answer SDP; for an answerer it is the offer SDP.
   */
  remoteSdp: string;
  /** Which side of the handshake this peer is on. */
  role: SessionRole;
}

/**
 * Wires up an RTCPeerConnection from a pair of SDPs and returns a
 * connected Transport wrapping the DataChannel.
 *
 * In this slice the SDPs are hardcoded (per the slice 2 issue). Slice 3
 * will source the offer SDP from the QR scan and the answer SDP from
 * the clipboard paste; the WebRTC seam itself does not change.
 *
 * The DataChannel is configured as `{ ordered: false }` per the PRD —
 * reliable + unordered, so the Transfer layer can reassemble chunks by
 * `offset` without stalling on out-of-order delivery.
 *
 * `iceServers: []` because the slice 2 target is same-machine. Adding
 * STUN/TURN is out of scope here.
 */
export function createSession(params: CreateSessionParams): Promise<Transport> {
  const { role, localSdp, remoteSdp } = params;
  const pc = new RTCPeerConnection({ iceServers: [] });

  if (role === "offerer") {
    return createOffererSession(pc, localSdp, remoteSdp);
  }
  return createAnswererSession(pc, localSdp, remoteSdp);
}

async function createOffererSession(
  pc: RTCPeerConnection,
  localOffer: string,
  remoteAnswer: string
): Promise<Transport> {
  // The offerer creates the data channel before setting descriptions.
  const channel = pc.createDataChannel("p2p", { ordered: false });
  await pc.setLocalDescription({ type: "offer", sdp: localOffer });
  await pc.setRemoteDescription({ type: "answer", sdp: remoteAnswer });
  return new RealTransport(pc, channel);
}

async function createAnswererSession(
  pc: RTCPeerConnection,
  localAnswer: string,
  remoteOffer: string
): Promise<Transport> {
  // The answerer sets the remote offer first, which triggers
  // ondatachannel; the channel is then handed to RealTransport.
  const channel = await new Promise<RTCDataChannel>((resolve) => {
    pc.ondatachannel = (event) => {
      resolve(event.channel);
    };
    pc.setRemoteDescription({ type: "offer", sdp: remoteOffer }).catch(
      () => undefined
    );
  });
  await pc.setLocalDescription({ type: "answer", sdp: localAnswer });
  return new RealTransport(pc, channel);
}
