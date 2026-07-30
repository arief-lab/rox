// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { InboxScreen } from "@/components/inbox-screen";
import { Inbox, type InboxEntry } from "@/lib/inbox";

function makeEntry(name: string, size = 10): InboxEntry {
  return {
    blob: new Blob([new Uint8Array(size)]),
    id: `id-${name}`,
    name,
    size,
    receivedAt: Date.now(),
  };
}

function render(inbox: Inbox) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(<InboxScreen inbox={inbox} />);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

const SECTION = '[data-testid="inbox-section"]';
const EMPTY = '[data-testid="inbox-empty"]';
const ROW = '[data-testid="inbox-row"]';
const SAVE_BTN = '[data-testid="inbox-save"]';
const DISCARD_BTN = '[data-testid="inbox-discard"]';
const SAVED_BADGE = '[data-testid="inbox-saved-badge"]';

describe("InboxScreen", () => {
  it('shows "No files received yet" when the inbox is empty', () => {
    const inbox = new Inbox();
    const { container, unmount } = render(inbox);
    expect(container.querySelector(EMPTY)).not.toBeNull();
    expect(container.querySelector(EMPTY)?.textContent).toBe(
      "No files received yet."
    );
    unmount();
  });

  it("renders rows for each entry in the inbox", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt", 10));
    inbox.push(makeEntry("b.txt", 20));
    const { container, unmount } = render(inbox);
    expect(container.querySelectorAll(ROW)).toHaveLength(2);
    unmount();
  });

  it("hides the empty state when there are entries", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    const { container, unmount } = render(inbox);
    expect(container.querySelector(EMPTY)).toBeNull();
    expect(container.querySelector(SECTION)).not.toBeNull();
    unmount();
  });

  it("clicking Save on a row calls inbox.save", () => {
    const inbox = new Inbox({ download: vi.fn() });
    inbox.push(makeEntry("a.txt"));
    const saveSpy = vi.spyOn(inbox, "save");
    const { container, unmount } = render(inbox);

    const saveBtn = container.querySelector(SAVE_BTN) as HTMLButtonElement;
    saveBtn.click();

    expect(saveSpy).toHaveBeenCalledWith("id-a.txt");
    unmount();
  });

  it("clicking Discard on a row calls inbox.discard", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    const discardSpy = vi.spyOn(inbox, "discard");
    const { container, unmount } = render(inbox);

    const discardBtn = container.querySelector(
      DISCARD_BTN
    ) as HTMLButtonElement;
    discardBtn.click();

    expect(discardSpy).toHaveBeenCalledWith("id-a.txt");
    unmount();
  });

  it("shows a Saved badge for saved entries", () => {
    const inbox = new Inbox({ download: vi.fn() });
    const entry = makeEntry("a.txt");
    inbox.push(entry);
    inbox.save(entry.id);
    const { container, unmount } = render(inbox);

    expect(container.querySelector(SAVED_BADGE)).not.toBeNull();
    unmount();
  });
});
