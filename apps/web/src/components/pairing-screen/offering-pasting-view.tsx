// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { Textarea } from "@rox-apps/ui/components/textarea";
import type { RefObject } from "react";
import { CardHeaderWithStatus } from "@/components/card-header-with-status";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

/**
 * Pairing-specific offering|pasting view. Shown when the
 * offerer has created the offer SDP and is either showing the
 * QR (state.kind === "offering") or waiting for the answerer
 * to paste the answer (state.kind === "pasting"). The header
 * label switches between "Show this QR" and "Connecting..."
 * based on the sub-state.
 *
 * Extracted from the screen in the render-tree follow-up to
 * bring the screen's cognitive complexity under 20.
 */
interface OfferingPastingViewProps {
  connectionStatus: ConnectionStatusKind;
  error: string;
  label: string;
  offerSdp: string;
  onPaste: () => void;
  onPastedTextChange: (text: string) => void;
  onReadClipboard: () => void;
  pastedText: string;
  qrCanvasRef: RefObject<HTMLCanvasElement | null>;
}

export function OfferingPastingView({
  connectionStatus,
  error,
  label,
  offerSdp,
  onPaste,
  onReadClipboard,
  onPastedTextChange,
  pastedText,
  qrCanvasRef,
}: OfferingPastingViewProps) {
  return (
    <Card data-testid="offering-state">
      <CardHeaderWithStatus connectionStatus={connectionStatus} title={label} />
      <CardContent>
        <canvas className="border" data-testid="qr-canvas" ref={qrCanvasRef} />
        <p className="mt-2 text-sm">
          Offer SDP:{" "}
          <code className="break-all text-xs" data-testid="offer-sdp">
            {offerSdp.slice(0, 80)}...
          </code>
        </p>
        <div className="mt-4">
          <Button
            data-testid="read-clipboard"
            onClick={onReadClipboard}
            variant="alt-action"
          >
            Read answer from clipboard
          </Button>
          <Textarea
            className="mt-2"
            data-testid="paste-area"
            onChange={(e) => onPastedTextChange(e.target.value)}
            placeholder="Or paste answer text here..."
            value={pastedText}
          />
          <Button
            className="mt-2"
            data-testid="paste-answer"
            disabled={!pastedText}
            onClick={onPaste}
            variant="success"
          >
            Connect with pasted answer
          </Button>
        </div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
