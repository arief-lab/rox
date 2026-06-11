/**
 * Pairing state machine.
 *
 * The state machine is pure — it tracks which step of the Pairing flow
 * the user is on, and rejects illegal transitions. It does NOT do any
 * WebRTC work; the UI orchestrates the WebRTC calls and dispatches
 * transitions to the machine.
 *
 * States:
 * - idle: initial state, no Pairing in progress
 * - offering: offerer has generated an offer SDP and is showing the QR
 * - scanning: answerer is scanning the QR
 * - pasting: offerer is waiting for the answerer to paste the answer
 * - connected: DataChannel is open, Session is live
 * - closing: Session is being torn down
 * - malformed_qr: the scanned QR text was not a valid PairingPayload
 * - invalid_paste: the pasted answer text was not a valid SDP answer
 * - ice_failure: the WebRTC connection could not be established
 *
 * Legal transitions:
 * - idle → offering (startOffering)
 * - idle → scanning (startScanning)
 * - offering → pasting (pasteAnswer)
 * - scanning → connected (completeScan)
 * - pasting → connected (completePaste)
 * - idle | scanning → malformed_qr (failMalformedQr)
 * - offering | pasting → invalid_paste (failInvalidPaste)
 * - offering | pasting | scanning → ice_failure (failIce)
 * - any → closing (close)
 * - any → idle (reset)
 *
 * Illegal transitions throw an Error so tests can assert on them.
 */

export type PairingState =
  | { kind: "idle" }
  | { kind: "offering"; offerSdp: string }
  | { kind: "scanning" }
  | { kind: "pasting"; offerSdp: string }
  | { kind: "connected"; peerName?: string }
  | { kind: "closing" }
  | { kind: "malformed_qr"; reason: string }
  | { kind: "invalid_paste"; reason: string }
  | { kind: "ice_failure"; reason: string };

export class PairingMachine {
  private state: PairingState = { kind: "idle" };

  getState(): Readonly<PairingState> {
    return this.state;
  }

  startOffering(offerSdp: string): void {
    this.assertKind("idle");
    this.state = { kind: "offering", offerSdp };
  }

  startScanning(): void {
    this.assertKind("idle");
    this.state = { kind: "scanning" };
  }

  completeScan(peerName?: string): void {
    this.assertKind("scanning");
    this.state = { kind: "connected", peerName };
  }

  pasteAnswer(): void {
    this.assertKind("offering");
    // assertKind narrowed this.state to { kind: "offering"; offerSdp: string }
    // but TS can't carry the narrowing across a this.* boundary, so we
    // re-read with a local variable.
    const current = this.state;
    if (current.kind !== "offering") {
      return;
    }
    this.state = { kind: "pasting", offerSdp: current.offerSdp };
  }

  completePaste(peerName?: string): void {
    this.assertKind("pasting");
    this.state = { kind: "connected", peerName };
  }

  /**
   * Record a malformed QR scan. Legal from idle (decodeOffer threw
   * before startScanning was called) or scanning (the caller advanced
   * the machine speculatively before decoding). After recording,
   * the caller should reset() to return to idle.
   */
  failMalformedQr(reason: string): void {
    if (this.state.kind !== "idle" && this.state.kind !== "scanning") {
      throw new Error(
        `Cannot fail with malformed QR from "${this.state.kind}" — must be idle or scanning`
      );
    }
    this.state = { kind: "malformed_qr", reason };
  }

  /**
   * Record an invalid paste. Legal from offering or pasting. After
   * recording, the caller should reset() to return to idle.
   */
  failInvalidPaste(reason: string): void {
    if (this.state.kind !== "offering" && this.state.kind !== "pasting") {
      throw new Error(
        `Cannot fail with invalid paste from "${this.state.kind}" — must be offering or pasting`
      );
    }
    this.state = { kind: "invalid_paste", reason };
  }

  /**
   * Record an ICE failure. Legal from offering, pasting, or scanning
   * (the states where WebRTC setup is in progress). After recording,
   * the caller should reset() to return to idle.
   */
  failIce(reason: string): void {
    if (
      this.state.kind !== "offering" &&
      this.state.kind !== "pasting" &&
      this.state.kind !== "scanning"
    ) {
      throw new Error(
        `Cannot fail with ICE from "${this.state.kind}" — must be offering, pasting, or scanning`
      );
    }
    this.state = { kind: "ice_failure", reason };
  }

  close(): void {
    if (this.state.kind === "idle" || this.state.kind === "closing") {
      return;
    }
    this.state = { kind: "closing" };
  }

  reset(): void {
    this.state = { kind: "idle" };
  }

  private assertKind(expected: PairingState["kind"]): void {
    if (this.state.kind !== expected) {
      throw new Error(
        `Illegal Pairing transition: expected to be in "${expected}" but was in "${this.state.kind}"`
      );
    }
  }
}
