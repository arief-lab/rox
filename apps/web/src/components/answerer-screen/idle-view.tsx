"use client";

import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";

/**
 * Answerer-specific idle view. Shown before the user has pasted
 * the offerer's QR text. The only action is to paste the text
 * and click "Scan".
 *
 * Extracted from the screen in the render-tree follow-up to
 * bring the screen's cognitive complexity under 20.
 */
interface AnswererIdleViewProps {
  connectionStatus: ConnectionStatusKind;
  error: string;
  onScan: () => void;
  onScannedTextChange: (text: string) => void;
  scannedText: string;
}

export function AnswererIdleView({
  connectionStatus,
  error,
  onScan,
  onScannedTextChange,
  scannedText,
}: AnswererIdleViewProps) {
  return (
    <div className="rounded-lg border p-4" data-testid="answerer-idle-state">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Send a file</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <p className="mb-2 text-gray-500 text-sm">
        Paste the offerer's QR text below (or scan it with your camera).
      </p>
      <textarea
        className="w-full rounded border p-2 text-xs"
        data-testid="scan-area"
        onChange={(e) => onScannedTextChange(e.target.value)}
        placeholder="Paste offer text here..."
        value={scannedText}
      />
      <button
        className="mt-2 rounded bg-blue-500 px-4 py-2 text-white"
        data-testid="scan-qr"
        disabled={!scannedText}
        onClick={onScan}
        type="button"
      >
        Scan
      </button>
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
