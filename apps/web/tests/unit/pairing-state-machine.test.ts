import { describe, expect, it } from "vitest";

import { PairingMachine } from "@/lib/pairing";

/**
 * PairingMachine unit tests.
 *
 * The machine has 9 states:
 *   idle | offering | scanning | pasting | connected | closing
 *   | malformed_qr | invalid_paste | ice_failure
 *
 * Legal transitions:
 *   idle → offering (startOffering)
 *   idle → scanning (startScanning)
 *   offering → pasting (pasteAnswer)
 *   scanning → connected (completeScan)
 *   pasting → connected (completePaste)
 *   idle | scanning → malformed_qr (failMalformedQr)
 *   offering | pasting → invalid_paste (failInvalidPaste)
 *   offering | pasting | scanning → ice_failure (failIce)
 *   any → closing (close) — except idle and closing (which are no-ops)
 *   any → idle (reset)
 */

const DEMO_SDP = "v=0\no=- 12345 67890 IN IP4 192.168.1.1\n";

function makeMachine() {
  return new PairingMachine();
}

/** Kept as top-level constants so they're not re-created on every assertion. */
const ILLEGAL_TRANSITION_REGEX = /Illegal Pairing transition/;
const QR_GUARD_REGEX = /must be idle or scanning/;
const PASTE_GUARD_REGEX = /must be offering or pasting/;
const ICE_GUARD_REGEX = /must be offering, pasting, or scanning/;

// ── Legal transitions ────────────────────────────────────────────

describe("PairingMachine: idle → offering", () => {
  it("startOffering transitions from idle to offering with the SDP", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    const state = m.getState();
    expect(state.kind).toBe("offering");
    if (state.kind === "offering") {
      expect(state.offerSdp).toBe(DEMO_SDP);
    }
  });

  it("startOffering from a non-idle state throws", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    expect(() => m.startOffering("another")).toThrow(ILLEGAL_TRANSITION_REGEX);
    expect(m.getState().kind).toBe("offering");
  });
});

describe("PairingMachine: idle → scanning", () => {
  it("startScanning transitions from idle to scanning", () => {
    const m = makeMachine();
    m.startScanning();
    expect(m.getState().kind).toBe("scanning");
  });

  it("startScanning from a non-idle state throws", () => {
    const m = makeMachine();
    m.startScanning();
    expect(() => m.startScanning()).toThrow(ILLEGAL_TRANSITION_REGEX);
    expect(m.getState().kind).toBe("scanning");
  });
});

describe("PairingMachine: offering → pasting", () => {
  it("pasteAnswer transitions from offering to pasting, preserving the SDP", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    const state = m.getState();
    expect(state.kind).toBe("pasting");
    if (state.kind === "pasting") {
      expect(state.offerSdp).toBe(DEMO_SDP);
    }
  });

  it("pasteAnswer from scanning throws", () => {
    const m = makeMachine();
    m.startScanning();
    expect(() => m.pasteAnswer()).toThrow(ILLEGAL_TRANSITION_REGEX);
  });

  it("pasteAnswer from pasting throws", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    expect(() => m.pasteAnswer()).toThrow(ILLEGAL_TRANSITION_REGEX);
  });
});

describe("PairingMachine: scanning → connected", () => {
  it("completeScan transitions from scanning to connected with an optional peer name", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan("Alice's iPhone");
    const state = m.getState();
    expect(state.kind).toBe("connected");
    if (state.kind === "connected") {
      expect(state.peerName).toBe("Alice's iPhone");
    }
  });

  it("completeScan transitions without a peer name", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan();
    expect(m.getState().kind).toBe("connected");
  });

  it("completeScan from offering throws", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    expect(() => m.completeScan()).toThrow(ILLEGAL_TRANSITION_REGEX);
  });
});

