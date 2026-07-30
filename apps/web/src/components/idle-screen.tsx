// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Card, CardContent } from "@rox-apps/ui/components/card";
import type { ReactNode } from "react";
import { CardHeaderWithStatus } from "@/components/card-header-with-status";
import type { ConnectionStatusKind } from "@/components/connection-status";
import { ErrorText } from "@/components/error-text";

interface IdleScreenProps {
  children?: ReactNode;
  connectionStatus: ConnectionStatusKind;
  dataTestId: string;
  description: string;
  error: string;
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
        <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
          {description}
        </p>
        <div className="flex flex-col items-start gap-3">{children}</div>
        <ErrorText error={error} />
      </CardContent>
    </Card>
  );
}
