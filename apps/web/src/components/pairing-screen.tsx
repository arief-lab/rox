"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { deriveConnectionStatus } from "@/components/connection-status";
import { ConnectedView } from "@/components/pairing-screen/connected-view";
import { IdleView } from "@/components/pairing-screen/idle-view";
import { OfferingPastingView } from "@/components/pairing-screen/offering-pasting-view";
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
 * mirrors the machine's state. The three render branches (idle,
 * offering|pasting, connected) are extracted into sub-components
 * under `components/pairing-screen/` to keep the screen body
 * under ultracite's `noExcessiveCognitiveComplexity` limit.
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

  // The three render branches are extracted into sub-components
  // (IdleView / OfferingPastingView / ConnectedView) so the
  // screen body stays under ultracite's
  // `noExcessiveCognitiveComplexity` limit. The sub-components
  // take the screen's state and handlers as props and render
  // their respective tree.
  if (state.kind === "connected") {
    return (
      <ConnectedView
        connectionStatus={connectionStatus}
        handleCancelReceive={handleCancelReceive}
        handleCancelSend={handleCancelSend}
        handleClose={handleClose}
        handleSend={handleSend}
        inbox={inbox}
        inFlight={inFlight}
        peerName={state.peerName}
        progress={progress}
        receiveProgress={receiveProgress}
        sendLog={sendLog}
        session={session}
        wasDisconnected={wasDisconnected}
      />
    );
  }

  if (state.kind === "offering" || state.kind === "pasting") {
    return (
      <OfferingPastingView
        connectionStatus={connectionStatus}
        error={error}
        label={state.kind === "offering" ? "Show this QR" : "Connecting..."}
        offerSdp={offerSdp}
        onPaste={handlePaste}
        onPastedTextChange={setPastedText}
        onReadClipboard={handleReadClipboard}
        pastedText={pastedText}
        qrCanvasRef={canvasRef}
      />
    );
  }

  return (
    <IdleView
      connectionStatus={connectionStatus}
      error={error}
      onStart={handleStart}
    />
  );
}
