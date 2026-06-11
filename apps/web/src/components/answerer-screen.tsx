"use client";

import { useEffect, useRef, useState } from "react";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import type { Inbox } from "@/lib/inbox";
import {
  decodeOffer,
  generateAnswer,
  PairingMachine,
  writeClipboard,
} from "@/lib/pairing";
import { receive, send } from "@/lib/transfer";
import type { Transport } from "@/lib/webrtc";

interface AnswererScreenProps {
  inbox: Inbox;
}

/**
 * Answerer-side Pairing screen.
 *
 * Flow:
 * 1. User pastes the offerer's QR text (or scans it) → decodeOffer()
 * 2. User clicks "Generate answer" → generateAnswer() → copies to clipboard
 * 3. When the DataChannel opens, the transport resolves → Connected
 * 4. Once connected, both sides can send and receive files via the Inbox
 */
export function AnswererScreen({ inbox }: AnswererScreenProps) {
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
  const [sendLog, setSendLog] = useState<string[]>([]);
  const [peerName, setPeerName] = useState<string | undefined>(undefined);

  // When the transport opens, start receiving and push to the Inbox. The
  // InboxScreen subscribes to the Inbox directly and re-renders on push.
  useEffect(() => {
    if (!transport) {
      return;
    }
    const handle = receive(transport);
    handle.promise
      .then(({ name, blob }) => {
        inbox.push({
          id: crypto.randomUUID(),
          name,
          size: blob.size,
          blob,
          receivedAt: Date.now(),
        });
      })
      .catch(() => {
        // Transfer failed — Inbox stays untouched.
      });
    return () => {
      handle.cancel();
    };
  }, [transport, inbox]);

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
      if (typeof window !== "undefined") {
        (window as unknown as { __answerText?: string }).__answerText =
          result.answerText;
      }
      await writeClipboard(result.answerText);
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

  const handleSend = async (file: File) => {
    if (!transport) {
      return;
    }
    const handle = send(file, transport);
    setSendLog((log) => [
      ...log,
      `Sending ${file.name} (${file.size} bytes)...`,
    ]);
    await handle.promise;
    setSendLog((log) => [...log, `Sent ${file.name}`]);
  };

  const handleClose = () => {
    machine.close();
    setState(machine.getState());
    transport?.close("user closed");
    setTransport(null);
  };

  if (state.kind === "connected") {
    return (
      <div className="rounded-lg border p-4" data-testid="connected-state">
        <h2 className="mb-2 font-medium">Connected</h2>
        <p className="mb-2 text-sm">Peer: {state.peerName ?? "(unknown)"}</p>
        <div className="mb-4" data-testid="send-section">
          <SendButton onSend={handleSend} />
          {sendLog.length > 0 ? (
            <pre
              className="mt-2 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-xs"
              data-testid="send-log"
            >
              {sendLog.join("\n")}
            </pre>
          ) : null}
        </div>
        <InboxScreen inbox={inbox} />
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
