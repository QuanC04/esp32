/**
 * Service Worker Registration
 * Registers the service worker for PWA functionality
 */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        "/service-worker.js",
        {
          scope: "/",
        }
      );

      console.log(
        "[PWA] Service Worker registered successfully:",
        registration.scope
      );

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New service worker available
            console.log("[PWA] New version available! Refresh to update.");

            // Optionally, show a notification to the user
            if (confirm("New version available! Reload to update?")) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }
          }
        });
      });

      // Reload page when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error);
    }
  });
} else {
  console.warn("[PWA] Service Workers are not supported in this browser");
}
