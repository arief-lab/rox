// SPDX-License-Identifier: AGPL-3.0-or-later
"use client";

import { Button } from "@rox-apps/ui/components/button";
import { Card, CardContent } from "@rox-apps/ui/components/card";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { readSharedFile, type SharedFile } from "@/lib/pwa/share-cache";

export default function ShareTargetPage() {
  return (
    <Suspense fallback={<ShareTargetLoading />}>
      <ShareTargetContent />
    </Suspense>
  );
}

function ShareTargetContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const errorParam = searchParams.get("error");

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

  if (!(id || errorParam)) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p
          className="mb-4 text-muted-foreground text-sm"
          data-testid="share-no-file"
        >
          No file shared. Open this app from the share sheet in another app
          (Photos, Files, etc.) to send a file.
        </p>
        <Button asChild data-testid="share-go-home" variant="outline">
          <Link href="/">← Back to home</Link>
        </Button>
      </div>
    );
  }

  if (errorParam) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-destructive text-sm" data-testid="share-error">
          {errorParam === "no-file"
            ? "No file was included in the share."
            : "Could not read the shared file. Please try again."}
        </p>
        <Button asChild data-testid="share-retry" variant="outline">
          <Link href="/">← Back to home</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <ShareTargetLoading />;
  }

  if (cacheError || !sharedFile) {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <p
          className="mb-4 text-destructive text-sm"
          data-testid="share-expired"
        >
          Shared file expired. Please share again from the source app.
        </p>
        <Button asChild data-testid="share-go-home-expired" variant="outline">
          <Link href="/">← Back to home</Link>
        </Button>
      </div>
    );
  }

  const isMultiFile = sharedFile.fileCount > 1;

  return (
    <div
      className="container mx-auto max-w-md px-4 py-16"
      data-testid="share-ready"
    >
      <h1 className="mb-6 font-bold text-2xl">Ready to send</h1>

      <Card className="mb-6">
        <CardContent className="flex items-start justify-between gap-4 py-5">
          <div>
            <p className="font-medium text-sm" data-testid="share-file-name">
              {sharedFile.name}
            </p>
            <p
              className="text-muted-foreground text-xs"
              data-testid="share-file-size"
            >
              {formatSize(sharedFile.size)}
              {" · "}
              {sharedFile.type || "unknown type"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success text-xs"
            data-testid="share-ready-badge"
          >
            Ready
          </span>
        </CardContent>
      </Card>

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

      <div className="flex gap-3">
        <Button asChild data-testid="share-send-button">
          <Link
            href={`/?role=answerer&pending=${encodeURIComponent(sharedFile.id)}`}
          >
            Send this file
          </Link>
        </Button>
        <Button asChild data-testid="share-cancel-button" variant="secondary">
          <Link href="/">Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

function ShareTargetLoading() {
  return (
    <div className="container mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-muted-foreground text-sm" data-testid="share-loading">
        Reading shared file…
      </p>
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
