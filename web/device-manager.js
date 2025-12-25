/**
 * Device Manager Module
 * Handles Firestore operations for multi-device management
 */

import { auth, db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const STORAGE_KEYS = {
  SELECTED_ID: "esp32_selected_device_id",
};

// Cache for devices
let devicesCache = [];
let devicesListener = null;

/**
 * Get user's devices collection reference
 * @returns {CollectionReference|null}
 */
function getUserDevicesCollection() {
  const user = auth.currentUser;
  if (!user) {
    console.error("No authenticated user");
    return null;
  }
  return collection(db, `users/${user.uid}/devices`);
}

/**
 * Get all saved devices from Firestore
 * @returns {Promise<Array>} Array of device objects
 */
export async function getDevices() {
  const devicesCol = getUserDevicesCollection();
  if (!devicesCol) return [];

  try {
    const q = query(devicesCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const devices = [];
    snapshot.forEach((doc) => {
      devices.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    devicesCache = devices;
    return devices;
  } catch (error) {
    console.error("Error fetching devices:", error);
    return [];
  }
}

/**
 * Subscribe to real-time device updates
 * @param {function} callback - Called when devices change
 */
export function subscribeToDevices(callback) {
  const devicesCol = getUserDevicesCollection();
  if (!devicesCol) return null;

  // Unsubscribe from previous listener
  if (devicesListener) {
    devicesListener();
  }

  const q = query(devicesCol, orderBy("createdAt", "desc"));

  devicesListener = onSnapshot(
    q,
    (snapshot) => {
      const devices = [];
      snapshot.forEach((doc) => {
        devices.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      devicesCache = devices;
      callback(devices);
    },
    (error) => {
      console.error("Error listening to devices:", error);
    }
  );

  return devicesListener;
}

/**
 * Unsubscribe from device updates
 */
export function unsubscribeFromDevices() {
  if (devicesListener) {
    devicesListener();
    devicesListener = null;
  }
}

/**
 * Add a new device to Firestore
 * @param {string} name - Device name
 * @param {string} brokerUrl - MQTT broker URL
 * @param {string} topicStatus - Status topic
 * @param {string} topicCommands - Commands topic
 * @returns {Promise<object|null>} The created device object or null
 */
export async function addDevice(
  name,
  brokerUrl,
  topicStatus = "esp32/iot/status",
  topicCommands = "esp32/iot/commands"
) {
  const devicesCol = getUserDevicesCollection();
  if (!devicesCol) {
    console.error("Cannot add device: User not authenticated");
    return null;
  }

  try {
    const newDevice = {
      name: name.trim(),
      brokerUrl: brokerUrl.trim(),
      topicStatus: topicStatus.trim(),
      topicCommands: topicCommands.trim(),
      createdAt: new Date(),
    };

    const docRef = await addDoc(devicesCol, newDevice);

    return {
      id: docRef.id,
      ...newDevice,
    };
  } catch (error) {
    console.error("Error adding device:", error);
    return null;
  }
}

/**
 * Remove a device by ID from Firestore
 * @param {string} id - Device ID to remove
 * @returns {Promise<boolean>} True if device was removed
 */
export async function removeDevice(id) {
  const user = auth.currentUser;
  if (!user) {
    console.error("Cannot remove device: User not authenticated");
    return false;
  }

  try {
    const deviceDoc = doc(db, `users/${user.uid}/devices/${id}`);
    await deleteDoc(deviceDoc);

    // Clear selection if removed device was selected
    if (getSelectedDeviceId() === id) {
      localStorage.removeItem(STORAGE_KEYS.SELECTED_ID);
    }

    return true;
  } catch (error) {
    console.error("Error removing device:", error);
    return false;
  }
}

/**
 * Get the currently selected device ID (from localStorage for fast access)
 * @returns {string|null} Selected device ID or null
 */
export function getSelectedDeviceId() {
  return localStorage.getItem(STORAGE_KEYS.SELECTED_ID);
}

/**
 * Get the currently selected device object
 * @returns {Promise<object|null>} Selected device object or null
 */
export async function getSelectedDevice() {
  const selectedId = getSelectedDeviceId();
  if (!selectedId) return null;

  // Try from cache first
  const cachedDevice = devicesCache.find((d) => d.id === selectedId);
  if (cachedDevice) return cachedDevice;

  // Cache is empty, fetch from Firestore
  const devices = await getDevices();
  return devices.find((d) => d.id === selectedId) || null;
}

/**
 * Select a device by ID (stores in localStorage for fast access)
 * @param {string} id - Device ID to select
 * @returns {boolean} True if device was found and selected
 */
export function selectDevice(id) {
  // Check if device exists in cache
  const device = devicesCache.find((d) => d.id === id);

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
