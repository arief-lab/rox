"use client";

import { Card, CardContent } from "@rox-apps/ui/components/card";
import type { ReactNode } from "react";
import { CardHeaderWithStatus } from "@/components/card-header-with-status";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

/**
 * Shared idle screen layout used by both the pairing (offerer) and
 * answerer idle views. Provides the Card shell, title, connection
 * status indicator, description paragraph, error text, and a
 * children slot for the screen-specific action content.
 */
interface IdleScreenProps {
  /** Screen-specific action content (buttons, textareas, etc.). */
  children?: ReactNode;
  /** Connection status indicator shown in the Card header. */
  connectionStatus: ConnectionStatusKind;
  /** Data-testid on the root Card element. */
  dataTestId: string;
  /** Description paragraph shown above the children. */
  description: string;
  /** Error text to display. Renders nothing when empty. */
  error: string;
  /** Card title (e.g. "Receive a file" or "Send a file"). */
  title: string;
}

export function IdleScreen({
  connectionStatus,
  dataTestId,
  description,
  error,
  title,
  children,
}: IdleScreenProps) {
  return (
    <Card data-testid={dataTestId}>
      <CardHeaderWithStatus connectionStatus={connectionStatus} title={title} />
      <CardContent>
        <p className="mb-2 text-gray-500 text-sm">{description}</p>
        {children}
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
