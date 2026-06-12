// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { Transport } from "@/lib/webrtc";

/**
 * ConnectionStatus — the slice 8 header indicator.
 *
 * Shows a colored dot + short label for the current WebRTC peer
 * connection state, derived by the parent from `transport.state`
 * and a `wasDisconnected` flag. Three states:
 *
 * - "connecting" (yellow): during pairing (offer/scan/paste) and
 *   while the DataChannel is still negotiating. The user knows
 *   the app is doing something but the peer isn't fully wired up
 *   yet.
 * - "connected" (green): the DataChannel is open and both sides
 *   can send/receive files. The default state of an active
 *   Session.
 * - "disconnected" (red): the Session ended (idle timeout, page
 *   hidden, peer disconnect, user close). The screen stays
 *   mounted briefly so the user sees WHY the session ended
 *   before falling back to the idle screen.
 *
 * The dot is `aria-hidden` (decorative) — the visible label is
 * the accessible name, surfaced via the parent screen's
 * `aria-live` region (or simply read by the user directly).
 */
export type ConnectionStatusKind = "connecting" | "connected" | "disconnected";

interface ConnectionStatusProps {
  status: ConnectionStatusKind;
}

const STATUS_CONFIG: Record<
  ConnectionStatusKind,
  { color: string; label: string }
> = {
  connecting: { color: "bg-yellow-500", label: "Connecting..." },
  connected: { color: "bg-green-500", label: "Connected" },
  disconnected: { color: "bg-red-500", label: "Disconnected" },
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const config = STATUS_CONFIG[status];
  return (
    <div
      className="flex items-center gap-2"
      data-status={status}
      data-testid="connection-status"
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${config.color}`}
      />
      <span className="text-sm" data-testid="connection-status-text">
        {config.label}
      </span>
    </div>
  );
}

/**
 * Map the Transport's actual state + the screen's wasDisconnected
 * flag to the user-facing ConnectionStatusKind. Extracted from
 * the screens so both PairingScreen and AnswererScreen share the
 * same mapping (and the next screen to need it just imports this
 * helper instead of re-deriving the nested ternary).
 *
 * Mapping:
 * - wasDisconnected (Session ended, screen kept mounted for the
 *   "Start over" flow) → "disconnected"
 * - transport === null (pairing in progress, pre-DataChannel) →
 *   "connecting"
 * - transport.state === "open" (DataChannel ready) → "connected"
 * - transport.state === "connecting" (DataChannel negotiating) →
 *   "connecting"
 * - transport.state === "closing" | "closed" → "disconnected"
 */
export function deriveConnectionStatus(
  transport: Transport | null,
  wasDisconnected: boolean
): ConnectionStatusKind {
  if (wasDisconnected) {
    return "disconnected";
  }
  if (transport === null) {
    return "connecting";
  }
  if (transport.state === "open") {
    return "connected";
  }
  if (transport.state === "connecting") {
    return "connecting";
  }
  return "disconnected";
}
