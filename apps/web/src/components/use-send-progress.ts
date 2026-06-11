"use client";

import { useCallback, useRef, useState } from "react";

import { type SendHandle, send } from "@/lib/transfer";
import type { Transport } from "@/lib/webrtc";

/**
 * Slice 10: extract the send-side progress tracking into a
 * custom hook so the screens don't bloat with another ~10
 * lines of state, a ref, and a cancel callback. Mirrors
 * `useReceiveProgress` on the receive side.
 *
 * The hook owns:
 * - `inFlightRef` — the current SendHandle, set in sendFile,
 *   cleared in the finally block (so handleCancelSend can
 *   reach it)
 * - `progress` — the bytes-sent / total state that drives the
 *   progress bar
 * - `handleCancelSend` — wired to the Cancel button on the
 *   send progress
 *
 * The screens call the hook, pass `handleSend` to the
 * ConnectedView, and wire the Cancel button to
 * `handleCancelSend`. The screen-level log and session
 * activity are still owned by the screen because they're UI
 * concerns — the hook reports the outcome via `onComplete`.
 */

/**
 * Normalized send outcome. The hook reads the SendHandle's
 * underlying TransferMachine state at catch time to
 * distinguish a user/peer cancel (machine is "cancelled") from
 * a transport failure (machine is "failed"). `send()`'s inner
 * catch transitions to "failed" only if the machine was still
 * "sending", and leaves it as "cancelled" if machine.cancel()
 * already ran. `cancelled` and `failed` carry the error
 * message so the screen can show it in the log; the screen is
 * free to collapse them (the existing UI logs "Cancelled X:
 * <msg>" for both) or to distinguish them in a future
 * revision.
 */
export type SendOutcome =
  | { kind: "sent" }
  | { kind: "cancelled"; message: string }
  | { kind: "failed"; message: string };

export interface UseSendProgressResult {
  /** Wired to the send-side Cancel button. */
  handleCancelSend: () => void;
  /**
   * Drives the send progress bar. Null when no transfer is in
   * flight.
   */
  progress: { bytes: number; total: number } | null;
  /**
   * Synchronously clears the hook's internal state (in-flight
   * handle ref + progress). The screen's `resetToIdle` calls
   * this so the send state is cleared on the same render tick
   * as the rest of the screen state, instead of waiting for
   * the sendFile promise's finally block to run.
   */
  reset: () => void;
  /**
   * Start a send. Stable across renders (useCallback with
   * empty deps). Sets the in-flight handle, drives the progress
   * state via the onProgress callback, and clears state in the
   * finally block. Calls `onComplete` with the outcome so the
   * screen can update its log and notify the session. The
   * promise itself does not reject — the outcome is reported
   * via `onComplete`.
   */
  sendFile: (args: {
    file: File;
    onComplete?: (outcome: SendOutcome) => void;
    transport: Transport;
  }) => Promise<void>;
}

export function useSendProgress(): UseSendProgressResult {
  const inFlightRef = useRef<SendHandle | null>(null);
  const [progress, setProgress] = useState<{
    bytes: number;
    total: number;
  } | null>(null);

  const handleCancelSend = useCallback((): void => {
    inFlightRef.current?.cancel();
  }, []);

  // Synchronous reset for the screen's `resetToIdle` path.
  // The sendFile's finally block is async (waits for the
  // send promise), so the screen can't rely on it to clear
  // state on the same render tick. This callback clears both
  // the ref and the state synchronously, so the screen can
  // reset everything in one pass.
  const reset = useCallback((): void => {
    inFlightRef.current = null;
    setProgress(null);
  }, []);

  const sendFile = useCallback(
    async ({
      file,
      onComplete,
      transport,
    }: {
      file: File;
      onComplete?: (outcome: SendOutcome) => void;
      transport: Transport;
    }): Promise<void> => {
      // Stable useCallback wrapper around `send`. The
      // onProgress callback closes over setProgress, which is
      // stable across renders, so it doesn't need to be in
      // sendFile's dep array.
      const handle = send(file, transport, {
        onProgress: (bytes, total) => {
          setProgress({ bytes, total });
        },
      });
      inFlightRef.current = handle;
      setProgress({ bytes: 0, total: file.size });
      try {
        await handle.promise;
        onComplete?.({ kind: "sent" });
      } catch (err) {
        // send()'s inner catch transitions the machine to
        // "failed" if it was still "sending" when the error
        // occurred, and leaves it as "cancelled" if
        // machine.cancel() already ran (user clicked Cancel,
        // or a peer cancel frame arrived). At this point
        // the machine's kind is the source of truth for who
        // initiated the abort.
        const message = err instanceof Error ? err.message : "transfer failed";
        const kind =
          handle.getState().kind === "cancelled" ? "cancelled" : "failed";
        onComplete?.({ kind, message });
      } finally {
        inFlightRef.current = null;
        setProgress(null);
      }
    },
    []
  );

  return {
    handleCancelSend,
    progress,
    reset,
    sendFile,
  };
}
