// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import type { ReactNode } from "react";

interface HandshakeLayoutProps {
  className?: string;
  left: ReactNode;
  right: ReactNode;
}

/**
 * Split-screen handshake layout.
 *
 * - Desktop: two columns, left for the hero / device info,
 *   right for the action card (QR, paste, connected state).
 * - Mobile: stacked vertically, with the action card on top so
 *   the user immediately sees what the app does.
 */
export function HandshakeLayout({
  left,
  right,
  className,
}: HandshakeLayoutProps) {
  return (
    <div
      className={`grid min-h-screen w-full grid-cols-1 gap-6 bg-background p-6 lg:grid-cols-2 lg:gap-12 lg:p-12 ${className ?? ""}`}
    >
      <section className="order-2 flex flex-col justify-center lg:order-1">
        {left}
      </section>
      <section className="order-1 flex flex-col justify-center lg:order-2">
        {right}
      </section>
    </div>
  );
}
