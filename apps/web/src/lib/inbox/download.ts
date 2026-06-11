/**
 * Browser-dependent download trigger. Creates a blob URL, clicks a
 * temporary anchor with `download="<filename>"`, then revokes the URL.
 *
 * Lives in its own module so the Inbox store can be tested without
 * DOM dependencies — the store takes a `DownloadFn` and the tests
 * inject a spy.
 */
export type DownloadFn = (blob: Blob, filename: string) => void;

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
