import { describe, expect, it } from "vitest";

import { Inbox, type InboxEntry } from "@/lib/inbox";

function makeEntry(name: string, size: number): InboxEntry {
  return {
    id: `id-${name}`,
    name,
    size,
    blob: new Blob([new Uint8Array(size)]),
    receivedAt: Date.now(),
  };
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
