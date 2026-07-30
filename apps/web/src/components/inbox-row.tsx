// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import type { InboxEntry } from "@/lib/inbox";

interface InboxRowProps {
  entry: InboxEntry;
  isSaved: boolean;
  onDiscard: (id: string) => void;
  onSave: (id: string) => void;
}

export function InboxRow({ entry, isSaved, onDiscard, onSave }: InboxRowProps) {
  const sizeLabel = formatSize(entry.size);
  return (
    <div
      className="flex items-center justify-between border-b py-2"
      data-entry-id={entry.id}
      data-testid="inbox-row"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm" data-testid="inbox-name">
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
      <div className="ml-2 flex gap-1">
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
