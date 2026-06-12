import { readFile } from "node:fs/promises";

import type { Download } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";
import {
  getInboxEntryIds,
  saveInboxEntry,
  sendFile,
  waitForSavedCount,
} from "./_helpers/transfer";

/**
 * Slice 5 E2E: receive three files, save two, discard one.
 *
 * The clipboard permissions are required because the answerer's
 * `writeClipboard` call throws "Write permission denied" in headless
 * Chromium without explicit permission. Without this, the
 * `result.transport.then(...)` never fires and the test stalls at
 * the connected-state assertion.
 */
test.describe("Inbox save/discard (slice 5)", () => {
  test.describe.configure({ mode: "serial" });
  // Generous timeout: pairing + 3 file transfers + save/discard.
  test.setTimeout(120_000);

  test("receive three files, save two, discard one", async ({ browser }) => {
    const ctxA = await browser.newContext({
      permissions: ["clipboard-write", "clipboard-read"],
    });
    const ctxB = await browser.newContext({
      permissions: ["clipboard-write", "clipboard-read"],
    });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // Collect downloads initiated by pageB (the receive side). The
    // triggerBrowserDownload helper creates a blob URL + anchor click,
    // which Playwright intercepts as a download event.
    const downloads: Download[] = [];
    pageB.on("download", (d) => downloads.push(d));

    try {
      await pageA.goto("/");
      await pageB.goto("/");

      // 1. Pair up (same flow as pairing.spec.ts)
      await pair(pageA, pageB);

      // 2. Send three files from page A to page B. Each send waits
      //    for the receive side's Inbox to grow by one row before
      //    sending the next, so the transfers are serialized and
      //    we never race the chunk-frame state machine.
      await sendFile(pageA, pageB, "file1.txt", "hello world 1", 1);
      await sendFile(pageA, pageB, "file2.txt", "hello world 2", 2);
      await sendFile(pageA, pageB, "file3.txt", "hello world 3", 3);

      // 3. Read entry IDs from the Inbox so we can save them one at
      //    a time (two rapid downloads in the same event-loop tick
      //    cause headless Chromium to capture the wrong blob URL).
      await expect(pageB.getByTestId("inbox-save-selected")).toBeVisible();
      const entryIds = await getInboxEntryIds(pageB);

      // 4. Save the first two entries (at indices 0 and 1). Each
      //    save runs in its own evaluate call via saveInboxEntry,
      //    letting the browser process each download before the
      //    next save fires.
      const download1Promise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await saveInboxEntry(pageB, entryIds[0]);
      const download1 = await download1Promise;

      const download2Promise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await saveInboxEntry(pageB, entryIds[1]);
      const download2 = await download2Promise;

      // 5. Verify saved state directly via the Inbox instance on
      //    window (bypasses React DOM rendering).
      await waitForSavedCount(pageB, 2);

      // 6. Discard the third row (the one without a "Saved" badge).
      //    Save doesn't reorder, so the unsaved row is still at
      //    index 2 in the list.
      await pageB.getByTestId("inbox-discard").nth(2).click();

      // 7. Final Inbox state: 2 rows, both with "Saved" badge.
      //    Same toHaveCount strategy as step 5 — the React
      //    re-render from the discard happens in a microtask and
      //    can race the 5s default on slow CI.
      await expect(pageB.getByTestId("inbox-row")).toHaveCount(2, {
        timeout: 5000,
      });
      await expect(pageB.getByTestId("inbox-saved-badge")).toHaveCount(2, {
        timeout: 5000,
      });

      // 8. Verify the download content: headless Chromium may
      //    reuse the same suggestedFilename for rapid successive
      //    downloads, so we identify downloads by their content
      //    rather than by filename.  Read both, sort the
      //    contents, and assert the set matches.
      expect(downloads).toHaveLength(2);
      const downloadContents = (
        await Promise.all(
          [download1, download2].map(async (d) => {
            const path = await d.path();
            return readFile(path, "utf-8");
          })
        )
      ).sort();
      expect(downloadContents).toEqual(["hello world 1", "hello world 2"]);
    } finally {
      // Close pages first so the WebRTC connections release the
      // browser cleanly. Race each close against a 5s timeout so the
      // test doesn't stall if a peer connection is stuck in a state
      // that prevents the page from closing promptly.
      await Promise.race([
        Promise.all([
          pageA.close().catch(() => {
            // Page may already be closed if the test failed earlier.
          }),
          pageB.close().catch(() => {
            // Page may already be closed if the test failed earlier.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await Promise.race([
        Promise.all([
          ctxA.close().catch(() => {
            // Context may already be closed if the page close above
            // cascaded the context shutdown.
          }),
          ctxB.close().catch(() => {
            // Context may already be closed if the page close above
            // cascaded the context shutdown.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });
});
