// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { useEffect } from "react";

interface ImpeccableLiveLoaderProps {
  port: number;
  token: string;
}

/**
 * Carrier for the Impeccable live-mode helper script. Render an
 * instance of this inside the `impeccable-live-start` /
 * `impeccable-live-end` marker block in
 * `apps/web/src/app/layout.tsx`. It mounts the helper script via
 * `document.head` so React Server Components never emit a raw
 * script tag (which React 19 forbids in JSX).
 *
 * Future live restarts will re-write the marker block in
 * `layout.tsx` with a literal script tag and reintroduce the
 * React 19 console error. Restore by:
 *
 *   1. Replace the literal script tag with
 *      `<ImpeccableLiveLoader port={N} token="…" />`.
 *   2. Add the import to `layout.tsx`:
 *      `import { ImpeccableLiveLoader } from
 *       "@/components/impeccable-live-loader";`
 *   3. Remove any residual `import Script from "next/script"`.
 *
 * Behavioral notes:
 *   - The effect dedup-checks `document.head` for an existing
 *     script with the same `data-impeccable-live-src` attribute,
 *     so React Strict-Mode double-mount and repeated live restarts
 *     don't accumulate duplicate helper scripts.
 *   - Cleanup uses `parentNode?.removeChild(...)` so an externally
 *     removed script (e.g., `live-inject.mjs --remove`) doesn't
 *     raise `NotFoundError` in dev or production.
 */
export function ImpeccableLiveLoader({
  port,
  token,
}: ImpeccableLiveLoaderProps) {
  useEffect(() => {
    const src = `http://localhost:${port}/live.js?token=${token}`;
    const selector = `script[data-impeccable-live-src="${CSS.escape(src)}"]`;
    if (document.querySelector(selector)) {
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.setAttribute("data-impeccable-live-src", src);
    document.head.appendChild(s);
    return () => {
      s.parentNode?.removeChild(s);
    };
  }, [port, token]);
  return null;
}
