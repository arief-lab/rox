"use client";

import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";

/**
 * Pairing-specific idle view. Shown before the user has clicked
 * "Start receiving". The only action is to start the offer
 * creation.
 *
 * Extracted from the screen in the render-tree follow-up to
 * bring the screen's cognitive complexity under 20.
 */
interface IdleViewProps {
  connectionStatus: ConnectionStatusKind;
  error: string;
  onStart: () => void;
}

export function IdleView({ connectionStatus, error, onStart }: IdleViewProps) {
  return (
    <div className="rounded-lg border p-4" data-testid="idle-state">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Receive a file</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <p className="mb-2 text-gray-500 text-sm">
        Start a Pairing session. A QR code will appear for the other device to
        scan.
      </p>
      <button
        className="rounded bg-blue-500 px-4 py-2 text-white"
        data-testid="start-receiving"
        onClick={onStart}
        type="button"
      >
        Start receiving
      </button>
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
