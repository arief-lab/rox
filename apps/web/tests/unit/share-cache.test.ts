import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearSharedCache, readSharedFile } from "@/lib/pwa/share-cache";

const CACHE_NAME = "share-target-v1";

/**
 * In-memory cache store — maps cache names to Maps of key → Response stub.
 * Wiped in beforeEach so tests start fresh.
 */
const cacheStore = new Map<string, Map<string, MockResponse>>();

interface MockResponse {
  blob: () => Promise<Blob>;
  json: () => Promise<Record<string, unknown>>;
}

/** Factory for a single-cache view backed by an in-memory Map. */
function createMockCache(name: string) {
  let entries = cacheStore.get(name);
  if (!entries) {
    entries = new Map();
    cacheStore.set(name, entries);
  }
  return {
    add: vi.fn(),
    addAll: vi.fn(),
    delete: vi.fn(),
    keys: vi.fn(),
    match: vi.fn((key: string) => entries?.get(key) ?? null),
    put: vi.fn(),
  };
}

beforeEach(() => {
  cacheStore.clear();
  vi.stubGlobal("caches", {
    open: vi.fn(async (name: string) => createMockCache(name)),
    delete: vi.fn(async (name: string) => cacheStore.delete(name)),
    has: vi.fn(),
    keys: vi.fn(),
    match: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Seed the in-memory cache with metadata and file entries for a given id.
 *  Creates the cache Map if it doesn't exist yet (called before the module
 *  opens the cache via caches.open). */
function seedCache(
  id: string,
  meta: { name: string; size: number; type: string; count: number },
  fileBlob: Blob
): void {
  let cache = cacheStore.get(CACHE_NAME);
  if (!cache) {
    cache = new Map();
    cacheStore.set(CACHE_NAME, cache);
  }
  cache.set(`meta-${id}`, {
    json: async () => meta,
    blob: async () => new Blob([JSON.stringify(meta)]),
  });
  cache.set(`file-${id}-${encodeURIComponent(meta.name)}`, {
    json: async () => ({}),
    blob: async () => fileBlob,
  });
}

describe("readSharedFile", () => {
  it("returns null when id is null", async () => {
    const result = await readSharedFile(null);
    expect(result).toBeNull();
  });

  it("returns null when id is an empty string", async () => {
    const result = await readSharedFile("");
    expect(result).toBeNull();
  });

  it("returns null when caches is undefined", async () => {
    vi.stubGlobal("caches", undefined);
    const result = await readSharedFile("some-id");
    expect(result).toBeNull();
  });

  it("returns null when metadata entry does not exist in the cache", async () => {
    const result = await readSharedFile("missing-meta");
    expect(result).toBeNull();
  });

  it("returns null when file entry does not exist (stale metadata)", async () => {
    // Seed only the metadata, not the file.
    const cache = cacheStore.get(CACHE_NAME);
    if (cache) {
      cache.set("meta-stale-id", {
        json: async () => ({
          name: "ghost.txt",
          size: 100,
          type: "text/plain",
          count: 1,
        }),
        blob: async () => new Blob(),
      });
    }
    const result = await readSharedFile("stale-id");
    expect(result).toBeNull();
  });

  it("returns a SharedFile when both metadata and file exist", async () => {
    const id = "file-abc";
    const meta = {
      name: "photo.jpg",
      size: 12_345,
      type: "image/jpeg",
      count: 1,
    };
    const fileBlob = new Blob(["fake image data"], { type: "image/jpeg" });
    seedCache(id, meta, fileBlob);

    const result = await readSharedFile(id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(id);
    expect(result?.name).toBe("photo.jpg");
    expect(result?.size).toBe(12_345);
    expect(result?.type).toBe("image/jpeg");
    expect(result?.fileCount).toBe(1);
    // The blob content must match.
    const resultText = await result?.blob.text();
    expect(resultText).toBe("fake image data");
  });

  it("reads a file with special characters in the name", async () => {
    const id = "unicode-file";
    const meta = {
      name: "文件 🚀.txt",
      size: 42,
      type: "text/plain",
      count: 1,
    };
    const fileBlob = new Blob(["hello 世界"], { type: "text/plain" });
    seedCache(id, meta, fileBlob);

    const result = await readSharedFile(id);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("文件 🚀.txt");
    expect(result?.size).toBe(42);
    const text = await result?.blob.text();
    expect(text).toBe("hello 世界");
  });

  it("reads a file with multi-file share (count > 1)", async () => {
    const id = "multi-file";
    const meta = {
      name: "first.bin",
      size: 256,
      type: "application/octet-stream",
      count: 3,
    };
    const fileBlob = new Blob([new Uint8Array(256)]);
    seedCache(id, meta, fileBlob);

    const result = await readSharedFile(id);

    expect(result).not.toBeNull();
    expect(result?.fileCount).toBe(3);
    expect(result?.name).toBe("first.bin");
  });

  it("caches.open is called with the correct cache name", async () => {
    const id = "verify-cache-name";
    const meta = { name: "test.txt", size: 10, type: "text/plain", count: 1 };
    const fileBlob = new Blob(["data"]);
    seedCache(id, meta, fileBlob);

    await readSharedFile(id);

    expect(caches.open).toHaveBeenCalledWith(CACHE_NAME);
  });
});

describe("clearSharedCache", () => {
  it("deletes the share-target cache", async () => {
    // Prime a cache entry via seedCache so we can verify deletion.
    seedCache(
      "x",
      { name: "x.txt", size: 1, type: "text/plain", count: 1 },
      new Blob()
    );

    expect(cacheStore.has(CACHE_NAME)).toBe(true);
    await clearSharedCache();
    expect(cacheStore.has(CACHE_NAME)).toBe(false);
  });

  it("is a no-op when caches is undefined", async () => {
    vi.stubGlobal("caches", undefined);
    // Should not throw.
    await expect(clearSharedCache()).resolves.toBeUndefined();
  });

  it("calls caches.delete with the correct cache name", async () => {
    await clearSharedCache();
    expect(caches.delete).toHaveBeenCalledWith(CACHE_NAME);
  });
});
