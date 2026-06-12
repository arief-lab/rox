"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { deriveConnectionStatus } from "@/components/connection-status";
import { useReceiveProgress } from "@/components/use-receive-progress";
import { useSendProgress } from "@/components/use-send-progress";
import type { Inbox } from "@/lib/inbox";
import { startReceiveLoop } from "@/lib/transfer";
import { Session, type Transport } from "@/lib/webrtc";

export interface UseSessionOptions {
  /** Returns the peer name to stamp on the Inbox when the transport opens. */
  getPeerName: () => string | undefined;
  inbox: Inbox;
  /**
   * Called before session.close() in the handleClose else branch.
   * Use for screen-specific cleanup like clearing an offerer handle ref.
   */
  onBeforeClose?: () => void;
  /**
   * Called before the screen state resets to idle (between the
   * wasDisconnected check and clearing state). Use for
   * screen-specific cleanup like clearing an offerer handle ref.
   */
  onBeforeReset?: () => void;
}

export interface UseSessionReturn {
  /** Derived from transport + wasDisconnected. */
  connectionStatus: import("@/components/connection-status").ConnectionStatusKind;
  /** Cancel the in-flight receive. */
  handleCancelReceive: () => void;
  /** Cancel the in-flight send. */
  handleCancelSend: () => void;
  /**
   * Close the session (or reset to idle if already disconnected).
   * The session.close() path sets wasDisconnected so the user
   * sees the "Disconnected" indicator, then a second click calls
   * resetToIdle.
   */
  handleClose: () => void;
  /**
   * Send a file. Logs progress and outcome to sendLog. The
   * promise itself does not reject — outcome is reported via
   * sendLog updates and the session activity notification.
   * Handles the guard against no transport internally.
   */
  handleSend: (file: File) => Promise<void>;
  /**
   * The three callbacks the screen passes to `startReceiveLoop`.
   * Stable across renders — safe in a useEffect dep array.
   */
  receiveLoopCallbacks: {
    onEnd: () => void;
    onProgress: (bytes: number, total: number) => void;
    onReceiveStart: (info: {
      name: string;
      totalSize: number;
      handle: import("@/lib/transfer").ReceiveHandle;
    }) => void;
  };
  /** Drives the receive progress bar. Null when no receive is in flight. */
  receiveProgress: { bytes: number; total: number } | null;
  /**
   * Reset all hook state back to idle. Clears transport, session,
   * sendLog, wasDisconnected, and both progress hooks
   * synchronously. Calls onBeforeReset first for screen-specific
   * cleanup.
   */
  resetToIdle: () => void;
  /** Array of send log messages for the ConnectedView. */
  sendLog: string[];
  /** Drives the send progress bar. Null when no send is in flight. */
  sendProgress: { bytes: number; total: number } | null;
  /** The current Session, or null. */
  session: Session | null;
  sessionRef: React.MutableRefObject<Session | null>;
  /**
   * Set the transport once it opens. Called from the screen's
   * pairing-specific handler (handlePaste / result.transport.then).
   */
  setTransport: (t: Transport | null) => void;
  /** The current transport. Null while idle. */
  transport: Transport | null;
  /** True when the Session has ended (disconnect, timeout). */
  wasDisconnected: boolean;
}

/**
 * Shared hook that owns the session lifecycle (Transport → Session,
 * receive loop, progress tracking, send/cancel/close/reset handlers)
 * used identically by both PairingScreen and AnswererScreen.
 *
 * Extracts ~110 lines of duplicated code from each screen. The screen
 * keeps its own machine init, state tracking, error handling, and
 * pairing-specific handlers; the hook manages everything after the
 * transport is established.
 */
