"use client";

/**
 * In-flight Transfer progress bar + Cancel button.
 *
 * Shown on both the offerer and answerer screens while a send is in
 * progress. The progress bar uses `role="progressbar"` with
 * `aria-valuenow` / `aria-valuemin` / `aria-valuemax` so screen
 * readers announce the changing percentage (real a11y, not just a
 * decorative fill).
 *
 * The Cancel button calls `onCancel()`, which the parent should wire
 * to the current `SendHandle.cancel()`. The button is only rendered
 * while `progress` is non-null, so the slice 7 spec ("Cancel button
 * is visible only while a Transfer is in flight") is enforced by
 * the parent's state, not by a CSS class.
 */
interface TransferProgressProps {
  onCancel: () => void;
  progress: { bytesSent: number; total: number };
}

export function TransferProgress({
  progress,
  onCancel,
}: TransferProgressProps) {
  // Edge case: empty file (total === 0) → percent is 0, not NaN.
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.bytesSent / progress.total) * 100);
  // Clamp the bar width to 100% so an overshoot in onProgress
  // (e.g. the final chunk arriving before the last onProgress tick)
  // doesn't visually overflow the track.
  const fillWidth =
    progress.total === 0
      ? 0
      : Math.min(100, (progress.bytesSent / progress.total) * 100);

  return (
    <div className="mt-2" data-testid="send-progress">
      <div
        aria-label="send progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded bg-gray-200"
        data-testid="send-progress-bar"
        role="progressbar"
      >
        <div
          className="h-full bg-blue-500 transition-all"
          data-testid="send-progress-fill"
          style={{ width: `${fillWidth}%` }}
        />
      </div>
      <p
        className="mt-1 text-gray-500 text-xs"
        data-testid="send-progress-text"
      >
        {progress.bytesSent} / {progress.total} bytes ({percent}%)
      </p>
      <button
        className="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white"
        data-testid="send-cancel"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
    </div>
  );
}
