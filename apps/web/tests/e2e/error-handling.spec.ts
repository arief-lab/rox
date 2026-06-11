import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";

/**
 * Slice 11 E2E: error handling edge cases.
 *
 * Exercises the four failure paths from issue 8:
 * 1. Malformed QR → "QR not recognized", stays on idle view
 * 2. Invalid paste → "not a valid answer"
 * 3. Camera permission denial → fallback message
 * 4. Connection lost mid-transfer → "Connection lost" on sender,
 *    no Inbox entry on receiver
 */

test.describe("Error handling (slice 11)", () => {
  test.describe.configure({ mode: "serial" });
  // Generous timeout: pairing + error paths + connection-lost test
  // (sends a 50 MB file and waits for the log).
  test.setTimeout(120_000);

  test("malformed QR shows 'QR not recognized' and stays on idle view", async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await page.goto("/");
      await page.getByTestId("role-answerer").click();
      await expect(page.getByTestId("answerer-idle-state")).toBeVisible();

      // Type garbage into the scan area — not valid base64, not
      // valid JSON, definitely not a PairingPayload.
      await page.getByTestId("scan-area").fill("this-is-not-a-valid-offer!!!");
      await page.getByTestId("scan-qr").click();

      // The error text should now be visible with the specific
      // message defined in slice 11.
      const errorLocator = page.getByTestId("error-text");
      await expect(errorLocator).toBeVisible();
      await expect(errorLocator).toHaveText("QR not recognized");

      // The screen should still be on the idle view (the machine
      // never advanced past idle because decodeOffer threw).
      await expect(page.getByTestId("answerer-idle-state")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("invalid SDP paste shows 'not a valid answer'", async ({ browser }) => {
    // Only the offerer page is needed — the invalid paste happens
    // before the answerer is involved (the offerer pastes garbage
    // instead of a valid answer). No need for ctxB/pageB.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await page.goto("/");

      // Bring the offerer to the offering state: click "Receive a
      // file", then "Start receiving" to generate the offer SDP
      // and show the QR.
      await page.getByTestId("role-offerer").click();
      await page.getByTestId("start-receiving").click();
      await expect(page.getByTestId("offering-state")).toBeVisible();

      // Paste garbage text in the answer paste area and click
      // "Connect with pasted answer".
      await page.getByTestId("paste-area").fill("not-a-valid-sdp-answer");
      await expect(page.getByTestId("paste-answer")).toBeEnabled();
      await page.getByTestId("paste-answer").click();

      // Verify the specific error message.
      const errorLocator = page.getByTestId("error-text");
      await expect(errorLocator).toBeVisible();
      await expect(errorLocator).toHaveText("not a valid answer");

      // The machine recorded the failure and reset to idle — the
      // IdleView should render with the error (the QR disappears,
      // the user sees the error and can start over).
      await expect(page.getByTestId("idle-state")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test("camera permission denial shows fallback message", async ({
    browser,
  }) => {
    // Do NOT grant camera permission — the browser context has no
    // permission grants for camera, so getUserMedia will throw in
    // headless Chromium (no camera device) and the Permission API
    // will return "prompt" (not explicitly granted). Both paths
    // lead to the denial fallback message.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await page.goto("/");
      await page.getByTestId("role-answerer").click();
      await expect(page.getByTestId("answerer-idle-state")).toBeVisible();

      // Click the "Use camera" button added in slice 11.
      await page.getByTestId("use-camera").click();

      // Wait for the denial message. In headless Chromium,
      // getUserMedia throws NotFoundError (no camera device),
      // which the catch block maps to the denial fallback.
      const errorLocator = page.getByTestId("error-text");
      await expect(errorLocator).toBeVisible({ timeout: 5000 });
      await expect(errorLocator).toHaveText(
        "Camera access was denied — paste the offer text below"
      );

      // The paste text area is still visible (it was always
      // shown — the camera button is presented alongside it,
      // not instead of it).
      await expect(page.getByTestId("scan-area")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  /**
   * Connection-lost mid-transfer: two complementary approaches.
   *
   * Test A closes the receiver mid-transfer and verifies the
   * sender's log shows "Connection lost". The file is 50 MB —
   * large enough that the transfer won't complete in a single
   * event-loop tick before we close the receiver page.
   *
   * Test B closes the sender mid-transfer and verifies the
   * receiver's Inbox is empty (no partial entry). This path is
   * deterministic — the receive loop breaks on transport close
   * and never pushes to the Inbox.
   */

  test("connection lost mid-transfer: sender log shows 'Connection lost'", async ({
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

      // 1. Pair the two pages.
      await pair(pageA, pageB);

      // 2. Send a 50 MB file from page A to page B. The file is
      //    deliberately large so the WebRTC DataChannel transfer
      //    doesn't complete before we close the receiver page.
      //    On localhost a DataChannel can move ~100 MB/s, so 50
      //    MB should take ~500 ms — plenty of headroom.
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024, 0x41);
      await pageA.setInputFiles('[data-testid="file-input"]', {
        name: "large.dat",
        mimeType: "application/octet-stream",
        buffer: largeBuffer,
      });

      // 3. Wait for the send progress bar to appear (confirms the
      //    transfer is in flight).
      await expect(pageA.getByTestId("send-progress")).toBeVisible({
        timeout: 5000,
      });

      // 4. Close the receiver page mid-transfer. The transport
      //    closes, which causes the send to fail.
      await pageB.close();

      // 5. Wait for the send log to show "Connection lost". The
      //    sendFile promise rejects, onComplete fires with kind
      //    "failed", and the screen appends "Connection lost:
      //    <reason>" to the send log.
      const sendLog = pageA.getByTestId("send-log");
      await expect(sendLog).toBeVisible({ timeout: 5000 });
      await expect(sendLog).toContainText("Connection lost", {
        timeout: 10_000,
      });
    } finally {
      await Promise.race([
        Promise.all([
          pageA.close().catch(() => {
            // Page/context may already be closed.
          }),
          pageB.close().catch(() => {
            // Page/context may already be closed.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await Promise.race([
        Promise.all([
          ctxA.close().catch(() => {
            // Page/context may already be closed.
          }),
          ctxB.close().catch(() => {
            // Page/context may already be closed.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });

  test("connection lost mid-transfer: receiver Inbox is empty (no partial entry)", async ({
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

      // 1. Pair the two pages. page A is the offerer (receiver
      //    role in the Inbox sense), page B is the answerer
      //    (sender role). In the bidirectional session, either
      //    side can send — we'll have page B send to page A.
      await pair(pageA, pageB);

      // 2. Page B sends a large file to page A.
      const largeBuffer = Buffer.alloc(50 * 1024 * 1024, 0x41);
      await pageB.setInputFiles('[data-testid="file-input"]', {
        name: "large.dat",
        mimeType: "application/octet-stream",
        buffer: largeBuffer,
      });

      // 3. Wait for the send progress bar to appear on page B
      //    (confirms the transfer is in flight).
      await expect(pageB.getByTestId("send-progress")).toBeVisible({
        timeout: 5000,
      });

      // 4. Close the sender page mid-transfer. The transport
      //    closes, the receive loop breaks, and the Inbox on
      //    page A is never updated with a partial file.
      await pageB.close();

      // 5. Verify page A's Inbox is still empty. The receive
      //    loop broke on transport close and never pushed to
      //    the Inbox. This is deterministic (unlike the sender-
      //    side "Connection lost" check, which depends on timing)
      //    because the loop always breaks on transport close.
      const inboxEmpty = pageA.getByTestId("inbox-empty");
      await expect(inboxEmpty).toBeVisible({ timeout: 10_000 });
      await expect(inboxEmpty).toHaveText("No files received yet.");
    } finally {
      await Promise.race([
        Promise.all([
          pageA.close().catch(() => {
            // Page/context may already be closed.
          }),
          pageB.close().catch(() => {
            // Page/context may already be closed.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      await Promise.race([
        Promise.all([
          ctxA.close().catch(() => {
            // Page/context may already be closed.
          }),
          ctxB.close().catch(() => {
            // Page/context may already be closed.
          }),
        ]),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    }
  });
});
