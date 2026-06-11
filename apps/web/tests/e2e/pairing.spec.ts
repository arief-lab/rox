import { expect, test } from "@playwright/test";

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

      // Wait for the answer text to appear (exposed to window by
      // AnswererScreen for testability)
      const answerText = await pageB.evaluate(() => {
        const w = window as unknown as { __answerText?: string };
        return w.__answerText ?? "";
      });
      // Poll for the answer text (the generate is async)
      await expect
        .poll(
          () =>
            pageB.evaluate(() => {
              const w = window as unknown as { __answerText?: string };
              return w.__answerText ?? "";
            }),
          { timeout: 5000 }
        )
        .not.toBe("");

      // Context A: paste the answer text and connect
      await pageA.getByTestId("paste-area").fill(answerText);
      await pageA.getByTestId("paste-answer").click();

      // Both sides should reach "Connected"
      await expect(pageA.getByTestId("connected-state")).toBeVisible({
        timeout: 10_000,
      });
      await expect(pageB.getByTestId("connected-state")).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
