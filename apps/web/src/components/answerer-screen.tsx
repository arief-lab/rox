"use client";

import { useEffect, useRef, useState } from "react";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import { TransferProgress } from "@/components/transfer-progress";
import type { Inbox } from "@/lib/inbox";
import {
  decodeOffer,
  generateAnswer,
  PairingMachine,
  writeClipboard,
} from "@/lib/pairing";
import { type SendHandle, send } from "@/lib/transfer";
import { startReceiveLoop } from "@/lib/transfer/receive-loop";
import { Session, type Transport } from "@/lib/webrtc";

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
  const [session, setSession] = useState<Session | null>(null);
  const [sendLog, setSendLog] = useState<string[]>([]);
  const [peerName, setPeerName] = useState<string | undefined>(undefined);
  // Slice 7: track the in-flight send handle + progress for the
  // progress bar and Cancel button. `inFlight` is null when no
  // transfer is in progress; `progress` is null alongside it.
  const [inFlight, setInFlight] = useState<SendHandle | null>(null);
  const [progress, setProgress] = useState<{
    bytesSent: number;
    total: number;
  } | null>(null);

  // When the transport opens, create a Session, start receiving, and
  // push to the Inbox. The InboxScreen subscribes to the Inbox and
  // re-renders on push. The Session wraps the Transport for the
  // Session lifecycle (idle timer, pagehide, close propagation).
  useEffect(() => {
    if (!transport) {
      return;
    }
    const sess = new Session(transport, inbox);
    sess.start();
    const unsubscribe = sess.onClose(() => {
      setSession(null);
      setTransport(null);
      machine.close();
      setState(machine.getState());
    });
    setSession(sess);

    // Loop receive(transport) so N sequential file transfers are all
    // received per session. The helper handles the loop, the
    // in-flight handle tracking, and the cleanup race.
    const receiveHandle = startReceiveLoop(transport, inbox, sess);
    return () => {
      receiveHandle.cancel();
      unsubscribe();
    };
  }, [transport, inbox, machine]);

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
    const handle = send(file, transport, {
      onProgress: (bytesSent, total) => {
        setProgress({ bytesSent, total });
      },
    });
    setInFlight(handle);
    setProgress({ bytesSent: 0, total: file.size });
    setSendLog((log) => [
      ...log,
      `Sending ${file.name} (${file.size} bytes)...`,
    ]);
    try {
      await handle.promise;
      setSendLog((log) => [...log, `Sent ${file.name}`]);
    } catch (err) {
      setSendLog((log) => [
        ...log,
        `Cancelled ${file.name}: ${err instanceof Error ? err.message : "transfer failed"}`,
      ]);
    } finally {
      setInFlight(null);
      setProgress(null);
    }
    session?.notifyActivity();
  };

  const handleCancelSend = (): void => {
    inFlight?.cancel();
  };

  const handleClose = () => {
    // Closing the Session triggers onClose → clears the inbox,
    // closes the transport, and falls back to the idle screen.
    session?.close("user closed");
  };

  if (state.kind === "connected") {
    return (
      <div className="rounded-lg border p-4" data-testid="connected-state">
        <h2 className="mb-2 font-medium">Connected</h2>
        <p className="mb-2 text-sm">Peer: {state.peerName ?? "(unknown)"}</p>
        {session ? <SessionTimer session={session} /> : null}
        <div className="mb-4" data-testid="send-section">
          <SendButton disabled={inFlight !== null} onSend={handleSend} />
          {progress ? (
            <TransferProgress onCancel={handleCancelSend} progress={progress} />
          ) : null}
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
