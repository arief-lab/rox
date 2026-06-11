/**
 * Inbox — session-scoped store of received Transfers.
 *
 * Per the PRD glossary: "when the Session ends, the Inbox is cleared".
 * The Inbox class is a simple in-memory list; the Session layer is
 * responsible for calling `clear()` when the Session ends.
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

  push(entry: InboxEntry): void {
    this.entries.push(entry);
  }

  list(): readonly InboxEntry[] {
    return this.entries;
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }
}
