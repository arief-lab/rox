"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
import { createOffer, type Transport } from "@/lib/webrtc";

type OffererHandle = Awaited<ReturnType<typeof createOffer>>;

/**
 * Offerer-side Pairing screen.
 *
 * Flow:
 * 1. User clicks "Start receiving" → calls createOffer() → displays QR
 * 2. User pastes the answerer's answer text → parseAnswer() → accept() → Connected
 *
 * The PairingMachine tracks which step the user is on and rejects
 * illegal transitions. The component mirrors the machine's state.
 *
 * The offerer handle is stored in a ref so handlePaste can reuse it —
 * the offer SDP the answerer scans must be the same SDP the offerer
 * uses to accept the answer.
 */
export function PairingScreen() {
  const machineRef = useRef<PairingMachine | null>(null);
  if (machineRef.current === null) {
    machineRef.current = new PairingMachine();
  }
  const machine = machineRef.current;

  const offererHandleRef = useRef<OffererHandle | null>(null);

  const [state, setState] = useState(machine.getState());
  const [pastedText, setPastedText] = useState("");
  const [error, setError] = useState("");
  const [transport, setTransport] = useState<Transport | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const offerSdp =
    state.kind === "offering" || state.kind === "pasting" ? state.offerSdp : "";

  // Expose the offer SDP to window for e2e testability. The visible
  // offer-sdp element is truncated to 80 chars; tests need the full SDP.
  useEffect(() => {
    if (typeof window !== "undefined" && offerSdp) {
      (window as unknown as { __offerSdp?: string }).__offerSdp = offerSdp;
    }
  }, [offerSdp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && offerSdp)) {
      return;
    }
    QRCode.toCanvas(canvas, encodeOffer(offerSdp), {
      width: 256,
      margin: 1,
    }).catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "QR render failed")
    );
  }, [offerSdp]);

  const handleStart = async () => {
    setError("");
    try {
      const offerer = await createOffer();
      offererHandleRef.current = offerer;
      machine.startOffering(offerer.offerSdp);
      setState(machine.getState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create offer");
    }
  };

  const handleReadClipboard = async () => {
    setError("");
    try {
      const text = await readClipboard();
      setPastedText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clipboard read failed");
    }
  };

  const handlePaste = async () => {
    setError("");
    try {
      const decoded = parseAnswer(pastedText);
      machine.pasteAnswer();
      setState(machine.getState());
      // Reuse the offerer handle from handleStart — do NOT call
      // createOffer() again, or the SDPs won't match.
      const offerer = offererHandleRef.current;
      if (!offerer) {
        throw new Error("No active offer — click 'Start receiving' first");
      }
      const t = await offerer.accept(decoded.sdp);
      machine.completePaste(decoded.name);
      setState(machine.getState());
      setTransport(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to paste answer");
    }
  };

  const handleClose = () => {
    machine.close();
    setState(machine.getState());
    transport?.close("user closed");
    offererHandleRef.current = null;
  };

  if (state.kind === "connected") {
    return (
      <div className="rounded-lg border p-4" data-testid="connected-state">
        <h2 className="mb-2 font-medium">Connected</h2>
        <p className="mb-2 text-sm">Peer: {state.peerName ?? "(unknown)"}</p>
        <button
          className="rounded bg-red-500 px-4 py-2 text-white"
          data-testid="close-session"
          onClick={handleClose}
          type="button"
        >
          Close session
        </button>
      </div>
    );
  }

  if (state.kind === "offering" || state.kind === "pasting") {
    return (
      <div className="rounded-lg border p-4" data-testid="offering-state">
        <h2 className="mb-2 font-medium">
          {state.kind === "offering" ? "Show this QR" : "Connecting..."}
        </h2>
        <canvas
          className="mt-2 border"
          data-testid="qr-canvas"
          ref={canvasRef}
        />
        <p className="mt-2 text-sm">
          Offer SDP:{" "}
          <code className="break-all text-xs" data-testid="offer-sdp">
            {offerSdp.slice(0, 80)}...
          </code>
        </p>
        <div className="mt-4">
          <button
            className="rounded bg-purple-500 px-4 py-2 text-white"
            data-testid="read-clipboard"
            onClick={handleReadClipboard}
            type="button"
          >
            Read answer from clipboard
          </button>
          <textarea
            className="mt-2 w-full rounded border p-2 text-xs"
            data-testid="paste-area"
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Or paste answer text here..."
            value={pastedText}
          />
          <button
            className="mt-2 rounded bg-green-500 px-4 py-2 text-white"
            data-testid="paste-answer"
            disabled={!pastedText}
            onClick={handlePaste}
            type="button"
          >
            Connect with pasted answer
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4" data-testid="idle-state">
      <h2 className="mb-2 font-medium">Receive a file</h2>
      <p className="mb-2 text-gray-500 text-sm">
        Start a Pairing session. A QR code will appear for the other device to
        scan.
      </p>
      <button
        className="rounded bg-blue-500 px-4 py-2 text-white"
        data-testid="start-receiving"
        onClick={handleStart}
        type="button"
      >
        Start receiving
      </button>
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
