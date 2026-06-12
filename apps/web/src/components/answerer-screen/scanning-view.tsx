"use client";

import { Button } from "@rox-apps/ui/components/button";
import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";

/**
 * Answerer-specific scanning view. Shown after the user has
 * pasted the offerer's QR text and clicked "Scan" — they now
 * need to generate the answer and copy it to their clipboard
 * for the offerer to paste back.
 *
 * Extracted from the screen in the render-tree follow-up to
 * bring the screen's cognitive complexity under 20.
 */
interface ScanningViewProps {
  answerText: string;
  connectionStatus: ConnectionStatusKind;
  error: string;
  onGenerate: () => void;
  peerName: string | undefined;
}

export function ScanningView({
  answerText,
  connectionStatus,
  error,
  onGenerate,
  peerName,
}: ScanningViewProps) {
  return (
    <div
      className="rounded-lg border p-4"
      data-testid="answerer-scanning-state"
    >
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Generate answer</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <p className="mb-2 text-gray-500 text-sm">
        Offerer: {peerName ?? "(unknown)"}. Click below to generate the answer
        and copy it to your clipboard.
      </p>
      <Button
        data-testid="generate-answer"
        onClick={onGenerate}
        variant="success"
      >
        Generate answer & copy
      </Button>
      {answerText ? (
        <p className="mt-2 text-sm">
          Answer copied to clipboard:{" "}
          <code className="break-all text-xs" data-testid="answer-text">
            {answerText.slice(0, 80)}...
          </code>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-red-500 text-sm" data-testid="error-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
