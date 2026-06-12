// SPDX-License-Identifier: AGPL-3.0-or-later
const STORAGE_KEY = "rox-device-name";

/**
 * Generate a friendly device name from a User-Agent string.
 *
 * Heuristic order matters — check the most specific patterns first
 * (iPhone, iPad) before the broad ones (Mac). The goal is a label
 * the other side sees during a Session and in each Inbox row, not
 * an exhaustive device database.
 *
 * @param ua - `navigator.userAgent` string (defaults to empty string
 *   for SSR safety — the caller should pass the real UA in the
 *   browser).
 */
export function generateDeviceName(ua = ""): string {
  const uaLower = ua.toLowerCase();

  if (uaLower.includes("iphone")) {
    return "iPhone";
  }
  if (uaLower.includes("ipad")) {
    return "iPad";
  }
  if (uaLower.includes("android")) {
    return "Android";
  }
  if (uaLower.includes("cros")) {
    return "ChromeOS";
  }
  if (uaLower.includes("windows")) {
    return "Windows";
  }
  if (uaLower.includes("macintosh") || uaLower.includes("mac os x")) {
    return "Mac";
  }
  if (uaLower.includes("linux")) {
    return "Linux";
  }

  return "Unknown Device";
}

/**
 * Read the persisted device name from localStorage. Returns `null`
 * if no name has been saved yet — the caller should call
 * `generateDeviceName()` as a fallback.
 */
function readStored(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persist a device name override to localStorage.
 */
function writeStored(name: string): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Storage full or disabled — the override won't persist but
    // the in-memory name is still used for this session.
  }
}

/**
 * Get the current device name. Returns the user's override (from
 * localStorage) if one exists; otherwise auto-generates from
 * `navigator.userAgent`. The result is cached in memory for the
 * lifetime of the page so repeated calls don't re-parse the UA.
 */
let cached: string | null = null;

export function getDeviceName(): string {
  if (cached !== null) {
    return cached;
  }
  // Check localStorage first so a user override always wins.
  const stored = readStored();
  if (stored) {
    cached = stored;
    return cached;
  }
  // Auto-generate from the UA and cache it. The auto-generated
  // name is NOT persisted — only explicit overrides go to
  // localStorage, so the user can always see the auto-generated
  // default without ever having to hit "reset".
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  cached = generateDeviceName(ua);
  return cached;
}

/**
 * Override the device name. Persists to localStorage and updates
 * the in-memory cache so all UI consumers see the new name
 * immediately without a page reload.
 */
export function setDeviceName(name: string): void {
  cached = name;
  writeStored(name);
}

/**
 * Clear the persisted override and the in-memory cache so the
 * next call to `getDeviceName()` auto-generates a fresh name
 * from `navigator.userAgent`. Used by the Settings screen's
 * reset flow.
 */
export function resetDeviceName(): void {
  cached = null;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage access denied — cache is still cleared for this
      // session.
    }
  }
}
