#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

const char* ssid = "ESP32-AP";
const char* password = "12345678";

AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// UART to Arduino Mega
#define TXD 18  // ESP32 TX -> Arduino RX1
#define RXD 19  // ESP32 RX -> Arduino TX1

void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
  AwsFrameInfo *info = (AwsFrameInfo*)arg;
  if (info->final && info->opcode == WS_TEXT) {
    String jsonStr = String((char*)data);
    Serial.println("[WS] 收到: " + jsonStr);

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, jsonStr);
    if (err) {
      Serial.println("JSON 解析錯誤");
      return;
    }

    String action = doc["action"] | "";
    int value = doc["value"] | 0;

    // 傳送簡化資料格式給 Arduino（如：rotate:90）
    String uartMsg = action + ":" + String(value) + "}";
    Serial1.print(uartMsg);
    Serial.println("已透過 UART 傳給 Arduino: " + uartMsg);
  }
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
               AwsEventType type, void *arg, uint8_t *data, size_t len) {
  if (type == WS_EVT_DATA) {
    handleWebSocketMessage(arg, data, len);
  }
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600, SERIAL_8N1, RXD, TXD);  // UART to Arduino

  WiFi.softAP(ssid, password);
  Serial.print("AP IP: "); Serial.println(WiFi.softAPIP());

  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  server.begin();
}

void loop() {
  // 無需輪詢 WebSocket
}
