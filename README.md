
# 🚗 Robot Car & Robotic Arm Controller

一個使用 **React Native** 和 **ESP32** 搭配 **WebSocket** 實現的機器車與機械臂遠端控制系統。

前端 App 支援：

✅ 車輪方向控制  
✅ 機械臂多關節滑桿控制、自動動作序列  
✅ 緊急停止功能  
✅ 實時狀態回饋  

ESP32 側程式負責處理 WebSocket 指令，控制馬達/伺服機等硬體。

---

## 🗂️ Table of Contents

- [Demo](#demo)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Dependencies](#dependencies)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributors](#contributors)
- [License](#license)

---

## 🎬 Demo

> App 首頁：車子連線狀態 + 進入控制頁面  
> 車輪控制頁面：方向控制 + 緊急停止  
> 機械臂控制頁面：6 軸滑桿 + 自動動作 + 緊急停止  

---

## ✨ Features

- React Native App 支援 WebSocket 實時通訊
- 車輪控制：前進、後退、左轉、右轉，角度微調
- 機械臂 6 軸關節控制
- 機械臂自動流程動畫（取物 → 抬升 → 運送 → 回位）
- 緊急停止功能（即時中斷動作）
- ESP32 回傳當前狀態（位置、動作）

---

## ⚙️ Architecture

```
+-------------+            +-------------+            +-----------+
| ReactNative |  <--WS-->  | ESP32 MCU   |  --> PWM / GPIO --> Motor / Servo
| App (Expo)  |            | WebSocket   |            | Hardware  |
+-------------+            +-------------+            +-----------+
```

- `/index.jsx` → App 首頁
- `/control.jsx` → 車輪控制頁面
- `/armcontrol.jsx` → 機械臂控制頁面
- `/service/websocketService.js` → 共用 WebSocket 通道
- `graduate_move_v2.ino` → ESP32 Arduino 端程式碼

---

## 🛠️ Installation

1️⃣ Clone this repo:

```bash
git clone https://github.com/your-repo/robot-car-arm-controller.git
cd robot-car-arm-controller
```

2️⃣ 安裝依賴：

```bash
npm install
```

3️⃣ 啟動 Expo：

```bash
npx expo start
```

---

## 🚀 Usage

1️⃣ 先將 ESP32 上傳 `graduate_move_v2.ino`  
2️⃣ 開啟 ESP32，確認 WiFi 已連線  
3️⃣ 開啟 React Native App，點選「連接車子」  
4️⃣ 進入「車輪控制」或「手臂控制」頁面操作

---

## ⚙️ Configuration

- WebSocket 服務位址需設定 ESP32 IP
  - `/service/websocketService.js`
- 機械臂關節位置可於 `armcontrol.jsx` 調整 `POSITION_CONFIGS`

---

## 📦 Dependencies

前端：

```json
"expo": "^50.x.x",
"expo-router": "^3.x.x",
"react-native-gesture-handler": "^2.x.x",
"@react-native-community/slider": "^4.x.x",
"@expo/vector-icons": "^14.x.x",
"react-native": ">=0.73",
```

ESP32：
```
- Arduino IDE
- ESP32 Board package
- WiFi
- ESPAsyncWebserver
- AduinoJson
- Async TCP
- Adafruit Bus IO
- Adafruit PWM Servo Driver Library
```
---

## 🧑‍🏫 Examples

```text
- 手動控制滑桿 Joint1 ~ Joint6
- 一鍵自動執行取物 → 運送流程
- 車輪控制 長按/單擊觸控
- 緊急停止 → 恢復
```

---

## 🐞 Troubleshooting

- 無法連線？
  - 確認 ESP32 IP 位址正確
  - 確認 WebSocket Server 已啟動
  - WiFi 網路正常

- 動作延遲？
  - 檢查 WebSocket 頻寬
  - 優化動畫參數 `ANIMATION_SETTINGS`

---

## 👥 Contributors

- 🧑‍💻 Author: ChangYue
- Special thanks to OpenAI GPT Assistance

---

## 📜 License

MIT License
