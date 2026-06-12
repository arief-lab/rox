// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Issue 12 (PWA install prompt + home screen).
 *
 * Verifies the install prompt component across all target
 * platforms: Chrome/Android/Desktop (beforeinstallprompt),
 * iOS Safari (Share → Add to Home Screen instructions), and
 * the persistence/standalone suppression logic.
 *
 * Acceptance criteria covered:
 * - On Android Chrome, install prompt appears and installs on tap
 * - On iOS Safari 17+, the prompt shows "tap Share → Add to Home
 *   Screen" instructions
 * - On desktop Chrome/Edge, same flow as Android
 * - Once installed or dismissed N times, prompt is suppressed
 * - E2E: stub beforeinstallprompt, fire it, assert UI renders
 *   and install action calls deferred prompt's prompt()
 *
 * --- Implementation notes ---
 *
 * The install-store module (install-store.ts) is NOT importable
 * inside page.evaluate because Next.js doesn't serve source files
 * to the browser.  Instead we operate on localStorage directly
 * using the same key the store uses:
 *
 *   STORAGE_KEY = "p2p-share:install-dismiss-count"
 *
 * The STORAGE_KEY and MAX_DISMISSALS (=3) are hardcoded in the
 * store; duplicating them here is safe for an E2E test that
 * verifies end-to-end user-facing behavior.
 */

const STORAGE_KEY = "p2p-share:install-dismiss-count";
const MAX_DISMISSALS = 3;

/** Reset the install dismissal count to 0. */
async function resetCount(page: Page): Promise<void> {
  await page.evaluate((key) => {
    localStorage.setItem(key, "0");
  }, STORAGE_KEY);
}

/** Read the current install dismissal count from localStorage. */
function readCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? 0 : Number.parseInt(raw, 10);
  }, STORAGE_KEY);
}

/**
 * Dispatch a synthetic beforeinstallprompt event on the page.
 *
 * The component's useEffect registers the listener on mount,
 * which runs asynchronously after the initial render.  Callers
 * must ensure React has had time to flush effects before invoking
 * this helper (a short wait or goto + setTimeout).
 *
 * After dispatching, `window.__promptCalled` tracks whether the
 * component's handleInstall called `deferredPrompt.prompt()`.
 */
async function fireBeforeInstallPrompt(page: Page): Promise<void> {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", {
      cancelable: true,
    }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };

    // The prompt() closure must set __promptCalled on window
    // directly (not a local variable), because prompt() is called
    // later — on button click — after this evaluate() has
    // returned and the local scope is gone.
    event.prompt = () => {
      (window as unknown as Record<string, boolean>).__promptCalled = true;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });

    window.dispatchEvent(event);
  });
}

/** Check whether the deferred prompt's prompt() was called. */
function wasPromptCalled(page: Page): Promise<boolean> {
  return page.evaluate(
    () => (window as unknown as Record<string, boolean>).__promptCalled ?? false
  );
}

