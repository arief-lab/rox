// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { Textarea } from "@rox-apps/ui/components/textarea";
import { CameraIcon } from "lucide-react";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";
import { HandshakeLayout } from "@/components/handshake-layout";
import { HeroSection } from "@/components/hero-section";

/**
 * Answerer-specific idle view. Shown before the user has pasted
 * the offerer's QR text. Uses the same split-screen handshake
 * layout, but the right card asks for the other device's code.
 */
interface AnswererIdleViewProps {
  connectionStatus: ConnectionStatusKind;
  error: string;
  onBack: () => void;
  onScan: () => void;
  onScannedTextChange: (text: string) => void;
  onUseCamera: () => void;
  scannedText: string;
}

export function AnswererIdleView({
  error,
  onBack,
  onScan,
  onScannedTextChange,
  onUseCamera,
  scannedText,
}: AnswererIdleViewProps) {
  return (
    <div data-testid="answerer-idle-state">
      <HandshakeLayout
        left={
          <HeroSection
            subtitle="Paste the code from the other device, or scan its QR code. Once connected you can send files directly."
            title="Connect to a device"
          />
        }
        right={
          <Card className="w-full max-w-md border border-border/60 shadow-2xl shadow-primary/5">
            <CardContent className="flex flex-col gap-4 p-6 lg:p-8">
              <Textarea
                className="min-h-[120px] resize-none"
                data-testid="scan-area"
                onChange={(e) => onScannedTextChange(e.target.value)}
                placeholder="Paste the other device's offer code here..."
                value={scannedText}
              />
              <Button
                data-testid="scan-qr"
                disabled={!scannedText}
                onClick={onScan}
              >
                Connect
              </Button>
              <Button
                data-testid="use-camera"
                onClick={onUseCamera}
                variant="secondary"
              >
                <CameraIcon className="mr-2 size-4" />
                Scan QR with camera
              </Button>
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