describe("PairingMachine: pasting → connected", () => {
  it("completePaste transitions from pasting to connected with an optional peer name", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.completePaste("Bob's Pixel");
    const state = m.getState();
    expect(state.kind).toBe("connected");
    if (state.kind === "connected") {
      expect(state.peerName).toBe("Bob's Pixel");
    }
  });

  it("completePaste transitions without a peer name", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.completePaste();
    expect(m.getState().kind).toBe("connected");
  });

  it("completePaste from scanning throws", () => {
    const m = makeMachine();
    m.startScanning();
    expect(() => m.completePaste()).toThrow(ILLEGAL_TRANSITION_REGEX);
  });
});

// ── Failure transitions ──────────────────────────────────────────

describe("PairingMachine: failMalformedQr", () => {
  it("legal from idle", () => {
    const m = makeMachine();
    m.failMalformedQr("not a QR");
    const state = m.getState();
    expect(state.kind).toBe("malformed_qr");
    if (state.kind === "malformed_qr") {
      expect(state.reason).toBe("not a QR");
    }
  });

  it("legal from scanning", () => {
    const m = makeMachine();
    m.startScanning();
    m.failMalformedQr("decoded but invalid");
    const state = m.getState();
    expect(state.kind).toBe("malformed_qr");
    if (state.kind === "malformed_qr") {
      expect(state.reason).toBe("decoded but invalid");
    }
  });

  it("throws from offering", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    expect(() => m.failMalformedQr("x")).toThrow(QR_GUARD_REGEX);
    expect(m.getState().kind).toBe("offering");
  });

  it("throws from pasting", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    expect(() => m.failMalformedQr("x")).toThrow(QR_GUARD_REGEX);
    expect(m.getState().kind).toBe("pasting");
  });

  it("throws from connected", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan();
    expect(() => m.failMalformedQr("x")).toThrow(QR_GUARD_REGEX);
    expect(m.getState().kind).toBe("connected");
  });
});

describe("PairingMachine: failInvalidPaste", () => {
  it("legal from offering", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failInvalidPaste("not an SDP answer");
    const state = m.getState();
    expect(state.kind).toBe("invalid_paste");
    if (state.kind === "invalid_paste") {
      expect(state.reason).toBe("not an SDP answer");
    }
  });

  it("legal from pasting", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.failInvalidPaste("corrupted answer");
    const state = m.getState();
    expect(state.kind).toBe("invalid_paste");
    if (state.kind === "invalid_paste") {
      expect(state.reason).toBe("corrupted answer");
    }
  });

  it("throws from scanning", () => {
    const m = makeMachine();
    m.startScanning();
    expect(() => m.failInvalidPaste("x")).toThrow(PASTE_GUARD_REGEX);
    expect(m.getState().kind).toBe("scanning");
  });

  it("throws from idle", () => {
    const m = makeMachine();
    expect(() => m.failInvalidPaste("x")).toThrow(PASTE_GUARD_REGEX);
    expect(m.getState().kind).toBe("idle");
  });

  it("throws from connected", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.completePaste();
    expect(() => m.failInvalidPaste("x")).toThrow(PASTE_GUARD_REGEX);
    expect(m.getState().kind).toBe("connected");
  });
});

describe("PairingMachine: failIce", () => {
  it("legal from offering", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failIce("ICE connection failed");
    const state = m.getState();
    expect(state.kind).toBe("ice_failure");
    if (state.kind === "ice_failure") {
      expect(state.reason).toBe("ICE connection failed");
    }
  });

  it("legal from pasting", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.failIce("ICE timeout");
    expect(m.getState().kind).toBe("ice_failure");
  });

  it("legal from scanning", () => {
    const m = makeMachine();
    m.startScanning();
    m.failIce("no candidate pair");
    expect(m.getState().kind).toBe("ice_failure");
  });

  it("throws from idle", () => {
    const m = makeMachine();
    expect(() => m.failIce("x")).toThrow(ICE_GUARD_REGEX);
    expect(m.getState().kind).toBe("idle");
  });

  it("throws from connected", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.completePaste();
    expect(() => m.failIce("x")).toThrow(ICE_GUARD_REGEX);
    expect(m.getState().kind).toBe("connected");
  });

  it("throws from malformed_qr", () => {
    const m = makeMachine();
    m.failMalformedQr("bad");
    expect(() => m.failIce("x")).toThrow(ICE_GUARD_REGEX);
    expect(m.getState().kind).toBe("malformed_qr");
  });

  it("throws from invalid_paste", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failInvalidPaste("bad");
    expect(() => m.failIce("x")).toThrow(ICE_GUARD_REGEX);
    expect(m.getState().kind).toBe("invalid_paste");
  });
});

