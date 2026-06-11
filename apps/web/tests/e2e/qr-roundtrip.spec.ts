import { expect, test } from "@playwright/test";
import jsQR from "jsqr";

import {
  DEMO_OFFER_NAME,
  DEMO_OFFER_SDP,
  decodeOffer,
} from "../../src/lib/pairing";

test.describe("QR round-trip (slice 1)", () => {
  test("context A renders a QR; the test decodes it and matches the hardcoded SDP", async ({
    browser,
  }) => {
    // Two contexts simulate the PC (Offerer) and the phone (scanner).
    // The actual jsqr decode runs in the test runtime (Node side), where
    // jsqr is a normal devDep — we never ask the browser to fetch it.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const offerer = await ctxA.newPage();
    const scanner = await ctxB.newPage();

    try {
      // Context A: render the QR.
      await offerer.goto("/");
      await offerer.getByTestId("generate-qr").click();

      const canvas = offerer.getByTestId("qr-canvas");
      await expect(canvas).toBeVisible();

      // Wait until the canvas has actually rendered at least one non-white
      // pixel, so getImageData returns real QR data and not a blank canvas.
      await offerer.waitForFunction(() => {
        const c = document.querySelector<HTMLCanvasElement>(
          "[data-testid='qr-canvas']"
        );
        if (!c) {
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
      });

      // Grab the raw image data from the canvas in context A.
      const imageData = await offerer.evaluate(() => {
        const c = document.querySelector<HTMLCanvasElement>(
          "[data-testid='qr-canvas']"
        );
        if (!c) {
          throw new Error("QR canvas not found");
        }
        const ctx2d = c.getContext("2d");
        if (!ctx2d) {
          throw new Error("2d context unavailable");
        }
        const data = ctx2d.getImageData(0, 0, c.width, c.height);
        return {
          data: Array.from(data.data),
          width: c.width,
          height: c.height,
        };
      });

      // Context B: confirm the same-origin URL works in a different context
      // (proves the QR is reachable from a second browser, not just one).
      await scanner.goto("/");
      await expect(scanner.getByTestId("generate-qr")).toBeVisible();

      // Decode the QR in the test runtime.
      const code = jsQR(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      expect(code).not.toBeNull();

      if (!code) {
        throw new Error("jsqr did not return a result");
      }
      const decoded = decodeOffer(code.data);
      expect(decoded.sdp).toBe(DEMO_OFFER_SDP);
      expect(decoded.name).toBe(DEMO_OFFER_NAME);
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
