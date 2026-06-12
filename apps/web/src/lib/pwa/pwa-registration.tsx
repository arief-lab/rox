// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "./register-sw";

/**
 * Client component that registers the service worker on mount.
 * Renders nothing — the SW runs in the background.
 *
 * Slice 10: issue 10-pwa-shell-manifest-sw-offline.
 */
export function PwaRegistration() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
