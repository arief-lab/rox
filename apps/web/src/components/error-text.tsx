// SPDX-License-Identifier: AGPL-3.0-or-later
import type * as React from "react";

interface ErrorTextProps {
  /** The error message to display. When falsy, nothing is rendered. */
  error: string;
}

/**
 * ErrorText — renders a red error message when `error` is non-empty.
 *
 * Passes through data-testid and other HTML attributes via React.ComponentProps.
 * Defaults data-testid to "error-text" when not explicitly set.
 */
export function ErrorText({
  error,
  ...props
}: ErrorTextProps & React.ComponentProps<"p">) {
  if (!error) {
    return null;
  }
  return (
    <p
      className="mt-2 text-red-500 text-sm"
      data-testid="error-text"
      {...props}
    >
      {error}
    </p>
  );
}
