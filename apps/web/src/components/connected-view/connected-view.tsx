// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import { useEffect, useState } from "react";
import { CardHeaderWithStatus } from "@/components/card-header-with-status";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import { TransferProgress } from "@/components/transfer-progress";
import type { Inbox, PendingEntry } from "@/lib/inbox";
import type { Session } from "@/lib/webrtc";

interface ConnectedViewProps {
  connectionStatus: ConnectionStatusKind;
  handleCancelReceive: () => void;
  handleCancelSend: () => void;
  handleClose: () => void;
  handleSend: (file: File) => Promise<void>;
  inbox: Inbox;
  peerName: string | undefined;
  progress: { bytes: number; total: number } | null;
  receiveProgress: { bytes: number; total: number } | null;
  sendLog: string[];
  session: Session | null;
  wasDisconnected: boolean;
}

export function ConnectedView({
  connectionStatus,
  handleCancelReceive,
  handleCancelSend,
  handleClose,
  handleSend,
  inbox,
  peerName,
  progress,
  receiveProgress,
  sendLog,
  session,
  wasDisconnected,
}: ConnectedViewProps) {
  const [pendingEntries, setPendingEntries] = useState<PendingEntry[]>(() => [
    ...inbox.listPending(),
  ]);

  useEffect(() => {
    const unsub = inbox.subscribe(() => {
      setPendingEntries([...inbox.listPending()]);
    }, "pending-changed");
    return unsub;
  }, [inbox]);

  return (
    <Card data-testid="connected-state">
      <CardHeaderWithStatus
        connectionStatus={connectionStatus}
        title="Connected"
      />
      <CardContent>
        <p className="mb-2 text-sm">Peer: {peerName ?? "(unknown)"}</p>
        {session ? <SessionTimer session={session} /> : null}

        {pendingEntries.length > 0 ? (
          <div className="mb-4" data-testid="pending-send-section">
            <h3 className="mb-2 font-medium text-sm">Ready to send</h3>
            {pendingEntries.map((entry) => (
              <div
                className="mb-2 flex items-center justify-between rounded-lg border bg-white p-3"
                data-pending-id={entry.id}
                data-testid="pending-send-row"
                key={entry.id}
              >
                <div>
                  <p
                    className="font-medium text-sm"
                    data-testid="pending-send-name"
                  >
                    {entry.name}
                  </p>
                  <p
                    className="text-gray-500 text-xs"
                    data-testid="pending-send-size"
                  >
                    {formatPendingSize(entry.size)}
                    {" · "}
                    {entry.type || "unknown type"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    data-testid="pending-send-button"
                    disabled={progress !== null || wasDisconnected}
                    onClick={() => {
                      const file = new File([entry.blob], entry.name, {
                        type: entry.type,
                      });
                      inbox.removePending(entry.id);
                      handleSend(file);
                    }}
                    size="xs"
                    variant="success"
                  >
                    Send
                  </Button>
                  <Button
                    data-testid="pending-discard-button"
                    onClick={() => inbox.removePending(entry.id)}
                    size="xs"
                    variant="secondary"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-4" data-testid="send-section">
          <SendButton
            disabled={progress !== null || wasDisconnected}
            onSend={handleSend}
          />
          {progress ? (
            <TransferProgress onCancel={handleCancelSend} progress={progress} />
          ) : null}
          {sendLog.length > 0 ? (
            <pre
              className="mt-2 max-h-24 overflow-auto rounded bg-gray-50 p-2 text-xs"
              data-testid="send-log"
            >
              {sendLog.join("\n")}
            </pre>
          ) : null}
        </div>

        {receiveProgress ? (
          <div className="mb-4" data-testid="receive-section">
            <TransferProgress
              direction="receive"
              onCancel={handleCancelReceive}
              progress={receiveProgress}
            />
          </div>
        ) : null}

        <InboxScreen inbox={inbox} />

        <Button
          className="mt-2 w-full"
          data-testid="close-session"
          onClick={handleClose}
          variant="destructive"
        >
          {wasDisconnected ? "Start over" : "Disconnect"}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatPendingSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
