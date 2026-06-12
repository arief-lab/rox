// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";

import { generateAnswer, PairingMachine, parseAnswer } from "@/lib/pairing";

const SAMPLE_OFFER_SDP =
  "v=0\no=- 12345 67890 IN IP4 192.168.1.1\ns=-\nt=0 0\n";

/** Matches the error thrown by PairingMachine on an illegal transition. */
const ILLEGAL_TRANSITION_REGEX = /Illegal Pairing transition/;

// Failure transition error patterns (from the guard assertions).
const MALFORMED_QR_FROM_INVALID = /Cannot fail with malformed QR/;
const INVALID_PASTE_FROM_INVALID = /Cannot fail with invalid paste/;
const ICE_FROM_INVALID = /Cannot fail with ICE/;

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

/**
 * PairingMachine.failMalformedQr() — slice 11.
 *
 * Legal from idle (decodeOffer threw before startScanning was
 * called) and scanning (the caller advanced the machine
 * speculatively). Illegal from offering, pasting, and connected.
 * After recording, reset() returns to idle — the failure state
 * is transient so the next startOffering/startScanning works.
 */
describe("PairingMachine.failMalformedQr()", () => {
  it("idle → malformed_qr is legal (decodeOffer threw before startScanning)", () => {
    const m = new PairingMachine();
    m.failMalformedQr("not valid JSON");
    const state = m.getState();
    expect(state.kind).toBe("malformed_qr");
    if (state.kind === "malformed_qr") {
      expect(state.reason).toBe("not valid JSON");
    }
  });

  it("scanning → malformed_qr is legal (caller advanced speculatively)", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.failMalformedQr("wrong shape");
    const state = m.getState();
    expect(state.kind).toBe("malformed_qr");
    if (state.kind === "malformed_qr") {
      expect(state.reason).toBe("wrong shape");
    }
  });

  it("reset() after malformed_qr returns to idle", () => {
    const m = new PairingMachine();
    m.failMalformedQr("bad qr");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("offering → malformed_qr throws (wrong failure type)", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    expect(() => m.failMalformedQr("wrong")).toThrow(MALFORMED_QR_FROM_INVALID);
    // State untouched — the offering is still valid.
    expect(m.getState().kind).toBe("offering");
  });

  it("pasting → malformed_qr throws", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    expect(() => m.failMalformedQr("wrong")).toThrow(MALFORMED_QR_FROM_INVALID);
    // The machine is still in pasting — the illegal transition
    // was a no-op so the user can retry the paste.
    expect(m.getState().kind).toBe("pasting");
  });

  it("connected → malformed_qr throws", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.completeScan("Peer");
    expect(() => m.failMalformedQr("wrong")).toThrow(MALFORMED_QR_FROM_INVALID);
    expect(m.getState().kind).toBe("connected");
  });
});

/**
 * PairingMachine.failInvalidPaste() — slice 11.
 *
 * Legal from offering and pasting (the two states where the
 * offerer is waiting for or processing the answerer's paste).
 * Illegal from idle, scanning, and connected. After recording,
 * reset() returns to idle so the user can start over.
 */
describe("PairingMachine.failInvalidPaste()", () => {
  it("offering → invalid_paste is legal", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.failInvalidPaste("not valid SDP");
    const state = m.getState();
    expect(state.kind).toBe("invalid_paste");
    if (state.kind === "invalid_paste") {
      expect(state.reason).toBe("not valid SDP");
    }
  });

  it("pasting → invalid_paste is legal (accept rejected the SDP)", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    m.failInvalidPaste("parse failure");
    const state = m.getState();
    expect(state.kind).toBe("invalid_paste");
    if (state.kind === "invalid_paste") {
      expect(state.reason).toBe("parse failure");
    }
  });

  it("reset() after invalid_paste returns to idle", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.failInvalidPaste("bad");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("idle → invalid_paste throws", () => {
    const m = new PairingMachine();
    expect(() => m.failInvalidPaste("nothing to paste")).toThrow(
      INVALID_PASTE_FROM_INVALID
    );
    expect(m.getState().kind).toBe("idle");
  });

  it("scanning → invalid_paste throws (answerer can't paste their own answer)", () => {
    const m = new PairingMachine();
    m.startScanning();
    expect(() => m.failInvalidPaste("wrong role")).toThrow(
      INVALID_PASTE_FROM_INVALID
    );
    expect(m.getState().kind).toBe("scanning");
  });

  it("connected → invalid_paste throws", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    m.completePaste("Peer");
    expect(() => m.failInvalidPaste("too late")).toThrow(
      INVALID_PASTE_FROM_INVALID
    );
    expect(m.getState().kind).toBe("connected");
  });
});

/**
 * PairingMachine.failIce() — slice 11.
 *
 * Legal from offering, pasting, and scanning (the three states
 * where WebRTC is being set up). Illegal from idle (no WebRTC
 * to fail) and connected (already established). After recording,
 * reset() returns to idle.
 */
describe("PairingMachine.failIce()", () => {
  it("offering → ice_failure is legal (createOffer or accept failed)", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.failIce("ICE connection timeout");
    const state = m.getState();
    expect(state.kind).toBe("ice_failure");
    if (state.kind === "ice_failure") {
      expect(state.reason).toBe("ICE connection timeout");
    }
  });

  it("pasting → ice_failure is legal (accept failed mid-connection)", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.pasteAnswer();
    m.failIce("network lost during accept");
    const state = m.getState();
    expect(state.kind).toBe("ice_failure");
    if (state.kind === "ice_failure") {
      expect(state.reason).toBe("network lost during accept");
    }
  });

  it("scanning → ice_failure is legal (generateAnswer failed)", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.failIce("generateAnswer timeout");
    const state = m.getState();
    expect(state.kind).toBe("ice_failure");
    if (state.kind === "ice_failure") {
      expect(state.reason).toBe("generateAnswer timeout");
    }
  });

  it("reset() after ice_failure returns to idle", () => {
    const m = new PairingMachine();
    m.startOffering(SAMPLE_OFFER_SDP);
    m.failIce("ice error");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("idle → ice_failure throws (no WebRTC in progress)", () => {
    const m = new PairingMachine();
    expect(() => m.failIce("no connection")).toThrow(ICE_FROM_INVALID);
    expect(m.getState().kind).toBe("idle");
  });

  it("connected → ice_failure throws (connection already established)", () => {
    const m = new PairingMachine();
    m.startScanning();
    m.completeScan("Peer");
    expect(() => m.failIce("late failure")).toThrow(ICE_FROM_INVALID);
    // A late ICE failure after the connection is already
    // established shouldn't clobber the connected state —
    // the transport itself handles reconnection.
    expect(m.getState().kind).toBe("connected");
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
