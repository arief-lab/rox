"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { ReceiveHandle } from "@/lib/transfer";

/**
 * Slice 9: extract the receive-side progress tracking into a
 * custom hook so the screens (PairingScreen, AnswererScreen)
 * don't bloat with another ~40 lines of state, refs, and
 * callbacks — each of which adds 1 to the component's
 * `noExcessiveCognitiveComplexity` score.
 *
 * The hook owns:
 * - `incomingHandleRef` — the current ReceiveHandle, set in
 *   onReceiveStart, cleared in onEnd
 * - `receiveProgress` — the bytes-received / total state that
 *   drives the progress bar
 * - the three callbacks passed to `startReceiveLoop`
 * - `handleCancelReceive` — wired to the Cancel button on the
 *   receive progress
 *
 * The screens just call the hook, pass the three callbacks to
 * `startReceiveLoop` inside their session useEffect, and wire
 * the Cancel button to `handleCancelReceive`.
 */
export interface UseReceiveProgressResult {
  /** Wired to the receive-side Cancel button. */
  handleCancelReceive: () => void;
  /**
   * The three callbacks the screen passes to `startReceiveLoop`.
   * They're stable across renders (useCallback with empty deps),
   * so adding them to a useEffect dep array doesn't cause the
   * effect to re-run on every render.
   */
  receiveLoopCallbacks: {
    onEnd: () => void;
    onProgress: (bytes: number, total: number) => void;
    onReceiveStart: (info: {
      name: string;
      totalSize: number;
      handle: ReceiveHandle;
    }) => void;
  };
  /** Drives the receive progress bar. Null when no transfer is in flight. */
  receiveProgress: { bytes: number; total: number } | null;
  /**
   * Synchronously clears the hook's internal state (incoming
   * handle ref + receive progress). If a receive is in flight,
   * cancels it first (symmetric with `useSendProgress.reset` and
   * the receive loop's own cleanup, which also calls
   * `currentHandle.cancel()`) so the receive stops consuming
   * transport bandwidth and processing chunks instead of
   * running to completion in the background. The screen's
   * `resetToIdle` calls this so the receive state is cleared on
   * the same render tick as the rest of the screen state,
   * instead of waiting for the loop's async `finally` block to
   * fire `onEnd`.
   */
  reset: () => void;
}

export function useReceiveProgress(): UseReceiveProgressResult {
  const incomingHandleRef = useRef<ReceiveHandle | null>(null);
  const [receiveProgress, setReceiveProgress] = useState<{
    bytes: number;
    total: number;
  } | null>(null);

  const handleReceiveEnd = useCallback((): void => {
    incomingHandleRef.current = null;
    setReceiveProgress(null);
  }, []);
  const handleReceiveProgress = useCallback(
    (bytes: number, total: number): void => {
      setReceiveProgress({ bytes, total });
    },
    []
  );
  const handleReceiveStart = useCallback(
    ({ handle }: { handle: ReceiveHandle }): void => {
      incomingHandleRef.current = handle;
    },
    []
  );

  const handleCancelReceive = useCallback((): void => {
    incomingHandleRef.current?.cancel();
  }, []);

  // Synchronous reset for the screen's `resetToIdle` path.
  // The receive loop's `onEnd` is async (fires from the
  // finally block of the receive promise), so the screen
  // can't rely on it to clear state on the same render tick.
  // This callback cancels any in-flight receive (symmetric
  // with the receive loop's own cleanup, which calls
  // `currentHandle.cancel()`, and with `useSendProgress.reset`)
  // and clears the ref + state synchronously, so the screen
  // can reset everything in one pass. The cancel stops the
  // receive from processing further chunks after "Start over";
  // the loop's finally block then fires onEnd on the next
  // microtask, which is a no-op since the state is already
  // cleared.
  const reset = useCallback((): void => {
    incomingHandleRef.current?.cancel();
    incomingHandleRef.current = null;
    setReceiveProgress(null);
  }, []);

  // Bundled into a stable object so the screen's useEffect can
  // pass all three callbacks at once to startReceiveLoop and
  // list a single dep. The three callbacks are stable (empty
  // deps above), so this memo is also stable across renders —
  // critical, because if it weren't stable the effect would
  // re-run on every render and tear down the receive loop.
  const receiveLoopCallbacks = useMemo(
    () => ({
      onEnd: handleReceiveEnd,
      onProgress: handleReceiveProgress,
      onReceiveStart: handleReceiveStart,
    }),
    [handleReceiveEnd, handleReceiveProgress, handleReceiveStart]
  );

  return {
    handleCancelReceive,
    receiveProgress,
    receiveLoopCallbacks,
    reset,
  };
}
