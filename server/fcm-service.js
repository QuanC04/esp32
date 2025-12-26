/**
 * FCM Push Notification Service
 * Sends push notifications via Firebase Cloud Messaging
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin SDK
let initialized = false;

function initializeFCM() {
  if (initialized) return true;

  try {
    const serviceAccountPath = path.join(__dirname, "service-account.json");
    const serviceAccount = require(serviceAccountPath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    initialized = true;
    console.log("[FCM] Firebase Admin SDK initialized successfully");
    return true;
  } catch (error) {
    console.warn(
      "[FCM] Could not initialize Firebase Admin SDK:",
      error.message
    );
    console.warn(
      "[FCM] Push notifications will be disabled until service-account.json is added"
    );
    return false;
  }
}

/**
 * Get all FCM tokens from Firestore
 * @returns {Promise<string[]>} Array of FCM tokens
 */
async function getTokensFromFirestore() {
  if (!initialized) return [];

  try {
    const db = admin.firestore();
    const tokensSnapshot = await db.collection("fcm_tokens").get();

    const tokens = [];
    tokensSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.token) {
        tokens.push(data.token);
      }
    });

    console.log(`[FCM] Found ${tokens.length} registered tokens`);
    return tokens;
  } catch (error) {
    console.error("[FCM] Error getting tokens:", error.message);
    return [];
  }
}

/**
 * Send danger push notification to all registered devices
 * @param {string} type - "fire" or "gas"
 * @param {object} data - Additional data (e.g., { gas: 800 })
 */
async function sendDangerPush(type, data = {}) {
  if (!initialized) {
    console.warn("[FCM] Not initialized, skipping push notification");
    return { success: false, reason: "not_initialized" };
  }

  const tokens = await getTokensFromFirestore();

  if (tokens.length === 0) {
    console.warn("[FCM] No tokens registered, skipping push notification");
    return { success: false, reason: "no_tokens" };
  }

  // Build notification content
  let title, body;

  if (type === "fire") {
    title = "🔥 PHÁT HIỆN LỬA!";
    body = "Cảm biến phát hiện có lửa! Vui lòng kiểm tra ngay!";
  } else if (type === "gas") {
    title = "⚠️ RÒ RỈ KHÍ GAS!";
    body = `Nồng độ gas: ${data.gas || "N/A"} ppm (Ngưỡng nguy hiểm: 700 ppm)`;
  } else {
    console.warn("[FCM] Unknown danger type:", type);
    return { success: false, reason: "unknown_type" };
  }

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      type,
      timestamp: String(Date.now()),
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "danger_alerts",
        priority: "max",
        defaultVibrateTimings: true,
      },
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
      notification: {
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-96.png",
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag: `${type}-alert`,
      },
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(
      `[FCM] Push sent: ${response.successCount} success, ${response.failureCount} failed`
    );

    // Handle failed tokens (remove invalid tokens)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.warn(`[FCM] Token failed:`, resp.error?.message);
        }
      });

      // Optionally remove failed tokens from Firestore
      // await removeInvalidTokens(failedTokens);
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("[FCM] Error sending push:", error.message);
    return { success: false, reason: error.message };
  }
}

// Debounce mechanism to prevent spam
let lastPushTime = 0;
const PUSH_COOLDOWN = 30000; // 30 seconds cooldown between pushes

/**
 * Send danger push with debounce protection
 * @param {string} type - "fire" or "gas"
 * @param {object} data - Additional data
 */
async function sendDangerPushDebounced(type, data = {}) {
  const now = Date.now();

  if (now - lastPushTime < PUSH_COOLDOWN) {
    console.log(
      `[FCM] Push cooldown active, ${Math.round(
        (PUSH_COOLDOWN - (now - lastPushTime)) / 1000
      )}s remaining`
    );
    return { success: false, reason: "cooldown" };
  }

  lastPushTime = now;
  return await sendDangerPush(type, data);
}

// Try to initialize on module load
initializeFCM();

module.exports = {
  initializeFCM,
  sendDangerPush,
  sendDangerPushDebounced,
  getTokensFromFirestore,
};
