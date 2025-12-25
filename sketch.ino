#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- CẤU HÌNH WIFI ---
const char* ssid = "Wokwi-GUEST";
const char* password = "";

// --- CẤU HÌNH MQTT ---
const char* mqtt_server = "broker.emqx.io";
const int mqtt_port = 1883;
const char* topic_status = "esp32/iot/status";
const char* topic_commands = "esp32/iot/commands";

String clientId = "esp32_";
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- CHÂN KẾT NỐI ---
const int PIN_GAS = 34;
const int PIN_LUA = 35;
const int PIN_QUAT = 4;
const int PIN_BOM = 12;
const int PIN_SERVO = 27;
const int PIN_COI = 14;

LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo myServo;

// --- TRẠNG THÁI ---
bool fanState = false;
bool pumpState = false;
bool buzzerState = false;
bool isFire = false;
bool isAutoMode = true; // Mặc định là Tự động

// --- THỜI GIAN ---
unsigned long lastSensorRead = 0;
unsigned long lastStatusPublish = 0;
const unsigned long SENSOR_INTERVAL = 500;
const unsigned long STATUS_PUBLISH_INTERVAL = 1000;

// --- GIÁ TRỊ CẢM BIẾN ---
int gasValue = 0;
int lightValue = 0;
int servoAngle = 0;

// LCD
String lcdLine1 = "";
String lcdLine2 = "";

void setup() {
  Serial.begin(115200);

  // Khởi động LCD
  lcd.init();
  lcd.backlight();
  lcd.print("KHOI DONG...");

  myServo.attach(PIN_SERVO);
  myServo.write(0);

  pinMode(PIN_QUAT, OUTPUT);
  pinMode(PIN_BOM, OUTPUT);
  pinMode(PIN_COI, OUTPUT);
  pinMode(PIN_LUA, INPUT);

  // Tắt hết thiết bị ban đầu
  digitalWrite(PIN_QUAT, LOW);
  digitalWrite(PIN_BOM, LOW);
  digitalWrite(PIN_COI, LOW);

  // Kết nối WiFi
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Dang ket noi...");
  lcd.setCursor(0, 1);
  lcd.print("WiFi: ");
  lcd.print(ssid);

  Serial.println();
  Serial.print("Dang ket noi WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
    // Timeout sau 30 giây (60 lần x 500ms)
    if (wifiAttempts > 60) {
      Serial.println("\n[LOI] Khong ket noi duoc WiFi! Dang restart...");
      lcd.clear();
      lcd.print("LOI WIFI!");
      delay(2000);
      ESP.restart(); // Khởi động lại ESP32
    }
  }
  Serial.println();
  Serial.println("WiFi da ket noi!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi OK!");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(1000);

  clientId += String((uint32_t)ESP.getEfuseMac(), HEX);

  // Cấu hình MQTT
  mqttClient.setServer(mqtt_server, mqtt_port);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);

  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  unsigned long currentMillis = millis();

  // Đọc cảm biến & Xử lý logic
  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = currentMillis;
    readSensors();
  }

  // Gửi trạng thái lên Web
  if (currentMillis - lastStatusPublish >= STATUS_PUBLISH_INTERVAL) {
    lastStatusPublish = currentMillis;
    publishStatus();
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    if (mqttClient.connect(clientId.c_str())) {
      mqttClient.subscribe(topic_commands);
      mqttClient.publish(topic_status, "{\"online\":true}");
    } else {
      delay(1000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) return;

  // 1. Chuyển chế độ Auto
  if (doc.containsKey("auto")) {
    isAutoMode = doc["auto"];
    updateLCD(); // Cập nhật màn hình ngay để biết chế độ đã đổi
  }

  // 2. Điều khiển QUẠT
  if (doc.containsKey("fan")) {
    // KHI CÓ LỆNH THỦ CÔNG -> TẮT CHẾ ĐỘ AUTO NGAY LẬP TỨC
    isAutoMode = false;

    bool newFanState = doc["fan"];
    if (newFanState != fanState) setFan(newFanState);
  }

  // 3. Điều khiển BƠM
  if (doc.containsKey("pump")) {
    isAutoMode = false; // Tắt Auto
    bool newPumpState = doc["pump"];
    if (newPumpState != pumpState) setPump(newPumpState);
  }

  // 4. Điều khiển CÒI
  if (doc.containsKey("buzzer")) {
    isAutoMode = false; // Tắt Auto
    bool newBuzzerState = doc["buzzer"];
    if (newBuzzerState != buzzerState) setBuzzer(newBuzzerState);
  }

  // 5. Điều khiển Servo
  if (doc.containsKey("servo")) {
    isAutoMode = false; // Tắt Auto
    int newServoAngle = doc["servo"];
    if (newServoAngle != servoAngle) setServo(newServoAngle);
  }
}

void readSensors() {
  // Đọc Gas
  gasValue = analogRead(PIN_GAS);
  gasValue = map(gasValue, 0, 4095, 0, 1000);

  // Đọc Lửa
  int fireStateRead = digitalRead(PIN_LUA);
  isFire = (fireStateRead == LOW); // LOW = Có lửa

  // Đọc Ánh sáng
  int rawLight = analogRead(PIN_GAS);
  lightValue = map(rawLight, 0, 4095, 0, 100);

  // --- XỬ LÝ LOGIC ---
  processSystemLogic();

  // Cập nhật LCD
  updateLCD();
}

void processSystemLogic() {
  // 1. ƯU TIÊN CAO NHẤT: AN TOÀN (Override mọi chế độ)
  // Nếu Gas > 700 HOẶC Có cháy -> BẮT BUỘC BẬT CÒI
  bool isDanger = (gasValue > 700) || isFire;

  if (isDanger) {
    if (!buzzerState) setBuzzer(true);
    // Khi nguy hiểm thì nên bật cả quạt để hút khí
    if (!fanState) setFan(true);
    return; // Dừng hàm, không xét logic bên dưới nữa
  }

  // 2. LOGIC KHI AN TOÀN (Gas < 700 và Không cháy)
  // Chỉ chạy logic này nếu đang ở chế độ AUTO
  if (isAutoMode) {
    // Logic Quạt theo mức Gas (Hysteresis 500/450)
    if (gasValue > 500 && !fanState) {
      setFan(true);
    } else if (gasValue <= 450 && fanState) {
      setFan(false);
    }

    // Logic Còi: Khi đã hết nguy hiểm (isDanger = false ở trên),
    // và đang ở Auto Mode -> Tự động tắt còi.
    // Dùng ngưỡng 650 để tắt cho chắc chắn (tránh bật tắt liên tục)
    if (gasValue < 650 && buzzerState) {
      setBuzzer(false);
    }
  }
  else {
    // 3. LOGIC KHI Ở CHẾ ĐỘ THỦ CÔNG (MANUAL)
    // Code KHÔNG LÀM GÌ CẢ.
    // Giữ nguyên trạng thái do người dùng bật/tắt qua Web.
    // (Trừ trường hợp Nguy hiểm ở mục 1 đã xử lý rồi)
  }
}

void updateLCD() {
  // Ưu tiên 1: BÁO CHÁY
  if (isFire) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("!! CANH BAO !!");
    lcd.setCursor(0, 1); lcd.print("PHAT HIEN LUA!");
    return;
  }

  // Ưu tiên 2: BÁO KHÍ GAS CAO
  if (gasValue > 700) {
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("!! NGUY HIEM !!");
    lcd.setCursor(0, 1); lcd.print("RO RI KHI GAS!");
    return;
  }

  // Ưu tiên 3: BÌNH THƯỜNG
  lcdLine1 = "Gas:" + String(gasValue) + " Mode:" + (isAutoMode ? "AUTO" : "MAN");

  // Dòng 2 hiển thị trạng thái thiết bị cho dễ theo dõi
  String devices = "";
  if (fanState) devices += "F"; else devices += "_";
  if (pumpState) devices += "P"; else devices += "_";
  if (buzzerState) devices += "B"; else devices += "_";

  lcdLine2 = "Stt: [" + devices + "]";

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print(lcdLine1);
  lcd.setCursor(0, 1); lcd.print(lcdLine2);
}

