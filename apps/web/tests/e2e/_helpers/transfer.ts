import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Send a file from one page to a paired peer via the hidden file
 * input and poll the receiver's Inbox for the expected row count,
 * confirming the Transfer completed end-to-end.
 *
 * Used by inbox-save-discard.spec.ts and bidirectional.spec.ts.
 * The 15s timeout accommodates slow CI runners where the transport
 * / React re-render can take a few seconds after the chunks land.
 */
export async function sendFile(
  sender: Page,
  receiver: Page,
  filename: string,
  content: string,
  expectedCount: number
): Promise<void> {
  await sender.setInputFiles('[data-testid="file-input"]', {
    name: filename,
    mimeType: "text/plain",
    buffer: Buffer.from(content),
  });
  await expect
    .poll(async () => receiver.getByTestId("inbox-row").count(), {
      timeout: 15_000,
    })
    .toBe(expectedCount);
}

/**
 * Read the entry IDs from the Inbox exposed on `window.__inbox`.
 * Used to reference specific entries for save/discard without
 * relying on DOM selectors that race React re-renders.
 */
export function getInboxEntryIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __inbox?: { list: () => { id: string }[] };
    };
    const inbox = w.__inbox;
    if (!inbox) {
      throw new Error("Inbox not exposed on window");
    }
    return inbox.list().map((e) => e.id);
  });
}

/**
 * Save an inbox entry by its ID via `window.__inbox.save()`.  Each
 * call runs in its own `page.evaluate` so the browser can process
 * the anchor.click() download before the next save fires — two
 * rapid downloads in the same event-loop tick cause headless
 * Chromium to capture the wrong blob URL for the second download.
 */
export async function saveInboxEntry(page: Page, id: string): Promise<void> {
  await page.evaluate((saveId: string) => {
    const w = window as unknown as {
      __inbox?: { save: (saveId: string) => boolean };
    };
    w.__inbox?.save(saveId);
  }, id);
}

/**
 * Poll a page until the Inbox has the expected number of saved
 * entries.  Reads from `window.__inbox` directly (bypassing React
 * DOM rendering which can race headless Chromium's event loop).
 * This is the source-of-truth check — the Inbox's `save()` method
 * marks entries synchronously.
 *
 * @param page - The page whose Inbox to check.
 * @param expected - The expected number of saved entries.
 * @param timeout - Poll timeout in ms (default 5000).
 */
export async function waitForSavedCount(
  page: Page,
  expected: number,
  timeout = 5000
): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as unknown as {
            __inbox?: {
              isSaved: (id: string) => boolean;
              list: () => { id: string }[];
            };
          };
          const inbox = w.__inbox;
          if (!inbox) {
            return 0;
          }
          return inbox.list().filter((e) => inbox.isSaved(e.id)).length;
        }),
      { timeout }
    )
    .toBe(expected);
}
