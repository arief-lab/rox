/**
 * Browser-dependent download trigger. Creates a blob URL, clicks a
 * temporary anchor with `download="<filename>"`, then revokes the URL.
 *
 * Lives in its own module so the Inbox store can be tested without
 * DOM dependencies — the store takes a `DownloadFn` and the tests
 * inject a spy.
 *
 * URL revocation is deferred via setTimeout so the blob stays
 * alive until the browser has started the async download.
 * Without the defer, saveAll's synchronous loop revokes blob URL
 * 1 before the browser has started download 1, causing it to
 * silently fail or capture the wrong blob's data.
 *
 * The anchor stays in the DOM until the download completes (the
 * browser needs it to be present to start the download).  Headless
 * Chromium downloads the wrong file when two download anchors
 * coexist in the same event-loop tick — the caller must yield
 * between successive save() calls (see handleSaveSelected).
 */
export type DownloadFn = (blob: Blob, filename: string) => void;

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  // Defer URL revocation — the blob must stay alive until the
  // browser has started the download.
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 100);
}
