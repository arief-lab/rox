// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDismissCount,
  incrementDismissCount,
  isRunningStandalone,
  resetDismissCount,
  shouldShowPrompt,
} from "@/lib/pwa/install-store";

const STORAGE_KEY = "p2p-share:install-dismiss-count";

/**
 * In-memory store backing the mocked localStorage.  Wiped in beforeEach
 * so each test starts fresh regardless of jsdom availability.
 */
const store = new Map<string, string>();

/** Factory for a non-matching matchMedia mock (returns matches: false). */
function nonMatchingMatchMedia(query: string) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

/** Factory for a standalone-matching matchMedia mock. */
function standaloneMatchMedia(query: string) {
  return {
    matches: query === "(display-mode: standalone)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

beforeEach(() => {
  store.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(nonMatchingMatchMedia)
  );
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getDismissCount", () => {
  it("returns 0 when localStorage is empty", () => {
    expect(getDismissCount()).toBe(0);
  });

  it("returns 0 when localStorage has non-numeric data", () => {
    localStorage.setItem(STORAGE_KEY, "not-a-number");
    expect(getDismissCount()).toBe(0);
  });

  it("returns the stored count", () => {
    localStorage.setItem(STORAGE_KEY, "2");
    expect(getDismissCount()).toBe(2);
  });

  it("returns the raw parsed value for negative numbers (no clamping)", () => {
    // readCount() does not clamp negative values — parseInt("-1") returns -1.
    localStorage.setItem(STORAGE_KEY, "-1");
    expect(getDismissCount()).toBe(-1);
  });
});

describe("incrementDismissCount", () => {
  it("increments from 0 to 1", () => {
    incrementDismissCount();
    expect(getDismissCount()).toBe(1);
  });

  it("increments from 2 to 3", () => {
    localStorage.setItem(STORAGE_KEY, "2");
    incrementDismissCount();
    expect(getDismissCount()).toBe(3);
  });

  it("persists to localStorage", () => {
    incrementDismissCount();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });
});

describe("resetDismissCount", () => {
  it("sets the count back to 0", () => {
    incrementDismissCount();
    incrementDismissCount();
    resetDismissCount();
    expect(getDismissCount()).toBe(0);
  });

  it("clears the localStorage entry to 0", () => {
    incrementDismissCount();
    resetDismissCount();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("0");
  });
});

describe("isRunningStandalone", () => {
  it("returns false when not in standalone mode", () => {
    expect(isRunningStandalone()).toBe(false);
  });

  it("returns true when display-mode: standalone matches", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(standaloneMatchMedia)
    );
    expect(isRunningStandalone()).toBe(true);
  });

  it("returns true when navigator.standalone is true (iOS < 17)", () => {
    // Keep matchMedia as non-matching so only the navigator fallback wins.
    const origStandalone = (navigator as unknown as Record<string, unknown>)
      .standalone;
    Object.defineProperty(navigator, "standalone", {
      value: true,
      configurable: true,
    });
    expect(isRunningStandalone()).toBe(true);
    // Restore original value.
    Object.defineProperty(navigator, "standalone", {
      value: origStandalone,
      configurable: true,
    });
  });
});

describe("shouldShowPrompt", () => {
  it("returns true on first visit (count=0, not standalone)", () => {
    expect(shouldShowPrompt()).toBe(true);
  });

  it("returns true after 2 dismissals", () => {
    incrementDismissCount();
    incrementDismissCount();
    expect(shouldShowPrompt()).toBe(true);
  });

  it("returns false after MAX_DISMISSALS (3) dismissals", () => {
    incrementDismissCount();
    incrementDismissCount();
    incrementDismissCount();
    expect(shouldShowPrompt()).toBe(false);
  });

  it("returns false after more than MAX_DISMISSALS dismissals", () => {
    incrementDismissCount();
    incrementDismissCount();
    incrementDismissCount();
    incrementDismissCount(); // 4th — past the limit
    expect(shouldShowPrompt()).toBe(false);
  });

  it("returns false when running in standalone mode even on first visit", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation(standaloneMatchMedia)
    );
    expect(shouldShowPrompt()).toBe(false);
  });

  it("dismissals increment correctly across multiple sessions", () => {
    // Visit 1: dismiss once
    expect(shouldShowPrompt()).toBe(true);
    incrementDismissCount();
    expect(getDismissCount()).toBe(1);

    // Visit 2: dismiss twice more
    incrementDismissCount();
    incrementDismissCount();
    expect(getDismissCount()).toBe(3);
    expect(shouldShowPrompt()).toBe(false);

    // Reset
    resetDismissCount();
    expect(shouldShowPrompt()).toBe(true);
  });
});
