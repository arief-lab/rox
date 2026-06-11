"use client";

import type { InboxEntry } from "@/lib/inbox";

interface InboxRowProps {
  entry: InboxEntry;
}

/**
 * Renders a single Inbox entry. Displays the file name and size in
 * a human-readable format (bytes → KB/MB).
 */
export function InboxRow({ entry }: InboxRowProps) {
  const sizeLabel = formatSize(entry.size);
  return (
    <div
      className="flex items-center justify-between border-b py-2"
      data-testid="inbox-row"
    >
      <div>
        <p className="font-medium text-sm" data-testid="inbox-name">
          {entry.name}
        </p>
        <p className="text-gray-500 text-xs" data-testid="inbox-size">
          {sizeLabel}
        </p>
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
