"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { readSharedFile, type SharedFile } from "@/lib/pwa/share-cache";

/**
 * ShareTargetPage — receives a file shared from the OS share
 * sheet (Photos, Files, WhatsApp, Mail, etc.) and presents it as
 * "ready to send".
 *
 * Flow:
 * 1. OS share sheet POSTs the file to the SW → SW stores in cache
 *    → SW redirects to `/share-target?id=<uuid>`
 * 2. This component reads the `id` from the URL search params
 * 3. Fetches the file from the share-target cache
 * 4. Renders the file's name / size / type with a "Ready to send"
 *    badge and a "Send this file" button
 * 5. Clicking "Send this file" navigates to the home page with
 *    the file ID, where the main page reads it from cache and
 *    pushes it to the Inbox as a PendingEntry
 *
 * Edge cases:
 * - No `id` in URL (direct navigation): "No file shared" message
 * - Cache miss: "Shared file expired" message
 * - Multi-file share: note that only the first file was accepted
 *
 * Slice 11: issue 11-share-target-integration.
 */
/**
 * Read search params from `window.location` directly instead of
 * using `useSearchParams()`.  Next.js 15's `useSearchParams` hook
 * requires a Suspense boundary on the page; reading
 * `window.location.search` avoids the warning and is consistent
 * with how `page.tsx` handles the share-target pending param.
 */
function getShareParams(): { id: string | null; error: string | null } {
  if (typeof window === "undefined") {
    return { id: null, error: null };
  }
  const params = new URLSearchParams(window.location.search);
  return { id: params.get("id"), error: params.get("error") };
}

export default function ShareTargetPage() {
  const { id, error: errorParam } = getShareParams();

  const [sharedFile, setSharedFile] = useState<SharedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [cacheError, setCacheError] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    readSharedFile(id).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (result) {
        setSharedFile(result);
      } else {
        setCacheError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Direct navigation — no share in progress.
  if (!(id || errorParam)) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-2 text-gray-500 text-sm" data-testid="share-no-file">
          No file shared. Open this app from the share sheet in another app
          (Photos, Files, etc.) to send a file.
        </p>
        <Link
          className="text-blue-500 text-sm underline"
          data-testid="share-go-home"
          href="/"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  // Error path — SW couldn't parse the form data or no file was
  // included in the share.
  if (errorParam) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-2 text-red-600 text-sm" data-testid="share-error">
          {errorParam === "no-file"
            ? "No file was included in the share."
            : "Could not read the shared file. Please try again."}
        </p>
        <Link
          className="text-blue-500 text-sm underline"
          data-testid="share-retry"
          href="/"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  // Loading — reading the file from cache.
  if (loading) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-gray-500 text-sm" data-testid="share-loading">
          Reading shared file…
        </p>
      </div>
    );
  }

  // Cache miss — the file was in the cache when the SW redirected
  // but has since been evicted.
  if (cacheError || !sharedFile) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-2 text-red-600 text-sm" data-testid="share-expired">
          Shared file expired. Please share again from the source app.
        </p>
        <Link
          className="text-blue-500 text-sm underline"
          data-testid="share-go-home-expired"
          href="/"
        >
          ← Back to home
        </Link>
      </div>
    );
  }

  // Happy path — file ready to send.
  const isMultiFile = sharedFile.fileCount > 1;

  return (
    <div
      className="container mx-auto max-w-md px-4 py-16"
      data-testid="share-ready"
    >
      <h1 className="mb-6 font-bold text-xl">Ready to send</h1>

      {/* File card */}
      <div
        className="mb-6 rounded-lg border bg-white p-4 shadow-sm"
        data-testid="share-file-card"
      >
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="font-medium text-sm" data-testid="share-file-name">
              {sharedFile.name}
            </p>
            <p className="text-gray-500 text-xs" data-testid="share-file-size">
              {formatSize(sharedFile.size)}
              {" · "}
              {sharedFile.type || "unknown type"}
            </p>
          </div>
          <span
            className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-700 text-xs"
            data-testid="share-ready-badge"
          >
            Ready
          </span>
        </div>
      </div>

      {/* Multi-file note — day-1 limitation per PRD out-of-scope */}
      {isMultiFile ? (
        <p
          className="mb-4 text-amber-600 text-xs"
          data-testid="share-multi-note"
        >
          {sharedFile.fileCount} files were shared; only the first file (
          {sharedFile.name}) was accepted. Multi-file share support is planned
          for a future update.
        </p>
      ) : null}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          className="inline-block rounded bg-blue-500 px-6 py-3 text-center text-white"
          data-testid="share-send-button"
          href={`/?role=answerer&pending=${encodeURIComponent(sharedFile.id)}`}
        >
          Send this file
        </Link>
        <Link
          className="inline-block rounded bg-gray-200 px-6 py-3 text-center text-gray-700 text-sm"
          data-testid="share-cancel-button"
          href="/"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
