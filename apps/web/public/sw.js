// Service worker for P2P File Sharing PWA.
// Pre-caches the app shell on install so the app launches and is
// usable offline after the first visit. The NetworkFirst strategy
// for navigation ensures the user always gets the freshest HTML,
// falling back to the cached shell when offline.
//
// Slice 10: issue 10-pwa-shell-manifest-sw-offline.

const CACHE_NAME = "p2p-share-v1";

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
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// --- Fetch: network-first for navigation, cache-first for assets ---

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests.
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
