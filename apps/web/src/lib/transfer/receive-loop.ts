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

/**
 * Loop `receive(transport)` so N sequential file transfers are all
 * received per session. The first `receive()` call resolves after
 * the first file completes; without this loop, the second send
 * would be dropped on the floor.
 *
 * Each `receive()` call cleans up its own subscriptions when the
 * file completes, so calling it again is safe. The loop breaks on
 * any rejection (transport close, protocol error, or cancel) — in
 * all three cases the session is ending or already ended.
 *
 * On each successful receive, pushes the reassembled file to the
 * Inbox and calls `session.notifyActivity()` to reset the idle
 * timer.
 *
 * Returns a handle with `cancel()` for the consumer's cleanup.
 * Calling `cancel()` sets a flag that prevents the next loop
 * iteration from starting and cancels any in-flight receive.
 */
export function startReceiveLoop(
  transport: Transport,
  inbox: InboxLike,
  session: SessionLike
): StartReceiveLoopHandle {
  let cancelled = false;
  let currentHandle: ReceiveHandle | null = null;

  const loop = async (): Promise<void> => {
    while (!cancelled) {
      const handle = receive(transport);
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
        // Stop the loop: transport close, protocol error, or cancel.
        break;
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
