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

      // Check for updates frequently (every 10 seconds)
      setInterval(() => {
        console.log("[PWA] Checking for updates...");
        registration.update();
      }, 10000); // Check every 10 seconds

      // Handle service worker updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("[PWA] New service worker found, installing...");

        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            // New service worker available
            console.log("[PWA] New version installed!");
            showUpdateNotification(newWorker);
          }
        });
      });

      // Reload page when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          console.log("[PWA] New service worker activated, reloading page...");
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

// Show a non-intrusive update notification
function showUpdateNotification(newWorker) {
  // Create notification element
  const notification = document.createElement("div");
  notification.id = "pwa-update-notification";
  notification.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 350px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="font-weight: 600; margin-bottom: 8px; font-size: 16px;">
        🎉 New Version Available!
      </div>
      <div style="font-size: 14px; margin-bottom: 12px; opacity: 0.9;">
        A new version of the app is ready. Update now for the latest features and fixes.
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="pwa-update-btn" style="
          flex: 1;
          background: white;
          color: #667eea;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          transition: transform 0.2s;
        ">
          Update Now
        </button>
        <button id="pwa-dismiss-btn" style="
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          transition: transform 0.2s;
        ">
          Later
        </button>
      </div>
    </div>
    <style>
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      #pwa-update-btn:hover, #pwa-dismiss-btn:hover {
        transform: scale(1.05);
      }
    </style>
  `;

  document.body.appendChild(notification);

  // Update button click handler
  document.getElementById("pwa-update-btn").addEventListener("click", () => {
    console.log("[PWA] User clicked update, activating new service worker...");
    newWorker.postMessage({ type: "SKIP_WAITING" });
    notification.remove();
  });

  // Dismiss button click handler
  document.getElementById("pwa-dismiss-btn").addEventListener("click", () => {
    console.log("[PWA] User dismissed update notification");
    notification.remove();
  });
}
