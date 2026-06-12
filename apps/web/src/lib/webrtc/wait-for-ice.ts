// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Wait for the peer connection's ICE gathering to complete.
 *
 * `createOffer()` and `createAnswer()` can return SDPs before all local
 * ICE candidates have been gathered. If the caller hands that incomplete
 * SDP to the remote peer, the remote's `setRemoteDescription` succeeds
 * but the WebRTC connection never reaches `connected` because the missing
 * candidates can't be exchanged. This is especially visible in headless
 * browsers and in PWA environments where network discovery is slow.
 *
 * The standard fix is to wait for the `icegatheringstatechange` event to
 * fire with `iceGatheringState === "complete"` before returning the SDP.
 * We also add a 1.5s fallback timeout because some browsers (notably
 * Firefox) don't always fire the event when using only host candidates.
 */
export function waitForIceGatheringComplete(
  pc: RTCPeerConnection,
  timeoutMs = 1500
): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const onStateChange = (): void => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        clearTimeout(fallback);
        resolve();
      }
    };
    const fallback = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    }, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onStateChange);
  });
}
