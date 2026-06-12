// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";
import { sendFile } from "./_helpers/transfer";

/**
 * Slice 15 E2E: cancel mid-transfer.
 *
 * Two tests exercise the cancel flow end-to-end:
 *
 * 1. Sender cancel: A sends a large file → A clicks Cancel on the
 *    send progress bar → A's send log shows "Cancelled" → B's
 *    Inbox is empty → Session stays connected → A sends a second
 *    (small) file successfully.
 *
 * 2. Receiver cancel: A sends a large file → B clicks Cancel on
 *    the receive progress bar → A's send log shows "Cancelled" →
 *    B's Inbox is empty → Session stays connected → A sends a
 *    second file successfully.
 *
 * A 10 MB file gives enough time over WebRTC-on-localhost to
 * cancel mid-flight before all chunks land.
 */
test.describe("Cancel mid-transfer (slice 15)", () => {
  test.describe.configure({ mode: "serial" });
  // Generous timeout: pairing + large-file send + cancel + second send + save.
  test.setTimeout(120_000);

  /**
   * Sender cancels mid-flight. A initiates the send, then clicks
   * Cancel on the send progress bar. The transfer must stop, the
   * Inbox must stay empty, the Session must stay alive, and a
   * subsequent send must succeed.
   */
  test("sender cancels mid-flight: Inbox stays empty, Session survives, second send succeeds", async ({
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
      await pair(pageA, pageB);

      // 1. A sends a 25 MB file — enough time to cancel mid-flight
      //    over WebRTC-on-localhost (640+ chunks at 16 KB each).
      const largeFile = Buffer.alloc(25 * 1024 * 1024, 0x41); // all 'A'
      await pageA.setInputFiles('[data-testid="file-input"]', {
        name: "large.bin",
        mimeType: "application/octet-stream",
        buffer: largeFile,
      });

      // 2. Wait for the send progress bar AND the send log to appear,
      //    then cancel immediately.  The file is large enough that not
      //    all chunks will have landed before we click.
      await expect(pageA.getByTestId("send-log")).toBeVisible({
        timeout: 5000,
      });
      await expect(pageA.getByTestId("send-progress")).toBeVisible({
        timeout: 10_000,
      });
      await pageA.getByTestId("send-cancel").click();

      // 3. The send log must show "Cancelled" within a reasonable
      //    window (the send promise rejects on cancel, and the
      //    onComplete callback updates the React state).
      await expect(pageA.getByTestId("send-log")).toContainText("Cancelled", {
        timeout: 10_000,
      });

      // 4. B's Inbox must be empty — no partial entry (PRD invariant).
      await expect(pageB.getByTestId("inbox-empty")).toBeVisible();

      // 5. The Session stays connected on both sides.
      await expect(pageA.getByTestId("connected-state")).toBeVisible();
      await expect(pageB.getByTestId("connected-state")).toBeVisible();

      // 6. A sends a second (small) file to prove the transport is
      //    still usable after the cancel.
      await sendFile(pageA, pageB, "recovery.txt", "hello after cancel", 1);

      // 7. Verify the content of the second file round-tripped.
      const downloadPromise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await pageB.getByTestId("inbox-save").click();
      const dl = await downloadPromise;
      expect(await readFile(await dl.path(), "utf-8")).toBe(
        "hello after cancel"
      );
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

  /**
   * Receiver cancels mid-flight. A initiates the send; B clicks
   * Cancel on the receive progress bar. The transfer must stop,
   * the Inbox must stay empty, the Session must stay alive, and
   * a subsequent send must succeed.
   */
  test("receiver cancels mid-flight: Inbox stays empty, Session survives, second send succeeds", async ({
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
      await pair(pageA, pageB);

      // 1. A sends a 25 MB file.
      const largeFile = Buffer.alloc(25 * 1024 * 1024, 0x42); // all 'B'
      await pageA.setInputFiles('[data-testid="file-input"]', {
        name: "large.bin",
        mimeType: "application/octet-stream",
        buffer: largeFile,
      });

      // 2. Wait for the send log and receive progress bar to appear
      //    on B's side, then cancel immediately.
      await expect(pageA.getByTestId("send-log")).toBeVisible({
        timeout: 5000,
      });
      await expect(pageB.getByTestId("receive-progress")).toBeVisible({
        timeout: 10_000,
      });
      await pageB.getByTestId("receive-cancel").click();

      // 3. A's send log must show "Cancelled" (the cancel frame
      //    from B reached A and stopped the send).
      await expect(pageA.getByTestId("send-log")).toContainText("Cancelled", {
        timeout: 10_000,
      });

      // 4. B's Inbox must be empty — no partial entry.
      await expect(pageB.getByTestId("inbox-empty")).toBeVisible();

      // 5. Session stays connected on both sides.
      await expect(pageA.getByTestId("connected-state")).toBeVisible();
      await expect(pageB.getByTestId("connected-state")).toBeVisible();

      // 6. A sends a second file to prove the transport is still
      //    usable after the receiver-side cancel.
      await sendFile(pageA, pageB, "recovery.txt", "hello after cancel", 1);

      // 7. Verify content round-tripped.
      const downloadPromise = pageB.waitForEvent("download", {
        timeout: 10_000,
      });
      await pageB.getByTestId("inbox-save").click();
      const dl = await downloadPromise;
      expect(await readFile(await dl.path(), "utf-8")).toBe(
        "hello after cancel"
      );
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
