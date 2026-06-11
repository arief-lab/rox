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
