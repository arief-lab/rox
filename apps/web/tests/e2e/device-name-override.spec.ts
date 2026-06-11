import { expect, test } from "@playwright/test";

import { pair } from "./_helpers/pairing";
import { sendFile } from "./_helpers/transfer";

/**
 * Slice 18 E2E: device name override.
 *
 * The Offerer changes their device name via Settings, pairs with
 * the Answerer, and verifies the peer sees the overridden name in
 * the connected-view and Inbox rows.  Also verifies the Reset
 * flow reverts to the auto-generated name.
 *
 * On headless Linux Chromium the auto-generated name is "Linux".
 */
test.describe("Device name override (slice 18)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("override device name, pair, verify peer sees it, reset clears it", async ({
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
      // ---- 1. Offerer: open Settings, set custom name ----
      await pageA.goto("/");

      await pageA.getByTestId("open-settings").click();
      await expect(pageA.getByTestId("settings-screen")).toBeVisible();

      // The input is pre-populated with the auto-generated name
      // ("Linux" in headless Linux Chromium).
      const input = pageA.getByTestId("device-name-input");
      await expect(input).not.toHaveValue("");

      // Type a custom name and save.
      await input.fill("My Test Device");
      await pageA.getByTestId("device-name-save").click();

      // Settings screen closes → back to idle.
      await expect(pageA.getByTestId("settings-screen")).not.toBeVisible();

      // ---- 2. Pair Offerer and Answerer ----
      await pageB.goto("/");
      await pair(pageA, pageB);

      // Answerer should see the Offerer's custom device name as peer.
      // The connected-view shows "Peer: {peerName}".
      await expect(pageB.getByTestId("connected-state")).toContainText(
        "My Test Device"
      );

      // ---- 3. Offerer sends a file → Answerer's Inbox shows
      //       "From: My Test Device" (the sender's custom name) ----
      await sendFile(pageA, pageB, "hello.txt", "hello world", 1);

      // The Inbox row's sender label: data-testid="inbox-sender"
      await expect(pageB.getByTestId("inbox-sender")).toContainText(
        "My Test Device"
      );

      // ---- 4. Reset: Offerer closes session (two clicks:
      //       first closes, second resets to idle), navigates
      //       back to the home screen, opens Settings, clicks
      //       Reset ----
      // First click: closes the Session.
      await pageA.getByTestId("close-session").click();
      // Wait for React to set wasDisconnected and the button
      // text to change to "Start over", then click again to
      // reset the pairing-screen to its idle state.
      await expect(pageA.getByTestId("close-session")).toContainText(
        "Start over"
      );
      await pageA.getByTestId("close-session").click();
      // The Offerer is still on the offerer route — click "← Back"
      // to return to the home screen where the Settings button lives.
      await pageA.getByText("← Back").click();
      await pageA.getByTestId("open-settings").click();
      await expect(pageA.getByTestId("settings-screen")).toBeVisible();

      // Input should still show the saved name (persisted).
      await expect(pageA.getByTestId("device-name-input")).toHaveValue(
        "My Test Device"
      );

      // Click Reset → input reverts to auto-generated
      // (not empty, not the custom name).
      await pageA.getByTestId("device-name-reset").click();
      await expect(pageA.getByTestId("device-name-input")).not.toHaveValue("");
      await expect(pageA.getByTestId("device-name-input")).not.toHaveValue(
        "My Test Device"
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
