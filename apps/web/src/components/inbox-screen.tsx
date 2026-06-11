"use client";

import { useEffect, useState } from "react";

import { InboxRow } from "@/components/inbox-row";
import type { Inbox } from "@/lib/inbox";

interface InboxScreenProps {
  inbox: Inbox;
}

/**
 * InboxScreen — renders the Inbox as a multi-select list with
 * Save / Discard actions.
 *
 * Per-row actions:
 * - Save: triggers a browser download for that entry, marks it as
 *   saved (idempotent — clicking again is a no-op)
 * - Discard: removes the entry from the Inbox
 *
 * Multi-select actions:
 * - Save selected: saves every selected entry that hasn't been saved
 * - Discard selected: removes every selected entry
 * - Select all / Deselect all: toggle all checkboxes
 *
 * Whole-inbox actions:
 * - Save all: saves every entry that hasn't been saved (disabled
 *   when there's nothing new to save)
 * - Discard all: removes every entry from the Inbox
 *
 * The component subscribes to the Inbox on mount and re-renders on
 * any push/discard/save/clear notification. The selection set is
 * local component state; it is pruned to only ids that still exist
 * on each notification (so discarding a selected row drops it from
 * the selection).
 */
export function InboxScreen({ inbox }: InboxScreenProps) {
  const [entries, setEntries] = useState(() => [...inbox.list()]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set()
  );

  // Subscribe to the Inbox so the UI re-renders when entries are
  // pushed (e.g. from a transfer's receive() promise) or removed
  // (discard / clear). The subscription is the only mechanism that
  // refreshes the entries list — the handlers don't need to.
  useEffect(() => {
    const unsubscribe = inbox.subscribe(() => {
      setEntries([...inbox.list()]);
      // Prune selection to only entries that still exist
      setSelected(
        (prev) =>
          new Set(
            [...prev].filter((id) => inbox.list().some((e) => e.id === id))
          )
      );
    });
    return unsubscribe;
  }, [inbox]);

  const handleSave = (id: string): void => {
    inbox.save(id);
  };

  const handleDiscard = (id: string): void => {
    inbox.discard(id);
  };

  const handleSelectChange = (id: string, isSelected: boolean): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (): void => {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  };

  const handleSaveSelected = (): void => {
    for (const id of selected) {
      inbox.save(id);
    }
  };

  const handleDiscardSelected = (): void => {
    for (const id of selected) {
      inbox.discard(id);
    }
  };

  const handleSaveAll = (): void => {
    inbox.saveAll();
  };

  const handleDiscardAll = (): void => {
    inbox.discardAll();
  };

  // Save all is a no-op when every entry is already saved; reflect
  // that in the button's disabled state.
  const allSaved =
    entries.length > 0 && entries.every((e) => inbox.isSaved(e.id));

  if (entries.length === 0) {
    return (
      <div className="mb-4" data-testid="inbox-section">
        <h3 className="mb-2 font-medium text-sm">Inbox</h3>
        <p className="text-gray-500 text-xs" data-testid="inbox-empty">
          No files received yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4" data-testid="inbox-section">
      <h3 className="mb-2 font-medium text-sm">Inbox</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          className="rounded bg-gray-200 px-2 py-1 text-xs"
          data-testid="inbox-select-all"
          onClick={handleSelectAll}
          type="button"
        >
          {selected.size === entries.length ? "Deselect all" : "Select all"}
        </button>
        <button
          className="rounded bg-blue-500 px-2 py-1 text-white text-xs disabled:opacity-50"
          data-testid="inbox-save-selected"
          disabled={selected.size === 0}
          onClick={handleSaveSelected}
          type="button"
        >
          Save selected ({selected.size})
        </button>
        <button
          className="rounded bg-red-500 px-2 py-1 text-white text-xs disabled:opacity-50"
          data-testid="inbox-discard-selected"
          disabled={selected.size === 0}
          onClick={handleDiscardSelected}
          type="button"
        >
          Discard selected ({selected.size})
        </button>
        <button
          className="rounded bg-blue-500 px-2 py-1 text-white text-xs disabled:opacity-50"
          data-testid="inbox-save-all"
          disabled={allSaved}
          onClick={handleSaveAll}
          type="button"
        >
          Save all
        </button>
        <button
          className="rounded bg-red-500 px-2 py-1 text-white text-xs disabled:opacity-50"
          data-testid="inbox-discard-all"
          onClick={handleDiscardAll}
          type="button"
        >
          Discard all
        </button>
      </div>
      {entries.map((entry) => (
        <InboxRow
          entry={entry}
          isSaved={inbox.isSaved(entry.id)}
          isSelected={selected.has(entry.id)}
          key={entry.id}
          onDiscard={handleDiscard}
          onSave={handleSave}
          onSelectChange={handleSelectChange}
        />
      ))}
    </div>
  );
}
