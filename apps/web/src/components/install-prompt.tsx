"use client";

import { useCallback, useEffect, useState } from "react";

const IOS_REGEX = /iphone|ipad|ipod/;

/**
 * InstallPrompt — the slice 10 Add to Home Screen banner.
 *
 * Listens for the `beforeinstallprompt` event (fired by Chrome when
 * the PWA meets installability criteria) and shows a small
 * dismissible banner. On click, calls `prompt()` which triggers the
 * native Add to Home Screen dialog. The banner only appears on the
 * second visit (after the SW has precached the shell) and stays
 * hidden after the user dismisses it or installs the app.
 *
 * iOS Safari 17+ does not fire `beforeinstallprompt`; users on iOS
 * use the Share → Add to Home Screen flow. This component shows a
 * passive hint on iOS instead.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Detect iOS Safari (which doesn't fire beforeinstallprompt).
    const isIOS =
      typeof navigator !== "undefined" &&
      IOS_REGEX.test(navigator.userAgent.toLowerCase()) &&
      "standalone" in navigator &&
      !navigator.standalone;
    if (isIOS) {
      // Show after a short delay so the page has loaded.
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

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const handleIOSDismiss = useCallback(() => {
    setShowIOSHint(false);
  }, []);

  if (dismissed) {
    return null;
  }

  // iOS hint: Safari doesn't support beforeinstallprompt.
  if (showIOSHint) {
    return (
      <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm rounded-lg border border-blue-300 bg-blue-50 p-3 shadow-lg">
        <button
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          data-testid="install-dismiss"
          onClick={handleIOSDismiss}
          type="button"
        >
          ×
        </button>
        <p className="pr-6 text-sm">
          <span className="font-medium">Install this app:</span> tap{" "}
          <span className="rounded bg-gray-200 px-1 text-xs">Share</span> then
          <span className="rounded bg-gray-200 px-1 text-xs">
            Add to Home Screen
          </span>
          .
        </p>
      </div>
    );
  }

  // Chrome / Android: native beforeinstallprompt banner.
  if (deferredPrompt) {
    return (
      <div className="fixed right-4 bottom-4 left-4 z-50 mx-auto max-w-sm rounded-lg border border-slate-300 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-800">
        <button
          aria-label="Dismiss"
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          data-testid="install-dismiss"
          onClick={handleDismiss}
          type="button"
        >
          ×
        </button>
        <p className="mb-2 pr-6 text-sm">Install this app for quick access.</p>
        <button
          className="rounded bg-blue-500 px-4 py-1.5 text-sm text-white"
          data-testid="install-button"
          onClick={handleInstall}
          type="button"
        >
          Install
        </button>
      </div>
    );
  }

  return null;
}
