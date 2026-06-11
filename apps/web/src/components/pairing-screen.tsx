"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import type { Inbox } from "@/lib/inbox";
import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
import { type ReceiveHandle, receive, send } from "@/lib/transfer";
import { createOffer, Session, type Transport } from "@/lib/webrtc";

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
  const [session, setSession] = useState<Session | null>(null);
  const [sendLog, setSendLog] = useState<string[]>([]);
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
    // When the Session ends (idle, pagehide, peer disconnect, or
    // user close), fall back to the idle screen. The Session has
    // already cleared the Inbox and closed the transport.
    const unsubscribe = sess.onClose(() => {
      setSession(null);
      setTransport(null);
      machine.close();
      setState(machine.getState());
    });
    setSession(sess);

    // Loop receive(transport) so N sequential file transfers are all
    // received per session. The first receive() call resolves after
    // the first file completes; without this loop, the second send
    // would be dropped on the floor. Each receive() cleans up its
    // own subscriptions when the file completes, so calling it
    // again is safe. The loop breaks on any rejection (transport
    // close, protocol error, or cancel) — in all three cases the
    // session is ending or already ended.
    let cancelled = false;
    let currentHandle: ReceiveHandle | null = null;
    const receiveLoop = async (): Promise<void> => {
      while (!cancelled) {
        const handle = receive(transport);
        currentHandle = handle;
        try {
          const { name, blob } = await handle.promise;
          inbox.push({
            id: crypto.randomUUID(),
            name,
            size: blob.size,
            blob,
            receivedAt: Date.now(),
          });
          sess.notifyActivity();
        } catch {
          // Transfer failed — Inbox stays untouched (PRD invariant).
          // Stop the loop: transport close, protocol error, or cancel.
          break;
        }
      }
    };
    receiveLoop();
    return () => {
      cancelled = true;
      currentHandle?.cancel();
      unsubscribe();
    };
  }, [transport, inbox, machine]);

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
    session?.notifyActivity();
  };

  const handleClose = () => {
    // Closing the Session triggers onClose → clears the inbox,
    // closes the transport, and falls back to the idle screen.
    session?.close("user closed");
    offererHandleRef.current = null;
  };

  if (state.kind === "connected") {
    return (
      <div className="rounded-lg border p-4" data-testid="connected-state">
        <h2 className="mb-2 font-medium">Connected</h2>
        <p className="mb-2 text-sm">Peer: {state.peerName ?? "(unknown)"}</p>
        {session ? <SessionTimer session={session} /> : null}
        {session ? <SessionTimer session={session} /> : null}
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
