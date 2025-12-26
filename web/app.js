/**
 * ESP32 Control Panel - MQTT Application
 * Handles MQTT communication with ESP32 via cloud broker
 */

import {
  requestNotificationPermission,
  sendDangerAlert,
} from "./notification-helper.js";
import { initPushNotifications } from "./push-manager.js";
import {
  initDangerMap,
  showDeviceLocation,
  destroyMap,
} from "./location-map.js";

// =====================================================
// Configuration & State
// =====================================================
const state = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  connected: false,
  dangerDismissed: false, // Đã nhấn "Đã hiểu" popup nguy hiểm
  mqttClient: null,

  // MQTT Topics
  topics: {
    status: "esp32/iot/status",
    commands: "esp32/iot/commands",
  },

  // Device states
  devices: {
    auto: true,
    fan: false,
    pump: false,
    buzzer: false,
    relay: false,
    led: false,
    servo: 90,
  },

  // Sensor values
  sensors: {
    gas: 0,
  },

  // Current device info (for location display)
  currentDevice: null,
};

// =====================================================
// DOM Elements
// =====================================================
const elements = {
  brokerUrl: document.getElementById("brokerUrl"),
  connectBtn: document.getElementById("connectBtn"),
  connectionStatus: document.getElementById("connectionStatus"),

  // Danger Popup
  dangerPopup: document.getElementById("dangerPopup"),
  dangerTitle: document.getElementById("dangerTitle"),
  dangerMessage: document.getElementById("dangerMessage"),
  dangerDismissBtn: document.getElementById("dangerDismissBtn"),
  dangerMapContainer: document.getElementById("dangerMapContainer"),
  dangerLocationInfo: document.getElementById("dangerLocationInfo"),

  // LCD
  lcdLine1: document.getElementById("lcdLine1"),
  lcdLine2: document.getElementById("lcdLine2"),

  // Sensors
  gasValue: document.getElementById("gasValue"),
  gasProgress: document.getElementById("gasProgress"),
  gasStatus: document.getElementById("gasStatus"),

  // Controls
  autoToggle: document.getElementById("autoToggle"),
  autoStatus: document.getElementById("autoStatus"),
  fanToggle: document.getElementById("fanToggle"),
  fanStatus: document.getElementById("fanStatus"),
  pumpToggle: document.getElementById("pumpToggle"),
  pumpStatus: document.getElementById("pumpStatus"),
  buzzerToggle: document.getElementById("buzzerToggle"),
  buzzerStatus: document.getElementById("buzzerStatus"),

  servoSlider: document.getElementById("servoSlider"),
  servoValue: document.getElementById("servoValue"),

  // Log
  logContent: document.getElementById("logContent"),
};

// =====================================================
// Utility Functions
// =====================================================
function formatTime(date = new Date()) {
  return date.toLocaleTimeString("vi-VN", { hour12: false });
}

