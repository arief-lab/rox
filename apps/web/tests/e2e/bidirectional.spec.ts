// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";
import { sendFile } from "./_helpers/transfer";

/**
 * Slice 14 E2E: bidirectional transfer in the same Session.
 *
 * Context A sends a file to Context B, then Context B sends a
 * different file back to Context A — all without re-pairing.
 * Both files must land in the correct Inbox with exactly one
 * entry each (no cross-contamination), and the Session must stay
 * connected throughout.
 */
test.describe("Bidirectional transfer (slice 14)", () => {
  test.describe.configure({ mode: "serial" });
  // Generous timeout: pairing + 2 file transfers + 2 saves.
  test.setTimeout(120_000);

  test("A sends to B, then B sends to A, both Inboxes have exactly one file each", async ({
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
      await pageA.goto("/");
      await pageB.goto("/");

      // 1. Pair up (same flow as pairing.spec.ts).
      await pair(pageA, pageB);

      // 2. A sends "from-a.txt" to B. Wait for B's Inbox to show
      //    1 row, confirming the transfer completed end-to-end.
      await sendFile(pageA, pageB, "from-a.txt", "hello from A", 1);

      // 3. B sends "from-b.txt" back to A. Wait for A's Inbox to
      //    show 1 row. Both Inboxes now have exactly 1 entry each.
      await sendFile(pageB, pageA, "from-b.txt", "hello from B", 1);

      // 4. Session stays connected — no "Disconnected" indicator
      //    on either side.
      await expect(pageA.getByTestId("connected-state")).toBeVisible();
      await expect(pageB.getByTestId("connected-state")).toBeVisible();

      // 5. Save the received file from A's Inbox (the one B sent).
      //    Capture the download event before clicking Save.
      const downloadFromB = pageA.waitForEvent("download", {
        timeout: 10_000,
      });
      await pageA.getByTestId("inbox-save").click();
      const fileFromB = await downloadFromB;

      // 6. Save the received file from B's Inbox (the one A sent).
      const downloadFromA = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await pageB.getByTestId("inbox-save").click();
      const fileFromA = await downloadFromA;

      // 7. Verify download contents match the original sent data.
      expect(await readFile(await fileFromA.path(), "utf-8")).toBe(
        "hello from A"
      );
      expect(await readFile(await fileFromB.path(), "utf-8")).toBe(
        "hello from B"
      );

      // 8. Both Inboxes have exactly 1 entry each (no cross-
      //    contamination — A didn't receive B's sent file in A's
      //    Inbox, and vice versa). Check via the DOM row count.
      await expect(pageA.getByTestId("inbox-row")).toHaveCount(1);
      await expect(pageB.getByTestId("inbox-row")).toHaveCount(1);
    } finally {
      await Promise.race([
        Promise.all([
          // Page may already be closed if the test failed earlier.
          pageA.close().catch(() => {
            // Ignore — racing close in finally.
          }),
          // Page may already be closed if the test failed earlier.
          pageB.close().catch(() => {
            // Ignore — racing close in finally.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await Promise.race([
        Promise.all([
          // Context may already be closed if the page close above
          // cascaded the context shutdown.
          ctxA.close().catch(() => {
            // Ignore — racing close in finally.
          }),
          // Context may already be closed if the page close above
          // cascaded the context shutdown.
          ctxB.close().catch(() => {
            // Ignore — racing close in finally.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });
});
