"use client";

import { Button } from "@rox-apps/ui/components/button";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { IdleScreen } from "@/components/idle-screen";

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
    <IdleScreen
      connectionStatus={connectionStatus}
      dataTestId="idle-state"
      description="Start a Pairing session. A QR code will appear for the other device to scan."
      error={error}
      title="Receive a file"
    >
      <Button data-testid="start-receiving" onClick={onStart}>
        Start receiving
      </Button>
    </IdleScreen>
  );
}
