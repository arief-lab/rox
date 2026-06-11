"use client";

import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";
import { InboxScreen } from "@/components/inbox-screen";
import { SendButton } from "@/components/send-button";
import { SessionTimer } from "@/components/session-timer";
import { TransferProgress } from "@/components/transfer-progress";
import type { Inbox } from "@/lib/inbox";
import type { SendHandle } from "@/lib/transfer";
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
 */
interface ConnectedViewProps {
  connectionStatus: ConnectionStatusKind;
  handleCancelReceive: () => void;
  handleCancelSend: () => void;
  handleClose: () => void;
  handleSend: (file: File) => Promise<void>;
  inbox: Inbox;
  inFlight: SendHandle | null;
  peerName: string | undefined;
  progress: { bytesSent: number; total: number } | null;
  receiveProgress: { bytesReceived: number; total: number } | null;
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
  inFlight,
  peerName,
  progress,
  receiveProgress,
  sendLog,
  session,
  wasDisconnected,
}: ConnectedViewProps) {
  return (
    <div className="rounded-lg border p-4" data-testid="connected-state">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Connected</h2>
        <ConnectionStatus status={connectionStatus} />
      </div>
      <p className="mb-2 text-sm">Peer: {peerName ?? "(unknown)"}</p>
      {session ? <SessionTimer session={session} /> : null}
      <div className="mb-4" data-testid="send-section">
        <SendButton
          disabled={inFlight !== null || wasDisconnected}
          onSend={handleSend}
        />
        {progress ? (
          <TransferProgress
            onCancel={handleCancelSend}
            progress={{
              bytes: progress.bytesSent,
              total: progress.total,
            }}
          />
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
      <div className="mb-4" data-testid="receive-section">
        {receiveProgress ? (
          <TransferProgress
            direction="receive"
            onCancel={handleCancelReceive}
            progress={{
              bytes: receiveProgress.bytesReceived,
              total: receiveProgress.total,
            }}
          />
        ) : null}
      </div>
      <InboxScreen inbox={inbox} />
      <button
        className="rounded bg-red-500 px-4 py-2 text-white"
        data-testid="close-session"
        onClick={handleClose}
        type="button"
      >
        {wasDisconnected ? "Start over" : "Close session"}
      </button>
    </div>
  );
}
