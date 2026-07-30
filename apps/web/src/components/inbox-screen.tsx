// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect, useReducer, useState } from "react";
import { InboxRow } from "@/components/inbox-row";
import type { Inbox } from "@/lib/inbox";

interface InboxScreenProps {
  inbox: Inbox;
}

export function InboxScreen({ inbox }: InboxScreenProps) {
  const [entries, setEntries] = useState(() => [...inbox.list()]);
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    const unsubscribeList = inbox.subscribe(() => {
      setEntries([...inbox.list()]);
    }, "list-changed");
    const unsubscribeSaved = inbox.subscribe(forceRender, "saved-changed");
    return () => {
      unsubscribeList();
      unsubscribeSaved();
    };
  }, [inbox]);

  const handleSave = (id: string): void => {
    inbox.save(id);
  };

  const handleDiscard = (id: string): void => {
    inbox.discard(id);
  };

  if (entries.length === 0) {
    return (
      <div className="mb-4" data-testid="inbox-section">
        <h3 className="mb-2 font-medium text-sm">Received files</h3>
        <p className="text-gray-500 text-xs" data-testid="inbox-empty">
          No files received yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4" data-testid="inbox-section">
      <h3 className="mb-2 font-medium text-sm">Received files</h3>
      {entries.map((entry) => (
        <InboxRow
          entry={entry}
          isSaved={inbox.isSaved(entry.id)}
          key={entry.id}
          onDiscard={handleDiscard}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}
