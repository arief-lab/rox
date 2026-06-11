"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import {
  ConnectionStatus,
  deriveConnectionStatus,
} from "@/components/connection-status";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import { TransferProgress } from "@/components/transfer-progress";
import { useReceiveProgress } from "@/components/use-receive-progress";
import type { Inbox } from "@/lib/inbox";
import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
import { type SendHandle, send } from "@/lib/transfer";
import { startReceiveLoop } from "@/lib/transfer/receive-loop";
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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: The three
// render branches (idle / offering|pasting / connected) are inlined
// so the screen reads top-to-bottom as one story. Extracting each
// branch into a sub-component would push the complexity under 20
// but split the pairing-flow narrative across files. Tracked as a
// follow-up alongside the answerer-screen render tree.
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
  // Slice 7: track the in-flight send handle + progress for the
  // progress bar and Cancel button.
  const [inFlight, setInFlight] = useState<SendHandle | null>(null);
  const [progress, setProgress] = useState<{
    bytesSent: number;
    total: number;
  } | null>(null);
  // Slice 9: receive-side progress tracking lives in a custom
  // hook (useReceiveProgress) so the screen body stays under
  // ultracite's `noExcessiveCognitiveComplexity` limit. The
  // hook owns the incoming-handle ref, the receive-progress
  // state, the three startReceiveLoop callbacks, and the
  // Cancel handler.
  const {
    handleCancelReceive,
    receiveProgress,
    receiveLoopCallbacks,
    reset: resetReceiveProgress,
  } = useReceiveProgress();
  // Slice 8: set to true when the Session ends (idle timeout, page
  // hidden, peer disconnect). The screen stays mounted so the
  // header shows the "Disconnected" indicator — the "Close
  // session" button doubles as "Start over" and resets the
  // screen state when the Session is already closed.
  const [wasDisconnected, setWasDisconnected] = useState(false);
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
    // user close), keep the screen mounted and show the
    // "Disconnected" indicator in the header. The "Close session"
    // button now doubles as "Start over" — clicking it after the
    // Session has ended resets the screen state (wasDisconnected,
    // transport, machine). The Session has already cleared the
    // Inbox and closed the transport.
    const unsubscribe = sess.onClose(() => {
      setWasDisconnected(true);
      setSession(null);
    });
    setSession(sess);

    // Loop receive(transport) so N sequential file transfers are all
    // received per session. The helper handles the loop, the
    // in-flight handle tracking, and the cleanup race. The
    // onReceiveStart / onProgress / onEnd callbacks (from
    // useReceiveProgress) expose the current ReceiveHandle to
    // the screen so it can render a progress bar + Cancel button
    // for the in-flight receive — the symmetric UI to the
    // send-side progress bar wired in slice 7. Without these
    // callbacks, the user couldn't cancel an unwanted incoming
    // file (the loop owns the handle and the screen has no
    // other way to reach it).
    const receiveHandle = startReceiveLoop(
      transport,
      inbox,
      sess,
      receiveLoopCallbacks
    );
    return () => {
      receiveHandle.cancel();
      unsubscribe();
    };
    // receiveLoopCallbacks is stable (useCallback with empty
    // deps inside the hook) so it doesn't trigger effect
    // re-runs. `machine` is a stable ref (created once via
    // machineRef) and `inbox` is a stable prop reference, so
    // neither needs to be in the dep array — omitting them
    // prevents the effect from re-running when other state
    // (sendLog, send progress, receive progress) changes.
  }, [transport, inbox, receiveLoopCallbacks]);

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

  // Reset all screen state back to the idle screen. Extracted from
  // handleClose so the component body stays under ultracite's
  // `noExcessiveCognitiveComplexity` limit (the wasDisconnected
  // branch + connectionStatus derivation + handleClose together
  // pushed the function over 20). The hook's onEnd (wired to the
  // receive loop) clears the receive-progress state when the
  // Session ends; the receive state is set to null again here
  // as belt-and-suspenders in case the user clicks "Start over"
  // while a receive is in flight (the loop's cleanup also
  // cancels the in-flight receive).
  const resetToIdle = (): void => {
    setWasDisconnected(false);
    setSession(null);
    setTransport(null);
    setInFlight(null);
    setProgress(null);
    // Clear the receive-progress state held by the hook
    // synchronously — the loop's async `onEnd` isn't reliable
    // for the "Start over" path (user clicks while a receive is
    // in flight). Without this, the receive progress bar can
    // persist one render tick after the rest of the screen has
    // reset.
    resetReceiveProgress();
    setSendLog([]);
    offererHandleRef.current = null;
    machine.close();
    setState(machine.getState());
  };

  const handleClose = () => {
    if (wasDisconnected) {
      resetToIdle();
    } else {
      // Closing the Session triggers onClose → sets wasDisconnected
      // and shows the "Disconnected" indicator. The user can then
      // click "Start over" to fall back to the idle screen.
      session?.close("user closed");
      offererHandleRef.current = null;
    }
  };

  // Slice 8: derive the connection status from the Transport's
  // actual state and the wasDisconnected flag. The Transport
  // already exposes "connecting" | "open" | "closing" | "closed",
  // so we just map those to the three user-facing labels via
  // the shared helper.
  const connectionStatus = deriveConnectionStatus(transport, wasDisconnected);

  if (state.kind === "connected") {
    return (
      <div className="rounded-lg border p-4" data-testid="connected-state">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Connected</h2>
          <ConnectionStatus status={connectionStatus} />
        </div>
        <p className="mb-2 text-sm">Peer: {state.peerName ?? "(unknown)"}</p>
        {session ? <SessionTimer session={session} /> : null}
        <div className="mb-4" data-testid="send-section">
          <SendButton
            disabled={inFlight !== null || wasDisconnected}
            onSend={handleSend}
          />
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
        {/*
          Slice 9: receive-side progress bar + Cancel button. Shown
          when the peer is mid-send. The Cancel button calls
          handleCancelReceive, which calls ReceiveHandle.cancel()
          — the receiver-cancel protocol sends a cancel frame back
          to the sender, which stops the in-flight send. Without
          this, the user has no way to abort an unwanted incoming
          file (the loop owns the handle and the screen had no
          way to reach it). The bar and button are direction-aware
          (data-testid="receive-progress" / "receive-cancel") so
          e2e selectors can target the send and receive UIs
          independently.
        */}
        <div className="mb-4" data-testid="receive-section">
          {receiveProgress ? (
            <TransferProgress
              direction="receive"
              onCancel={handleCancelReceive}
              progress={{
                bytesSent: receiveProgress.bytesReceived,
                total: receiveProgress.total,
              }}
            />
          ) : null}
        </div>
        <InboxScreen inbox={inbox} />
        <button
          className="rounded bg-red-500 px-4 py-2 text-white"
          data-testid="close-session"
          onClick={handleClose}
          type="button"
        >
          {wasDisconnected ? "Start over" : "Close session"}
        </button>
      </div>
    );
  }

  if (state.kind === "offering" || state.kind === "pasting") {
    return (
      <div className="rounded-lg border p-4" data-testid="offering-state">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">
            {state.kind === "offering" ? "Show this QR" : "Connecting..."}
          </h2>
          <ConnectionStatus status={connectionStatus} />
        </div>
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
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Receive a file</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
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
