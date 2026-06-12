// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useCallback, useRef, useState } from "react";
import { AnswererIdleView } from "@/components/answerer-screen/idle-view";
import { ScanningView } from "@/components/answerer-screen/scanning-view";
import { ConnectedView } from "@/components/connected-view/connected-view";
import { useSession } from "@/components/use-session";
import { getDeviceName } from "@/lib/device-name";
import type { Inbox } from "@/lib/inbox";
import {
  decodeOffer,
  generateAnswer,
  PairingMachine,
  writeClipboard,
} from "@/lib/pairing";

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
  const [peerName, setPeerName] = useState<string | undefined>(undefined);

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
    getPeerName: () => peerName,
    onBeforeReset: () => {
      machine.close();
      setState(machine.getState());
    },
  });

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
      const result = await generateAnswer(decoded.sdp, getDeviceName());
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
