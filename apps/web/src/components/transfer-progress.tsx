// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { motion } from "motion/react";

export type TransferDirection = "send" | "receive";

interface TransferProgressProps {
  direction?: TransferDirection;
  onCancel: () => void;
  progress: { bytes: number; total: number };
}

const DIRECTION_PREFIX: Record<TransferDirection, string> = {
  receive: "receive",
  send: "send",
};

const DIRECTION_ARIA_LABEL: Record<TransferDirection, string> = {
  receive: "receive progress",
  send: "send progress",
};

export function TransferProgress({
  direction = "send",
  onCancel,
  progress,
}: TransferProgressProps) {
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.bytes / progress.total) * 100);
  const fillWidth =
    progress.total === 0
      ? 0
      : Math.min(100, (progress.bytes / progress.total) * 100);

  const prefix = DIRECTION_PREFIX[direction];
  const ariaLabel = DIRECTION_ARIA_LABEL[direction];

  return (
    <div data-testid={`${prefix}-progress`}>
      <div
        aria-label={ariaLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        data-testid={`${prefix}-progress-bar`}
        role="progressbar"
      >
        <motion.div
          animate={{ width: `${fillWidth}%` }}
          className="h-full rounded-full bg-primary"
          data-testid={`${prefix}-progress-fill`}
          initial={false}
          style={{ width: `${fillWidth}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p
        className="mt-1 text-muted-foreground text-xs"
        data-testid={`${prefix}-progress-text`}
      >
        {progress.bytes} / {progress.total} bytes ({percent}%)
      </p>
      <Button
        className="mt-2"
        data-testid={`${prefix}-cancel`}
        onClick={onCancel}
        variant="destructive"
      >
        Cancel
      </Button>
    </div>
  );
}
