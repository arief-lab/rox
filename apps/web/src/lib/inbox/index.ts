import { type DownloadFn, triggerBrowserDownload } from "./download";

export type { DownloadFn } from "./download";

/**
 * Inbox — session-scoped store of received Transfers.
 *
 * Per the PRD glossary: "when the Session ends, the Inbox is cleared".
 * The Inbox class is a simple in-memory list; the Session layer is
 * responsible for calling `clear()` when the Session ends.
 *
 * Slice 5 adds save/discard: `save` triggers a browser download (via
 * the injected `download` function, defaults to `triggerBrowserDownload`),
 * `discard` removes the entry from the in-memory list. Both are
 * idempotent — double-save is a no-op, double-discard is a no-op.
 *
 * The Inbox is observable: consumers (e.g. InboxScreen) can subscribe
 * to be notified whenever the list changes, and re-read `list()`.
 * Notifications fire on `push`, `discard`, `save`, `saveAll`, `clear`,
 * and `discardAll`. `isSaved` doesn't fire (it doesn't change the
 * list shape from the consumer's point of view — the entry is still
 * there with the same data, just marked as saved).
 */

export interface InboxEntry {
  /** The reassembled file bytes. */
  blob: Blob;
  /** UUID assigned at receive time. */
  id: string;
  /** File name (from the start message). */
  name: string;
  /** Timestamp (ms since epoch) when the entry was added. */
  receivedAt: number;
  /** File size in bytes (from the start message). */
  size: number;
}

export class Inbox {
  private entries: InboxEntry[] = [];
  private readonly saved = new Set<string>();
  private readonly download: DownloadFn;
  private readonly subscribers = new Set<() => void>();

  constructor(options: { download?: DownloadFn } = {}) {
    this.download = options.download ?? triggerBrowserDownload;
  }

  /**
   * Subscribe to list-shape changes. The callback is invoked
   * synchronously after any operation that adds, removes, or
   * clears entries. The callback should call `list()` to read the
   * current state — it does not receive the change as an argument.
   *
   * Returns an unsubscribe function. The same function can be
   * subscribed multiple times; each `subscribe` call returns a
   * separate unsubscribe.
   */
  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    // Copy to a snapshot so a callback that calls subscribe/unsubscribe
    // mid-iteration doesn't mutate the set we're iterating.
    for (const fn of [...this.subscribers]) {
      fn();
    }
  }

  push(entry: InboxEntry): void {
    this.entries.push(entry);
    this.notify();
  }

  list(): readonly InboxEntry[] {
    return this.entries;
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
    this.saved.clear();
    this.notify();
  }

  /**
   * Trigger a download for the entry with the given id. Idempotent —
   * a second call with the same id is a no-op (the entry is already
   * marked as saved and stays in the list so the user can see what
   * they received).
   *
   * Returns true if the download was triggered, false if the entry
   * was already saved or doesn't exist.
   */
  save(id: string): boolean {
    if (this.saved.has(id)) {
      return false;
    }
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      return false;
    }
    this.download(entry.blob, entry.name);
    this.saved.add(id);
    this.notify();
    return true;
  }

  /**
   * Remove the entry with the given id from the in-memory list.
   * Also clears the "saved" flag for that id so a future re-receive
   * (unlikely in practice) would be savable again. Idempotent —
   * discarding an unknown id is a no-op.
   */
  discard(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.saved.delete(id);
    this.notify();
  }

  /**
   * Save every entry that hasn't been saved yet. Returns the number
   * of entries that were newly saved. Each new save fires its own
   * notification, so subscribers may see N notifications rather than
   * one batch notification.
   */
  saveAll(): number {
    let count = 0;
    for (const entry of this.entries) {
      if (this.save(entry.id)) {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Discard every entry. Same as `clear()` but kept as a named
   * alias for the UI to call (the semantics are the same, but the
   * intent differs — `clear` is for Session-end, `discardAll` is
   * for explicit user action).
   */
  discardAll(): void {
    this.clear();
  }

  /** Whether the entry with the given id has been saved. */
  isSaved(id: string): boolean {
    return this.saved.has(id);
  }
}
