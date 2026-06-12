// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { ConnectedView } from "@/components/connected-view/connected-view";
import { IdleView } from "@/components/pairing-screen/idle-view";
import { OfferingPastingView } from "@/components/pairing-screen/offering-pasting-view";
import { useSession } from "@/components/use-session";
import { getDeviceName } from "@/lib/device-name";
import type { Inbox } from "@/lib/inbox";
import type { DecodedOffer } from "@/lib/pairing";
import {
  encodeOffer,
  PairingMachine,
  parseAnswer,
  readClipboard,
} from "@/lib/pairing";
import { createOffer } from "@/lib/webrtc";

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

  const {
    connectionStatus,
    handleCancelReceive,
    handleCancelSend,
    handleClose,
    handleSend,
    receiveProgress,
    sendLog,
    sendProgress,
    session,
    setTransport,
    wasDisconnected,
  } = useSession({
    inbox,
    getPeerName: () =>
      state.kind === "connected" ? state.peerName : undefined,
    onBeforeReset: () => {
      offererHandleRef.current = null;
      machine.close();
      setState(machine.getState());
    },
    onBeforeClose: () => {
      offererHandleRef.current = null;
    },
  });

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
  const handlePasteRef = useRef<((text?: string) => Promise<void>) | null>(
    null
  );
  useEffect(() => {
    if (typeof window !== "undefined") {
      const w = window as unknown as {
        __handlePaste?: (text?: string) => Promise<void>;
      };
      w.__handlePaste = async (text?: string) => {
        await handlePasteRef.current?.(text);
      };
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
