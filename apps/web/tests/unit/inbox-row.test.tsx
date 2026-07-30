// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { InboxRow } from "@/components/inbox-row";
import type { InboxEntry } from "@/lib/inbox";

function makeEntry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    blob: new Blob(["data"]),
    id: "entry-1",
    name: "photo.jpg",
    size: 1024,
    receivedAt: Date.now(),
    ...overrides,
  };
}

function render(
  props: {
    entry?: InboxEntry;
    isSaved?: boolean;
    onDiscard?: (id: string) => void;
    onSave?: (id: string) => void;
  } = {}
) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
      <InboxRow
        entry={props.entry ?? makeEntry()}
        isSaved={props.isSaved ?? false}
        onDiscard={props.onDiscard ?? vi.fn()}
        onSave={props.onSave ?? vi.fn()}
      />
    );
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

const SAVED_BADGE = '[data-testid="inbox-saved-badge"]';
const ROW = '[data-testid="inbox-row"]';
const NAME = '[data-testid="inbox-name"]';
const SIZE = '[data-testid="inbox-size"]';
const SENDER = '[data-testid="inbox-sender"]';
const SAVE_BTN = '[data-testid="inbox-save"]';
const DISCARD_BTN = '[data-testid="inbox-discard"]';

describe("InboxRow", () => {
  it("renders the file name", () => {
    const { container, unmount } = render();
    expect(container.querySelector(NAME)?.textContent).toContain("photo.jpg");
    unmount();
  });

  it("renders the file size in human-readable format", () => {
    const { container, unmount } = render();
    expect(container.querySelector(SIZE)?.textContent).toBe("1.0 KB");
    unmount();
  });

  it("renders size in bytes for small files", () => {
    const { container, unmount } = render({
      entry: makeEntry({ size: 500 }),
    });
    expect(container.querySelector(SIZE)?.textContent).toBe("500 B");
    unmount();
  });

  it("renders size in MB for large files", () => {
    const { container, unmount } = render({
      entry: makeEntry({ size: 2 * 1024 * 1024 }),
    });
    expect(container.querySelector(SIZE)?.textContent).toBe("2.00 MB");
    unmount();
  });

  it("does not show a saved badge when not saved", () => {
    const { container, unmount } = render({ isSaved: false });
    expect(container.querySelector(SAVED_BADGE)).toBeNull();
    unmount();
  });

  it("shows a saved badge when saved", () => {
    const { container, unmount } = render({ isSaved: true });
    expect(container.querySelector(SAVED_BADGE)).not.toBeNull();
    expect(container.querySelector(SAVED_BADGE)?.textContent).toBe("Saved");
    unmount();
  });

  it("shows the sender name when present", () => {
    const { container, unmount } = render({
      entry: makeEntry({ senderName: "Alice's iPhone" }),
    });
    const sender = container.querySelector(SENDER);
    expect(sender).not.toBeNull();
    expect(sender?.textContent).toBe("From: Alice's iPhone");
    unmount();
  });

  it("does not show sender when absent", () => {
    const { container, unmount } = render({
      entry: makeEntry({ senderName: undefined }),
    });
    expect(container.querySelector(SENDER)).toBeNull();
    unmount();
  });

  it("calls onSave when Save button is clicked", () => {
    const onSave = vi.fn();
    const { container, unmount } = render({ onSave });
    const btn = container.querySelector(SAVE_BTN) as HTMLButtonElement;
    btn.click();
    expect(onSave).toHaveBeenCalledWith("entry-1");
    unmount();
  });

  it("disables Save button when already saved", () => {
    const { container, unmount } = render({ isSaved: true });
    const btn = container.querySelector(SAVE_BTN) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    unmount();
  });

  it("enables Save button when not saved", () => {
    const { container, unmount } = render({ isSaved: false });
    const btn = container.querySelector(SAVE_BTN) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    unmount();
  });

  it("calls onDiscard when Discard button is clicked", () => {
    const onDiscard = vi.fn();
    const { container, unmount } = render({ onDiscard });
    const btn = container.querySelector(DISCARD_BTN) as HTMLButtonElement;
    btn.click();
    expect(onDiscard).toHaveBeenCalledWith("entry-1");
    unmount();
  });

  it("sets data-entry-id on the row element", () => {
    const { container, unmount } = render({
      entry: makeEntry({ id: "custom-id-42" }),
    });
    const row = container.querySelector(ROW);
    expect(row?.getAttribute("data-entry-id")).toBe("custom-id-42");
    unmount();
  });
});
