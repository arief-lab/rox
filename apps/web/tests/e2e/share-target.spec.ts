// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";

/**
 * Slice 17 E2E: share target mock flow.
 *
 * Three tests:
 * 1. Direct navigation to /share-target — verifies the page
 *    renders without hydration errors (the SSR fix uses
 *    useSearchParams + Suspense).  Without a share ID, the page
 *    shows the "No file shared" message.
 * 2. Cache API roundtrip — stores file + metadata in the
 *    share-target-v1 cache via page.evaluate() using the same
 *    plain-string key format as the SW (sw.js), then navigates
 *    to /share-target?id=... and verifies the share-ready UI
 *    (file name, size, badge).  The SSR hydration fix
 *    (useSearchParams + Suspense) ensures the page renders
 *    without errors.
 * 3. Full flow via bypass — pushes a PendingEntry directly into
 *    the Inbox via window.__inbox, then verifies the end-to-end
 *    chain: pending entry → pair → send → receiver's Inbox.
 *
 * Cache API key alignment:
 * The SW stores entries with plain string keys (e.g.
 * "file:<id>:<name>", "meta:<id>") — NOT Request objects.
 * share-cache.ts reads with cache.match(plainString).  Both
 * the SW and the window page are on the same origin
 * (localhost:3000), so plain strings resolve to identical
 * absolute URLs in both contexts and cache.match() finds them.
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

  test("share-target page shows share-ready UI after cache mock", async ({
    page,
  }) => {
    const fileId = "e2e-share-cache-1";
    const fileName = "sunset.jpg";
    const fileContent = "fake-image-bytes";
    const fileSize = fileContent.length;
    const fileType = "image/jpeg";

    // Navigate to the home page first so the page has an origin
    // to resolve relative Cache API keys against.
    await page.goto("/");

    // Store file + metadata in the share-target cache using
    // the same hyphen-separated key format as the SW (sw.js).
    // Hyphens avoid URL-scheme ambiguity: "file:id:name" would
    // be parsed as scheme "file" → Cache API rejects it.
    // "file-id-name" resolves as a relative URL against
    // localhost:3000 → scheme is "http" → Cache API accepts it.
    await page.evaluate(
      ({
        id,
        name,
        content,
        size,
        type,
      }: {
        id: string;
        name: string;
        content: string;
        size: number;
        type: string;
      }) => {
        const cacheName = "share-target-v1";
        return caches.open(cacheName).then(async (cache) => {
          await cache.put(
            `file-${id}-${encodeURIComponent(name)}`,
            new Response(content, {
              headers: {
                "Content-Type": type,
                "Content-Length": String(size),
              },
            })
          );
          await cache.put(
            `meta-${id}`,
            Response.json({
              name,
              size,
              type,
              count: 1,
            })
          );
        });
      },
      {
        id: fileId,
        name: fileName,
        content: fileContent,
        size: fileSize,
        type: fileType,
      }
    );

    // Navigate to the share-target page — the component reads
    // `id` from useSearchParams() then calls readSharedFile(id)
    // which hits cache.match("meta:<id>") and
    // cache.match("file:<id>:<name>").  The plain-string keys
    // resolve to the same absolute URLs on localhost:3000.
    await page.goto(`/share-target?id=${encodeURIComponent(fileId)}`);

    // ---- Verify share-ready UI ----
    await expect(page.getByTestId("share-ready")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("share-file-name")).toContainText(fileName);
    await expect(page.getByTestId("share-file-size")).toContainText(
      "16 B · image/jpeg"
    );
    await expect(page.getByTestId("share-ready-badge")).toContainText("Ready");

    // Clean up the cache so subsequent runs start fresh.
    await page.evaluate(() => caches.delete("share-target-v1"));
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
      // the Cache API).  The Inbox is created by page.tsx and
      // exposed on window.__inbox for E2E tests.
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
