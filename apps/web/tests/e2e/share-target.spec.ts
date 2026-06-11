import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";

/**
 * Slice 17 E2E: share target mock flow.
 *
 * Two tests:
 * 1. Direct navigation to /share-target — verifies the page
 *    renders without hydration errors (the SSR fix uses
 *    useSearchParams + Suspense).  Without a share ID, the page
 *    shows the "No file shared" message.
 * 2. Full flow via bypass — pushes a PendingEntry directly into
 *    the Inbox via window.__inbox, then verifies the end-to-end
 *    chain: pending entry → pair → send → receiver's Inbox.
 *
 * The Cache API (caches.open / cache.put) behaves differently
 * between the service worker context and the window context
 * (page.evaluate), making cache-key alignment fragile.  The SW's
 * share_target POST handler is covered by SW unit tests; the
 * page's share-ready UI can be verified manually or via a
 * future Playwright test that hooks into the SW's fetch event.
 */
test.describe("Share target mock (slice 17)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("share-target page renders without hydration errors", async ({
    page,
  }) => {
    // Direct navigation — no share ID, shows "No file shared".
    await page.goto("/share-target");
    // Hydration errors would prevent the component from
    // rendering — share-no-file visibility is the real check.
    await expect(page.getByTestId("share-no-file")).toBeVisible({
      timeout: 5000,
    });
  });

  test("pending entry appears in ConnectedView, send to paired peer succeeds", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext({
      permissions: ["clipboard-write", "clipboard-read"],
    });
    const ctxB = await browser.newContext({
      permissions: ["clipboard-write", "clipboard-read"],
    });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      const fileName = "shared-photo.jpg";
      const fileContent = "fake-jpeg-content";

      await pageB.goto("/");

      // page.tsx exposes the Inbox on window.__inbox via
      // useEffect — poll until available.
      await pageB.waitForFunction(
        () =>
          (
            window as unknown as {
              __inbox?: { pushPending: (e: unknown) => void };
            }
          ).__inbox !== undefined,
        { timeout: 5000 }
      );

      // Push a PendingEntry directly into the Inbox (bypassing
      // the Cache API which behaves differently between SW and
      // window contexts).  The Inbox is created by page.tsx
      // and exposed on window.__inbox for E2E tests.
      await pageB.evaluate(
        ({ name, content }: { name: string; content: string }) => {
          const w = window as unknown as {
            __inbox: {
              pushPending: (entry: {
                blob: Blob;
                id: string;
                name: string;
                sharedAt: number;
                size: number;
                type: string;
              }) => void;
            };
          };
          const encoder = new TextEncoder();
          w.__inbox.pushPending({
            blob: new Blob([encoder.encode(content)]),
            id: crypto.randomUUID(),
            name,
            sharedAt: Date.now(),
            size: content.length,
            type: "text/plain",
          });
        },
        { name: fileName, content: fileContent }
      );

      // ---- 1. Pair Offerer (pageA) and Answerer (pageB) ----
      await pageA.goto("/");
      await pair(pageA, pageB);

      // ---- 2. Verify the pending send entry appears ----
      const pendingSection = pageB.getByTestId("pending-send-section");
      await expect(pendingSection).toBeVisible({ timeout: 10_000 });
      await expect(pageB.getByTestId("pending-send-name")).toContainText(
        fileName
      );

      // ---- 3. Click "Send" on the pending entry ----
      await pageB.getByTestId("pending-send-button").click();

      // ---- 4. Verify pageA received the file ----
      await expect(pageA.getByTestId("inbox-row")).toHaveCount(1, {
        timeout: 15_000,
      });
      await expect(pageA.getByTestId("inbox-name")).toContainText(fileName);
    } finally {
      await Promise.race([
        Promise.all([
          pageA.close().catch(() => {
            // Ignore — racing close in finally.
          }),
          pageB.close().catch(() => {
            // Ignore — racing close in finally.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await Promise.race([
        Promise.all([
          ctxA.close().catch(() => {
            // Ignore — racing close in finally.
          }),
          ctxB.close().catch(() => {
            // Ignore — racing close in finally.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });
});
