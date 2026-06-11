import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Surface any error that the page's component has displayed in its
 * `data-testid="error-text"` element. The components wrap their async
 * handlers in try/catch and render the error message there; without
 * this check, a silent throw inside the component would just produce
 * a downstream timeout with no visible cause.
 *
 * Polls for 2s — long enough to not race with the component's error
 * render, short enough to fail fast on real errors.
 */
async function assertNoError(page: Page, label: string): Promise<void> {
  const errorLocator = page.getByTestId("error-text");
  if (await errorLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
    const message = (await errorLocator.textContent()) ?? "(no text)";
    throw new Error(`${label} pairing failed: ${message.trim()}`);
  }
}

/**
 * Slice 3 E2E: two browser contexts complete the full Pairing flow.
 *
 * Context A acts as the Offerer (Receive a file). It generates an
 * offer SDP, which is exposed to window.__offerSdp for testability.
 *
 * Context B acts as the Answerer (Send a file). It receives the
 * offer text, generates an answer, and copies it to the clipboard.
 * The answer text is also exposed to window.__answerText.
 *
 * Context A then pastes the answer text and both sides reach
 * "Connected".
 */
test.describe("Pairing via QR + clipboard (slice 3)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(60_000);

  test("offerer and answerer complete the full pairing flow and both see Connected", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    try {
      await pageA.goto("/");
      await pageB.goto("/");

      // Context A: click "Receive a file" → "Start receiving"
      await pageA.getByTestId("role-offerer").click();
      await pageA.getByTestId("start-receiving").click();

      // Wait for the offering state to appear
      await expect(pageA.getByTestId("offering-state")).toBeVisible();

      // Read the full offer SDP from window (exposed by PairingScreen
      // for e2e testability — the visible offer-sdp element is
      // truncated to 80 chars).
      const offerSdp = await pageA.evaluate(() => {
        const w = window as unknown as { __offerSdp?: string };
        return w.__offerSdp ?? "";
      });
      expect(offerSdp.length).toBeGreaterThan(80);

      // Encode the offer SDP the same way the QR would (base64url
      // of JSON { sdp, name? }) and paste it into the answerer.
      const offerText = await pageA.evaluate((sdp: string) => {
        const payload = JSON.stringify({ sdp, name: "Offerer" });
        return btoa(payload)
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
      }, offerSdp);

      // Context B: click "Send a file" → paste the offer text → "Scan"
      await pageB.getByTestId("role-answerer").click();
      await pageB.getByTestId("scan-area").fill(offerText);
      await pageB.getByTestId("scan-qr").click();

      // The answerer should reach the scanning state
      await expect(pageB.getByTestId("answerer-scanning-state")).toBeVisible();

      // Click "Generate answer & copy"
      await pageB.getByTestId("generate-answer").click();

      // Surface any error from the answerer's handleGenerate
      // (decodeOffer / generateAnswer / writeClipboard) before
      // waiting on window.__answerText.
      await assertNoError(pageB, "Answerer");

      // Poll for the answer text (the generate is async) and capture
      // the value via closure. The previous pattern of reading once
      // and then polling separately left answerText as "" if the
      // first read raced ahead of handleGenerate. `expect.poll`
      // returns a PollMatchers object (not the value directly), so
      // we use a closure variable to capture the last non-empty
      // value. The non-empty assertion lives inside the callback so
      // the poll keeps retrying until the text is set.
      let answerText = "";
      await expect.poll(
        () =>
          pageB.evaluate(() => {
            const w = window as unknown as { __answerText?: string };
            const text = w.__answerText ?? "";
            expect(text).not.toBe("");
            return text;
          }),
        { timeout: 5000 }
      );
      // Re-read the final value after the poll resolves.
      answerText = await pageB.evaluate(() => {
        const w = window as unknown as { __answerText?: string };
        return w.__answerText ?? "";
      });

      // Context A: paste the answer text and connect
      await pageA.getByTestId("paste-area").fill(answerText);
      await pageA.getByTestId("paste-answer").click();

      // Surface any error from the offerer's handlePaste (parseAnswer /
      // offerer.accept / machine.completePaste) before waiting on the
      // happy-path connected-state.
      await assertNoError(pageA, "Offerer");

      // Both sides should reach "Connected"
      await expect(pageA.getByTestId("connected-state")).toBeVisible({
        timeout: 10_000,
      });
      await expect(pageB.getByTestId("connected-state")).toBeVisible({
        timeout: 10_000,
      });
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
