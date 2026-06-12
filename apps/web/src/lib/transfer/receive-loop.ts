// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Transport } from "@/lib/webrtc";

import { type ReceiveHandle, receive } from "./receive";

/**
 * Structural type for the Inbox — the transfer module doesn't
 * import from `@/lib/inbox` to avoid a circular dependency.
 * Any object with a `push(entry)` method matches.
 */
export interface InboxLike {
  push(entry: {
    blob: Blob;
    id: string;
    name: string;
    receivedAt: number;
    size: number;
  }): void;
}

/**
 * Structural type for the Session — we only need `notifyActivity()`
 * to reset the idle timer on each successful receive. The transfer
 * module doesn't import from `@/lib/webrtc/Session` to keep the
 * dependency surface minimal.
 */
export interface SessionLike {
  notifyActivity(): void;
}

export interface StartReceiveLoopHandle {
  /** Cancel the loop and the in-flight receive (if any). Idempotent. */
  cancel(): void;
}

export interface StartReceiveLoopOptions {
  /**
   * Fires when a receive ends (either successfully — the file
   * was pushed to the Inbox — or with a rejection — transport
   * close, protocol error, or cancel). The screen uses this to
   * clear the progress bar and the incoming-handle ref so the
   * Cancel button stops pointing at a stale handle.
   */
  onEnd?: () => void;
  /**
   * Fires after each chunk is processed, with cumulative bytes
   * received and the total file size (from the start message).
   * The screen uses this to drive the progress bar.
   */
  onProgress?: (bytesReceived: number, total: number) => void;
  /**
   * Fires when the start message for a new receive is processed
   * (i.e. the filename and total size are known, but the first
   * chunk may not have landed yet). The screen uses this to show
   * the progress bar at 0% AND to wire the Cancel button BEFORE
   * any chunks arrive — so the user can cancel an unwanted
   * incoming file immediately. The screen also stores `handle`
   * so its `handleCancel` can call `handle.cancel()`.
   */
  onReceiveStart?: (info: {
    name: string;
    totalSize: number;
    handle: ReceiveHandle;
  }) => void;
}

/**
 * Loop `receive(transport)` so N sequential file transfers are all
 * received per session. The first `receive()` call resolves after
 * the first file completes; without this loop, the second send
 * would be dropped on the floor.
 *
 * Each `receive()` call cleans up its own subscriptions when the
 * file completes, so calling it again is safe. The loop breaks on
 * transport close or protocol error — a cancel (by either side)
 * does NOT stop the loop (the DataChannel stays open and
 * subsequent transfers on the same session are unaffected per the
 * PRD invariant).
 *
 * On each successful receive, pushes the reassembled file to the
 * Inbox and calls `session.notifyActivity()` to reset the idle
 * timer.
 *
 * Returns a handle with `cancel()` for the consumer's cleanup.
 * Calling `cancel()` sets a flag that prevents the next loop
 * iteration from starting and cancels any in-flight receive.
 *
 * The optional callbacks (onReceiveStart / onProgress / onEnd)
 * let the consumer (PairingScreen / AnswererScreen) track the
 * current ReceiveHandle and show a progress bar + Cancel button
 * for an in-flight receive — the symmetric UI to the send-side
 * progress bar wired in slice 7. Without these callbacks, the
 * screen would have no way to know which ReceiveHandle is
 * currently in flight (the loop owns it) or to cancel an
 * unwanted incoming file.
 */
export function startReceiveLoop(
  transport: Transport,
  inbox: InboxLike,
  session: SessionLike,
  options: StartReceiveLoopOptions = {}
): StartReceiveLoopHandle {
  let cancelled = false;
  let currentHandle: ReceiveHandle | null = null;

  const loop = async (): Promise<void> => {
    while (!cancelled) {
      // Create the handle FIRST so it's captured in the onStart
      // closure (the receive() function's onStart fires
      // asynchronously when the start message is processed, but
      // the handle is already valid at that point).
      const handle = receive(transport, {
        onProgress: options.onProgress,
        onStart: (info) => {
          // Wrap the screen's onReceiveStart so it receives the
          // handle alongside the name/totalSize. The handle is
          // captured in the outer closure (assigned above), so
          // it's guaranteed to be set by the time the start
          // message is processed.
          options.onReceiveStart?.({ ...info, handle });
        },
      });
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
        session.notifyActivity();
      } catch {
        // Transfer failed — Inbox stays untouched (PRD invariant).
        // Continue on cancelled (user/peer cancelled) and idle
        // (stale chunk from a previous cancelled transfer arrived
        // before the next start message — retry by calling
        // receive() again). Only break on transport close or
        // protocol error (machine transitions to "failed").
        const kind = handle.getState().kind;
        if (kind !== "cancelled" && kind !== "idle") {
          break;
        }
      } finally {
        // Fires for both success (file pushed to Inbox) and
        // failure (transport close / protocol error / cancel).
        // The screen uses this to clear the progress bar and the
        // incoming-handle ref so the Cancel button stops pointing
        // at a stale handle.
        options.onEnd?.();
      }
    }
  };
  loop();

  return {
    cancel: () => {
      cancelled = true;
      currentHandle?.cancel();
    },
  };
}
