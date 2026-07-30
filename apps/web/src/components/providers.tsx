// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Toaster } from "@rox-apps/ui/components/sonner";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors />
    </>
  );
}
