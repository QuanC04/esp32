/**
 * Device Manager Module
 * Handles localStorage operations for multi-device management
 */

const STORAGE_KEYS = {
  DEVICES: "esp32_devices",
  SELECTED_ID: "esp32_selected_device_id",
};

/**
 * Get all saved devices
 * @returns {Array} Array of device objects
 */
export function getDevices() {
  const devicesJson = localStorage.getItem(STORAGE_KEYS.DEVICES);
  return devicesJson ? JSON.parse(devicesJson) : [];
}

/**
 * Add a new device
 * @param {string} name - Device name
 * @param {string} brokerUrl - MQTT broker URL
 * @param {string} topicStatus - Status topic (optional)
 * @param {string} topicCommands - Commands topic (optional)
 * @returns {object} The created device object
 */
export function addDevice(
  name,
  brokerUrl,
  topicStatus = "esp32/iot/status",
  topicCommands = "esp32/iot/commands"
) {
  const devices = getDevices();

  // Generate unique ID
  const id = "device_" + Date.now();

  const newDevice = {
    id,
    name: name.trim(),
    brokerUrl: brokerUrl.trim(),
    topicStatus: topicStatus.trim(),
    topicCommands: topicCommands.trim(),
    createdAt: new Date().toISOString(),
  };

  devices.push(newDevice);
  localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(devices));

  return newDevice;
}

/**
 * Remove a device by ID
 * @param {string} id - Device ID to remove
 * @returns {boolean} True if device was removed
 */
export function removeDevice(id) {
  const devices = getDevices();
  const filteredDevices = devices.filter((d) => d.id !== id);

  if (filteredDevices.length === devices.length) {
    return false; // Device not found
  }

  localStorage.setItem(STORAGE_KEYS.DEVICES, JSON.stringify(filteredDevices));

  // Clear selection if removed device was selected
  if (getSelectedDeviceId() === id) {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_ID);
  }

  return true;
}

/**
 * Get the currently selected device ID
 * @returns {string|null} Selected device ID or null
 */
export function getSelectedDeviceId() {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_ID);
}

/**
 * Get the currently selected device object
 * @returns {object|null} Selected device object or null
 */
export function getSelectedDevice() {
  const selectedId = getSelectedDeviceId();
  if (!selectedId) return null;

  const devices = getDevices();
  return devices.find((d) => d.id === selectedId) || null;
}

/**
 * Select a device by ID
 * @param {string} id - Device ID to select
 * @returns {boolean} True if device was found and selected
 */
export function selectDevice(id) {
  const devices = getDevices();
  const device = devices.find((d) => d.id === id);

  if (!device) {
    return false;
  }

  localStorage.setItem(STORAGE_KEYS.SELECTED_ID, id);
  return true;
}

/**
 * Check if a device is currently selected
 * @returns {boolean} True if a device is selected
 */
export function hasSelectedDevice() {
  return getSelectedDeviceId() !== null && getSelectedDevice() !== null;
}
