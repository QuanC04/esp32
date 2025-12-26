/**
 * Location Map Module
 * Handles Leaflet map integration for displaying device locations during danger alerts
 */

// Map instance
let mapInstance = null;
let markerInstance = null;
let circleInstance = null;

/**
 * Custom icons for different alert types
 */
const alertIcons = {
  fire: null,
  gas: null,
};

/**
 * Initialize custom Leaflet icons (call after Leaflet is loaded)
 */
function initIcons() {
  if (typeof L === "undefined") return;

  // Fire alert icon (red/orange)
  alertIcons.fire = L.divIcon({
    className: "danger-marker fire-marker",
    html: `<div class="marker-pin fire"><span>🔥</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });

  // Gas alert icon (yellow/green)
  alertIcons.gas = L.divIcon({
    className: "danger-marker gas-marker",
    html: `<div class="marker-pin gas"><span>☠️</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
}

/**
 * Initialize the danger map in a container
 * @param {string} containerId - DOM element ID for the map container
 * @param {number} lat - Initial latitude (default: Ho Chi Minh City)
 * @param {number} lng - Initial longitude
 * @returns {object|null} Leaflet map instance
 */
export function initDangerMap(containerId, lat = 10.8231, lng = 106.6297) {
  if (typeof L === "undefined") {
    console.error(
      "[LocationMap] Leaflet not loaded. Please include Leaflet.js first."
    );
    return null;
  }

  // Initialize icons if not already done
  if (!alertIcons.fire) {
    initIcons();
  }

  // Destroy existing map if any
  destroyMap();

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`[LocationMap] Container #${containerId} not found`);
    return null;
  }

  // Create map instance
  mapInstance = L.map(containerId, {
    center: [lat, lng],
    zoom: 16,
    zoomControl: true,
    attributionControl: true,
  });

  // Add OpenStreetMap tiles
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(mapInstance);

  return mapInstance;
}

/**
 * Show device location on the map with appropriate danger marker
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} deviceName - Name of the device
 * @param {string} alertType - 'fire' or 'gas'
 * @param {object} data - Additional data (gas value, etc.)
 */
export function showDeviceLocation(lat, lng, deviceName, alertType, data = {}) {
  if (!mapInstance) {
    console.error("[LocationMap] Map not initialized");
    return;
  }

  // Clear existing markers
  if (markerInstance) {
    mapInstance.removeLayer(markerInstance);
  }
  if (circleInstance) {
    mapInstance.removeLayer(circleInstance);
  }

  // Select icon based on alert type
  const icon = alertType === "fire" ? alertIcons.fire : alertIcons.gas;

  // Create marker
  markerInstance = L.marker([lat, lng], { icon }).addTo(mapInstance);

  // Create popup content
  let popupContent = `
    <div class="map-popup">
      <strong>${deviceName}</strong><br>
      <span class="alert-type ${alertType}">
        ${alertType === "fire" ? "🔥 PHÁT HIỆN LỬA!" : "☠️ RÒ RỈ KHÍ GAS!"}
      </span>
  `;

  if (alertType === "gas" && data.gas) {
    popupContent += `<br><span class="gas-value">Nồng độ: ${data.gas} ppm</span>`;
  }

  popupContent += `
      <br><small>Vị trí: ${lat.toFixed(6)}, ${lng.toFixed(6)}</small>
    </div>
  `;

  markerInstance.bindPopup(popupContent).openPopup();

  // Add danger zone circle
  const circleColor = alertType === "fire" ? "#ff4444" : "#ffaa00";
  circleInstance = L.circle([lat, lng], {
    color: circleColor,
    fillColor: circleColor,
    fillOpacity: 0.2,
    radius: 50, // 50 meters danger zone
  }).addTo(mapInstance);

  // Center map on location
  mapInstance.setView([lat, lng], 16);

  // Force map to redraw (fixes rendering issues in popups)
  setTimeout(() => {
    mapInstance.invalidateSize();
  }, 100);
}

/**
 * Get current user's geolocation
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let message = "Unknown error";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "User denied the request for Geolocation";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            message = "The request to get user location timed out";
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Initialize a simple location picker map
 * @param {string} containerId - Map container ID
 * @param {function} onLocationSelect - Callback when location is selected
 * @param {number} initialLat - Initial latitude
 * @param {number} initialLng - Initial longitude
 */
export function initLocationPicker(
  containerId,
  onLocationSelect,
  initialLat = 10.8231,
  initialLng = 106.6297
) {
  if (typeof L === "undefined") {
    console.error("[LocationMap] Leaflet not loaded");
    return null;
  }

  const container = document.getElementById(containerId);
  if (!container) return null;

  const pickerMap = L.map(containerId, {
    center: [initialLat, initialLng],
    zoom: 15,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap",
  }).addTo(pickerMap);

  let pickerMarker = L.marker([initialLat, initialLng], {
    draggable: true,
  }).addTo(pickerMap);

  // Update on marker drag
  pickerMarker.on("dragend", (e) => {
    const { lat, lng } = e.target.getLatLng();
    onLocationSelect(lat, lng);
  });

  // Update on map click
  pickerMap.on("click", (e) => {
    const { lat, lng } = e.latlng;
    pickerMarker.setLatLng([lat, lng]);
    onLocationSelect(lat, lng);
  });

  return pickerMap;
}

/**
 * Destroy the map instance and clean up
 */
export function destroyMap() {
  if (markerInstance && mapInstance) {
    mapInstance.removeLayer(markerInstance);
    markerInstance = null;
  }

  if (circleInstance && mapInstance) {
    mapInstance.removeLayer(circleInstance);
    circleInstance = null;
  }

  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
}

/**
 * Check if map is currently initialized
 * @returns {boolean}
 */
export function isMapInitialized() {
  return mapInstance !== null;
}
