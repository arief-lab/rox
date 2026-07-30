// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { Loader2Icon } from "lucide-react";
import { ErrorText } from "@/components/error-text";
import { HandshakeLayout } from "@/components/handshake-layout";
import { HeroSection } from "@/components/hero-section";

/**
 * Pairing-specific idle view. Shown briefly while the offer is
 * being generated (PairingScreen auto-starts on mount per spec
 * §4.1). When an error is present we expose a retry button so
 * the user can recover without a page reload.
 *
 * The left column matches spec §5.1 (Rox wordmark + 2-line
 * headline + device name at the bottom) so the brief loading
 * state doesn't disrupt the layout rhythm.
 */
interface IdleViewProps {
  error: string;
  onConnectOther: () => void;
  onStart: () => void;
}

export function IdleView({
  error,
  onConnectOther,
  onStart,
}: IdleViewProps) {
  return (
    <div data-testid="idle-state">
      <HandshakeLayout
        left={
          <HeroSection
            subtitle="Paste-free, account-free. Files move straight over your local network — no servers, no uploads."
            title="Send files directly to another device."
          />
        }
        right={
          <Card className="w-full max-w-md border border-border/60 shadow-2xl shadow-primary/5">
            <CardContent className="flex flex-col items-center gap-6 p-6 lg:p-8">
              <div className="flex items-center gap-3 text-muted-foreground">
                {error ? null : (
                  <Loader2Icon
                    aria-label="Generating QR"
                    className="size-5 animate-spin text-primary"
                  />
                )}
                <h2 className="font-semibold text-foreground text-xl">
                  {error ? "Couldn't start" : "Preparing your QR code…"}
                </h2>
              </div>
              {error ? (
                <Button data-testid="retry-offer" onClick={onStart}>
                  Try again
                </Button>
              ) : null}
              <Button
                data-testid="connect-to-other"
                onClick={onConnectOther}
                variant="ghost"
              >
                Connect to another device
              </Button>
              <ErrorText error={error} />
            </CardContent>
          </Card>
        }
      />
    </div>
  );
}
