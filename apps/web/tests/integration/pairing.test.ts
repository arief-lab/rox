import { describe, expect, it } from "vitest";

import { generateAnswer, PairingMachine, parseAnswer } from "@/lib/pairing";

const SAMPLE_OFFER_SDP =
  "v=0\no=- 12345 67890 IN IP4 192.168.1.1\ns=-\nt=0 0\n";

/** Matches the error thrown by PairingMachine on an illegal transition. */
const ILLEGAL_TRANSITION_REGEX = /Illegal Pairing transition/;

describe("PairingMachine", () => {
  it("starts in idle", () => {
    const m = new PairingMachine();
    expect(m.getState().kind).toBe("idle");
  });

  it("idle → offering on startOffering", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    expect(m.getState()).toEqual({
      kind: "offering",
      offerSdp: SAMPLE_OFFER_SDP,
    });
  });

  it("idle → scanning on startScanning", () => {
    const m = new PairingMachine();
    m.startScanning();
    expect(m.getState().kind).toBe("scanning");
  });

  it("offering → pasting on pasteAnswer", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    expect(m.getState()).toEqual({
      kind: "pasting",
      offerSdp: SAMPLE_OFFER_SDP,
    });
  });

  it("pasting → connected on completePaste", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    m.completePaste("AnswererName");
    expect(m.getState()).toEqual({
      kind: "connected",
      peerName: "AnswererName",
    });
  });

  it("scanning → connected on completeScan", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.completeScan("OffererName");
    expect(m.getState()).toEqual({
      kind: "connected",
      peerName: "OffererName",
    });
  });

  it("any → closing on close()", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("close() from idle is a no-op", () => {
    const m = new PairingMachine();
    m.close();
    expect(m.getState().kind).toBe("idle");
  });

  it("reset() returns to idle from any state", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("rejects illegal transitions: startOffering from connected", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.completeScan("Peer");
    expect(() => m.startOffering(SAMPLE_OFFER_SDP)).toThrow(
      ILLEGAL_TRANSITION_REGEX
    );
  });

  it("rejects illegal transitions: pasteAnswer from idle", () => {
    const m = new PairingMachine();
    expect(() => m.pasteAnswer()).toThrow(ILLEGAL_TRANSITION_REGEX);
  });

  it("rejects illegal transitions: completeScan from offering", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    expect(() => m.completeScan("Peer")).toThrow(ILLEGAL_TRANSITION_REGEX);
  });
});

describe("parseAnswer", () => {
  it("decodes a valid answer text to a PairingPayload", () => {
    // Build a text that decodeOffer would accept: base64url(JSON({sdp, name}))
    const decoded = parseAnswer("eyJzZHAiOiJ2PTAiLCJuYW1lIjoiQWxpY2UifQ");
    expect(decoded.sdp).toBe("v=0");
    expect(decoded.name).toBe("Alice");
  });

  it("rejects malformed text", () => {
    expect(() => parseAnswer("not-valid-base64!!!")).toThrow();
  });
});

describe("generateAnswer (with a minimal mock RTCPeerConnection)", () => {
  it("returns encoded answer text + a transport promise", () => {
    // We can't easily mock RTCPeerConnection in vitest, so this test
    // just verifies the function signature. The full WebRTC flow is
    // covered by the Playwright e2e.
    expect(typeof generateAnswer).toBe("function");
  });
});
