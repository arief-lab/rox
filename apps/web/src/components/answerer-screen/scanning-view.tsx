// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { CardHeaderWithStatus } from "@/components/card-header-with-status";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

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
  onBack: () => void;
  onGenerate: () => void;
  peerName: string | undefined;
}

export function ScanningView({
  answerText,
  connectionStatus,
  error,
  onBack,
  onGenerate,
  peerName,
}: ScanningViewProps) {
  return (
    <Card data-testid="answerer-scanning-state">
      <CardHeaderWithStatus
        connectionStatus={connectionStatus}
        title="Generate answer"
      />
      <CardContent>
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
        <Button
          className="mt-4"
          data-testid="back-to-qr"
          onClick={onBack}
          variant="ghost"
        >
          ← Back to my QR
        </Button>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
