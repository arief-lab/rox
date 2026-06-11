"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswererIdleView } from "@/components/answerer-screen/idle-view";
import { ScanningView } from "@/components/answerer-screen/scanning-view";
import { ConnectedView } from "@/components/connected-view/connected-view";
import { deriveConnectionStatus } from "@/components/connection-status";
import { useReceiveProgress } from "@/components/use-receive-progress";
import { useSendProgress } from "@/components/use-send-progress";
import type { Inbox } from "@/lib/inbox";
import {
  decodeOffer,
  generateAnswer,
  PairingMachine,
  writeClipboard,
} from "@/lib/pairing";
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
 *
 * The three render branches (idle / scanning / connected) are
 * extracted into sub-components: the connected view is shared
 * with PairingScreen (identical behavior), and the idle +
 * scanning views are answerer-specific. Extracting the render
 * trees brings the screen body under ultracite's
 * `noExcessiveCognitiveComplexity` limit.
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
  // Slice 10: send-side progress tracking also lives in a
  // custom hook (useSendProgress), mirroring
  // useReceiveProgress. The hook owns the in-flight handle
  // ref, the send-progress state, and the Cancel handler;
  // the screen wraps sendFile with the screen-level log and
  // session-activity notification.
  const {
    handleCancelSend,
    progress: sendProgress,
    reset: resetSendProgress,
    sendFile,
  } = useSendProgress();
  // Slice 8: set to true when the Session ends (idle timeout, page
  // hidden, peer disconnect). The screen stays mounted so the
  // header shows the "Disconnected" indicator — the "Close
  // session" button doubles as "Start over" and resets the
  // screen state when the Session is already closed.
  const [wasDisconnected, setWasDisconnected] = useState(false);

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

  const handleScan = () => {
    setError("");
    try {
      const decoded = decodeOffer(scannedText);
      setPeerName(decoded.name);
      machine.startScanning();
      setState(machine.getState());
    } catch (err) {
      setError("QR not recognized");
      machine.failMalformedQr(
        err instanceof Error ? err.message : "malformed QR"
      );
      machine.reset();
      // Synchronise the React state with the machine so the
      // next render shows the IdleView (machine is back in
      // idle after the recorded failure). Consistent with
      // handleGenerate's failIce path.
      setState(machine.getState());
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
      const message =
        err instanceof Error ? err.message : "Failed to generate answer";
      setError(message);
      machine.failIce(message);
      machine.reset();
      setState(machine.getState());
    }
  };

  // Slice 11: distinguish "Connection lost" (transport closed
  // mid-transfer by the network or peer) from "Cancelled"
  // (user clicked Cancel). Both are reported via onComplete
  // with different `kind` values ("failed" for connection
  // lost, "cancelled" for user cancel). The log message
  // reflects the difference so the user knows whether the
  // transfer was interrupted or they aborted it themselves.
  const handleSend = async (file: File) => {
    if (!transport) {
      return;
    }
    setSendLog((log) => [
      ...log,
      `Sending ${file.name} (${file.size} bytes)...`,
    ]);
    await sendFile({
      file,
      transport,
      onComplete: (outcome) => {
        if (outcome.kind === "sent") {
          setSendLog((log) => [...log, `Sent ${file.name}`]);
        } else if (outcome.kind === "failed") {
          setSendLog((log) => [...log, `Connection lost: ${outcome.message}`]);
        } else {
          setSendLog((log) => [
            ...log,
            `Cancelled ${file.name}: ${outcome.message}`,
          ]);
        }
        session?.notifyActivity();
      },
    });
  };

  // Reset all screen state back to the idle screen. Extracted
  // from handleClose so both screens share the same shape —
  // pairing-screen's version clears an extra field (the offerer
  // handle ref) but the rest is identical, and the duplication
  // would cost more than the extra parameter if a third screen
  // ever needs it. The hook's onEnd (wired to the receive
  // loop) clears the receive-progress state when the Session
  // ends; the receive state is set to null again here as
  // belt-and-suspenders in case the user clicks "Start over"
  // while a receive is in flight. The send hook's `reset`
  // clears the in-flight send handle and progress
  // synchronously — sendFile's finally block is async (waits
  // for the send promise), so we can't rely on it for the
  // "Start over" path.
  const resetToIdle = (): void => {
    setWasDisconnected(false);
    setSession(null);
    setTransport(null);
    // Clear the receive-progress state held by the hook
    // synchronously — the loop's async `onEnd` isn't reliable
    // for the "Start over" path (user clicks while a receive
    // is in flight). Without this, the receive progress bar
    // can persist one render tick after the rest of the screen
    // has reset.
    resetReceiveProgress();
    // Same belt-and-suspenders for the send state — if the
    // user clicks "Start over" while a send is in flight, the
    // hook's reset clears the in-flight handle and progress
    // synchronously, instead of waiting for sendFile's
    // finally block.
    resetSendProgress();
    setSendLog([]);
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
    }
  };

  /**
   * Slice 11: request camera permission. If granted, the browser
   * camera stream opens — future slices will add QR scanning from
   * the video feed. If denied, the paste text area is already
   * visible (the idle view always shows it) so the user can fall
   * back to pasting manually. The Permission API is the first
   * check (returns "denied" synchronously if the user previously
   * blocked the camera); getUserMedia is the actual permission
   * prompt. If either indicates denial, we show a message and the
   * user types/pastes the offer text.
   */
  const handleUseCamera = useCallback(async () => {
    // Check if the Permission API is available and camera was
    // already blocked — avoids a redundant getUserMedia call that
    // would also throw.
    if (navigator?.permissions?.query) {
      try {
        const status = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (status.state === "denied") {
          setError("Camera access was denied — paste the offer text below");
          return;
        }
      } catch {
        // Permissions API not supported for "camera" — fall
        // through to getUserMedia.
      }
    }
    try {
      // getUserMedia triggers the browser's permission prompt.
      // We don't need the stream yet (QR scanning comes in a
      // future slice) — just checking permission.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Stop the stream immediately — we only needed the
      // permission grant. Future slices will keep the stream
      // alive and feed frames to a QR scanner.
      for (const track of stream.getTracks()) {
        track.stop();
      }
      setError("");
    } catch {
      setError("Camera access was denied — paste the offer text below");
    }
  }, []);

  // Slice 8: derive the connection status from the Transport's
  // actual state and the wasDisconnected flag. The Transport
  // already exposes "connecting" | "open" | "closing" | "closed",
  // so we just map those to the three user-facing labels via
  // the shared helper.
  const connectionStatus = deriveConnectionStatus(transport, wasDisconnected);

  // The three render branches are extracted into sub-components
  // (AnswererIdleView / ScanningView / ConnectedView) so the
  // screen body stays under ultracite's
  // `noExcessiveCognitiveComplexity` limit. The connected view
  // is shared with PairingScreen (identical behavior).
  if (state.kind === "connected") {
    return (
      <ConnectedView
        connectionStatus={connectionStatus}
        handleCancelReceive={handleCancelReceive}
        handleCancelSend={handleCancelSend}
        handleClose={handleClose}
        handleSend={handleSend}
        inbox={inbox}
        peerName={state.peerName}
        progress={sendProgress}
        receiveProgress={receiveProgress}
        sendLog={sendLog}
        session={session}
        wasDisconnected={wasDisconnected}
      />
    );
  }

  if (state.kind === "scanning") {
    return (
      <ScanningView
        answerText={answerText}
        connectionStatus={connectionStatus}
        error={error}
        onGenerate={handleGenerate}
        peerName={peerName}
      />
    );
  }

  return (
    <AnswererIdleView
      connectionStatus={connectionStatus}
      error={error}
      onScan={handleScan}
      onScannedTextChange={setScannedText}
      onUseCamera={handleUseCamera}
      scannedText={scannedText}
    />
  );
}
