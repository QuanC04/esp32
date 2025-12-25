# ESP32 IoT Control System

Hệ thống điều khiển IoT với ESP32 (Wokwi Simulator) + Web Client.

## Kiến trúc hệ thống

```
┌─────────────────┐      HTTP POST       ┌──────────────────┐      WebSocket      ┌─────────────────┐
│   ESP32         │  ─────────────────►  │   Node.js        │  ◄───────────────►  │   Web Client    │
│   (Wokwi)       │  sensor data         │   Server         │  real-time updates  │   (Browser)     │
│                 │  ◄─────────────────  │   :8080          │  ─────────────────► │   index.html    │
│                 │  HTTP GET commands   │                  │  control commands   │                 │
└─────────────────┘                      └──────────────────┘                      └─────────────────┘
         │                                        │
         │                                        │
         └────────────────────────────────────────┘
                    Wokwi Gateway
                  (Port Forwarding)
```

## Cấu trúc thư mục

```
esp/
├── sketch.ino          # Code ESP32 (chạy trong Wokwi)
├── diagram.json        # Sơ đồ mạch Wokwi
├── gateway/
│   ├── wokwigw.exe     # Wokwi Gateway
│   └── start_gateway.bat
├── server/
│   ├── server.js       # Node.js server
│   ├── package.json
│   └── start_server.bat
└── web/
    ├── index.html      # Web UI
    ├── index.css       # Styles
    └── app.js          # Client logic
```

## Hướng dẫn chạy

### Bước 1: Khởi động Node.js Server

```bash
cd server
npm install
npm start
```

Hoặc double-click `server/start_server.bat`

Server sẽ chạy tại: `http://localhost:8080`

### Bước 2: Khởi động Wokwi Gateway

Double-click `gateway/start_gateway.bat`

Wokwi Gateway cho phép ESP32 trong simulator giao tiếp với localhost.

### Bước 3: Mở Web Client

Mở file `web/index.html` trong browser.

Nhập Server URL: `http://localhost:8080` và nhấn "Kết nối".

### Bước 4: Chạy ESP32 trong Wokwi

1. Mở [Wokwi Simulator](https://wokwi.com)
2. Import project từ file `diagram.json` và `sketch.ino`
3. Chạy simulation

ESP32 sẽ tự động kết nối WiFi và bắt đầu gửi dữ liệu lên server.

## Expose ra Internet với ngrok

### Cài đặt ngrok

```bash
# Download từ https://ngrok.com/download
# Hoặc dùng chocolatey
choco install ngrok
```

### Chạy ngrok

```bash
ngrok http 8080
```

ngrok sẽ cung cấp URL public như: `https://abc123.ngrok.io`

### Cập nhật URL trong Web Client

Trong web client, thay đổi Server URL từ `http://localhost:8080` thành URL ngrok.

### Cập nhật URL trong ESP32 (nếu cần)

Nếu bạn muốn ESP32 thật (không phải Wokwi) kết nối qua ngrok:

```cpp
// Trong sketch.ino
String serverUrl = "https://abc123.ngrok.io";
```

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | /status | Lấy trạng thái hiện tại của tất cả thiết bị |
| POST | /esp/status | ESP32 gửi dữ liệu cảm biến |
| GET | /esp/commands | ESP32 lấy lệnh điều khiển |
| POST | /fan | Bật/tắt quạt `{ "state": true/false }` |
| POST | /pump | Bật/tắt bơm `{ "state": true/false }` |
| POST | /buzzer | Bật/tắt còi `{ "state": true/false }` |
| POST | /relay | Bật/tắt relay `{ "state": true/false }` |
| POST | /led | Bật/tắt LED `{ "state": true/false }` |
| POST | /servo | Điều khiển servo `{ "angle": 0-180 }` |

## Thiết bị trong hệ thống

- **LCD 16x2 I2C**: Hiển thị trạng thái
- **MQ2 Gas Sensor**: Cảm biến khí gas
- **LDR Sensor**: Cảm biến ánh sáng (giả lập cảm biến lửa)
- **Servo Motor**: Điều khiển cửa
- **DC Motor (Quạt)**: Hút khí gas
- **DC Motor (Bơm)**: Phun nước dập lửa
- **Buzzer**: Còi báo động
- **Relay + LED**: Điều khiển đèn

## Ghi chú

- Trong Wokwi simulator, ESP32 sử dụng `host.wokwi.internal` để truy cập localhost của máy host
- WebSocket cho phép realtime updates mà không cần polling
- HTTP polling được sử dụng như fallback nếu WebSocket không khả dụng
