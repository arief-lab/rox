// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import Link from "next/link";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header className="border-border border-b bg-card/50 backdrop-blur-sm">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <Link
          className="font-semibold text-lg tracking-tight hover:text-primary"
          href="/"
        >
          Rox
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
