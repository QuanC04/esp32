/**
 * ESP32 IoT Gateway Server
 * Bridges communication between ESP32 (Wokwi) and Web Client
 */

const http = require("http");
const WebSocket = require("ws");

const PORT = 8080;

// Current device state (received from ESP32 or set by web client)
let deviceState = {
  gas: 0,
  light: 0,
  fan: false,
  pump: false,
  buzzer: false,
  relay: false,
  led: false,
  servo: 90,
  lcd: {
    line1: "ESP32 Ready",
    line2: "Waiting...",
  },
};

// Pending commands from web client to ESP32
let pendingCommands = {};

// Connected WebSocket clients
const wsClients = new Set();

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const url = req.url;

  // Log requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${url}`);

  // Route: GET /status - Web client gets current state
  if (req.method === "GET" && url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(deviceState));
    return;
  }

  // Route: POST /esp/status - ESP32 sends sensor data
  if (req.method === "POST" && url === "/esp/status") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);

        // Update device state from ESP32
        if (data.gas !== undefined) deviceState.gas = data.gas;
        if (data.light !== undefined) deviceState.light = data.light;
        if (data.fan !== undefined) deviceState.fan = data.fan;
        if (data.pump !== undefined) deviceState.pump = data.pump;
        if (data.buzzer !== undefined) deviceState.buzzer = data.buzzer;
        if (data.servo !== undefined) deviceState.servo = data.servo;
        if (data.lcd) deviceState.lcd = data.lcd;

        // Broadcast to all WebSocket clients
        broadcastState();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Route: GET /esp/commands - ESP32 checks for commands
  if (req.method === "GET" && url === "/esp/commands") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(pendingCommands));
    // Clear pending commands after sending
    pendingCommands = {};
    return;
  }

  // Route: POST /fan - Web client controls fan
  if (req.method === "POST" && url === "/fan") {
    handleDeviceControl(req, res, "fan");
    return;
  }

  // Route: POST /pump - Web client controls pump
  if (req.method === "POST" && url === "/pump") {
    handleDeviceControl(req, res, "pump");
    return;
  }

  // Route: POST /buzzer - Web client controls buzzer
  if (req.method === "POST" && url === "/buzzer") {
    handleDeviceControl(req, res, "buzzer");
    return;
  }

  // Route: POST /relay - Web client controls relay
  if (req.method === "POST" && url === "/relay") {
    handleDeviceControl(req, res, "relay");
    return;
  }

  // Route: POST /led - Web client controls LED
  if (req.method === "POST" && url === "/led") {
    handleDeviceControl(req, res, "led");
    return;
  }

  // Route: POST /servo - Web client controls servo
  if (req.method === "POST" && url === "/servo") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (data.angle !== undefined) {
          const angle = Math.min(180, Math.max(0, parseInt(data.angle)));
          deviceState.servo = angle;
          pendingCommands.servo = angle;
          broadcastState();
          console.log(`[SERVO] Set to ${angle}°`);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, servo: deviceState.servo }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
      }
    });
    return;
  }

  // 404 Not Found
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

// Handle device toggle control
function handleDeviceControl(req, res, device) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const data = JSON.parse(body);
      const newState = !!data.state;

      deviceState[device] = newState;
      pendingCommands[device] = newState;

      console.log(`[${device.toUpperCase()}] ${newState ? "ON" : "OFF"}`);
      broadcastState();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, [device]: newState }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });
}

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("[WS] New client connected");
  wsClients.add(ws);

  // Send current state immediately
  ws.send(JSON.stringify(deviceState));

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    wsClients.delete(ws);
  });

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log("[WS] Received:", data);

      // Handle commands from WebSocket client
      if (data.command) {
        const { device, value } = data;
        if (device && value !== undefined) {
          deviceState[device] = value;
          pendingCommands[device] = value;
          broadcastState();
        }
      }
    } catch (e) {
      console.error("[WS] Parse error:", e);
    }
  });
});

// Broadcast state to all WebSocket clients
function broadcastState() {
  const stateJson = JSON.stringify(deviceState);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(stateJson);
    }
  });
}

// Start server
server.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("🚀 ESP32 IoT Gateway Server");
  console.log("=".repeat(50));
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log("");
  console.log("API Endpoints:");
  console.log("  GET  /status       - Get current device state");
  console.log("  POST /esp/status   - ESP32 sends sensor data");
  console.log("  GET  /esp/commands - ESP32 gets pending commands");
  console.log("  POST /fan          - Control fan");
  console.log("  POST /pump         - Control pump");
  console.log("  POST /buzzer       - Control buzzer");
  console.log("  POST /relay        - Control relay");
  console.log("  POST /led          - Control LED");
  console.log("  POST /servo        - Control servo");
  console.log("=".repeat(50));
});
