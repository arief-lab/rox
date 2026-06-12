// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";

/**
 * In-flight Transfer progress bar + Cancel button. Reused for both
 * the send side (slice 7) and the receive side (slice 9 — the
 * receiver-cancel protocol in `startReceiveLoop` exposes the
 * current `ReceiveHandle` to the screen, which renders this
 * component with `direction="receive"` and a Cancel button that
 * calls `ReceiveHandle.cancel()`).
 *
 * The progress bar uses `role="progressbar"` with
 * `aria-valuenow` / `aria-valuemin` / `aria-valuemax` so screen
 * readers announce the changing percentage (real a11y, not just a
 * decorative fill).
 *
 * The Cancel button calls `onCancel()`, which the parent wires to
 * either `SendHandle.cancel()` (send) or `ReceiveHandle.cancel()`
 * (receive). The button is only rendered while `progress` is
 * non-null, so the visibility contract ("Cancel button is visible
 * only while a Transfer is in flight") is enforced by the parent's
 * state, not by a CSS class.
 *
 * Direction-aware testids (`send-cancel` / `receive-cancel`, etc.)
 * so e2e selectors can target each transfer independently when
 * the user happens to be both sending and receiving at the same
 * time on the same screen. The slice 7 test pins the default
 * (`direction="send"`) — adding the new direction doesn't change
 * the existing assertions.
 */
export type TransferDirection = "send" | "receive";

interface TransferProgressProps {
  /**
   * "send" (default) labels the bar "send progress" and uses
   * `send-*` testids. "receive" labels the bar "receive progress"
   * and uses `receive-*` testids. The visual style is identical —
   * the distinction is purely in the a11y label and the e2e
   * selectors.
   */
  direction?: TransferDirection;
  onCancel: () => void;
  /**
   * Direction-agnostic progress shape. `bytes` is the number of
   * bytes processed so far (sent for a send, received for a
   * receive) and `total` is the expected final size. The naming
   * is deliberately not `bytesSent` — the receive side is
   * reporting bytes *received*, not bytes sent, and the prop
   * field should reflect the component's contract (a count of
   * processed bytes) rather than the caller-specific direction.
   */
  progress: { bytes: number; total: number };
}

const DIRECTION_PREFIX: Record<TransferDirection, string> = {
  receive: "receive",
  send: "send",
};

const DIRECTION_ARIA_LABEL: Record<TransferDirection, string> = {
  receive: "receive progress",
  send: "send progress",
};

export function TransferProgress({
  direction = "send",
  onCancel,
  progress,
}: TransferProgressProps) {
  // Edge case: empty file (total === 0) → percent is 0, not NaN.
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.bytes / progress.total) * 100);
  // Clamp the bar width to 100% so an overshoot in onProgress
  // (e.g. the final chunk arriving before the last onProgress tick)
  // doesn't visually overflow the track.
  const fillWidth =
    progress.total === 0
      ? 0
      : Math.min(100, (progress.bytes / progress.total) * 100);

  const prefix = DIRECTION_PREFIX[direction];
  const ariaLabel = DIRECTION_ARIA_LABEL[direction];

  return (
    <div data-testid={`${prefix}-progress`}>
      <div
        aria-label={ariaLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded bg-gray-200"
        data-testid={`${prefix}-progress-bar`}
        role="progressbar"
      >
        <div
          className="h-full bg-blue-500 transition-all"
          data-testid={`${prefix}-progress-fill`}
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <p
        className="mt-1 text-gray-500 text-xs"
        data-testid={`${prefix}-progress-text`}
      >
        {progress.bytes} / {progress.total} bytes ({percent}%)
      </p>
      <Button
        className="mt-2"
        data-testid={`${prefix}-cancel`}
        onClick={onCancel}
        variant="destructive"
      >
        Cancel
      </Button>
    </div>
  );
}
