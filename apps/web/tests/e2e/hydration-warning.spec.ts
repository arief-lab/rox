// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from "@playwright/test";

/**
 * Regression guard for the hydration mismatch that surfaced during
 * the recent Impeccable Live UX iteration:
 *
 *   "Hydration failed because the server rendered HTML didn't match
 *    the client. […] <button aria-label='Edit device name'> … Rox"
 *
 * The fix (apps/web/src/app/page.tsx + hero-section.tsx +
 * device-name-editor.tsx) addresses three independent causes that
 * surface on first paint:
 *
 *   1. DeviceNameEditor's <button> reads `name` from localStorage
 *      after the initial render, producing a server-vs-client
 *      divergence on the second render.
 *   2. `/`, `/?mock=true`, and `/?role=answerer` flow through
 *      HeroSection's wrapper that flagged mismatches one level
 *      deep — too narrow before, too broad after.
 *   3. The URL-derived mode in page.tsx was applied in useState's
 *      initializer (which reads window on the first client paint)
 *      instead of the mount-time useEffect (which runs after SSR
 *      has flushed).
 *
 * This spec asserts NONE of these surfaces produce a hydration
 * warning — for any of the three URL paths that drove the
 * original report.
 *
 * Design notes (rationale in this section rather than as code):
 *
 *   - Detection signal: React 19 dev-mode hydration warnings print
 *     as console.error with text matching patterns like
 *     "Hydration failed", "did not match", "Text content does not
 *     match server-rendered HTML", and "Expected server HTML to
 *     contain". This regex matches all four. Production builds strip
 *     the warnings entirely — the dev webServer is required.
 *
 *   - Capture-match over hard-fail: React splits a single hydration
 *     mismatch across multiple consecutive console.error calls
 *     (the warning line, the component stack, the inner DOM diff).
 *     Hard-throwing on the first match truncates the diagnostic
 *     context. We collect everything, then `expect().toEqual([])`
 *     the violations as a single block so failures print the whole
 *     trace at once.
 *
 *   - Listener-before-goto: page.on("console") and
 *     page.on("pageerror") MUST be registered before page.goto
 *     otherwise any warning emitted during the SSR-to-hydration
 *     window is silently dropped. The fixture is constructed by
 *     Playwright per-test, so this is safe.
 *
 *   - Wait-for-mount not networkidle: WebRTC keepalives (some other
 *     specs in this suite open Transport connections) prevent
 *     networkidle from ever firing. Instead we wait for the
 *     `load` event (all static subresources loaded) plus a 1s
 *     margin for React 19's flushed-effect macrotask queue. After
 *     that the hydration phase is guaranteed to have completed for
 *     any subtree that's not gated on a deferred action, which is
 *     exactly the surface we want to guard.
 *
 *   - Filtering false positives: We only assert on messages whose
 *     body matches the hydration regex, not on all console.error
 *     activity. The Impeccable Live loader, the share-target SW,
 *     and various browser warnings register their own console
 *     messages during boot; none of them match the hydration
 *     patterns, so they're benign by construction.
 */

const HYDRATION_PATTERN =
  /hydration failed|did not match|expected server html|text content (?:does not|did not) match/i;

interface CapturedMessage {
  type: string;
  text: string;
  location?: { url?: string };
}

interface CapturedPageError {
  message: string;
  stack?: string;
}

interface CapturedTraffic {
  messages: CapturedMessage[];
  pageErrors: CapturedPageError[];
}

async function captureAndAssert(url: string): Promise<void> {
  // A fresh page per test means a fresh console buffer — no cross-test
  // pollution from other specs that opened WebRTC transports.
  const { messages, pageErrors } = await runCapture(url);

  const violations: Array<{ source: "console" | "pageerror"; body: string }> =
    [];

  for (const msg of messages) {
    if (
      (msg.type === "error" || msg.type === "warning") &&
      HYDRATION_PATTERN.test(msg.text)
    ) {
      violations.push({ source: "console", body: msg.text });
    }
  }
  for (const err of pageErrors) {
    if (HYDRATION_PATTERN.test(err.message)) {
      violations.push({
        source: "pageerror",
        body: `${err.message}${err.stack ? `\n${err.stack}` : ""}`,
      });
    }
  }

  // Locator snapshot is intentionally inline — a failed assertion
  // surfaces EVERY captured line so the developer sees the full
  // React diagnostic chain, not just the first match.
  expect(
    violations,
    `Hydration mismatch detected while visiting ${url}:\n${JSON.stringify(
      violations,
      null,
      2
    )}\n--- full captured console (for context) ---\n${JSON.stringify(
      messages,
      null,
      2
    )}\n--- captured pageerrors ---\n${JSON.stringify(pageErrors, null, 2)}`
  ).toEqual([]);
}

/**
 * Drives `url` in a fresh page, capturing every console message and
 * uncaught error emitted before and after navigation. We register
 * the listeners BEFORE page.goto so hydration warnings emitted
 * during the initial paint aren't dropped.
 */
async function runCapture(url: string): Promise<CapturedTraffic> {
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const messages: CapturedMessage[] = [];
    const pageErrors: CapturedPageError[] = [];

    page.on("console", (msg) => {
      messages.push({
        type: msg.type(),
        text: msg.text(),
        location: { url: msg.location()?.url },
      });
    });

    page.on("pageerror", (err) => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    await page.goto(url, { waitUntil: "load" });

    // Allow React 19's flushed-effect macrotask queue (which holds
    // hydration warnings and recovery errors) to drain before we
    // snapshot the captured buffers. 1s is empirically enough to
    // cover AnimatePresence transitions + lazy DeviceNameEditor
    // reads without padding the test suite noticeably.
    await page.waitForTimeout(1000);

    // Smoke check: the page must render SOMETHING — if the home
    // route renders the offerer, ReplyScreen — etc — proves we
    // reached the post-hydration substrate at all. A purely blank
    // page would hide hydration bugs behind a stale webServer.
    const rootText = await page.locator("body").innerText();
    expect(rootText.length, "page body is not blank").toBeGreaterThan(0);

    return { messages, pageErrors };
  } finally {
    await browser.close();
  }
}

test.describe("No hydration warnings on first paint", () => {
  // The dev webServer cold-compiles on first hit; 120s covers the
  // worst-case first-test bottleneck on resource-constrained CI.
  test.setTimeout(120_000);

  test("/ — default offerer route", async () => {
    await captureAndAssert("/");
  });

  test("/?mock=true — mock harness route", async () => {
    await captureAndAssert("/?mock=true");
  });

  test("/?role=answerer — answerer route", async () => {
    await captureAndAssert("/?role=answerer");
  });
});
