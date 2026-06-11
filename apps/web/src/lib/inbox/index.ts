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
 * to be notified when the list shape changes (push/discard/clear) or
 * when a saved flag flips (save/saveAll). The two signals are split
 * so consumers can pick the one they care about — e.g. InboxScreen
 * subscribes to `"list-changed"` to rebuild its entries array, and
 * to `"saved-changed"` to refresh `isSaved` flags without rebuilding
 * the array.
 */

/** Which signal a subscriber wants to listen for. */
export type InboxEvent = "list-changed" | "saved-changed";

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
  private readonly listSubscribers = new Set<() => void>();
  private readonly savedSubscribers = new Set<() => void>();

  constructor(options: { download?: DownloadFn } = {}) {
    this.download = options.download ?? triggerBrowserDownload;
  }

  /**
   * Subscribe to a signal. The callback is invoked synchronously
   * after any operation that fires the chosen event; the callback
   * should re-read whatever Inbox state it cares about (the signal
   * carries no payload).
   *
   * - `"list-changed"` fires on `push`, `discard`, `clear`,
   *   `discardAll`. Use this to rebuild a list of entries.
   * - `"saved-changed"` fires on `save` and `saveAll` (once per
   *   newly-saved entry). Use this to refresh `isSaved` flags.
   *
   * The default is `"list-changed"`, which matches the historical
   * "any change" signal.
   *
   * Returns an unsubscribe function.
   */
  subscribe(fn: () => void, event: InboxEvent = "list-changed"): () => void {
    const set =
      event === "list-changed" ? this.listSubscribers : this.savedSubscribers;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }

  private notify(set: Set<() => void>): void {
    // Copy to a snapshot so a callback that subscribes/unsubscribes
    // mid-iteration doesn't mutate the set we're iterating.
    for (const fn of [...set]) {
      fn();
    }
  }

  push(entry: InboxEntry): void {
    this.entries.push(entry);
    this.notify(this.listSubscribers);
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
    this.notify(this.listSubscribers);
  }

  /**
   * Trigger a download for the entry with the given id. Idempotent —
   * a second call with the same id is a no-op (the entry is already
   * marked as saved and stays in the list so the user can see what
   * they received).
   *
   * Returns true if the download was triggered, false if the entry
   * was already saved or doesn't exist. Fires `"saved-changed"` on
   * a successful new save.
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
    this.notify(this.savedSubscribers);
    return true;
  }

  /**
   * Remove the entry with the given id from the in-memory list.
   * Also clears the "saved" flag for that id so a future re-receive
   * (unlikely in practice) would be savable again. Idempotent —
   * discarding an unknown id is a no-op. Fires `"list-changed"`.
   */
  discard(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.saved.delete(id);
    this.notify(this.listSubscribers);
  }

  /**
   * Save every entry that hasn't been saved yet. Returns the number
   * of entries that were newly saved. Each new save fires its own
   * `"saved-changed"` notification, so subscribers may see N
   * notifications (React batches them into a single render).
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
   * for explicit user action). Fires `"list-changed"`.
   */
  discardAll(): void {
    this.clear();
  }

  /** Whether the entry with the given id has been saved. */
  isSaved(id: string): boolean {
    return this.saved.has(id);
  }
}
