// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from "@playwright/test";

/**
 * Issue 10 (PWA shell, manifest, SW offline).
 *
 * Verifies that the service worker caches the app shell on first
 * visit and serves it when the network is unavailable. This is the
 * foundational PWA offline-capable requirement — all other flows
 * (pair, transfer, inbox) depend on the shell being reachable
 * without a network.
 *
 * Acceptance criteria covered:
 * - Service worker registers successfully on first load
 * - After the first install, the app launches in airplane mode
 *   and is fully usable (home page renders offline)
 * - Playwright E2E: simulate offline mode after first visit;
 *   assert the home page renders
 */

test.describe("PWA offline capability", () => {
  test("home page renders offline after first visit", async ({ page }) => {
    // 1. First visit — this triggers SW registration + precache.
    await page.goto("/");

    // Wait for the SW to register and become the controller.  The
    // PwaRegistration component calls registerServiceWorker() in a
    // useEffect, which runs after the initial render.  We poll
    // until navigator.serviceWorker.controller is set (the SW has
    // activated and is controlling this page).
    await expect
      .poll(
        async () => {
          const hasController = await page.evaluate(
            () => !!navigator.serviceWorker.controller
          );
          return hasController;
        },
        {
          timeout: 15_000,
          message: "Service worker should become the controller",
        }
      )
      .toBe(true);

    // 2. Verify the home page renders normally (role buttons are
    // visible, proving JS/CSS loaded).
    await expect(page.getByTestId("role-offerer")).toBeVisible();
    await expect(page.getByTestId("role-answerer")).toBeVisible();
    await expect(page.getByTestId("open-settings")).toBeVisible();

    // 3. Navigate to /settings and back to exercise the cache-first
    // strategy for static assets (JS/CSS bundles get cached on
    // first access).  This ensures the offline reload has all the
    // resources it needs.
    await page.getByTestId("open-settings").click();
    await expect(page.getByTestId("settings-screen")).toBeVisible();
    await page.goto("/");
    await expect(page.getByTestId("role-offerer")).toBeVisible();

    // 4. Go offline.
    await page.context().setOffline(true);

    // 5. Reload — the SW's navigation handler should serve the
    // cached shell because the network fetch will fail.
    await page.reload();

    // 6. Assert the home page still renders.  The role buttons
    // depend on React hydration which requires JS bundles — if
    // those weren't cached, the page would be blank or show the
    // 503 "Offline" fallback.
    await expect(page.getByTestId("role-offerer")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("role-answerer")).toBeVisible();
    await expect(page.locator("h1")).toContainText("P2P File Sharing");

    // 7. Go back online for subsequent tests.
    await page.context().setOffline(false);
  });

  test("offline page shows fallback when no cache exists", async ({ page }) => {
    // First visit — installs the SW so it can intercept the
    // offline navigation request.  Without an active SW,
    // page.goto("/") throws net::ERR_INTERNET_DISCONNECTED
    // before any fallback handler can run.
    await page.goto("/");
    await expect
      .poll(
        async () => {
          const hasController = await page.evaluate(
            () => !!navigator.serviceWorker.controller
          );
          return hasController;
        },
        {
          timeout: 15_000,
          message: "Service worker should become the controller",
        }
      )
      .toBe(true);

    // Clear the cached / entry so the SW has nothing to serve
    // when we go offline.  The navigation handler's catch() will
    // fall through to the 503 "Offline" response.
    await page.evaluate(async () => {
      const cache = await caches.open("p2p-share-v1");
      const keys = await cache.keys();
      for (const req of keys) {
        if (req.url.endsWith("/") && new URL(req.url).pathname === "/") {
          await cache.delete(req);
        }
      }
    });

    await page.context().setOffline(true);
    // waitUntil: "commit" — the 503 response has no <script>
    // tags, so "load" would hang waiting for subresources that
    // don't exist.
    await page.reload({ waitUntil: "commit" });

    // The SW's navigation handler should serve the 503 "Offline"
    // fallback because the cached / entry was deleted.
    await expect(page.locator("body")).toContainText("Offline", {
      timeout: 10_000,
    });

    await page.context().setOffline(false);
  });
});
