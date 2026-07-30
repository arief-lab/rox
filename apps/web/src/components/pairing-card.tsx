// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { Textarea } from "@rox-apps/ui/components/textarea";
import { LinkIcon, ScanLineIcon, ShareIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { RefObject } from "react";
import { ErrorText } from "@/components/error-text";

interface PairingCardProps {
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

/**
 * The main action card on the right side of the handshake layout.
 *
 * Per spec §3 (Right Side):
 *  - QR code, 256×256 on desktop / 200×200 on mobile.
 *  - Short human-readable connection code below the QR.
 *  - Copy link button (copies the shareable offer URL).
 *  - Share button (Web Share API fallback to clipboard).
 *  - Subtle "Ready to connect" status pulse.
 *  - Paste area for the answerer's reply.
 *  - "Connect to another device" fallback that switches to
 *    answerer mode.
 *  - All motion respects `prefers-reduced-motion`.
 */
export function PairingCard({
  error,
  offerCode,
  pastedText,
  shortCode,
  onConnectOther,
  onPastedTextChange,
  onPaste,
  onReadClipboard,
  qrCanvasRef,
}: PairingCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const shareUrl = `${window.location.origin}/?role=answerer&offer=${encodeURIComponent(offerCode)}`;

  const handleCopyLink = async () => {
    if (!offerCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Connect on Rox",
          text: "Join my Rox session to send files directly.",
          url: shareUrl,
        });
        return;
      } catch {
        // Fall through to clipboard copy.
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const displayedCode = shortCode || "...";

  return (
    <Card className="relative w-full max-w-md overflow-hidden border border-border/60 shadow-2xl shadow-primary/5">
      <CardContent className="flex flex-col gap-6 p-6 lg:p-8">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-muted-foreground text-xs">
            <span className="relative inline-flex size-2">
              {shouldReduceMotion ? null : (
                <motion.span
                  animate={{ opacity: [0.35, 0, 0.35], scale: [1, 2.4, 2.4] }}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-primary/50"
                  initial={{ opacity: 0, scale: 1 }}
                  transition={{
                    duration: 1.8,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeOut",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative inline-block size-2 rounded-full bg-primary"
              />
            </span>
            <span aria-live="polite">Ready to connect</span>
          </div>
        </div>

        <div className="relative mx-auto">
          <div className="relative rounded-2xl border bg-white p-3">
            <canvas
              className="block size-[200px] lg:size-[256px]"
              data-testid="qr-canvas"
              ref={qrCanvasRef}
            />
          </div>
          {shouldReduceMotion ? null : (
            <motion.span
              animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.2, 1.2] }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-primary/40"
              initial={{ opacity: 0, scale: 1 }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          )}
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="sr-only">QR code ready</span>
          </span>
        </div>

        <div className="text-center">
          <p className="font-medium text-muted-foreground text-sm">
            Connection code
          </p>
          <p
            className="mt-1 font-mono text-foreground text-lg tracking-widest"
            data-testid="short-code"
          >
            {displayedCode}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            aria-label="Copy invite link"
            data-testid="copy-link"
            disabled={!offerCode}
            onClick={handleCopyLink}
            variant="outline"
          >
            <LinkIcon className="mr-2 size-4" />
            Copy link
          </Button>
          <Button
            aria-label="Share invite link"
            data-testid="share-link"
            disabled={!offerCode}
            onClick={handleShare}
            variant="outline"
          >
            <ShareIcon className="mr-2 size-4" />
            Share
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or paste an answer
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Textarea
            className="min-h-[80px] resize-none"
            data-testid="paste-area"
            onChange={(event) => onPastedTextChange(event.target.value)}
            placeholder="Paste the other device's answer code here..."
            value={pastedText}
          />
          <div className="grid grid-cols-2 gap-3">
            <Button
              data-testid="read-clipboard"
              onClick={onReadClipboard}
              variant="secondary"
            >
              Read clipboard
            </Button>
            <Button
              data-testid="paste-answer"
              disabled={!pastedText}
              onClick={onPaste}
              variant="default"
            >
              Connect
            </Button>
          </div>
        </div>

        <Button
          className="w-full"
          data-testid="connect-to-other"
          onClick={onConnectOther}
          variant="ghost"
        >
          <ScanLineIcon className="mr-2 size-4" />
          Connect to another device
        </Button>

        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
