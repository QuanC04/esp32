#include <ESP32Servo.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Global secure client cho HTTPS
WiFiClientSecure secureClient;

// WiFi Configuration
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// Server URL - ngrok public URL
String serverUrl = "https://sparing-jeniffer-mesically.ngrok-free.dev";

// --- PIN CONFIGURATION ---
const int PIN_GAS = 34;
const int PIN_LUA = 35;
const int PIN_QUAT = 4;
const int PIN_BOM = 12;
const int PIN_SERVO = 27;
const int PIN_COI = 14;

// Hardware instances
Servo myServo;

// Device states
bool fanState = false;
bool pumpState = false;
bool buzzerState = false;

// Timing
unsigned long lastStatusSend = 0;
unsigned long lastCommandCheck = 0;
const unsigned long STATUS_SEND_INTERVAL = 2000;
const unsigned long COMMAND_CHECK_INTERVAL = 1000;

// Sensor values
int gasValue = 0;
int servoAngle = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("Starting ESP32...");

  // Initialize Servo
  myServo.attach(PIN_SERVO);
  myServo.write(0);
  servoAngle = 0;

  // Initialize output pins
  pinMode(PIN_QUAT, OUTPUT);
  pinMode(PIN_BOM, OUTPUT);
  pinMode(PIN_COI, OUTPUT);
  pinMode(PIN_LUA, INPUT);

  digitalWrite(PIN_QUAT, LOW);
  digitalWrite(PIN_BOM, LOW);
  digitalWrite(PIN_COI, LOW);

  // Connect WiFi
  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());

  // Cấu hình secure client - bỏ qua verify SSL cho ngrok
  secureClient.setInsecure();

  Serial.println(">>> SETUP COMPLETE <<<");
}

void loop() {
  unsigned long currentMillis = millis();

  // Đọc cảm biến
  gasValue = analogRead(PIN_GAS);
  gasValue = map(gasValue, 0, 4095, 0, 1000);

  // Gửi status lên server
  if (currentMillis - lastStatusSend >= STATUS_SEND_INTERVAL) {
    lastStatusSend = currentMillis;
    sendStatusToServer();
  }

  // Check lệnh từ server
  if (currentMillis - lastCommandCheck >= COMMAND_CHECK_INTERVAL) {
    lastCommandCheck = currentMillis;
    checkCommands();
  }
}

void sendStatusToServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;

  StaticJsonDocument<256> doc;
  doc["gas"] = gasValue;
  doc["light"] = 50;
  doc["fan"] = fanState;
  doc["pump"] = pumpState;
  doc["buzzer"] = buzzerState;
  doc["servo"] = servoAngle;

  String jsonString;
  serializeJson(doc, jsonString);

  http.begin(secureClient, serverUrl + "/esp/status");
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(jsonString);
  if (httpCode > 0) {
    Serial.printf("[HTTP] Status sent: %d\n", httpCode);
  } else {
    Serial.printf("[HTTP] Error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}

void checkCommands() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(secureClient, serverUrl + "/esp/commands");

  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    Serial.print("[CMD] Received: ");
    Serial.println(payload);

    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (!error) {
      if (doc.containsKey("fan")) {
        bool newState = doc["fan"];
        if (newState != fanState) {
          fanState = newState;
          digitalWrite(PIN_QUAT, fanState ? HIGH : LOW);
          Serial.printf("[CMD] Fan: %s\n", fanState ? "ON" : "OFF");
        }
      }

      if (doc.containsKey("pump")) {
        bool newState = doc["pump"];
        if (newState != pumpState) {
          pumpState = newState;
          digitalWrite(PIN_BOM, pumpState ? HIGH : LOW);
          Serial.printf("[CMD] Pump: %s\n", pumpState ? "ON" : "OFF");
        }
      }

      if (doc.containsKey("buzzer")) {
        bool newState = doc["buzzer"];
        if (newState != buzzerState) {
          buzzerState = newState;
          digitalWrite(PIN_COI, buzzerState ? HIGH : LOW);
          Serial.printf("[CMD] Buzzer: %s\n", buzzerState ? "ON" : "OFF");
        }
      }

      if (doc.containsKey("servo")) {
        int newAngle = doc["servo"];
        if (newAngle != servoAngle) {
          servoAngle = constrain(newAngle, 0, 180);
          myServo.write(servoAngle);
          Serial.printf("[CMD] Servo: %d\n", servoAngle);
        }
      }
    }
  }
  http.end();
}