// ── Close and reset ──────────────────────────────────────────────

describe("PairingMachine: close", () => {
  it("transitions offering → closing", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("transitions scanning → closing", () => {
    const m = makeMachine();
    m.startScanning();
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("transitions pasting → closing", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("transitions connected → closing", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan();
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("transitions malformed_qr → closing", () => {
    const m = makeMachine();
    m.failMalformedQr("bad");
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("transitions ice_failure → closing", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failIce("no ice");
    m.close();
    expect(m.getState().kind).toBe("closing");
  });

  it("is a no-op from idle", () => {
    const m = makeMachine();
    m.close();
    expect(m.getState().kind).toBe("idle");
  });

  it("is a no-op from closing", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.close();
    m.close(); // second call
    expect(m.getState().kind).toBe("closing");
  });

  it("is a no-op from closing (started from scanning)", () => {
    const m = makeMachine();
    m.startScanning();
    m.close();
    m.close();
    expect(m.getState().kind).toBe("closing");
  });
});

describe("PairingMachine: reset", () => {
  it("resets from offering to idle", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from scanning to idle", () => {
    const m = makeMachine();
    m.startScanning();
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from pasting to idle", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.pasteAnswer();
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from connected to idle", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan();
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from closing to idle", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.close();
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from malformed_qr to idle", () => {
    const m = makeMachine();
    m.failMalformedQr("bad");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from invalid_paste to idle", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failInvalidPaste("bad");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("resets from ice_failure to idle", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failIce("no ice");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });

  it("reset is idempotent from idle", () => {
    const m = makeMachine();
    m.reset();
    expect(m.getState().kind).toBe("idle");
    m.reset();
    expect(m.getState().kind).toBe("idle");
  });
});

// ── Full lifecycle sequences ─────────────────────────────────────

describe("PairingMachine: full lifecycle sequences", () => {
  it("offerer flow: idle → offering → pasting → connected", () => {
    const m = makeMachine();
    expect(m.getState().kind).toBe("idle");
    m.startOffering(DEMO_SDP);
    expect(m.getState().kind).toBe("offering");
    m.pasteAnswer();
    expect(m.getState().kind).toBe("pasting");
    m.completePaste("Bob");
    expect(m.getState().kind).toBe("connected");
    if (m.getState().kind === "connected") {
      expect(m.getState().peerName).toBe("Bob");
    }
  });

  it("answerer flow: idle → scanning → connected", () => {
    const m = makeMachine();
    m.startScanning();
    expect(m.getState().kind).toBe("scanning");
    m.completeScan("Alice");
    expect(m.getState().kind).toBe("connected");
    if (m.getState().kind === "connected") {
      expect(m.getState().peerName).toBe("Alice");
    }
  });

  it("malformed QR: scanning → malformed_qr → reset → offering", () => {
    const m = makeMachine();
    m.startScanning();
    m.failMalformedQr("not a QR");
    expect(m.getState().kind).toBe("malformed_qr");
    m.reset();
    m.startOffering(DEMO_SDP);
    expect(m.getState().kind).toBe("offering");
  });

  it("ICE failure: offering → ice_failure → reset → scanning", () => {
    const m = makeMachine();
    m.startOffering(DEMO_SDP);
    m.failIce("no candidates");
    expect(m.getState().kind).toBe("ice_failure");
    m.reset();
    m.startScanning();
    expect(m.getState().kind).toBe("scanning");
  });

  it("close from connected and reset to offer again", () => {
    const m = makeMachine();
    m.startScanning();
    m.completeScan("Alice");
    m.close();
    expect(m.getState().kind).toBe("closing");
    m.reset();
    m.startOffering(DEMO_SDP);
    expect(m.getState().kind).toBe("offering");
  });
});
