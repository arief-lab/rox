// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import {
  CardAction,
  CardHeader,
  CardTitle,
} from "@rox-apps/ui/components/card";
import {
  ConnectionStatus,
  type ConnectionStatusKind,
} from "@/components/connection-status";

interface CardHeaderWithStatusProps {
  /** Connection status indicator shown in the Card header action area. */
  connectionStatus: ConnectionStatusKind;
  /** Card title text. */
  title: string;
}

/**
 * Shared Card header pattern: a title on the left and a ConnectionStatus
 * indicator on the right. Used by ConnectedView, OfferingPastingView,
 * ScanningView, and IdleScreen.
 */
export function CardHeaderWithStatus({
  connectionStatus,
  title,
}: CardHeaderWithStatusProps) {
  return (
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardAction>
        <ConnectionStatus status={connectionStatus} />
      </CardAction>
    </CardHeader>
  );
}
