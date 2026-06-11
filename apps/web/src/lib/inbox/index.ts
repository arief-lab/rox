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
  /** The sender's device name (from the pairing exchange). */
  senderName?: string;
  /** File size in bytes (from the start message). */
  size: number;
}

export class Inbox {
  private entries: InboxEntry[] = [];
  private readonly saved = new Set<string>();
  private readonly download: DownloadFn;
  private readonly listSubscribers = new Set<() => void>();
  private readonly savedSubscribers = new Set<() => void>();
  private _senderName: string | null = null;

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

  private notifyListChanged(): void {
    // Copy to a snapshot so a callback that subscribes/unsubscribes
    // mid-iteration doesn't mutate the set we're iterating.
    for (const fn of [...this.listSubscribers]) {
      fn();
    }
  }

  private notifySavedChanged(): void {
    // Copy to a snapshot so a callback that subscribes/unsubscribes
    // mid-iteration doesn't mutate the set we're iterating.
    for (const fn of [...this.savedSubscribers]) {
      fn();
    }
  }

  push(entry: InboxEntry): void {
    // Stamp the sender name (from the pairing exchange) onto the
    // entry so the InboxRow can display "From: {senderName}".
    // Spread into a new object so we don't mutate the caller's
    // reference — the receive-loop constructs a fresh object
    // each time, but mutation is fragile if a caller ever reuses
    // or shares an entry object.
    const stamped: InboxEntry = { ...entry };
    if (this._senderName !== null) {
      stamped.senderName = this._senderName;
    }
    this.entries.push(stamped);
    this.notifyListChanged();
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
    this.notifyListChanged();
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
    this.notifySavedChanged();
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
    this.notifyListChanged();
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

  /**
   * Set the sender's device name (the peer's device name from the
   * pairing exchange). Received entries are stamped with this name
   * so the InboxRow can display "From: {senderName}".
   */
  setSenderName(name: string): void {
    this._senderName = name;
  }
}
