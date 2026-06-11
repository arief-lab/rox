/**
 * Share cache — reads shared files stored by the service worker's
 * share-target POST handler.
 *
 * The SW intercepts a share-target POST (triggered by the OS share
 * sheet), extracts the file, and stores it in a dedicated cache
 * (`share-target-v1`).  The share-target page then reads the file
 * from this cache using the ID passed in the redirect URL query.
 *
 * Slice 11: issue 11-share-target-integration.
 */

const CACHE_NAME = "share-target-v1";

export interface SharedFile {
  blob: Blob;
  /** Number of files in the original share (1 for single-file). */
  fileCount: number;
  id: string;
  name: string;
  size: number;
  type: string;
}

/** Cache key helpers — must match the keys the SW writes. */
function fileKey(id: string, name: string): string {
  return `file:${id}:${encodeURIComponent(name)}`;
}
function metaKey(id: string): string {
  return `meta:${id}`;
}

/**
 * Read a shared file and its metadata from the share-target cache.
 *
 * Returns `null` when:
 * - The `id` is not in the URL (user navigated directly to /share-target)
 * - The cache doesn't contain the entry (expired or never written)
 * - The entry is stale (metadata exists but file doesn't)
 *
 * Call this from a client component (`useEffect`) — `caches` is
 * available in the window context in modern browsers.
 */
export async function readSharedFile(
  id: string | null
): Promise<SharedFile | null> {
  if (!id || typeof caches === "undefined") {
    return null;
  }
  const cache = await caches.open(CACHE_NAME);

  // Read metadata first so we know the file name.
  const metaRes = await cache.match(metaKey(id));
  if (!metaRes) {
    return null;
  }
  const meta: { name: string; size: number; type: string; count: number } =
    await metaRes.json();

  const key = fileKey(id, meta.name);
  const fileRes = await cache.match(key);
  if (!fileRes) {
    return null;
  }
  const blob = await fileRes.blob();
  return {
    blob,
    id,
    name: meta.name,
    size: meta.size,
    type: meta.type,
    fileCount: meta.count,
  };
}

/**
 * Wipe the share-target cache. Call this when discarding a pending
 * file or starting a new session so stale shares don't reappear.
 */
export async function clearSharedCache(): Promise<void> {
  if (typeof caches === "undefined") {
    return;
  }
  await caches.delete(CACHE_NAME);
}
