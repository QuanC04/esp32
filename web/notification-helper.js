/**
 * Notification Helper Module
 * Manages push notifications for PWA
 */

/**
 * Check if notifications are supported
 * @returns {boolean}
 */
export function isNotificationSupported() {
  return "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Get current notification permission status
 * @returns {NotificationPermission} "granted", "denied", or "default"
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return "denied";
  return Notification.permission;
}

/**
 * Request notification permission from user
 * @returns {Promise<NotificationPermission>}
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    console.warn("[Notification] Not supported in this browser");
    return "denied";
  }

  if (Notification.permission === "granted") {
    console.log("[Notification] Permission already granted");
    return "granted";
  }

  if (Notification.permission === "denied") {
    console.warn("[Notification] Permission denied by user");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    console.log(`[Notification] Permission ${permission}`);
    return permission;
  } catch (error) {
    console.error("[Notification] Error requesting permission:", error);
    return "denied";
  }
}

/**
 * Send a notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {object} options - Additional notification options
 * @returns {Promise<boolean>} True if notification was sent
 */
export async function sendNotification(title, body, options = {}) {
  if (!isNotificationSupported()) {
    console.warn("[Notification] Not supported");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("[Notification] Permission not granted");
    return false;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Default options
    const notificationOptions = {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-96.png",
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: false,
      ...options,
    };

    // Show notification through service worker for better persistence
    await registration.showNotification(title, notificationOptions);

    console.log(`[Notification] Sent: ${title}`);
    return true;
  } catch (error) {
    console.error("[Notification] Error sending notification:", error);
    return false;
  }
}

/**
 * Send danger alert notification
 * @param {string} type - "gas" or "fire"
 * @param {object} data - Alert data (e.g., gas value)
 */
export async function sendDangerAlert(type, data = {}) {
  let title, body, tag;

  if (type === "fire") {
    title = "🔥 PHÁT HIỆN LỬA!";
    body = "Cảm biến phát hiện có lửa! Vui lòng kiểm tra ngay!";
    tag = "fire-alert";
  } else if (type === "gas") {
    title = "⚠️ RÒ RỈ KHÍ GAS!";
    body = `Nồng độ gas: ${data.gas || "N/A"} ppm (Ngưỡng nguy hiểm: 700 ppm)`;
    tag = "gas-alert";
  } else {
    console.warn("[Notification] Unknown danger type:", type);
    return false;
  }

  return await sendNotification(title, body, {
    tag,
    requireInteraction: true,
    urgency: "high",
    data: {
      type,
      timestamp: Date.now(),
      ...data,
    },
  });
}
