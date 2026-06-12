"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ConnectedView } from "@/components/connected-view/connected-view";
import { deriveConnectionStatus } from "@/components/connection-status";
import { IdleView } from "@/components/pairing-screen/idle-view";
import { OfferingPastingView } from "@/components/pairing-screen/offering-pasting-view";
import { useReceiveProgress } from "@/components/use-receive-progress";
import { useSendProgress } from "@/components/use-send-progress";
import { getDeviceName } from "@/lib/device-name";
import type { Inbox } from "@/lib/inbox";
import type { DecodedOffer } from "@/lib/pairing";
import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const offerSdp =
    state.kind === "offering" || state.kind === "pasting" ? state.offerSdp : "";

  useEffect(() => {
    if (typeof window !== "undefined" && offerSdp) {
      const w = window as unknown as {
        __offerSdp?: string;
        __offerName?: string;
      };
      w.__offerSdp = offerSdp;
      // Slice 12: expose the device name so E2E tests can
      // verify the QR payload without calling getDeviceName()
      // (which reads localStorage/navigator in the Node.js
      // test runtime, not the browser).
      w.__offerName = getDeviceName();
    }
  }, [offerSdp]);

  // Ref for handlePaste so the window-exposure useEffect below
  // doesn't need handlePaste in its dependency array (which would
  // cause cleanup to delete window properties on every re-render
  // since handlePaste is recreated each render).  Initialised as
  // null because handlePaste is defined later in the component;
  // the ref is assigned in-line after the handlePaste definition.
  const handlePasteRef = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        __handlePaste?: (text?: string) => Promise<void>;
      };
      w.__handlePaste = (text?: string) => handlePasteRef.current?.(text);
    }
    return () => {
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__handlePaste =
          undefined;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!(canvas && offerSdp)) {
      return;
    }
    QRCode.toCanvas(canvas, encodeOffer(offerSdp, getDeviceName()), {
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: state.peerName set once before transport
  useEffect(() => {
    if (!transport) {
      return;
    }
    const sess = new Session(transport, inbox);
    sess.start();
    // Stamp the peer's device name (from the pairing exchange) on
    // the Inbox so received files show "From: {senderName}". The
    // peer name is available because the machine already advanced
    // to "connected" before the transport was set. Use a local
    // narrow to avoid TS spreading the PairingState union.
    const peerName = state.kind === "connected" ? state.peerName : undefined;
    inbox.setSenderName(peerName ?? "Unknown");
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
      const message =
        err instanceof Error ? err.message : "Failed to create offer";
      setError(message);
      machine.failIce(message);
      machine.reset();
      // Synchronise the React state with the machine so the
      // next render shows the IdleView. Consistent with
      // handleGenerate's failIce path in AnswererScreen.
      setState(machine.getState());
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

  const handlePaste = async (overrideText?: string) => {
    setError("");
    let decoded: DecodedOffer;
    // Split parse from accept so we can give a distinct "not a
    // valid answer" message for invalid SDP vs a generic failure
    // for connection errors. This matches the PRD's requirement
    // that each failure mode has its own user-facing message.
    //
    // Accept an optional overrideText so E2E tests can call
    // __handlePaste(answerText) directly without depending on
    // the pastedText closure being up-to-date (the state setter
    // only queues a microtask — the closure still has the old
    // value until React re-renders).  Guard against the button
    // click passing a SyntheticBaseEvent: only use overrideText
    // when it's a genuine string.
    const text = typeof overrideText === "string" ? overrideText : pastedText;
    try {
      decoded = parseAnswer(text);
    } catch (err) {
      setError("not a valid answer");
      machine.failInvalidPaste(
        err instanceof Error ? err.message : "invalid paste"
      );
      machine.reset();
      setState(machine.getState());
      // The machine is now idle — the IdleView renders with the
      // error so the user sees "not a valid answer" and can
      // click "Start receiving" to try again.
      return;
    }
    try {
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
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      machine.failIce(message);
      machine.reset();
      setState(machine.getState());
    }
  };
  // Keep the ref in sync with the latest handlePaste closure.
  handlePasteRef.current = handlePaste;

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

  // Reset all screen state back to the idle screen. Extracted from
  // handleClose so the component body stays under ultracite's
  // `noExcessiveCognitiveComplexity` limit (the wasDisconnected
  // branch + connectionStatus derivation + handleClose together
  // pushed the function over 20). The hook's onEnd (wired to the
  // receive loop) clears the receive-progress state when the
  // Session ends; the receive state is set to null again here
  // as belt-and-suspenders in case the user clicks "Start over"
  // while a receive is in flight (the loop's cleanup also
  // cancels the in-flight receive). The send hook's `reset`
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
    // for the "Start over" path (user clicks while a receive is
    // in flight). Without this, the receive progress bar can
    // persist one render tick after the rest of the screen has
    // reset.
    resetReceiveProgress();
    // Same belt-and-suspenders for the send state — if the
    // user clicks "Start over" while a send is in flight, the
    // hook's reset clears the in-flight handle and progress
    // synchronously, instead of waiting for sendFile's
    // finally block.
    resetSendProgress();
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
        peerName={state.peerName}
        progress={sendProgress}
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
