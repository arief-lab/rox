// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { RefObject } from "react";
import { HandshakeLayout } from "@/components/handshake-layout";
import { HeroSection } from "@/components/hero-section";
import { PairingCard } from "@/components/pairing-card";

/**
 * Pairing-specific offering|pasting view. Shown when the
 * offerer has created the offer SDP and is either showing the
 * QR or waiting for the answerer to paste the answer. Renders
 * the new split-screen handshake layout with the QR card on the
 * right and the hero on the left.
 *
 * Per spec §3 (text) the hero has a headline + a one-or-two-line
 * sub-headline explaining the zero-server, local-only concept.
 * Per spec §5.1 (layout diagram) the left column uses a small
 * wordmark at the very top and the device-name editor pinned
 * to the bottom. The user's clarification: §5.1 ASCII is a
 * layout skeleton, not a content spec, so the right card keeps
 * the existing paste area so the offerer can receive the
 * answerer's reply.
 */
interface OfferingPastingViewProps {
  error: string;
  offerCode: string;
  onConnectOther: () => void;
  onPaste: () => void;
  onPastedTextChange: (text: string) => void;
  onReadClipboard: () => void;
  pastedText: string;
  qrCanvasRef: RefObject<HTMLCanvasElement | null>;
  shortCode: string;
}

export function OfferingPastingView({
  error,
  offerCode,
  onConnectOther,
  onPaste,
  onReadClipboard,
  onPastedTextChange,
  pastedText,
  qrCanvasRef,
  shortCode,
}: OfferingPastingViewProps) {
  return (
    <div data-testid="offering-state">
      <HandshakeLayout
        left={
          <HeroSection
            subtitle="Paste-free, account-free. Files move straight over your local network — no servers, no uploads."
            title="Send files directly to another device."
          />
        }
        right={
          <PairingCard
            error={error}
            offerCode={offerCode}
            onConnectOther={onConnectOther}
            onPaste={onPaste}
            onPastedTextChange={onPastedTextChange}
            onReadClipboard={onReadClipboard}
            pastedText={pastedText}
            qrCanvasRef={qrCanvasRef}
            shortCode={shortCode}
          />
        }
      />
    </div>
  );
}