export function useSession({
  inbox,
  getPeerName,
  onBeforeReset,
  onBeforeClose,
}: UseSessionOptions): UseSessionReturn {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sendLog, setSendLog] = useState<string[]>([]);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  // Refs for values used by callbacks that should be stable across
  // renders (handleSend, handleClose, the Transport→Session effect).
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const transportRef = useRef<Transport | null>(null);
  transportRef.current = transport;

  // Use refs for the option callbacks so the Transport→Session effect
  // doesn't need them in its dep array (they change every render when
  // defined inline in the screen component, or close over changing
  // state that isn't relevant to the effect).
  const getPeerNameRef = useRef(getPeerName);
  getPeerNameRef.current = getPeerName;
  const onBeforeResetRef = useRef(onBeforeReset);
  onBeforeResetRef.current = onBeforeReset;
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;

  // Slice 9: receive-side progress tracking
  const {
    handleCancelReceive,
    receiveProgress,
    receiveLoopCallbacks,
    reset: resetReceiveProgress,
  } = useReceiveProgress();

  // Slice 10: send-side progress tracking
  const {
    handleCancelSend,
    progress: sendProgress,
    reset: resetSendProgress,
    sendFile,
  } = useSendProgress();

  // When the transport opens, create a Session, start receiving, and
  // push to the Inbox. Extracted identically from both screens.
  // getPeerName, onBeforeReset, onBeforeClose are accessed via refs
  // and never change the effect's identity.
  useEffect(() => {
    if (!transport) {
      return;
    }
    const sess = new Session(transport, inbox);
    sess.start();
    // Stamp the peer's device name (from the pairing exchange) on
    // the Inbox so received files show "From: {senderName}". The
    // peer name is available because the caller's state has already
    // advanced before setTransport was called.
    inbox.setSenderName(getPeerNameRef.current() ?? "Unknown");
    // When the Session ends (idle, pagehide, peer disconnect, or
    // user close), keep the screen mounted and show the
    // "Disconnected" indicator in the header.
    const unsubscribe = sess.onClose(() => {
      setWasDisconnected(true);
      setSession(null);
    });
    setSession(sess);

    // Loop receive(transport) so N sequential file transfers are all
    // received per session.
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
    // receiveLoopCallbacks is stable (useCallback with empty deps
    // inside the hook) so it doesn't trigger effect re-runs. `inbox`
    // is a stable prop reference.
  }, [transport, inbox, receiveLoopCallbacks]);

  // Slice 11: distinguish "Connection lost" from "Cancelled".
  const handleSend = useCallback(
    async (file: File) => {
      const t = transportRef.current;
      if (!t) {
        return;
      }
      setSendLog((log) => [
        ...log,
        `Sending ${file.name} (${file.size} bytes)...`,
      ]);
      await sendFile({
        file,
        transport: t,
        onComplete: (outcome) => {
          if (outcome.kind === "sent") {
            setSendLog((log) => [...log, `Sent ${file.name}`]);
          } else if (outcome.kind === "failed") {
            setSendLog((log) => [
              ...log,
              `Connection lost: ${outcome.message}`,
            ]);
          } else {
            setSendLog((log) => [
              ...log,
              `Cancelled ${file.name}: ${outcome.message}`,
            ]);
          }
          sessionRef.current?.notifyActivity();
        },
      });
    },
    [sendFile]
  );

  // Reset all hook state back to idle. Calls onBeforeReset first so
  // the caller can do screen-specific cleanup (e.g. clearing an
  // offerer handle ref).
  const resetToIdle = useCallback((): void => {
    onBeforeResetRef.current?.();
    setWasDisconnected(false);
    setSession(null);
    setTransport(null);
    resetReceiveProgress();
    resetSendProgress();
    setSendLog([]);
  }, [resetReceiveProgress, resetSendProgress]);

  // Close the session (or reset if already disconnected). Calls
  // onBeforeClose in the else branch for screen-specific cleanup.
  const handleClose = useCallback((): void => {
    if (wasDisconnected) {
      resetToIdle();
    } else {
      onBeforeCloseRef.current?.();
      sessionRef.current?.close("user closed");
    }
  }, [wasDisconnected, resetToIdle]);

  // Derive the connection status from the Transport's actual state
  // and the wasDisconnected flag.
  const connectionStatus = deriveConnectionStatus(transport, wasDisconnected);

  return {
    transport,
    setTransport,
    session,
    sendLog,
    sessionRef,
    wasDisconnected,
    sendProgress,
    receiveProgress,
    handleCancelSend,
    handleCancelReceive,
    receiveLoopCallbacks,
    handleSend,
    handleClose,
    resetToIdle,
    connectionStatus,
  };
}
