"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { InboxRow } from "@/components/inbox-row";
import { SendButton } from "@/components/send-button";
import type { Inbox, InboxEntry } from "@/lib/inbox";
import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
import { receive, send } from "@/lib/transfer";
import { createOffer, type Transport } from "@/lib/webrtc";

type OffererHandle = Awaited<ReturnType<typeof createOffer>>;

interface PairingScreenProps {
  inbox: Inbox;
}

/**
 * Offerer-side Pairing screen.
 *
 * Flow:
 * 1. User clicks "Start receiving" → calls createOffer() → displays QR
 * 2. User pastes the answerer's answer text → parseAnswer() → accept() → Connected
 * 3. Once connected, both sides can send and receive files via the Inbox
 *
 * The PairingMachine tracks which step the user is on. The component
 * mirrors the machine's state.
 */
export function PairingScreen({ inbox }: PairingScreenProps) {
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
  const [sendLog, setSendLog] = useState<string[]>([]);
  const [inboxEntries, setInboxEntries] = useState<readonly InboxEntry[]>(
    inbox.list()
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const offerSdp =
    state.kind === "offering" || state.kind === "pasting" ? state.offerSdp : "";

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

  // When the transport opens, start receiving and subscribe to Inbox changes.
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
        setInboxEntries([...inbox.list()]);
      })
      .catch(() => {
        // Transfer failed — Inbox stays untouched (PRD invariant).
      });
    return () => {
      handle.cancel();
    };
  }, [transport, inbox]);

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
    offererHandleRef.current = null;
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
        <div className="mb-4" data-testid="inbox-section">
          <h3 className="mb-2 font-medium text-sm">Inbox</h3>
          {inboxEntries.length === 0 ? (
            <p className="text-gray-500 text-xs" data-testid="inbox-empty">
              No files received yet.
            </p>
          ) : (
            inboxEntries.map((entry) => (
              <InboxRow entry={entry} key={entry.id} />
            ))
          )}
        </div>
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
