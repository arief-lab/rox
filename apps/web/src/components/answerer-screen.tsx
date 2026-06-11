"use client";

import { useRef, useState } from "react";

import {
  decodeOffer,
  generateAnswer,
  PairingMachine,
  writeClipboard,
} from "@/lib/pairing";
import type { Transport } from "@/lib/webrtc";

/**
 * Answerer-side Pairing screen.
 *
 * Flow:
 * 1. User pastes the offerer's QR text (or scans it) → decodeOffer()
 * 2. User clicks "Generate answer" → generateAnswer() → copies to clipboard
 * 3. When the DataChannel opens, the transport resolves → Connected
 *
 * The PairingMachine tracks which step the user is on.
 */
export function AnswererScreen() {
  const machineRef = useRef<PairingMachine | null>(null);
  if (machineRef.current === null) {
    machineRef.current = new PairingMachine();
  }
  const machine = machineRef.current;

  const [state, setState] = useState(machine.getState());
  const [scannedText, setScannedText] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [error, setError] = useState("");
  const [transport, setTransport] = useState<Transport | null>(null);
  const [peerName, setPeerName] = useState<string | undefined>(undefined);

  const handleScan = () => {
    setError("");
    try {
      const decoded = decodeOffer(scannedText);
      setPeerName(decoded.name);
      machine.startScanning();
      setState(machine.getState());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to decode QR");
    }
  };

  const handleGenerate = async () => {
    setError("");
    try {
      const decoded = decodeOffer(scannedText);
      const result = await generateAnswer(decoded.sdp, "Answerer");
      setAnswerText(result.answerText);
      // Expose the answer text to window for e2e testability
      if (typeof window !== "undefined") {
        (window as unknown as { __answerText?: string }).__answerText =
          result.answerText;
      }
      // Copy to clipboard
      await writeClipboard(result.answerText);
      // Wait for transport
      result.transport.then((t) => {
        machine.completeScan(decoded.name);
        setState(machine.getState());
        setTransport(t);
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate answer"
      );
    }
  };

  const handleClose = () => {
    machine.close();
    setState(machine.getState());
    transport?.close("user closed");
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

  if (state.kind === "scanning") {
    return (
      <div
        className="rounded-lg border p-4"
        data-testid="answerer-scanning-state"
      >
        <h2 className="mb-2 font-medium">Generate answer</h2>
        <p className="mb-2 text-gray-500 text-sm">
          Offerer: {peerName ?? "(unknown)"}. Click below to generate the answer
          and copy it to your clipboard.
        </p>
        <button
          className="rounded bg-green-500 px-4 py-2 text-white"
          data-testid="generate-answer"
          onClick={handleGenerate}
          type="button"
        >
          Generate answer & copy
        </button>
        {answerText ? (
          <p className="mt-2 text-sm">
            Answer copied to clipboard:{" "}
            <code className="break-all text-xs" data-testid="answer-text">
              {answerText.slice(0, 80)}...
            </code>
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4" data-testid="answerer-idle-state">
      <h2 className="mb-2 font-medium">Send a file</h2>
      <p className="mb-2 text-gray-500 text-sm">
        Paste the offerer's QR text below (or scan it with your camera).
      </p>
      <textarea
        className="w-full rounded border p-2 text-xs"
        data-testid="scan-area"
        onChange={(e) => setScannedText(e.target.value)}
        placeholder="Paste offer text here..."
        value={scannedText}
      />
      <button
        className="mt-2 rounded bg-blue-500 px-4 py-2 text-white"
        data-testid="scan-qr"
        disabled={!scannedText}
        onClick={handleScan}
        type="button"
      >
        Scan
      </button>
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
