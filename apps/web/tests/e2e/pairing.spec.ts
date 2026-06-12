// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "@playwright/test";

import { pair } from "./_helpers/pairing";

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
  // 90s gives headroom for the two connected-state assertions (currently
  // 10s each, but the code-reviewer flagged that bumping them to 30s
  // would theoretically push the test to 60s+) plus the dev-server
  // cold-start compile time on the first run.
  test.setTimeout(90_000);

  test("offerer and answerer complete the full pairing flow and both see Connected", async ({
    browser,
  }) => {
    // Clipboard permissions are required because the answerer's
    // writeClipboard call throws "Write permission denied" in
    // headless Chromium without explicit permission. Without
    // this the transport never resolves and the test stalls at
    // the connected-state assertion.
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

      // Context A + B: drive the full QR + clipboard pairing flow
      // (helpers live in tests/e2e/_helpers/pairing.ts).
      await pair(pageA, pageB);
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
