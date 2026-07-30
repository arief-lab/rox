// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { useCallback, useEffect, useState } from "react";
import {
  incrementDismissCount,
  shouldShowPrompt,
} from "@/lib/pwa/install-store";

const IOS_REGEX = /iphone|ipad|ipod/;

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (!shouldShowPrompt()) {
      return;
    }

    const isIOS =
      typeof navigator !== "undefined" &&
      IOS_REGEX.test(navigator.userAgent.toLowerCase()) &&
      "standalone" in navigator &&
      !navigator.standalone;

    if (isIOS) {
      const timer = setTimeout(() => setShowIOSHint(true), 3000);
      return () => clearTimeout(timer);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (deferredPrompt && shouldShowPrompt()) {
      setVisible(true);
    }
  }, [deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    incrementDismissCount();
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    incrementDismissCount();
    setVisible(false);
  }, []);

  const handleIOSDismiss = useCallback(() => {
    incrementDismissCount();
    setShowIOSHint(false);
  }, []);

  if (showIOSHint) {
    return (
      <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-lg">
        <Button
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          data-testid="install-dismiss"
          onClick={handleIOSDismiss}
          size="icon-xs"
          variant="ghost"
        >
          ×
        </Button>
        <p className="pr-6 text-sm">
          <span className="font-medium">Install this app:</span> tap{" "}
          <span className="rounded bg-muted px-1 text-xs">Share</span> then
          <span className="rounded bg-muted px-1 text-xs">
            Add to Home Screen
          </span>
          .
        </p>
      </div>
    );
  }

  if (visible && deferredPrompt) {
    return (
      <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-lg">
        <Button
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          data-testid="install-dismiss"
          onClick={handleDismiss}
          size="icon-xs"
          variant="ghost"
        >
          ×
        </Button>
        <p className="mb-3 pr-6 text-sm">Install this app for quick access.</p>
        <Button data-testid="install-button" onClick={handleInstall}>
          Install
        </Button>
      </div>
    );
  }

  return null;
}
