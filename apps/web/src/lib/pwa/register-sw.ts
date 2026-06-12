// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Register the service worker on first load. Must be called from a
 * client component (uses `navigator.serviceWorker`). Uses a simple
 * register/error pattern — the PWA install prompt fires from a
 * separate `beforeinstallprompt` event listener.
 *
 * Slice 10: issue 10-pwa-shell-manifest-sw-offline.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      // Service worker registered. The install prompt (Add to Home
      // Screen) is handled by a separate `beforeinstallprompt`
      // listener in the InstallPrompt component.
      registration.addEventListener("updatefound", () => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          return;
        }
        installingWorker.addEventListener("statechange", () => {
          if (
            installingWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New version available — the user will see it on the
            // next navigation or reload.
          }
        });
      });
    })
    .catch(() => {
      // Service worker registration failed (e.g., not served over
      // HTTPS in development). The app still works without it.
    });
}
