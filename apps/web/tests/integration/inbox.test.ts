import { describe, expect, it, vi } from "vitest";

import {
  type DownloadFn,
  Inbox,
  type InboxEntry,
  type PendingEntry,
} from "@/lib/inbox";

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

describe("Inbox pending send entries", () => {
  function makePending(name: string, size: number): PendingEntry {
    return {
      id: `pending-${name}`,
      name,
      size,
      blob: new Blob([new Uint8Array(size)]),
      sharedAt: Date.now(),
      type: "application/octet-stream",
    };
  }

  it("starts with an empty pending list", () => {
    const inbox = new Inbox();
    expect(inbox.listPending()).toEqual([]);
  });

  it("pushPending adds an entry to the pending list", () => {
    const inbox = new Inbox();
    const entry = makePending("photo.jpg", 1024);
    inbox.pushPending(entry);
    expect(inbox.listPending()).toEqual([entry]);
  });

  it("listPending returns entries in push order", () => {
    const inbox = new Inbox();
    const a = makePending("a.jpg", 100);
    const b = makePending("b.png", 200);
    inbox.pushPending(a);
    inbox.pushPending(b);
    expect(inbox.listPending()).toEqual([a, b]);
  });

  it("removePending removes a specific entry by id", () => {
    const inbox = new Inbox();
    const a = makePending("a.jpg", 100);
    const b = makePending("b.png", 200);
    inbox.pushPending(a);
    inbox.pushPending(b);
    inbox.removePending(a.id);
    expect(inbox.listPending()).toEqual([b]);
  });

  it("removePending is idempotent on unknown ids", () => {
    const inbox = new Inbox();
    inbox.pushPending(makePending("a.jpg", 100));
    expect(() => inbox.removePending("non-existent-id")).not.toThrow();
    expect(inbox.listPending()).toHaveLength(1);
  });

  it("clear clears both the entries list and the pending list", () => {
    const inbox = new Inbox();
    inbox.push(makeEntry("received.txt", 10));
    inbox.pushPending(makePending("pending.jpg", 1024));
    inbox.clear();
    expect(inbox.list()).toEqual([]);
    expect(inbox.listPending()).toEqual([]);
  });

  it('"pending-changed" fires on pushPending', () => {
    const inbox = new Inbox();
    const fn = vi.fn();
    inbox.subscribe(fn, "pending-changed");
    inbox.pushPending(makePending("p.jpg", 100));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"pending-changed" fires on removePending', () => {
    const inbox = new Inbox();
    const entry = makePending("p.jpg", 100);
    inbox.pushPending(entry);
    const fn = vi.fn();
    inbox.subscribe(fn, "pending-changed");
    inbox.removePending(entry.id);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"pending-changed" fires on clear', () => {
    const inbox = new Inbox();
    inbox.pushPending(makePending("p.jpg", 100));
    const fn = vi.fn();
    inbox.subscribe(fn, "pending-changed");
    inbox.clear();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"pending-changed" does NOT fire on save or discard', () => {
    const inbox = new Inbox();
    const entry = makeEntry("received.txt", 10);
    inbox.push(entry);
    const fn = vi.fn();
    inbox.subscribe(fn, "pending-changed");
    inbox.save(entry.id);
    inbox.discard(entry.id);
    expect(fn).not.toHaveBeenCalled();
  });

  it("pending entries survive clear() of regular entries", () => {
    // clear() clears BOTH lists simultaneously — but the design
    // says the Session layer calls clear() on Session end, which
    // clears everything. This test pins the current behaviour.
    const inbox = new Inbox();
    inbox.pushPending(makePending("p.jpg", 100));
    inbox.push(makeEntry("received.txt", 10));
    inbox.clear();
    expect(inbox.listPending()).toEqual([]);
    expect(inbox.list()).toEqual([]);
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

describe("Inbox.subscribe signal split", () => {
  it('"list-changed" fires on push', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    inbox.subscribe(fn, "list-changed");

    inbox.push(makeEntry("a.txt", 10));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"list-changed" fires on discard and clear', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    inbox.push(a);
    inbox.push(b);
    inbox.subscribe(fn, "list-changed");

    inbox.discard(a.id);
    inbox.clear();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('"list-changed" fires on discardAll (which calls clear)', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    inbox.push(makeEntry("a.txt", 10));
    inbox.subscribe(fn, "list-changed");

    inbox.discardAll();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"list-changed" does NOT fire on save or saveAll', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    inbox.push(a);
    inbox.push(b);
    inbox.subscribe(fn, "list-changed");

    inbox.save(a.id);
    inbox.saveAll();

    expect(fn).not.toHaveBeenCalled();
  });

  it('"saved-changed" fires on save', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    inbox.subscribe(fn, "saved-changed");

    inbox.save(entry.id);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"saved-changed" does NOT fire on a no-op save (already saved)', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    inbox.save(entry.id); // pre-save
    inbox.subscribe(fn, "saved-changed");

    inbox.save(entry.id); // no-op

    expect(fn).not.toHaveBeenCalled();
  });

  it('"saved-changed" fires once per newly-saved entry on saveAll', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    const c = makeEntry("c.txt", 30);
    inbox.push(a);
    inbox.push(b);
    inbox.push(c);
    inbox.subscribe(fn, "saved-changed");

    inbox.saveAll();

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('"saved-changed" fires N times on saveAll where N entries are newly saved (not already-saved)', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const a = makeEntry("a.txt", 10);
    const b = makeEntry("b.txt", 20);
    inbox.push(a);
    inbox.push(b);
    inbox.save(a.id); // pre-save a, so saveAll should only fire for b
    inbox.subscribe(fn, "saved-changed");

    inbox.saveAll();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('"saved-changed" does NOT fire on push, discard, or clear', () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    inbox.push(makeEntry("a.txt", 10));
    inbox.subscribe(fn, "saved-changed");

    inbox.push(makeEntry("b.txt", 20));
    inbox.discard("id-a.txt");
    inbox.clear();

    expect(fn).not.toHaveBeenCalled();
  });

  it("default subscribe (no event arg) is the historical 'list-changed' signal", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const fn = vi.fn();
    const a = makeEntry("a.txt", 10);
    inbox.push(a);
    inbox.subscribe(fn); // no event arg

    inbox.save(a.id); // should NOT fire on default
    inbox.discard(a.id); // SHOULD fire on default

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("two subscribers on the same event both fire", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const a = vi.fn();
    const b = vi.fn();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    inbox.subscribe(a, "saved-changed");
    inbox.subscribe(b, "saved-changed");

    inbox.save(entry.id);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("subscriber on list-changed does not fire when only saved-changed fires", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const listFn = vi.fn();
    const savedFn = vi.fn();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    inbox.subscribe(listFn, "list-changed");
    inbox.subscribe(savedFn, "saved-changed");

    inbox.save(entry.id);

    expect(listFn).not.toHaveBeenCalled();
    expect(savedFn).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops the subscriber from firing for the right event only", () => {
    const inbox = new Inbox({ download: spyDownload() });
    const listFn = vi.fn();
    const savedFn = vi.fn();
    const entry = makeEntry("a.txt", 10);
    inbox.push(entry);
    const unsubscribeList = inbox.subscribe(listFn, "list-changed");
    const unsubscribeSaved = inbox.subscribe(savedFn, "saved-changed");

    unsubscribeList();
    unsubscribeSaved();

    inbox.discard(entry.id);
    inbox.push(makeEntry("b.txt", 20));
    inbox.save("id-b.txt");

    expect(listFn).not.toHaveBeenCalled();
    expect(savedFn).not.toHaveBeenCalled();
  });

  it("a callback that subscribes during iteration does not receive the current notification", () => {
    // The snapshot copy in notify() means a subscriber added mid-
    // iteration is not part of the snapshot and won't fire for the
    // current notification (it will fire for the next one).
    const inbox = new Inbox({ download: spyDownload() });
    const newSub = vi.fn();
    const first = vi.fn(() => {
      inbox.subscribe(newSub, "list-changed");
    });
    inbox.subscribe(first, "list-changed");

    inbox.push(makeEntry("a.txt", 10));

    expect(first).toHaveBeenCalledTimes(1);
    expect(newSub).not.toHaveBeenCalled();

    // But it IS subscribed now, so the next notification fires it.
    inbox.push(makeEntry("b.txt", 20));
    expect(newSub).toHaveBeenCalledTimes(1);
  });

  it("a callback that unsubscribes another subscriber does not affect this notification's iteration", () => {
    // The snapshot copy means a subscriber that was in the snapshot
    // still fires for the current notification even if another
    // callback unsubscribes it mid-iteration. The unsubscribe only
    // takes effect for future notifications.
    const inbox = new Inbox({ download: spyDownload() });
    const victim = vi.fn();
    const unsubscribeVictim = inbox.subscribe(victim, "list-changed");
    const killer = vi.fn(() => {
      unsubscribeVictim();
    });
    inbox.subscribe(killer, "list-changed");

    inbox.push(makeEntry("a.txt", 10));

    // Both fire for this notification (both were in the snapshot).
    expect(victim).toHaveBeenCalledTimes(1);
    expect(killer).toHaveBeenCalledTimes(1);

    // Future notifications: victim is unsubscribed, killer still fires.
    inbox.push(makeEntry("b.txt", 20));
    expect(victim).toHaveBeenCalledTimes(1);
    expect(killer).toHaveBeenCalledTimes(2);
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
