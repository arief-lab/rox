// Service worker for P2P File Sharing PWA.
// Pre-caches the app shell on install so the app launches and is
// usable offline after the first visit. The NetworkFirst strategy
// for navigation ensures the user always gets the freshest HTML,
// falling back to the cached shell when offline.
//
// Slice 10: issue 10-pwa-shell-manifest-sw-offline.
// Slice 11: issue 11-share-target-integration — handles the
// share_target POST (OS share sheet) by storing the shared file
// in a dedicated cache and redirecting to the share-target page.

const CACHE_NAME = "p2p-share-v1";
const SHARE_CACHE_NAME = "share-target-v1";

// App shell — the minimal set of resources needed to render the
// home page offline. Next.js generates hashed filenames for JS/CSS
// bundles; the build step can expand this list, but for a simple
// PWA the static routes + precached bundles are enough.
const PRECACHE_URLS = [
  "/",
  "/favicon/web-app-manifest-192x192.png",
  "/favicon/web-app-manifest-512x512.png",
];

// --- Install: precache the app shell ---

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Claim clients immediately so the SW controls the page without
  // a reload.
  self.skipWaiting();
});

// --- Activate: clean up old caches ---

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== SHARE_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// --- Fetch: share-target POST handler ---

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Slice 11: intercept the share_target POST from the OS share
  // sheet. Extract the first file (multi-file shares are a
  // known day-1 limitation), store it in a dedicated cache, and
  // redirect to the share-target page with the file ID in the
  // query string so the client component can read it back.
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Only handle GET requests for the standard fetch strategies.
  if (request.method !== "GET") {
    return;
  }

  // Navigation requests: try network first, fall back to cache.
  // This ensures the user gets the latest HTML when online, but
  // still sees the app shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update the cache with the fresh response.
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          // Offline — serve the cached shell.
          return caches
            .match(request)
            .then(
              (cached) => cached ?? new Response("Offline", { status: 503 })
            );
        })
    );
    return;
  }

  // Static assets (JS, CSS, images, fonts): cache-first.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        // Cache successful responses for next time.
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});

// --- Share target: store shared file in cache, redirect to page ---

/**
 * Handle the share_target POST from the OS share sheet.
 *
 * The browser POSTs the shared file as `multipart/form-data` to
 * `/share-target`.  We extract the first file (multi-file shares
 * are a known day-1 limitation — only the first file is kept),
 * store it alongside its metadata in a dedicated cache, and
 * redirect to `/share-target?id=<uuid>` so the client component
 * can read the file back and present it as "ready to send".
 */
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("file");
    if (!files.length) {
      return Response.redirect("/share-target?error=no-file", 303);
    }

    // Day-1 limitation: only the first file is kept.  Multi-file
    // shares are dropped to the first file per the PRD's
    // Out-of-Scope note.
    const file = files[0];
    const fileId = crypto.randomUUID();
    const cache = await caches.open(SHARE_CACHE_NAME);

    // Store the file blob as a Response in the cache.  The
    // client reads it back via `cache.match(key)` and calls
    // `.blob()` on the cached Response.
    await cache.put(
      `file:${fileId}:${encodeURIComponent(file.name)}`,
      new Response(file, {
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "Content-Length": String(file.size),
        },
      })
    );

    // Store metadata so the client knows name, size, type, and
    // (for the multi-file note) the total file count.
    await cache.put(
      `meta:${fileId}`,
      Response.json({
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        count: files.length,
      })
    );

    return Response.redirect(`/share-target?id=${fileId}`, 303);
  } catch {
    // If formData parsing fails (e.g. wrong enctype), redirect
    // with an error param so the page can show a message.
    return Response.redirect("/share-target?error=parse-failed", 303);
  }
}