test.describe("PWA install prompt", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for React's useEffect to flush — the component
    // registers the beforeinstallprompt listener in an effect
    // that runs asynchronously after the initial render.  Without
    // this wait, the synthetic event may fire before the listener
    // exists and the test will timeout waiting for the banner.
    await page.waitForTimeout(1000);
    await resetCount(page);
  });

  test("Chrome beforeinstallprompt — banner renders with Install button", async ({
    page,
  }) => {
    await fireBeforeInstallPrompt(page);

    await expect(page.getByTestId("install-button")).toBeVisible();
    await expect(page.getByTestId("install-dismiss")).toBeVisible();
    await expect(page.locator("body")).toContainText(
      "Install this app for quick access."
    );
  });

  test("Chrome beforeinstallprompt — Install button calls prompt()", async ({
    page,
  }) => {
    await fireBeforeInstallPrompt(page);

    await expect(page.getByTestId("install-button")).toBeVisible();
    await page.getByTestId("install-button").click();

    // handleInstall should have called deferredPrompt.prompt(),
    // which sets window.__promptCalled = true.
    expect(await wasPromptCalled(page)).toBe(true);

    // After calling prompt() + userChoice resolution, the banner
    // should hide.
    await expect(page.getByTestId("install-button")).not.toBeVisible();
  });

  test("Chrome beforeinstallprompt — dismiss button hides prompt", async ({
    page,
  }) => {
    await fireBeforeInstallPrompt(page);

    await expect(page.getByTestId("install-dismiss")).toBeVisible();
    await page.getByTestId("install-dismiss").click();

    // Banner disappears.
    await expect(page.getByTestId("install-button")).not.toBeVisible();
    await expect(page.getByTestId("install-dismiss")).not.toBeVisible();

    // Dismissal count should be 1 (incremented by handleDismiss).
    expect(await readCount(page)).toBe(1);
  });

  test("prompt suppressed after 3 dismissals", async ({ page }) => {
    // Dismiss MAX_DISMISSALS times — each fires incrementDismissCount().
    for (let i = 0; i < MAX_DISMISSALS; i++) {
      await fireBeforeInstallPrompt(page);

      await expect(page.getByTestId("install-dismiss")).toBeVisible();
      await page.getByTestId("install-dismiss").click();
      await expect(page.getByTestId("install-button")).not.toBeVisible();
    }

    // After MAX_DISMISSALS dismissals, shouldShowPrompt() returns
    // false.  Fire another event — the banner must NOT appear.
    await fireBeforeInstallPrompt(page);

    // The second useEffect checks shouldShowPrompt() and won't
    // call setVisible(true).
    await expect(page.getByTestId("install-button")).not.toBeVisible();
  });

  test("standalone mode suppresses prompt", async ({ page }) => {
    // Mock matchMedia so isRunningStandalone() returns true.
    // addInitScript runs before any page JS, so the component
    // sees the mocked version when it mounts.
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = ((query: string) => {
        if (query === "(display-mode: standalone)") {
          const noop = (): void => undefined;
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: noop,
            removeListener: noop,
            addEventListener: noop,
            removeEventListener: noop,
            dispatchEvent: () => false,
          } as MediaQueryList;
        }
        return originalMatchMedia(query);
      }) as typeof window.matchMedia;
    });

    // Reload so the init script takes effect.
    await page.goto("/");
    await page.waitForTimeout(500);
    await resetCount(page);

    // Fire beforeinstallprompt — shouldShowPrompt() returns false
    // because isRunningStandalone() is true, so the banner won't
    // appear.
    await fireBeforeInstallPrompt(page);

    await expect(page.getByTestId("install-button")).not.toBeVisible();
  });

  test("iOS Safari — shows Share → Add to Home Screen instructions", async ({
    page,
  }) => {
    // Mock iOS Safari.  The component checks:
    //   IOS_REGEX.test(navigator.userAgent.toLowerCase()) &&
    //   "standalone" in navigator && !navigator.standalone
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        get: (): string =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        configurable: true,
      });
      Object.defineProperty(navigator, "standalone", {
        get: (): boolean => false,
        configurable: true,
      });
    });

    await page.goto("/");
    await resetCount(page);

    // The iOS hint appears after a 3s setTimeout.  Wait for it.
    await expect(page.getByTestId("install-dismiss")).toBeVisible({
      timeout: 6000,
    });
    await expect(page.locator("body")).toContainText("Install this app:");
    await expect(page.locator("body")).toContainText("Share");
    await expect(page.locator("body")).toContainText("Add to Home Screen");
  });

  test("iOS Safari — dismiss hides hint", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        get: (): string =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        configurable: true,
      });
      Object.defineProperty(navigator, "standalone", {
        get: (): boolean => false,
        configurable: true,
      });
    });

    await page.goto("/");
    await resetCount(page);

    await expect(page.getByTestId("install-dismiss")).toBeVisible({
      timeout: 6000,
    });
    await page.getByTestId("install-dismiss").click();

    // The iOS hint should disappear.
    await expect(page.getByTestId("install-dismiss")).not.toBeVisible();
    await expect(page.locator("body")).not.toContainText("Add to Home Screen");
  });
});
