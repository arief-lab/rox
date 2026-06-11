"use client";

import { useCallback, useEffect, useState } from "react";

import {
  incrementDismissCount,
  shouldShowPrompt,
} from "@/lib/pwa/install-store";

const IOS_REGEX = /iphone|ipad|ipod/;

/**
 * InstallPrompt — the Add to Home Screen banner.
 *
 * Listens for the `beforeinstallprompt` event (fired by Chrome when
 * the PWA meets installability criteria) and shows a small
 * dismissible banner. On click, calls `prompt()` which triggers the
 * native Add to Home Screen dialog.
 *
 * Persistence (slice 12):
 * - Dismissals are stored in `localStorage` via the install store
 *   so the prompt stays hidden across page reloads and new
 *   Sessions.  After MAX_DISMISSALS (3) dismissals, the prompt is
 *   suppressed permanently.
 * - When the app IS already installed (running in standalone
 *   mode), the prompt is never shown — the user is already using
 *   the installed PWA.
 *
 * iOS Safari 17+ does not fire `beforeinstallprompt`; users on iOS
 * use the Share → Add to Home Screen flow. This component shows a
 * passive hint on iOS instead.
 *
 * Slice 10: initial implementation.
 * Slice 12: persistence (localStorage, dismissal counter, standalone check).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Slice 12: skip if already installed or dismissed enough.
    if (!shouldShowPrompt()) {
      return;
    }

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

  // Show the Chrome banner once the deferred prompt is available
  // AND the store says we should show it.
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
    // Whether accepted or dismissed, count it — we don't want to
    // nag again.  Increment counts as a dismissal so the prompt
    // is suppressed after install or explicit dismissal.
    incrementDismissCount();
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setVisible(false);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    // Slice 12: persist the dismissal so the prompt stays hidden
    // across page reloads and new Sessions.
    incrementDismissCount();
    setVisible(false);
  }, []);

  const handleIOSDismiss = useCallback(() => {
    // Slice 12: count iOS hint dismissal too — same persistence.
    incrementDismissCount();
    setShowIOSHint(false);
  }, []);

  // Slice 12: guard each path with shouldShowPrompt() so
  // setting `visible` / `showIOSHint` to false is enough to
  // suppress on future renders.  The store's localStorage-based
  // check handles suppression across reloads.

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

  // Chrome / Android / Desktop: native beforeinstallprompt banner.
  if (visible && deferredPrompt) {
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
