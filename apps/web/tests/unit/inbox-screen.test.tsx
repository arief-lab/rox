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

const _SECTION = '[data-testid="inbox-section"]';
const EMPTY = '[data-testid="inbox-empty"]';
const ROW = '[data-testid="inbox-row"]';
const SAVE_BTN = '[data-testid="inbox-save"]';
const DISCARD_BTN = '[data-testid="inbox-discard"]';
const SAVE_SELECTED = '[data-testid="inbox-save-selected"]';
const DISCARD_SELECTED = '[data-testid="inbox-discard-selected"]';
const SAVE_ALL = '[data-testid="inbox-save-all"]';
const DISCARD_ALL = '[data-testid="inbox-discard-all"]';
const SELECT_ALL = '[data-testid="inbox-select-all"]';
const CHECKBOX = '[data-testid="inbox-checkbox"]';
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

  it("does not show action buttons when empty", () => {
    const inbox = new Inbox();
    const { container, unmount } = render(inbox);
    expect(container.querySelector(SELECT_ALL)).toBeNull();
    expect(container.querySelector(SAVE_SELECTED)).toBeNull();
    expect(container.querySelector(DISCARD_ALL)).toBeNull();
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

  it("shows action buttons when there are entries", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    const { container, unmount } = render(inbox);
    expect(container.querySelector(SELECT_ALL)).not.toBeNull();
    expect(container.querySelector(SAVE_SELECTED)).not.toBeNull();
    expect(container.querySelector(DISCARD_SELECTED)).not.toBeNull();
    expect(container.querySelector(SAVE_ALL)).not.toBeNull();
    expect(container.querySelector(DISCARD_ALL)).not.toBeNull();
    unmount();
  });

  it("Save selected button shows the count of selected items", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    inbox.push(makeEntry("b.txt"));
    const { container, unmount } = render(inbox);

    // Initially 0 selected
    expect(container.querySelector(SAVE_SELECTED)?.textContent).toContain("0");

    // Select the first entry
    const cb = container.querySelectorAll(CHECKBOX)[0] as HTMLInputElement;
    cb.click();
    flushSync(() => undefined);

    // Should now show 1
    expect(container.querySelector(SAVE_SELECTED)?.textContent).toContain("1");
    unmount();
  });

  it("Discard selected button shows the count of selected items", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    inbox.push(makeEntry("b.txt"));
    const { container, unmount } = render(inbox);

    expect(container.querySelector(DISCARD_SELECTED)?.textContent).toContain(
      "0"
    );

    // Select both entries
    const checkboxes = container.querySelectorAll(CHECKBOX);
    (checkboxes[0] as HTMLInputElement).click();
    flushSync(() => undefined);
    (checkboxes[1] as HTMLInputElement).click();
    flushSync(() => undefined);

    expect(container.querySelector(DISCARD_SELECTED)?.textContent).toContain(
      "2"
    );
    unmount();
  });

  it("Save all is disabled when all entries are already saved", () => {
    const inbox = new Inbox({ download: vi.fn() });
    const entry = makeEntry("a.txt");
    inbox.push(entry);
    inbox.save(entry.id);
    const { container, unmount } = render(inbox);

    const saveAll = container.querySelector(SAVE_ALL) as HTMLButtonElement;
    expect(saveAll.disabled).toBe(true);
    unmount();
  });

  it("Save all is enabled when some entries are unsaved", () => {
    const inbox = new Inbox({ download: vi.fn() });
    inbox.push(makeEntry("a.txt"));
    inbox.push(makeEntry("b.txt"));
    inbox.save("id-a.txt");
    const { container, unmount } = render(inbox);

    const saveAll = container.querySelector(SAVE_ALL) as HTMLButtonElement;
    expect(saveAll.disabled).toBe(false);
    unmount();
  });

  it("Save selected is disabled when nothing is selected", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    const { container, unmount } = render(inbox);

    const saveSelected = container.querySelector(
      SAVE_SELECTED
    ) as HTMLButtonElement;
    expect(saveSelected.disabled).toBe(true);
    unmount();
  });

  it("Save selected is enabled when items are selected", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    const { container, unmount } = render(inbox);

    const cb = container.querySelector(CHECKBOX) as HTMLInputElement;
    cb.click();
    flushSync(() => undefined);

    const saveSelected = container.querySelector(
      SAVE_SELECTED
    ) as HTMLButtonElement;
    expect(saveSelected.disabled).toBe(false);
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

  it("Select all toggles checkbox selection", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    inbox.push(makeEntry("b.txt"));
    const { container, unmount } = render(inbox);

    const selectAll = container.querySelector(SELECT_ALL) as HTMLButtonElement;

    // Click Select all
    selectAll.click();
    flushSync(() => undefined);

    const checkboxes = container.querySelectorAll(CHECKBOX);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);

    // Button now says "Deselect all"
    expect(selectAll.textContent).toBe("Deselect all");

    // Click again to deselect
    selectAll.click();
    flushSync(() => undefined);

    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    expect(selectAll.textContent).toBe("Select all");
    unmount();
  });

  it("discarding a selected row via UI removes it from the list", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt"));
    inbox.push(makeEntry("b.txt"));
    const { container, unmount } = render(inbox);

    // Discard the first entry via the Discard button
    const discardBtns = container.querySelectorAll(DISCARD_BTN);
    (discardBtns[0] as HTMLButtonElement).click();
    flushSync(() => undefined);

    // After discarding one entry, only the other remains
    const rows = container.querySelectorAll(ROW);
    expect(rows).toHaveLength(1);
    unmount();
  });
});
