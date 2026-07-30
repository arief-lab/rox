// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";
import { HandshakeLayout } from "@/components/handshake-layout";
import { HeroSection } from "@/components/hero-section";

/**
 * Answerer-specific scanning view. Shown after the user has
 * pasted the offerer's QR text and clicked "Scan" — they now
 * need to generate the answer and copy it to their clipboard
 * for the offerer to paste back.
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
  error,
  onBack,
  onGenerate,
  peerName,
}: ScanningViewProps) {
  return (
    <div data-testid="answerer-scanning-state">
      <HandshakeLayout
        left={
          <HeroSection
            subtitle="Generate the answer code and paste it back on the other device."
            title="Almost there"
          />
        }
        right={
          <Card className="w-full max-w-md border border-border/60 shadow-2xl shadow-primary/5">
            <CardContent className="flex flex-col gap-4 p-6 lg:p-8">
              <p className="text-muted-foreground text-sm">
                Connecting to <strong>{peerName ?? "(unknown)"}</strong>
              </p>
              <Button
                data-testid="generate-answer"
                onClick={onGenerate}
                variant="default"
              >
                Generate answer &amp; copy
              </Button>
              {answerText ? (
                <p className="text-sm">
                  Answer copied to clipboard:{" "}
                  <code className="break-all text-xs" data-testid="answer-text">
                    {answerText.slice(0, 80)}...
                  </code>
                </p>
              ) : null}
              <Button data-testid="back-to-qr" onClick={onBack} variant="ghost">
                ← Back to my QR
              </Button>
              <ErrorText error={error} />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
