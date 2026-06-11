import { expect, test } from "@playwright/test";

test.describe("WebRTC hardcoded SDP (slice 2)", () => {
  test("two browser contexts establish a real peer connection and exchange a 'ping' in each direction", async ({
    browser,
  }) => {
    // Two contexts simulate the two sides of a real WebRTC session on
    // the same machine. The SDPs are generated at test time via
    // pc.createOffer / pc.createAnswer, then passed between contexts
    // through the test runner (not through QR / clipboard — that's
    // slice 3). The 'hardcoded' aspect of slice 2 is just that the
    // SDP exchange is direct, not user-mediated.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await pageA.goto("/");
      await pageB.goto("/");

      // Each page installs a WebRTC helper that creates a peer
      // connection + data channel and exposes the offer / answer SDP
      // through window globals. The helper lives only on the page
      // for the duration of the test; it does not pollute the
      // production app surface.
      await pageA.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest?: {
            pc: RTCPeerConnection;
            channel: RTCDataChannel;
            onmessage?: (event: MessageEvent) => void;
          };
        };
        const pc = new RTCPeerConnection({ iceServers: [] });
        const channel = pc.createDataChannel("p2p", { ordered: false });
        w.__webrtcTest = { pc, channel };
      });
      await pageB.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest?: {
            pc: RTCPeerConnection;
            channel: RTCDataChannel;
            onmessage?: (event: MessageEvent) => void;
            resolveChannel?: (channel: RTCDataChannel) => void;
            channelPromise: Promise<RTCDataChannel>;
          };
        };
        const pc = new RTCPeerConnection({ iceServers: [] });
        const channelPromise = new Promise<RTCDataChannel>((resolve) => {
          pc.ondatachannel = (event) => {
            resolve(event.channel);
          };
        });
        w.__webrtcTest = {
          pc,
          channel: null as unknown as RTCDataChannel,
          channelPromise,
        };
      });

      // Context A creates the offer and waits for ICE gathering to complete.
      const offerSdp = await pageA.evaluate(async () => {
        const w = window as unknown as {
          __webrtcTest: { pc: RTCPeerConnection; channel: RTCDataChannel };
        };
        const { pc } = w.__webrtcTest;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            pc.addEventListener("icegatheringstatechange", () => {
              if (pc.iceGatheringState === "complete") {
                resolve();
              }
            });
          }
        });
        return pc.localDescription?.sdp;
      });

      // Context B receives the offer, creates the answer, and waits for ICE.
      const answerSdp = await pageB.evaluate(async (offer: string) => {
        const w = window as unknown as {
          __webrtcTest: {
            pc: RTCPeerConnection;
            channel: RTCDataChannel;
            channelPromise: Promise<RTCDataChannel>;
          };
        };
        const { pc } = w.__webrtcTest;
        await pc.setRemoteDescription({ type: "offer", sdp: offer });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            pc.addEventListener("icegatheringstatechange", () => {
              if (pc.iceGatheringState === "complete") {
                resolve();
              }
            });
          }
        });
        return pc.localDescription?.sdp;
      }, offerSdp ?? "");

      // Both sides set the remote description and wait for the data
      // channel to open.
      await pageA.evaluate(async (answer: string) => {
        const w = window as unknown as {
          __webrtcTest: { pc: RTCPeerConnection; channel: RTCDataChannel };
        };
        await w.__webrtcTest.pc.setRemoteDescription({
          type: "answer",
          sdp: answer,
        });
        await new Promise<void>((resolve) => {
          if (w.__webrtcTest.channel.readyState === "open") {
            resolve();
          } else {
            w.__webrtcTest.channel.addEventListener("open", () => resolve(), {
              once: true,
            });
          }
        });
      }, answerSdp ?? "");

      await pageB.evaluate(async () => {
        const w = window as unknown as {
          __webrtcTest: {
            channel: RTCDataChannel;
            channelPromise: Promise<RTCDataChannel>;
          };
        };
        const channel = await w.__webrtcTest.channelPromise;
        await new Promise<void>((resolve) => {
          if (channel.readyState === "open") {
            resolve();
          } else {
            channel.addEventListener("open", () => resolve(), { once: true });
          }
        });
      });

      // Wire each side's onmessage into a window global so the test
      // can read the received messages.
      await pageA.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest: { channel: RTCDataChannel };
          __received: string[];
        };
        w.__received = [];
        w.__webrtcTest.channel.addEventListener("message", (event) => {
          w.__received.push(event.data as string);
        });
      });
      await pageB.evaluate(async () => {
        const w = window as unknown as {
          __webrtcTest: { channelPromise: Promise<RTCDataChannel> };
          __received: string[];
        };
        w.__received = [];
        const channel = await w.__webrtcTest.channelPromise;
        channel.addEventListener("message", (event) => {
          w.__received.push(event.data as string);
        });
      });

      // Each side sends a 'ping' and verifies the other's 'ping' arrives.
      await pageA.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest: { channel: RTCDataChannel };
        };
        w.__webrtcTest.channel.send("ping-from-a");
      });
      await pageB.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest: { channelPromise: Promise<RTCDataChannel> };
        };
        return w.__webrtcTest.channelPromise.then((channel) => {
          channel.send("ping-from-b");
        });
      });

      // Wait for both sides to receive the other's ping.
      await expect
        .poll(
          () =>
            pageA.evaluate(() => {
              const w = window as unknown as { __received: string[] };
              return w.__received;
            }),
          { timeout: 5000 }
        )
        .toContain("ping-from-b");
      await expect
        .poll(
          () =>
            pageB.evaluate(() => {
              const w = window as unknown as { __received: string[] };
              return w.__received;
            }),
          { timeout: 5000 }
        )
        .toContain("ping-from-a");

      // Closing one side's peer connection tears down the other side.
      await pageA.evaluate(() => {
        const w = window as unknown as {
          __webrtcTest: { pc: RTCPeerConnection; channel: RTCDataChannel };
        };
        w.__webrtcTest.channel.close();
        w.__webrtcTest.pc.close();
      });
      await expect
        .poll(
          () =>
            pageB.evaluate(async () => {
              const w = window as unknown as {
                __webrtcTest: { channelPromise: Promise<RTCDataChannel> };
              };
              const channel = await w.__webrtcTest.channelPromise;
              return channel.readyState;
            }),
          { timeout: 5000 }
        )
        .toBe("closed");
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
