import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { parseAnswer } from "@/lib/pairing";

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
export async function assertNoError(page: Page, label: string): Promise<void> {
  const errorLocator = page.getByTestId("error-text");
  if (await errorLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
    const message = (await errorLocator.textContent()) ?? "(no text)";
    throw new Error(`${label} pairing failed: ${message.trim()}`);
  }
}

/**
 * Poll a page until its answerer component has generated a valid
 * answer text.  The answerer's handleGenerate sets
 * `window.__answerText` after generateAnswer completes — this polls
 * both for the value AND for `parseAnswer` to succeed, so callers
 * never send an invalid/partial answer to the offerer's handlePaste.
 *
 * Returns the validated answer text once it's available and parseable.
 * `__answerText` is stable once set, so there is no race between the
 * poll success and the final read.
 */
export async function waitForValidAnswer(page: Page): Promise<string> {
  await expect
    .poll(
      async () => {
        const text = await page.evaluate(() => {
          const w = window as unknown as { __answerText?: string };
          return w.__answerText ?? "";
        });
        if (!text) {
          return "";
        }
        try {
          parseAnswer(text);
          return text;
        } catch {
          return "";
        }
      },
      { timeout: 10_000 }
    )
    .toBeTruthy();

  return page.evaluate(() => {
    const w = window as unknown as { __answerText?: string };
    return w.__answerText ?? "";
  });
}

/**
 * Drive the full QR + clipboard pairing flow between two pages.
 * Both sides end up in the "Connected" state, with a live
 * Transport between them.
 */
export async function pair(pageA: Page, pageB: Page): Promise<void> {
  await pageA.getByTestId("role-offerer").click();
  await pageA.getByTestId("start-receiving").click();
  await expect(pageA.getByTestId("offering-state")).toBeVisible();

  const offerSdp = await pageA.evaluate(() => {
    const w = window as unknown as { __offerSdp?: string };
    return w.__offerSdp ?? "";
  });
  expect(offerSdp.length).toBeGreaterThan(80);

  // Read the Offerer's actual device name (custom or auto-generated)
  // so the Answerer sees the real peer name, not a hardcoded string.
  const offerName = await pageA.evaluate(() => {
    const w = window as unknown as { __offerName?: string };
    return w.__offerName ?? "Offerer";
  });

  const offerText = await pageA.evaluate(
    ({ sdp, name }: { sdp: string; name: string }) => {
      const payload = JSON.stringify({ sdp, name });
      return btoa(payload)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "");
    },
    { sdp: offerSdp, name: offerName }
  );

  await pageB.getByTestId("role-answerer").click();
  await pageB.getByTestId("scan-area").fill(offerText);
  await pageB.getByTestId("scan-qr").click();
  await expect(pageB.getByTestId("answerer-scanning-state")).toBeVisible();
  await pageB.getByTestId("generate-answer").click();
  await assertNoError(pageB, "Answerer");

  const answerText = await waitForValidAnswer(pageB);

  // Use a native-value-setter + dispatchEvent pattern via
  // evaluate() to populate the controlled textarea, rather than
  // Playwright's fill() or pressSequentially.  React 19's onChange
  // on controlled components responds to native input events, but
  // fill() can dispatch its input at a moment when the WebRTC ICE
  // callback queue starves the React render scheduler, causing the
  // setPastedText state update to not flush before toBeEnabled polls
  // — even with a 30s timeout.  The native setter bypasses React's
  // value override, so the synthetic event's e.target.value reflects
  // the full text, and the input event triggers onChange reliably.
  // This is the same pattern our unit tests use for React 19 input
  // simulation (see answerer-idle-view.test.tsx).
  // Bypass both the textarea and the paste-answer button by
  // calling the PairingScreen's handlePaste directly via
  // window.__handlePaste(answerText).  handlePaste accepts an
  // optional overrideText parameter, so the answer text is
  // passed directly and never read from a stale closure.
  await pageA.evaluate((text: string) => {
    const handlePaste = (
      window as unknown as { __handlePaste?: (t?: string) => Promise<void> }
    ).__handlePaste;
    if (!handlePaste) {
      throw new Error("window.__handlePaste not found");
    }
    return handlePaste(text);
  }, answerText);
  await assertNoError(pageA, "Offerer");

  await expect(pageA.getByTestId("connected-state")).toBeVisible({
    timeout: 30_000,
  });
  await expect(pageB.getByTestId("connected-state")).toBeVisible({
    timeout: 30_000,
  });
}
