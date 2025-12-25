/**
 * ESP32 Control Panel - Service Worker
 * Handles offline caching and PWA functionality
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `esp32-panel-${CACHE_VERSION}`;

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/devices.html",
  "/index.css",
  "/app.js",
  "/auth.js",
  "/device-manager.js",
  "/firebase-config.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Caching static assets");
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log("[Service Worker] Installation complete");
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error("[Service Worker] Installation failed:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(
              (name) => name.startsWith("esp32-panel-") && name !== CACHE_NAME
            )
            .map((name) => {
              console.log("[Service Worker] Deleting old cache:", name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log("[Service Worker] Activation complete");
        return self.clients.claim(); // Take control immediately
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip external requests (MQTT, Firebase, fonts, etc.)
  if (!url.origin.includes(self.location.origin)) {
    // Network-only for external resources
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log("[Service Worker] Serving from cache:", request.url);
        return cachedResponse;
      }

      // Not in cache, fetch from network
      console.log("[Service Worker] Fetching from network:", request.url);
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (
            !response ||
            response.status !== 200 ||
            response.type === "error"
          ) {
            return response;
          }

          // Clone the response (can only be consumed once)
          const responseToCache = response.clone();

          // Cache the new resource
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return response;
        })
        .catch((error) => {
          console.error("[Service Worker] Fetch failed:", error);

          // Offline fallback for HTML pages
          if (request.headers.get("accept").includes("text/html")) {
            return caches.match("/index.html");
          }

          throw error;
        });
    })
  );
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
