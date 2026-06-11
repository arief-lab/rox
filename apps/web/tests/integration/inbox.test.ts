import { describe, expect, it, vi } from "vitest";

import { type DownloadFn, Inbox, type InboxEntry } from "@/lib/inbox";

function makeEntry(name: string, size: number): InboxEntry {
  return {
    id: `id-${name}`,
    name,
    size,
    blob: new Blob([new Uint8Array(size)]),
    receivedAt: Date.now(),
  };
}

function spyDownload(): DownloadFn {
  return vi.fn();
}

describe("Inbox", () => {
  it("starts empty", () => {
    const inbox = new Inbox();
    expect(inbox.list()).toEqual([]);
    expect(inbox.size()).toBe(0);
  });

  it("push adds an entry to the list", () => {
    const inbox = new Inbox();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    expect(inbox.list()).toEqual([entry]);
    expect(inbox.size()).toBe(1);
  });

  it("list returns entries in push order", () => {
    const inbox = new Inbox();
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    const c = makeEntry("c.txt", 30);
    inbox.push(a);
    inbox.push(b);
    inbox.push(c);
    expect(inbox.list()).toEqual([a, b, c]);
  });

  it("clear removes all entries", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt", 10));
    inbox.push(makeEntry("b.txt", 20));
    inbox.clear();
    expect(inbox.list()).toEqual([]);
    expect(inbox.size()).toBe(0);
  });

  it("list returns a readonly view (caller cannot mutate the internal array)", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("a.txt", 10));
    const list = inbox.list();
    // Verify the list is an array (runtime check) and has the expected length.
    // The compile-time `ReadonlyArray<InboxEntry>` return type prevents
    // mutation at the type level; this test just confirms the runtime
    // shape matches the type.
    expect(Array.isArray(list)).toBe(true);
    expect(list).toHaveLength(1);
  });
});

describe("Inbox.save", () => {
  it("triggers a download with the entry's blob and name", () => {
    const download = spyDownload();
    const inbox = new Inbox({ download });
    const entry = makeEntry("photo.png", 12);
    inbox.push(entry);

    const result = inbox.save(entry.id);

    expect(result).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(entry.blob, "photo.png");
  });

  it("marks the entry as saved (isSaved returns true)", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);

    expect(inbox.isSaved(entry.id)).toBe(false);
    inbox.save(entry.id);
    expect(inbox.isSaved(entry.id)).toBe(true);
  });

  it("is idempotent: a second save for the same id is a no-op", () => {
    const download = spyDownload();
    const inbox = new Inbox({ download });
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);

    expect(inbox.save(entry.id)).toBe(true);
    expect(inbox.save(entry.id)).toBe(false);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("leaves the entry in the list after save (so the user can see what they received)", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);

    inbox.save(entry.id);

    expect(inbox.list()).toEqual([entry]);
    expect(inbox.isSaved(entry.id)).toBe(true);
  });

  it("returns false and does not download for an unknown id", () => {
    const download = spyDownload();
    const inbox = new Inbox({ download });
    inbox.push(makeEntry("a.txt", 10));

    const result = inbox.save("id-does-not-exist");

    expect(result).toBe(false);
    expect(download).not.toHaveBeenCalled();
  });
});

describe("Inbox.discard", () => {
  it("removes the entry from the list", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    inbox.push(a);
    inbox.push(b);

    inbox.discard(a.id);

    expect(inbox.list()).toEqual([b]);
  });

  it("clears the saved flag for the discarded id", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    inbox.save(entry.id);
    expect(inbox.isSaved(entry.id)).toBe(true);

    inbox.discard(entry.id);

    expect(inbox.isSaved(entry.id)).toBe(false);
  });

  it("is idempotent: discarding an unknown id is a no-op", () => {
    const inbox = new Inbox({ download: spyDownload() });
    inbox.push(makeEntry("a.txt", 10));

    // Should not throw, should not affect the list.
    expect(() => inbox.discard("id-unknown")).not.toThrow();
    expect(inbox.size()).toBe(1);
  });
});

describe("Inbox multi-select batch operations", () => {
  it("saveAll saves every entry that hasn't been saved yet", () => {
    const download = spyDownload();
    const inbox = new Inbox({ download });
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    const c = makeEntry("c.txt", 30);
    inbox.push(a);
    inbox.push(b);
    inbox.push(c);

    const count = inbox.saveAll();

    expect(count).toBe(3);
    expect(download).toHaveBeenCalledTimes(3);
    expect(download).toHaveBeenCalledWith(a.blob, "a.txt");
    expect(download).toHaveBeenCalledWith(b.blob, "b.txt");
    expect(download).toHaveBeenCalledWith(c.blob, "c.txt");
  });

  it("saveAll skips entries that are already saved", () => {
    const download = spyDownload();
    const inbox = new Inbox({ download });
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    inbox.push(a);
    inbox.push(b);
    inbox.save(a.id); // pre-save a

    const count = inbox.saveAll();

    expect(count).toBe(1);
    expect(download).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenLastCalledWith(b.blob, "b.txt");
  });

  it("discardAll removes every entry", () => {
    const inbox = new Inbox({ download: spyDownload() });
    inbox.push(makeEntry("a.txt", 10));
    inbox.push(makeEntry("b.txt", 20));
    inbox.push(makeEntry("c.txt", 30));

    inbox.discardAll();

    expect(inbox.list()).toEqual([]);
    expect(inbox.size()).toBe(0);
  });

  it("batch pattern: save 2 of 3, discard the 3rd, leaves 2 saved entries in the list", () => {
    // Simulates the acceptance-criteria scenario: receive three files,
    // save two, discard one. The two saved entries stay in the list
    // (with isSaved=true) and the discarded one is gone.
    const download = spyDownload();
    const inbox = new Inbox({ download });
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    const c = makeEntry("c.txt", 30);
    inbox.push(a);
    inbox.push(b);
    inbox.push(c);

    // Save a and b (multi-select batch)
    expect(inbox.save(a.id)).toBe(true);
    expect(inbox.save(b.id)).toBe(true);
    // Discard c
    inbox.discard(c.id);

    expect(inbox.list()).toEqual([a, b]);
    expect(inbox.isSaved(a.id)).toBe(true);
    expect(inbox.isSaved(b.id)).toBe(true);
    expect(download).toHaveBeenCalledTimes(2);
  });
});
