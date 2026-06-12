// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Install store — persistent dismissal tracking for the PWA
 * install prompt.
 *
 * The install prompt (Add to Home Screen) should not nag.  Once
 * the user dismisses it N times (or installs the app), the prompt
 * is suppressed permanently in this browser profile.  Dismissal
 * counts are stored in `localStorage` so they survive page reloads
 * and new Sessions.
 *
 * When the app IS already installed and running in standalone
 * mode (e.g. launched from the home screen), the prompt should
 * never appear — the user is already using the installed PWA.
 *
 * Slice 12: issue 12-pwa-install-prompt-home-screen.
 */

const STORAGE_KEY = "p2p-share:install-dismiss-count";
const MAX_DISMISSALS = 3;

/** Read the current dismissal count from localStorage. */
function readCount(): number {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return 0;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return 0;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

/** Write the dismissal count to localStorage. */
function writeCount(count: number): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(count));
  } catch {
    // Storage full or unavailable — silently ignore; the prompt
    // will reappear on next reload which is acceptable.
  }
}

/**
 * Is the app currently running in standalone mode (installed PWA,
 * launched from the home screen)?
 *
 * Checks the `display-mode` media query (standard for all
 * browsers) and falls back to `navigator.standalone` (iOS
 * Safari-specific).
 */
export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  // Standard check — works on Chrome, Edge, Firefox, Safari 17+.
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  // iOS Safari < 17 fallback (non-standard).
  if ("standalone" in navigator && navigator.standalone === true) {
    return true;
  }
  return false;
}

/** Get the current dismissal count. */
export function getDismissCount(): number {
  return readCount();
}

/** Increment the dismissal count (on manual dismiss or install). */
export function incrementDismissCount(): void {
  writeCount(readCount() + 1);
}

/** Reset the dismissal count (for testing). */
export function resetDismissCount(): void {
  writeCount(0);
}

/**
 * Should the install prompt be shown?
 *
 * Returns `false` when:
 * - The app is already running in standalone mode (installed), OR
 * - The user has dismissed the prompt `MAX_DISMISSALS` times.
 *
 * Returns `true` when the prompt can be shown.
 */
export function shouldShowPrompt(): boolean {
  if (isRunningStandalone()) {
    return false;
  }
  return readCount() < MAX_DISMISSALS;
}
