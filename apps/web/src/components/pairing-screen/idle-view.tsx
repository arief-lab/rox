"use client";

import { Button } from "@rox-apps/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rox-apps/ui/components/card";
import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

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
    <Card data-testid="idle-state">
      <CardHeader>
        <CardTitle>Receive a file</CardTitle>
        <CardAction>
          <ConnectionStatus status={connectionStatus} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-gray-500 text-sm">
          Start a Pairing session. A QR code will appear for the other device to
          scan.
        </p>
        <Button data-testid="start-receiving" onClick={onStart}>
          Start receiving
        </Button>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
