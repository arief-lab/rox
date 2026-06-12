"use client";

import { Button } from "@rox-apps/ui/components/button";
import type { InboxEntry } from "@/lib/inbox";

interface InboxRowProps {
  entry: InboxEntry;
  isSaved: boolean;
  isSelected: boolean;
  onDiscard: (id: string) => void;
  onSave: (id: string) => void;
  onSelectChange: (id: string, selected: boolean) => void;
}

/**
 * Renders a single Inbox entry. Displays the file name, size (in a
 * human-readable format), a multi-select checkbox, and Save / Discard
 * action buttons.
 *
 * Save is idempotent: clicking it again after a successful save is a
 * no-op (the row stays in the Inbox with a "Saved" label so the user
 * can see what they received).
 *
 * Discard removes the row from the Inbox immediately.
 */
export function InboxRow({
  entry,
  isSaved,
  isSelected,
  onSelectChange,
  onSave,
  onDiscard,
}: InboxRowProps) {
  const sizeLabel = formatSize(entry.size);
  return (
    <div
      className="flex items-center justify-between border-b py-2"
      data-entry-id={entry.id}
      data-testid="inbox-row"
    >
      <div className="flex items-center gap-2">
        <input
          aria-label={`Select ${entry.name}`}
          checked={isSelected}
          data-testid="inbox-checkbox"
          onChange={(e) => onSelectChange(entry.id, e.target.checked)}
          type="checkbox"
        />
        <div>
          <p className="font-medium text-sm" data-testid="inbox-name">
            {entry.name}
            {isSaved ? (
              <span
                className="ml-2 rounded bg-green-100 px-1 text-green-700 text-xs"
                data-testid="inbox-saved-badge"
              >
                Saved
              </span>
            ) : null}
          </p>
          <p className="text-gray-500 text-xs" data-testid="inbox-size">
            {sizeLabel}
          </p>
          {entry.senderName ? (
            <p className="text-gray-400 text-xs" data-testid="inbox-sender">
              From: {entry.senderName}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex gap-1">
        <Button
          data-testid="inbox-save"
          disabled={isSaved}
          onClick={() => onSave(entry.id)}
          size="xs"
          variant="default"
        >
          Save
        </Button>
        <Button
          data-testid="inbox-discard"
          onClick={() => onDiscard(entry.id)}
          size="xs"
          variant="destructive"
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
