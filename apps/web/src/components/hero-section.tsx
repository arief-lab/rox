// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { DeviceNameEditor } from "@/components/device-name-editor";

interface HeroSectionProps {
  /** Sub-headline directly under the headline explaining
   *  the zero-server, local-only concept (spec §3). Pass
   *  falsy to omit it. */
  subtitle?: string | null;
  /** Headline shown in the middle column area. Spec §3
   *  calls for "Large, tracked-tight typography". */
  title: string;
  /** Optional wordmark shown at the very top of the column
   *  (e.g. "Rox" on the default handshake screen). Pass
   *  falsy to skip rendering without leaving an empty spacer. */
  wordmark?: string | null;
}

/**
 * Left-side hero content for the handshake layout.
 *
 * Combines spec §3 (prose) with §5.1 (layout), top-to-bottom:
 *
 *  ┌────────────────────────────┐
 *  │ Rox                         │ ← wordmark (small, bold)
 *  │                             │
 *  │ Send files directly         │
 *  │ to another device.          │ ← large tracked-tight headline
 *  │                             │
 *  │ No servers, no accounts…     │ ← muted sub-headline (optional)
 *  │                             │
 *  │                             │ ← free space, recentres on desktop
 *  │                             │
 *  │ This device: [Name ▼]       │ ← device-name editor at the bottom
 *  └────────────────────────────┘
 *
 * The free space between the sub-headline and the device name
 * is the spec's "generous whitespace" requirement (§3 Visual
 * Style). The middle block is flex-1 + justify-centre so the
 * headline unit floats in the optical centre on tall
 * viewports and stays grouped on short ones. Device name
 * sits at the bottom via `pt-6` + the parent's flex layout.
 */
export function HeroSection({
  title,
  subtitle,
  wordmark = "Rox",
}: HeroSectionProps) {
  return (
    <div className="flex h-full max-w-md flex-col">
      {wordmark ? (
        <div className="font-bold text-2xl text-foreground tracking-tight lg:text-3xl">
          {wordmark}
        </div>
      ) : (
        <div aria-hidden="true" />
      )}

      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="font-semibold text-4xl text-foreground tracking-tight lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 text-base text-muted-foreground leading-relaxed lg:text-lg">
            {subtitle}
          </p>
        ) : null}
      </div>

      {/*
        suppressHydrationWarning: DeviceNameEditor's `<button>` reads its
        `name` from `localStorage` after mount; the second client render
        differs from the SSR snapshot whenever a real name has been saved.
        React 19's strict hydration reports this on the immediate child
        whose content diverges (the button itself carries a separate flag
        for the same reason). The flag here scopes to the wrapper that
        introduces that one browser-only child into the otherwise static
        HeroSection subtree, so a future regression inside `wordmark` or
        the title block still surfaces as a normal hydration warning.
      */}
      <div className="pt-6" suppressHydrationWarning>
        <DeviceNameEditor />
      </div>
    </div>
  );
}
