// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from "@playwright/test";

import { decodeOffer, encodeOffer } from "../../src/lib/pairing";

test.describe("QR round-trip (slice 1)", () => {
  test("context A renders a QR canvas from the real WebRTC offer; the offer SDP and device name are exposed on window", async ({
    browser,
  }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const offerer = await ctxA.newPage();
    const scanner = await ctxB.newPage();

    try {
      // Context A: enter the offering flow.
      await offerer.goto("/");
      await offerer.getByTestId("role-offerer").click();
      await offerer.getByTestId("start-receiving").click();
      await expect(offerer.getByTestId("offering-state")).toBeVisible();

      // The QR canvas is rendered by qrcode.toCanvas asynchronously.
      // Wait until the canvas has non-zero dimensions AND non-white
      // pixels (confirmed by the rendering library).
      await offerer.waitForFunction(
        () => {
          const c = document.querySelector<HTMLCanvasElement>(
            "[data-testid='qr-canvas']"
          );
          if (!c || c.width === 0 || c.height === 0) {
            return false;
          }
          const ctx2d = c.getContext("2d");
          if (!ctx2d) {
            return false;
          }
          const data = ctx2d.getImageData(0, 0, c.width, c.height).data;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] < 255 || data[i + 1] < 255 || data[i + 2] < 255) {
              return true;
            }
          }
          return false;
        },
        { timeout: 10_000 }
      );

      // Context B: confirm the app is reachable from a second context.
      await scanner.goto("/");
      await expect(scanner.getByTestId("role-offerer")).toBeVisible();

      // Verify the pairing-screen exposed the real WebRTC SDP
      // and device name on window.__offerSdp / __offerName.
      const [offerSdp, offerName] = await offerer.evaluate(() => {
        const w = window as unknown as {
          __offerSdp?: string;
          __offerName?: string;
        };
        return [w.__offerSdp ?? "", w.__offerName ?? ""];
      });

      // SDP should be a non-trivial WebRTC session description.
      expect(offerSdp.length).toBeGreaterThan(80);
      expect(offerSdp).toContain("v=0");

      // Name should be non-empty (auto-generated from UA or stored).
      expect(offerName.length).toBeGreaterThan(0);
      expect(typeof offerName).toBe("string");

      // Bonus: encodeOffer → decodeOffer round-trip on the
      // exposed SDP + name (these are already Node-side strings
      // from the previous page.evaluate — no second browser
      // round-trip needed).
      const payload = encodeOffer(offerSdp, offerName);
      const decoded = decodeOffer(payload);
      expect(decoded.sdp).toBe(offerSdp);
      expect(decoded.name).toBe(offerName);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
