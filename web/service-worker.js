/**
 * ESP32 Control Panel - Service Worker
 * Handles offline caching and PWA functionality with network-first strategy
 */

// Dynamic cache versioning - update this timestamp to force cache refresh
const CACHE_VERSION = "v2";
const BUILD_TIME = new Date().getTime(); // This creates a unique cache on each service worker update
const CACHE_NAME = `esp32-panel-${CACHE_VERSION}-${BUILD_TIME}`;

// Files that should use network-first strategy (always fetch latest)
const NETWORK_FIRST_URLS = [
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
  "/notification-helper.js",
  "/sw-register.js",
];

// Files that can use cache-first strategy (static assets)
const CACHE_FIRST_URLS = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing with cache:", CACHE_NAME);

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Pre-caching static assets");
        // Pre-cache only truly static assets
        return cache.addAll(CACHE_FIRST_URLS);
      })
      .then(() => {
        console.log(
          "[Service Worker] Installation complete - forcing activation"
        );
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error("[Service Worker] Installation failed:", error);
      })
  );
});

// Activate event - clean up old caches and take control
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
        console.log("[Service Worker] Activation complete - taking control");
        return self.clients.claim(); // Take control of all clients immediately
      })
  );
});

// Network-first fetch strategy
async function networkFirst(request) {
  try {
    console.log("[Service Worker] Network-first fetch:", request.url);
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("[Service Worker] Network failed, trying cache:", request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Offline fallback for HTML pages
    if (request.headers.get("accept")?.includes("text/html")) {
      const fallback = await caches.match("/index.html");
      if (fallback) return fallback;
    }

    throw error;
  }
}

// Cache-first fetch strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    console.log("[Service Worker] Cache hit:", request.url);
    return cachedResponse;
  }

  console.log("[Service Worker] Cache miss, fetching:", request.url);
  const networkResponse = await fetch(request);

  if (networkResponse && networkResponse.status === 200) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
  }

  return networkResponse;
}

// Fetch event - use appropriate strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip external requests (Firebase, MQTT, etc.)
  if (!url.origin.includes(self.location.origin)) {
    event.respondWith(fetch(request));
    return;
  }

  // Determine which strategy to use
  const pathname = url.pathname;
  const isNetworkFirst = NETWORK_FIRST_URLS.some(
    (path) => pathname === path || pathname.endsWith(path)
  );

  if (isNetworkFirst) {
    // Use network-first for app files to ensure updates
    event.respondWith(networkFirst(request));
  } else {
    // Use cache-first for truly static assets
    event.respondWith(cacheFirst(request));
  }
});

// Handle messages from clients
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[Service Worker] Received SKIP_WAITING message");
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CLEAR_CACHE") {
    console.log("[Service Worker] Clearing all caches");
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name.startsWith("esp32-panel-")) {
              return caches.delete(name);
            }
          })
        );
      })
    );
  }
});

// =====================================================
// Notification Handlers
// =====================================================

// Handle notification click - open the app
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked:", event.notification.tag);

  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }

        // Otherwise, open new window
        if (clients.openWindow) {
          return clients.openWindow("/");
        }
      })
  );
});

// Handle notification close
self.addEventListener("notificationclose", (event) => {
  console.log("[Service Worker] Notification closed:", event.notification.tag);
});
