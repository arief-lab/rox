"use client";

import { Button } from "@rox-apps/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rox-apps/ui/components/card";
import { Textarea } from "@rox-apps/ui/components/textarea";
import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

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
  onUseCamera: () => void;
  scannedText: string;
}

export function AnswererIdleView({
  connectionStatus,
  error,
  onScan,
  onScannedTextChange,
  onUseCamera,
  scannedText,
}: AnswererIdleViewProps) {
  return (
    <Card data-testid="answerer-idle-state">
      <CardHeader>
        <CardTitle>Send a file</CardTitle>
        <CardAction>
          <ConnectionStatus status={connectionStatus} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-gray-500 text-sm">
          Paste the offerer's QR text below (or scan it with your camera).
        </p>
        <div className="mb-2">
          <Button
            data-testid="use-camera"
            onClick={onUseCamera}
            variant="alt-action"
          >
            Use camera
          </Button>
        </div>
        <Textarea
          data-testid="scan-area"
          onChange={(e) => onScannedTextChange(e.target.value)}
          placeholder="Paste offer text here..."
          value={scannedText}
        />
        <Button
          className="mt-2"
          data-testid="scan-qr"
          disabled={!scannedText}
          onClick={onScan}
        >
          Scan
        </Button>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