void publishStatus() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<512> doc;
  doc["gas"] = gasValue;
  doc["light"] = lightValue;
  doc["fan"] = fanState;
  doc["pump"] = pumpState;
  doc["buzzer"] = buzzerState;
  doc["servo"] = servoAngle;
  doc["isFire"] = isFire;
  // Gửi biến auto về lại Web để cái nút gạt trên Web tự động nhảy sang tắt
  doc["auto"] = isAutoMode;

  JsonObject lcdObj = doc.createNestedObject("lcd");

  if (isFire) {
      lcdObj["line1"] = "!! CANH BAO !!";
      lcdObj["line2"] = "PHAT HIEN LUA!";
  } else if (gasValue > 700) {
      lcdObj["line1"] = "!! NGUY HIEM !!";
      lcdObj["line2"] = "RO RI KHI GAS!";
  } else {
      lcdObj["line1"] = lcdLine1;
      lcdObj["line2"] = lcdLine2;
  }

  String jsonString;
  serializeJson(doc, jsonString);
  mqttClient.publish(topic_status, jsonString.c_str());
}

// Device control
void setFan(bool state) {
  fanState = state;
  digitalWrite(PIN_QUAT, state ? HIGH : LOW);
}

void setPump(bool state) {
  pumpState = state;
  digitalWrite(PIN_BOM, state ? HIGH : LOW);
}

void setBuzzer(bool state) {
  buzzerState = state;
  digitalWrite(PIN_COI, state ? HIGH : LOW);
}

void setServo(int angle) {
  servoAngle = constrain(angle, 0, 180);
  myServo.write(servoAngle);
}