function addLog(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry log-${type}`;
  entry.innerHTML = `
    <span class="log-time">${formatTime()}</span>
    <span class="log-message">${message}</span>
  `;

  elements.logContent.insertBefore(entry, elements.logContent.firstChild);

  // Keep only last 50 entries
  while (elements.logContent.children.length > 50) {
    elements.logContent.removeChild(elements.logContent.lastChild);
  }
}

function updateConnectionStatus(status) {
  const statusEl = elements.connectionStatus;
  const textEl = statusEl.querySelector(".status-text");

  statusEl.classList.remove("connected", "disconnected");

  switch (status) {
    case "connected":
      statusEl.classList.add("connected");
      textEl.textContent = "Đã kết nối MQTT";
      state.connected = true;
      break;
    case "disconnected":
      statusEl.classList.add("disconnected");
      textEl.textContent = "Mất kết nối";
      state.connected = false;
      break;
    default:
      textEl.textContent = "Đang kết nối...";
      state.connected = false;
  }
}

// =====================================================
// MQTT Communication
// =====================================================
function connectMQTT() {
  const brokerUrl = elements.brokerUrl.value.trim();
  if (!brokerUrl) {
    addLog("Vui lòng nhập URL MQTT broker", "warning");
    return;
  }

  state.brokerUrl = brokerUrl;

  // Disconnect existing connection
  if (state.mqttClient) {
    state.mqttClient.end();
  }

  updateConnectionStatus("connecting");
  addLog(`Đang kết nối đến ${brokerUrl}...`, "info");

  // Generate unique client ID
  const clientId = "web_" + Math.random().toString(16).substr(2, 8);

  try {
    state.mqttClient = mqtt.connect(brokerUrl, {
      clientId: clientId,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 3000,
    });

    state.mqttClient.on("connect", () => {
      updateConnectionStatus("connected");
      addLog("✅ Đã kết nối MQTT broker!", "success");

      // Subscribe to status topic
      state.mqttClient.subscribe(state.topics.status, (err) => {
        if (err) {
          addLog(`Lỗi subscribe: ${err.message}`, "error");
        } else {
          addLog(`📡 Subscribed: ${state.topics.status}`, "info");
        }
      });
    });

    state.mqttClient.on("message", (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        updateFromStatus(data);
      } catch (e) {
        console.error("MQTT message parse error:", e);
      }
    });

    state.mqttClient.on("error", (error) => {
      console.error("MQTT error:", error);
      addLog(`Lỗi MQTT: ${error.message}`, "error");
    });

    state.mqttClient.on("close", () => {
      updateConnectionStatus("disconnected");
      addLog("MQTT đã đóng kết nối", "warning");
    });

    state.mqttClient.on("reconnect", () => {
      addLog("Đang thử kết nối lại...", "info");
    });
  } catch (error) {
    addLog(`Không thể kết nối: ${error.message}`, "error");
    updateConnectionStatus("disconnected");
  }
}

function sendCommand(device, value) {
  if (!state.connected || !state.mqttClient) {
    addLog("Chưa kết nối với MQTT broker", "warning");
    return;
  }

  const payload = JSON.stringify({ [device]: value });

  state.mqttClient.publish(state.topics.commands, payload, (err) => {
    if (err) {
      addLog(`Lỗi gửi lệnh: ${err.message}`, "error");
    } else {
      console.log(`[MQTT] Published to ${state.topics.commands}: ${payload}`);
    }
  });
}

function updateFromStatus(data) {
  if (!data) return;

  // Update sensors
  if (data.gas !== undefined) updateGasSensor(data.gas);

  // Update LCD
  if (data.lcd) {
    if (data.lcd.line1) elements.lcdLine1.textContent = data.lcd.line1;
    if (data.lcd.line2) elements.lcdLine2.textContent = data.lcd.line2;
  }

  // Update device states
  if (data.auto !== undefined) updateToggleState("auto", data.auto);
  if (data.fan !== undefined) updateToggleState("fan", data.fan);
  if (data.pump !== undefined) updateToggleState("pump", data.pump);
  if (data.buzzer !== undefined) updateToggleState("buzzer", data.buzzer);
  if (data.relay !== undefined) updateToggleState("relay", data.relay);
  if (data.led !== undefined) updateToggleState("led", data.led);
  if (data.servo !== undefined) updateServoValue(data.servo);

  // Check for danger conditions (Gas > 700 or Fire)
  checkDangerCondition(data);
}

// =====================================================
// Sensor Updates
// =====================================================
function updateGasSensor(value) {
  state.sensors.gas = value;
  elements.gasValue.textContent = value;

  const percentage = Math.min((value / 1000) * 100, 100);
  elements.gasProgress.style.width = `${percentage}%`;

  const statusEl = elements.gasStatus.querySelector(".status-badge");

  if (value < 300) {
    statusEl.className = "status-badge status-safe";
    statusEl.textContent = "An toàn";
  } else if (value < 600) {
    statusEl.className = "status-badge status-warning";
    statusEl.textContent = "Cảnh báo";
  } else {
    statusEl.className = "status-badge status-danger";
    statusEl.textContent = "Nguy hiểm";
  }
}

// =====================================================
// Control Updates
// =====================================================
function updateToggleState(device, isOn) {
  state.devices[device] = isOn;

  const toggle = elements[`${device}Toggle`];
  const status = elements[`${device}Status`];

  if (toggle) {
    toggle.dataset.state = isOn ? "on" : "off";
  }

  if (status) {
    status.textContent = isOn ? "BẬT" : "TẮT";
    status.classList.toggle("active", isOn);
  }
}

function updateServoValue(angle) {
  state.devices.servo = angle;
  elements.servoValue.textContent = angle;
  elements.servoSlider.value = angle;
}

// =====================================================
// Event Handlers
// =====================================================
function handleConnect() {
  connectMQTT();
}

function handleToggle(device) {
  const newState = !state.devices[device];

  // Optimistic update
  updateToggleState(device, newState);
  addLog(`${getDeviceName(device)}: ${newState ? "BẬT" : "TẮT"}`, "info");

  // Send MQTT command
  sendCommand(device, newState);
}

function handleServoChange(angle) {
  updateServoValue(angle);
  addLog(`Servo: ${angle}°`, "info");
  sendCommand("servo", parseInt(angle));
}

function getDeviceName(device) {
  const names = {
    auto: "Chế độ Tự động",
    fan: "Quạt hút",
    pump: "Máy bơm",
    buzzer: "Còi",
    relay: "Relay",
    led: "LED",
  };
  return names[device] || device;
}

// =====================================================
// Danger Popup
// =====================================================
function checkDangerCondition(data) {
  const isDanger =
    (data.gas !== undefined && data.gas > 700) || data.isFire === true;

  console.log(
    "[Danger Check] Gas:",
    data.gas,
    "Fire:",
    data.isFire,
    "isDanger:",
    isDanger,
    "dismissed:",
    state.dangerDismissed
  );

  if (isDanger && !state.dangerDismissed) {
    showDangerPopup(data);

    // Send push notification
    if (data.isFire) {
      sendDangerAlert("fire", data);
    } else if (data.gas > 700) {
      sendDangerAlert("gas", data);
    }
  }

  // Reset dismissed state when danger is over
  if (!isDanger) {
    state.dangerDismissed = false;
  }
}

function showDangerPopup(data) {
  const alertType = data.isFire ? "fire" : "gas";

  if (data.isFire) {
    elements.dangerTitle.textContent = "PHÁT HIỆN LỬA!";
    elements.dangerMessage.textContent =
      "Cảm biến phát hiện có lửa! Vui lòng kiểm tra ngay!";
  } else {
    elements.dangerTitle.textContent = "RÒ RỈ KHÍ GAS!";
    elements.dangerMessage.textContent = `Nồng độ gas: ${data.gas} ppm (Ngưỡng nguy hiểm: 700)`;
  }

  elements.dangerPopup.style.display = "flex";
  addLog("CẢNH BÁO NGUY HIỂM!", "error");

  // Show location on map if device has location info
  const device = state.currentDevice;
  if (
    device &&
    device.location &&
    device.location.latitude &&
    device.location.longitude
  ) {
    const { latitude, longitude } = device.location;

    // Update location info display
    elements.dangerLocationInfo.innerHTML = `
      <div class="device-name">📍 ${device.name}</div>
      <div class="coordinates">${latitude.toFixed(6)}, ${longitude.toFixed(
      6
    )}</div>
    `;

    // Initialize and show map after popup is visible
    setTimeout(() => {
      initDangerMap("dangerMapContainer", latitude, longitude);
      showDeviceLocation(latitude, longitude, device.name, alertType, data);
    }, 100);
  } else {
    // No location data available
    elements.dangerLocationInfo.innerHTML = `
      <div style="opacity: 0.7; font-size: 0.85rem;">
        ⚠️ Chưa có thông tin vị trí thiết bị
      </div>
    `;
    elements.dangerMapContainer.style.display = "none";
  }
}

function hideDangerPopup() {
  elements.dangerPopup.style.display = "none";
  state.dangerDismissed = true;
  addLog("Đã xác nhận cảnh báo", "warning");

  // Clean up map
  destroyMap();
  elements.dangerMapContainer.style.display = "block";
  elements.dangerLocationInfo.innerHTML = "";
}

// =====================================================
// Initialize UI (event listeners only)
// =====================================================
function initUI() {
  // Connect button
  elements.connectBtn.addEventListener("click", handleConnect);
  elements.brokerUrl.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleConnect();
  });

  // Danger popup dismiss button
  elements.dangerDismissBtn.addEventListener("click", hideDangerPopup);

  // Toggle buttons
  elements.autoToggle.addEventListener("click", () => handleToggle("auto"));
  elements.fanToggle.addEventListener("click", () => handleToggle("fan"));
  elements.pumpToggle.addEventListener("click", () => handleToggle("pump"));
  elements.buzzerToggle.addEventListener("click", () => handleToggle("buzzer"));

  // Servo slider
  let servoDebounce = null;
  elements.servoSlider.addEventListener("input", (e) => {
    elements.servoValue.textContent = e.target.value;

    // Debounce MQTT publish
    clearTimeout(servoDebounce);
    servoDebounce = setTimeout(() => {
      handleServoChange(e.target.value);
    }, 100);
  });

  // Initialize with default sensor values
  updateGasSensor(0);
  addLog("Hệ thống sẵn sàng. Đang chờ xác thực...", "info");
}

/**
 * Connect with device configuration (called after auth is confirmed)
 * @param {object} device - Device configuration object
 * @param {string} userId - Current user ID for push notifications
 */
export async function connectWithDevice(device, userId) {
  if (!device) {
    addLog("Không tìm thấy thiết bị. Vui lòng chọn thiết bị.", "warning");
    return;
  }

  // Update state with device config
  state.brokerUrl = device.brokerUrl;
  state.topics.status = device.topicStatus;
  state.topics.commands = device.topicCommands;
  state.currentDevice = device; // Store for location display

  // Update UI
  elements.brokerUrl.value = device.brokerUrl;

  // Auto-connect to MQTT
  addLog(`Đang kết nối tới ${device.name}...`, "info");
  connectMQTT();

  // Initialize push notifications for FCM
  if (userId) {
    try {
      await initPushNotifications(userId);
      addLog("Push notifications đã được kích hoạt", "success");
    } catch (error) {
      console.warn("[Push] Error initializing push:", error);
    }
  }
}

// Start the app - only initialize UI
document.addEventListener("DOMContentLoaded", initUI);
