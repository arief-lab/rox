import { readFile } from "node:fs/promises";

import type { Download, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";

/**
 * Send a file from pageA to pageB via the SendButton's hidden file
 * input. Waits for the receive side's Inbox to grow by one row,
 * confirming the Transfer completed end-to-end before returning.
 */
async function sendFile(
  pageA: Page,
  pageB: Page,
  filename: string,
  content: string,
  expectedCount: number
): Promise<void> {
  await pageA.setInputFiles('[data-testid="file-input"]', {
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from(content),
  });
  await expect
    .poll(async () => pageB.getByTestId("inbox-row").count(), {
      timeout: 10_000,
    })
    .toBe(expectedCount);
}

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

      // 3. Select the first two checkboxes
      const checkboxes = pageB.getByTestId("inbox-checkbox");
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // 4. Click "Save selected" and wait for two downloads. The
      //    download promises are set up BEFORE the click so we don't
      //    miss the events.
      const download1Promise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      const download2Promise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await pageB.getByTestId("inbox-save-selected").click();
      const [download1, download2] = await Promise.all([
        download1Promise,
        download2Promise,
      ]);

      // 5. After save: 3 rows still in the Inbox, 2 with "Saved" badge
      //    (save is idempotent — the entry stays in the list so the
      //    user can see what they received).
      await expect
        .poll(async () => pageB.getByTestId("inbox-saved-badge").count(), {
          timeout: 5000,
        })
        .toBe(2);

      // 6. Discard the third row (the one without a "Saved" badge).
      //    Save doesn't reorder, so the unsaved row is still at
      //    index 2 in the list.
      await pageB.getByTestId("inbox-discard").nth(2).click();

      // 7. Final Inbox state: 2 rows, both with "Saved" badge
      await expect
        .poll(async () => pageB.getByTestId("inbox-row").count(), {
          timeout: 5000,
        })
        .toBe(2);
      await expect
        .poll(async () => pageB.getByTestId("inbox-saved-badge").count(), {
          timeout: 5000,
        })
        .toBe(2);

      // 8. Verify the downloads: exactly 2 were intercepted, and the
      //    filenames match the two saved files.
      expect(downloads).toHaveLength(2);
      const filenames = [
        download1.suggestedFilename(),
        download2.suggestedFilename(),
      ].sort();
      expect(filenames).toEqual(["file1.txt", "file2.txt"]);

      // 9. Verify the download content: each file's bytes should
      //    match what was sent. download.path() returns a temp file
      //    path; we read the buffer and compare against the original
      //    sent content. This catches silent corruption in the
      //    chunk-frame round trip (off-by-one chunks, wrong offsets,
      //    payload truncation) that the filename check alone would
      //    miss. Using Map.get() so we don't need a non-null
      //    assertion (ultracite's noNonNullAssertion rule).
      const expectedContent = new Map<string, string>([
        ["file1.txt", "hello world 1"],
        ["file2.txt", "hello world 2"],
      ]);
      for (const download of [download1, download2]) {
        const filename = download.suggestedFilename();
        const path = await download.path();
        const expected = expectedContent.get(filename);
        if (expected === undefined) {
          throw new Error(`Unexpected download filename: ${filename}`);
        }
        const actual = await readFile(path, "utf-8");
        expect(actual).toBe(expected);
      }
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
