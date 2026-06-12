"use client";

import { Button } from "@rox-apps/ui/components/button";
import { useEffect, useState } from "react";
import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import { TransferProgress } from "@/components/transfer-progress";
import type { Inbox, PendingEntry } from "@/lib/inbox";
import type { Session } from "@/lib/webrtc";

/**
 * Shared connected-state view, used by both PairingScreen and
 * AnswererScreen. The two screens have identical connected
 * behavior (the PairingMachine's `connected` state carries
 * `peerName` regardless of which side initiated the pair), so
 * a single component renders for both.
 *
 * Extracted from the screens in the render-tree follow-up to
 * bring the screens' cognitive complexity under 20. The
 * connected tree was the biggest contributor (SendButton +
 * send progress + receive progress + Inbox + close button,
 * all conditional on a half-dozen pieces of state).
 *
 * Slice 10: the `inFlight` prop was removed — the screens now
 * derive the SendButton's disabled state from `progress !==
 * null` (the two are always in sync; the hook sets them
 * together). The `progress` prop is direction-agnostic
 * (`{ bytes, total }`), matching TransferProgress's prop
 * shape so the call site can pass it through without a
 * transform.
 */
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
  // Slice 11: pending send entries — files shared into the app
  // from the OS share sheet, queued as "ready to send" until
  // the user picks a peer and sends them.
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
    <div className="rounded-lg border p-4" data-testid="connected-state">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Connected</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <p className="mb-2 text-sm">Peer: {peerName ?? "(unknown)"}</p>
      {session ? <SessionTimer session={session} /> : null}

      {/* Slice 11: pending send entries from the share sheet. */}
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
                    // Remove the pending entry — the file is
                    // now in flight via the send progress
                    // flow.  Double-tapping is prevented by
                    // the disabled state on the button.
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
      {/*
        Slice 9: receive-side progress bar + Cancel button. Shown
        when the peer is mid-send. The Cancel button calls
        handleCancelReceive, which calls ReceiveHandle.cancel()
        — the receiver-cancel protocol sends a cancel frame back
        to the sender, which stops the in-flight send. Without
        this, the user has no way to abort an unwanted incoming
        file (the loop owns the handle and the screen had no
        way to reach it). The bar and button are direction-aware
        (data-testid="receive-progress" / "receive-cancel") so
        e2e selectors can target the send and receive UIs
        independently.
      */}
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
        data-testid="close-session"
        onClick={handleClose}
        variant="destructive"
      >
        {wasDisconnected ? "Start over" : "Close session"}
      </Button>
    </div>
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
