/**
 * Push Manager Module
 * Handles FCM token registration and push notification setup
 */

import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import {
  doc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app, db, auth } from "./firebase-config.js";

// VAPID Key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
const VAPID_KEY =
  "BOPoZeuqiH7v0JMF1fXUKasTIO4T2Ns-dK9xZ8AACz9j8XUST9u-9ApgQKBNgFCvYaA_5XhUAevYFeJb26vpoD8";

let messaging = null;
let fcmToken = null;

/**
 * Initialize Firebase Messaging
 * @returns {object|null} Firebase Messaging instance
 */
function initMessaging() {
  if (messaging) return messaging;

  try {
    messaging = getMessaging(app);
    console.log("[Push] Firebase Messaging initialized");
    return messaging;
  } catch (error) {
    console.warn(
      "[Push] Could not initialize Firebase Messaging:",
      error.message
    );
    return null;
  }
}

/**
 * Check if push notifications are supported
 * @returns {boolean}
 */
export function isPushSupported() {
  return (
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/**
 * Request notification permission
 * @returns {Promise<NotificationPermission>}
 */
export async function requestPushPermission() {
  if (!isPushSupported()) {
    console.warn("[Push] Push notifications not supported");
    return "denied";
  }

  if (Notification.permission === "granted") {
    console.log("[Push] Permission already granted");
    return "granted";
  }

  if (Notification.permission === "denied") {
    console.warn("[Push] Permission denied by user");
    return "denied";
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("[Push] Permission:", permission);
    return permission;
  } catch (error) {
    console.error("[Push] Error requesting permission:", error);
    return "denied";
  }
}

/**
 * Get FCM token and save to Firestore
 * @param {string} userId - Current user's ID
 * @returns {Promise<string|null>} FCM token
 */
export async function registerFCMToken(userId) {
  if (!userId) {
    console.warn("[Push] No user ID provided");
    return null;
  }

  const permission = await requestPushPermission();
  if (permission !== "granted") {
    console.warn("[Push] Cannot register token without permission");
    return null;
  }

  const msg = initMessaging();
  if (!msg) {
    console.warn("[Push] Messaging not initialized");
    return null;
  }

  try {
    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // Get FCM token
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      fcmToken = token;
      console.log("[Push] FCM Token obtained:", token.substring(0, 20) + "...");

      // Save token to Firestore
      await saveTokenToFirestore(userId, token);
      return token;
    } else {
      console.warn("[Push] No token received");
      return null;
    }
  } catch (error) {
    console.error("[Push] Error getting FCM token:", error);
    return null;
  }
}

/**
 * Save FCM token to Firestore
 * @param {string} userId - User's ID
 * @param {string} token - FCM token
 */
async function saveTokenToFirestore(userId, token) {
  try {
    await setDoc(doc(db, "fcm_tokens", userId), {
      token,
      userId,
      platform: "web",
      userAgent: navigator.userAgent,
      updatedAt: serverTimestamp(),
    });
    console.log("[Push] Token saved to Firestore");
  } catch (error) {
    console.error("[Push] Error saving token:", error);
  }
}

/**
 * Listen for foreground messages
 * @param {function} callback - Called when message received
 */
export function onForegroundMessage(callback) {
  const msg = initMessaging();
  if (!msg) return;

  onMessage(msg, (payload) => {
    console.log("[Push] Foreground message received:", payload);

    // Show notification manually for foreground
    if (payload.notification) {
      const { title, body } = payload.notification;

      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-96.png",
          vibrate: [200, 100, 200, 100, 200],
          tag: payload.data?.type
            ? `${payload.data.type}-alert`
            : "fcm-message",
        });
      }
    }

    if (callback) callback(payload);
  });
}

/**
 * Initialize push notifications for a user
 * @param {string} userId - User's ID
 */
export async function initPushNotifications(userId) {
  if (!isPushSupported()) {
    console.log("[Push] Push not supported on this browser");
    return;
  }

  // Register FCM token
  await registerFCMToken(userId);

  // Set up foreground message handler
  onForegroundMessage((payload) => {
    console.log("[Push] Message received while app open:", payload);
  });

  console.log("[Push] Push notifications initialized for user:", userId);
}

/**
 * Get current FCM token
 * @returns {string|null}
 */
export function getCurrentToken() {
  return fcmToken;
}
