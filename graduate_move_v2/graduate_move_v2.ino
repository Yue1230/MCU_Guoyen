#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <ArduinoJson.h>
#include <driver/ledc.h>


// WiFi AP 設定
const char* ap_ssid = "robotcar";
const char* ap_password = "12345678";  // WiFi密碼至少需要8位數

// AsyncWebServer & WebSocket
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// 双L298N 馬達控制腳位
// 左輪馬達 (L298N #1)
const int LEFT_IN1 = 27;
const int LEFT_IN2 = 26;
const int LEFT_ENA = 14;

// 右輪馬達 (L298N #2)  
const int RIGHT_IN1 = 25;
const int RIGHT_IN2 = 33;
const int RIGHT_ENB = 32;

// PWM 設定
const int freq = 30000;
const int leftPwmChannel = 0;   // 左輪PWM通道
const int rightPwmChannel = 1;  // 右輪PWM通道
const int resolution = 8;
int motorSpeed = 100;  // 預設馬達速度 (0-255)

// PCA9685 設定
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);
#define SERVO_MIN  150   // MG996R 最小脈寬
#define SERVO_MAX  600   // MG996R 最大脈寬

// joint初始位置（可自行修改）：
const int INIT_JOINT_1 = 95;
const int INIT_JOINT_2 = 90;
const int INIT_JOINT_3 = 90;
const int INIT_JOINT_4 = 72;
const int INIT_JOINT_5 = 70;
const int INIT_JOINT_6 = 90;

// 機械臂控制變數 - 當前位置
int joint1Current = 95;   // Joint1 - 底座旋轉 (0-180°)
int joint2Current = 90;   // Joint2 - 抬升控制 (0-180°)
int joint3Current = 90;   // Joint3 - 伸展控制 (0-180°)
int joint4Current = 72;   // Joint4 - 夾爪控制 (0-100)
int joint5Current = 70;   // Joint5 (0-180°)
int joint6Current = 90;    // Joint6 (0-180°)

// 機械臂控制變數 - 目標位置
int joint1Target = 90;
int joint2Target = 150;
int joint3Target = 100;
int joint4Target = 70;
int joint5Target = 125;
int joint6Target = 90;

// 上次設定的目標位置 (用於檢測重複)
int joint1LastTarget = 90;
int joint2LastTarget = 90;
int joint3LastTarget = 90;
int joint4LastTarget = 50;
int joint5LastTarget = 90;
int joint6LastTarget = 0;

// 平滑移動參數
const int MOVE_STEP = 2;           // 每次移動的步長(度)
const int MOVE_DELAY = 20;         // 移動間隔時間(毫秒)
unsigned long lastMoveTime = 0;    // 上次移動時間
bool isMovingToTarget = false;     // 是否正在移動到目標位置

// 改進的指令緩衝區結構
struct ServoCommand {
  int joint;
  int angle;
  unsigned long timestamp;
  bool processed;  // 標記是否已處理
};

const int BUFFER_SIZE = 6;  // 緩衝區大小 (6個關節各一個)
ServoCommand commandBuffer[BUFFER_SIZE];
int bufferCount = 0;
const unsigned long COMMAND_THROTTLE = 30;  // 指令節流時間(毫秒)

// 關節角度容差 (避免微小差異造成重複移動)
const int ANGLE_TOLERANCE = 1;  // 1度內視為相同角度

// 車子控制變數
int currentAngle = 90;  // 當前轉向角度 (0-180°)
bool isMoving = false;
bool isEmergencyMode = false;
bool isAutoMode = false;
int autoStep = 0;

// 舵機通道分配
#define JOINT1_CHANNEL 0   // Joint1
#define JOINT2_CHANNEL 1   // Joint2
#define JOINT3_CHANNEL 2   // Joint3
#define JOINT4_CHANNEL 3   // Joint4
#define JOINT5_CHANNEL 14   // Joint5
#define JOINT6_CHANNEL 15   // Joint6
#define STEERING_CHANNEL 6 // 車子轉向舵機

// 角度轉換為PWM值的函數
int angleToPWM(int angle, int minAngle = 0, int maxAngle = 180) {
  angle = constrain(angle, minAngle, maxAngle);
  return map(angle, minAngle, maxAngle, SERVO_MIN, SERVO_MAX);
}

// 夾爪角度轉換（0-100轉換為舵機角度）
int gripperToPWM(int gripperValue) {
  gripperValue = constrain(gripperValue, 0, 100);
  return map(gripperValue, 0, 100, SERVO_MIN, SERVO_MAX);
}

// 獲取上次目標位置
int getLastTarget(int joint) {
  switch (joint) {
    case 1: return joint1LastTarget;
    case 2: return joint2LastTarget;
    case 3: return joint3LastTarget;
    case 4: return joint4LastTarget;
    case 5: return joint5LastTarget;
    case 6: return joint6LastTarget;
    default: return 0;
  }
}

// 獲取當前位置
int getCurrentPosition(int joint) {
  switch (joint) {
    case 1: return joint1Current;
    case 2: return joint2Current;
    case 3: return joint3Current;
    case 4: return joint4Current;
    case 5: return joint5Current;
    case 6: return joint6Current;
    default: return 0;
  }
}

// 改進的指令添加函數 - 防重複和去重
bool addCommandToBuffer(int joint, int angle) {
  unsigned long currentTime = millis();
  
  // 1. 檢查是否與上次目標相同 (防重複)
  int lastTarget = getLastTarget(joint);
  if (abs(angle - lastTarget) <= ANGLE_TOLERANCE) {
    Serial.printf("忽略重複指令 Joint%d: %d° (上次: %d°)\n", joint, angle, lastTarget);
    return false;  // 忽略重複指令
  }
  
  // 2. 檢查緩衝區中是否已有同關節的指令
  for (int i = 0; i < bufferCount; i++) {
    if (commandBuffer[i].joint == joint && !commandBuffer[i].processed) {
      // 更新現有指令，而不是添加新指令
      if (abs(commandBuffer[i].angle - angle) > ANGLE_TOLERANCE) {
        Serial.printf("更新緩衝區 Joint%d: %d° → %d°\n", 
                     joint, commandBuffer[i].angle, angle);
        commandBuffer[i].angle = angle;
        commandBuffer[i].timestamp = currentTime;
        return true;
      } else {
        Serial.printf("忽略相似指令 Joint%d: %d°\n", joint, angle);
        return false;
      }
    }
  }
  
  // 3. 添加新指令到緩衝區
  if (bufferCount < BUFFER_SIZE) {
    commandBuffer[bufferCount].joint = joint;
    commandBuffer[bufferCount].angle = angle;
    commandBuffer[bufferCount].timestamp = currentTime;
    commandBuffer[bufferCount].processed = false;
    bufferCount++;
    Serial.printf("新增指令 Joint%d: %d°\n", joint, angle);
    return true;
  } else {
    Serial.println("緩衝區已滿，忽略指令");
    return false;
  }
}

// 設置目標位置 - 改進版本
bool setJointTarget(int joint, int angle) {
  int currentPos = getCurrentPosition(joint);
  
  // 檢查是否已經在目標位置
  if (abs(currentPos - angle) <= ANGLE_TOLERANCE) {
    Serial.printf("Joint%d 已在目標位置 %d°，忽略移動\n", joint, angle);
    return false;
  }
  
  // 設置新目標並更新上次目標記錄
  switch (joint) {
    case 1:
      joint1Target = constrain(angle, 0, 180);
      joint1LastTarget = joint1Target;
      Serial.printf("設定 Joint1 目標: %d° (當前: %d°)\n", joint1Target, joint1Current);
      break;
    case 2:
      joint2Target = constrain(angle, 0, 180);
      joint2LastTarget = joint2Target;
      Serial.printf("設定 Joint2 目標: %d° (當前: %d°)\n", joint2Target, joint2Current);
      break;
    case 3:
      joint3Target = constrain(angle, 0, 180);
      joint3LastTarget = joint3Target;
      Serial.printf("設定 Joint3 目標: %d° (當前: %d°)\n", joint3Target, joint3Current);
      break;
    case 4:
      joint4Target = constrain(angle, 0, 100);
      joint4LastTarget = joint4Target;
      Serial.printf("設定 Joint4 目標: %d (當前: %d)\n", joint4Target, joint4Current);
      break;
    case 5:
      joint5Target = constrain(angle, 0, 180);
      joint5LastTarget = joint5Target;
      Serial.printf("設定 Joint5 目標: %d° (當前: %d°)\n", joint5Target, joint5Current);
      break;
    case 6:
      joint6Target = constrain(angle, 0, 180);
      joint6LastTarget = joint6Target;
      Serial.printf("設定 Joint6 目標: %d° (當前: %d°)\n", joint6Target, joint6Current);
      break;
    default:
      return false;
  }
  
  isMovingToTarget = true;
  return true;
}

// 清理已處理的指令
void cleanupProcessedCommands() {
  int writeIndex = 0;
  for (int readIndex = 0; readIndex < bufferCount; readIndex++) {
    if (!commandBuffer[readIndex].processed) {
      if (writeIndex != readIndex) {
        commandBuffer[writeIndex] = commandBuffer[readIndex];
      }
      writeIndex++;
    }  
  }
  bufferCount = writeIndex;
}

// 改進的指令處理函數
void processCommandBuffer() {
  if (bufferCount == 0 || isMovingToTarget) {
    return;
  }
  
  // 找到最早的未處理指令
  ServoCommand* nextCmd = nullptr;
  int nextIndex = -1;
  unsigned long earliestTime = ULONG_MAX;
  
  for (int i = 0; i < bufferCount; i++) {
    if (!commandBuffer[i].processed && commandBuffer[i].timestamp < earliestTime) {
      earliestTime = commandBuffer[i].timestamp;
      nextCmd = &commandBuffer[i];
      nextIndex = i;
    }
  }
  
  if (nextCmd != nullptr) {
    // 處理指令
    if (setJointTarget(nextCmd->joint, nextCmd->angle)) {
      Serial.printf("開始處理 Joint%d → %d°\n", nextCmd->joint, nextCmd->angle);
    }
    
    // 標記為已處理
    nextCmd->processed = true;
    
    // 清理已處理的指令
    cleanupProcessedCommands();
  }
}

// 改進的平滑移動函數 - 只在需要時發送狀態
void updateSmoothMovement() {
  unsigned long currentTime = millis();
  
  if (!isMovingToTarget || (currentTime - lastMoveTime) < MOVE_DELAY) {
    return;
  }
  
  bool stillMoving = false;
  bool statusChanged = false;  // 追蹤是否有實際變化
  lastMoveTime = currentTime;
  
  // Joint1 平滑移動
  if (joint1Current != joint1Target) {
    int oldPos = joint1Current;
    if (joint1Current < joint1Target) {
      joint1Current = min(joint1Current + MOVE_STEP, joint1Target);
    } else {
      joint1Current = max(joint1Current - MOVE_STEP, joint1Target);
    }
    if (joint1Current != oldPos) {
      pwm.setPWM(JOINT1_CHANNEL, 0, angleToPWM(joint1Current, 0, 180));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // Joint2 平滑移動
  if (joint2Current != joint2Target) {
    int oldPos = joint2Current;
    if (joint2Current < joint2Target) {
      joint2Current = min(joint2Current + MOVE_STEP, joint2Target);
    } else {
      joint2Current = max(joint2Current - MOVE_STEP, joint2Target);
    }
    if (joint2Current != oldPos) {
      pwm.setPWM(JOINT2_CHANNEL, 0, angleToPWM(joint2Current, 0, 180));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // Joint3 平滑移動
  if (joint3Current != joint3Target) {
    int oldPos = joint3Current;
    if (joint3Current < joint3Target) {
      joint3Current = min(joint3Current + MOVE_STEP, joint3Target);
    } else {
      joint3Current = max(joint3Current - MOVE_STEP, joint3Target);
    }
    if (joint3Current != oldPos) {
      pwm.setPWM(JOINT3_CHANNEL, 0, angleToPWM(joint3Current, 0, 180));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // Joint4 平滑移動
  if (joint4Current != joint4Target) {
    int oldPos = joint4Current;
    if (joint4Current < joint4Target) {
      joint4Current = min(joint4Current + MOVE_STEP, joint4Target);
    } else {
      joint4Current = max(joint4Current - MOVE_STEP, joint4Target);
    }
    if (joint4Current != oldPos) {
      pwm.setPWM(JOINT4_CHANNEL, 0, gripperToPWM(joint4Current));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // Joint5 平滑移動
  if (joint5Current != joint5Target) {
    int oldPos = joint5Current;
    if (joint5Current < joint5Target) {
      joint5Current = min(joint5Current + MOVE_STEP, joint5Target);
    } else {
      joint5Current = max(joint5Current - MOVE_STEP, joint5Target);
    }
    if (joint5Current != oldPos) {
      pwm.setPWM(JOINT5_CHANNEL, 0, angleToPWM(joint5Current, 0, 180));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // Joint6 平滑移動
  if (joint6Current != joint6Target) {
    int oldPos = joint6Current;
    if (joint6Current < joint6Target) {
      joint6Current = min(joint6Current + MOVE_STEP, joint6Target);
    } else {
      joint6Current = max(joint6Current - MOVE_STEP, joint6Target);
    }
    if (joint6Current != oldPos) {
      pwm.setPWM(JOINT6_CHANNEL, 0, angleToPWM(joint6Current, 0, 180));
      statusChanged = true;
    }
    stillMoving = true;
  }
  
  // 只在有實際變化時發送狀態
  if (statusChanged) {
    sendArmStatus();
  }
  
  // 如果所有關節都到達目標位置，停止移動
  if (!stillMoving) {
    isMovingToTarget = false;
    Serial.println("所有關節到達目標位置");
    sendArmStatus(); // 發送最終狀態
  }
}

// === 雙馬達控制函數 ===

// 前進 - 兩輪同向
void motorForward() {
  if (!isEmergencyMode) {
    // 左輪前進
    digitalWrite(LEFT_IN1, HIGH);
    digitalWrite(LEFT_IN2, LOW);
    analogWrite(LEFT_ENA, 100); // 速度 0-255
    // ledcWrite(leftPwmChannel, motorSpeed);
    
    // 右輪前進
    digitalWrite(RIGHT_IN1, HIGH);
    digitalWrite(RIGHT_IN2, LOW);
    analogWrite(RIGHT_ENB, 100);
    // ledcWrite(rightPwmChannel, motorSpeed);
    
    isMoving = true;
    Serial.println("雙馬達前進");
  }
}

// 後退 - 兩輪同向
void motorBackward() {
  if (!isEmergencyMode) {
    // 左輪後退
    digitalWrite(LEFT_IN1, LOW);
    digitalWrite(LEFT_IN2, HIGH);
    analogWrite(LEFT_ENA, 100);
    // ledcWrite(leftPwmChannel, motorSpeed);
    
    // 右輪後退
    digitalWrite(RIGHT_IN1, LOW);
    digitalWrite(RIGHT_IN2, HIGH);
    analogWrite(RIGHT_ENB, 100);
    // ledcWrite(rightPwmChannel, motorSpeed);
    
    isMoving = true;
    Serial.println("雙馬達後退");
  }
}

// 停止 - 兩輪都停
void motorStop() {
  // 左輪停止
  digitalWrite(LEFT_IN1, LOW);
  digitalWrite(LEFT_IN2, LOW);
  analogWrite(LEFT_ENA, 0);
  // ledcWrite(leftPwmChannel, 0);
  
  // 右輪停止
  digitalWrite(RIGHT_IN1, LOW);
  digitalWrite(RIGHT_IN2, LOW);
  analogWrite(RIGHT_ENB, 100);
  // ledcWrite(rightPwmChannel, 0);
  
  isMoving = false;
  Serial.println("雙馬達停止");
}

// // 左轉 - 差速轉向 (左輪慢，右輪快)
void turnLeft() {
  if (!isEmergencyMode) {
    // 更新轉向角度
    currentAngle = constrain(currentAngle - 10, 50, 130);
    pwm.setPWM(STEERING_CHANNEL, 0, angleToPWM(currentAngle, 0, 180));
    
    // 如果正在移動，執行差速轉向
    if (isMoving) {
      // 左輪減速，右輪保持原速
      ledcWrite(leftPwmChannel, motorSpeed * 0.3);   // 左輪30%速度
      ledcWrite(rightPwmChannel, motorSpeed);        // 右輪100%速度
      Serial.printf("左轉中，角度: %d°，左輪減速\n", currentAngle);
    } else {
      Serial.printf("左轉，轉向角度: %d°\n", currentAngle);
    }
  }
} 

// 右轉 - 差速轉向 (右輪慢，左輪快)
void turnRight() {
  if (!isEmergencyMode) {
    // 更新轉向角度
    currentAngle = constrain(currentAngle + 10, 50, 130);
    pwm.setPWM(STEERING_CHANNEL, 0, angleToPWM(currentAngle, 0, 180));
    
    // 如果正在移動，執行差速轉向
    if (isMoving) {
      // 右輪減速，左輪保持原速
      ledcWrite(leftPwmChannel, motorSpeed);         // 左輪100%速度
      ledcWrite(rightPwmChannel, motorSpeed * 0.3);  // 右輪30%速度
      Serial.printf("右轉中，角度: %d°，右輪減速\n", currentAngle);
    } else {
      Serial.printf("右轉，轉向角度: %d°\n", currentAngle);
    }
  }
}

// 緊急停止
void emergencyStop() {
  isEmergencyMode = true;
  isAutoMode = false;
  isMovingToTarget = false; // 停止平滑移動
  motorStop();
  currentAngle = 90; // 重置角度到中央
  pwm.setPWM(STEERING_CHANNEL, 0, angleToPWM(currentAngle, 0, 180));
  Serial.println("緊急停止啟動");
}

// 恢復控制
void resumeControl() {
  isEmergencyMode = false;
  Serial.println("恢復控制");
}

// 發送狀態到前端
void sendStatus() {
  StaticJsonDocument<300> statusDoc;
  statusDoc["type"] = "status";
  statusDoc["isMoving"] = isMoving;
  statusDoc["angle"] = currentAngle;
  statusDoc["isEmergencyMode"] = isEmergencyMode;
  statusDoc["motorType"] = "dual"; // 新增：標識為雙馬達
  
  String statusJson;
  serializeJson(statusDoc, statusJson);
  ws.textAll(statusJson);
}

// 發送機械臂狀態到前端
void sendArmStatus() {
  StaticJsonDocument<400> armDoc;
  armDoc["type"] = "armStatus";
  armDoc["joint1"] = joint1Current;  // 發送當前位置，不是目標位置
  armDoc["joint2"] = joint2Current;
  armDoc["joint3"] = joint3Current;
  armDoc["joint4"] = joint4Current;
  armDoc["joint5"] = joint5Current;
  armDoc["joint6"] = joint6Current;
  armDoc["isAutoMode"] = isAutoMode;
  armDoc["isMoving"] = isMovingToTarget;
  
  String armJson;
  serializeJson(armDoc, armJson);
  ws.textAll(armJson);
}

// 統計和調試函數
void printBufferStatus() {
  Serial.printf("緩衝區狀態: %d/%d\n", bufferCount, BUFFER_SIZE);
  for (int i = 0; i < bufferCount; i++) {
    Serial.printf("  [%d] Joint%d: %d° %s\n", 
                 i, 
                 commandBuffer[i].joint, 
                 commandBuffer[i].angle,
                 commandBuffer[i].processed ? "(已處理)" : "(待處理)");
  }
}

// WebSocket 事件處理
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client,
               AwsEventType type, void *arg, uint8_t *data, size_t len) {

  if (type == WS_EVT_CONNECT) {
    Serial.printf("✅ WebSocket客戶端 %u 已連接\n", client->id());
    Serial.printf("來自IP: %s\n", client->remoteIP().toString().c_str());
    sendStatus();
    sendArmStatus();

  } else if (type == WS_EVT_DISCONNECT) {
    Serial.printf("🔌 WebSocket客戶端 %u 已斷線\n", client->id());

  } else if (type == WS_EVT_ERROR) {
    Serial.printf("❌ WebSocket錯誤，客戶端 %u\n", client->id());

  } else if (type == WS_EVT_DATA) {
    String msg = "";
    for (size_t i = 0; i < len; i++) {
      msg += (char)data[i];
    }
    Serial.printf("📨 收到訊息: %s\n", msg.c_str());

    // 嘗試解析 JSON 格式
    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, msg);

    if (!error) {
      // ✅ JSON 格式 - 機械臂控制指令
      const char* command = doc["action"];
      int value = doc["value"];
      if (strcmp(command, "joint1") == 0) {
      addCommandToBuffer(1, value);
      } else if (strcmp(command, "joint2") == 0) {
        addCommandToBuffer(2, value);
      } else if (strcmp(command, "joint3") == 0) {
        addCommandToBuffer(3, value);
      } else if (strcmp(command, "joint4") == 0) {
        addCommandToBuffer(4, value);
      } else if (strcmp(command, "joint5") == 0) {
        addCommandToBuffer(5, value);
      } else if (strcmp(command, "joint6") == 0) {
        addCommandToBuffer(6, value);
      } else if (strcmp(command, "forward") == 0) {
        motorForward();
        sendStatus();
      } else if (strcmp(command, "backward") == 0) {
        motorBackward();
        sendStatus();
      } else if (strcmp(command, "stop") == 0) {
        motorStop();
        sendStatus();
      } else if (strcmp(command, "left") == 0) {
        turnLeft();
        sendStatus();
      } else if (strcmp(command, "right") == 0) {
        turnRight();
        sendStatus();
      } else if (strcmp(command, "emgStop") == 0) {
        emergencyStop();
        sendStatus();
      } else if (strcmp(command, "resume") == 0) {
        resumeControl();
        sendStatus();
      } else if (strcmp(command, "startAutoMode") == 0) {
        if (!isEmergencyMode) {
          isAutoMode = true;
          bufferCount = 0;
          Serial.println("自動模式啟動");
          auto_parallel_grab();
        }
      } else if (strcmp(command, "stopAutoMode") == 0) {
        isAutoMode = false;
        Serial.println("自動模式停止");
        sendArmStatus();
      } else if (strcmp(command, "armEmgStop") == 0) {
        isAutoMode = false;
        isMovingToTarget = false;
        Serial.println("機械臂緊急停止");
        sendArmStatus();
      } else if (strcmp(command, "armResume") == 0) {
        bufferCount = 0;
        arm_reset();
        Serial.println("機械臂恢復控制");
      } else if (strcmp(command, "getArmPosition") == 0) {
        Serial.println("發送機械臂位置");
        sendArmStatus();
      } else if (strcmp(command, "autoModeCompleted") == 0) {
        isAutoMode = false;
        Serial.println("自動模式完成");
        sendArmStatus();
      } else {
        Serial.printf("未知指令: %s\n", command);
      }
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("=== ESP32S AP模式 雙馬達防重複平滑控制系統啟動 ===");

  // 雙L298N 馬達初始化
  // 左輪馬達
  pinMode(LEFT_IN1, OUTPUT);
  pinMode(LEFT_IN2, OUTPUT);
  pinMode(LEFT_ENA, OUTPUT);
  // ledcSetup(leftPwmChannel, freq, resolution);
  // ledcAttachPin(LEFT_ENA, leftPwmChannel);
  
  // 右輪馬達
  pinMode(RIGHT_IN1, OUTPUT);
  pinMode(RIGHT_IN2, OUTPUT);
  pinMode(RIGHT_ENB, OUTPUT);
  // ledcSetup(rightPwmChannel, freq, resolution);
  // ledcAttachPin(ENB, rightPwmChannel);
  
  motorStop();
  Serial.println("雙L298N 馬達初始化完成");

  // PCA9685 舵機初始化
  Wire.begin(21, 22);
  pwm.begin();
  pwm.setPWMFreq(50);  // MG996R 適用 50Hz
  
  // 設置所有舵機到初始位置
  delay(1000);
  pwm.setPWM(JOINT1_CHANNEL, 0, angleToPWM(joint1Current, 0, 180));
  pwm.setPWM(JOINT2_CHANNEL, 0, angleToPWM(joint2Current, 0, 180));
  pwm.setPWM(JOINT3_CHANNEL, 0, angleToPWM(joint3Current, 0, 180));
  pwm.setPWM(JOINT4_CHANNEL, 0, gripperToPWM(joint4Current));
  pwm.setPWM(JOINT5_CHANNEL, 0, angleToPWM(joint5Current, 0, 180));
  pwm.setPWM(JOINT6_CHANNEL, 0, angleToPWM(joint6Current, 0, 180));
  pwm.setPWM(STEERING_CHANNEL, 0, angleToPWM(currentAngle, 0, 180));
  Serial.println("PCA9685 舵機初始化完成");

  // 設定AP模式
  Serial.println("啟動AP模式...");
  WiFi.softAP(ap_ssid, ap_password);
  
  // 設定AP的IP地址（可選，預設為192.168.4.1）
  IPAddress local_IP(192, 168, 4, 1);
  IPAddress gateway(192, 168, 4, 1);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.softAPConfig(local_IP, gateway, subnet);
  
  // 等待AP啟動
  delay(2000);
  
  Serial.println("📶 AP模式啟動成功!");
  Serial.printf("📶 WiFi熱點名稱: %s\n", ap_ssid);
  Serial.printf("🔑 WiFi密碼: %s\n", ap_password);
  Serial.printf("🌐 AP IP地址: %s\n", WiFi.softAPIP().toString().c_str());
  Serial.printf("👥 已連接設備數: %d\n", WiFi.softAPgetStationNum());
  
  // 增加HTTP測試端點
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    String html = "<html><head><title>RobotCar Control</title></head>";
    html += "<body><h1>🤖 RobotCar Control Server</h1>";
    html += "<p>✅ ESP32S AP模式運行中</p>";
    html += "<p>📶 WiFi: " + String(ap_ssid) + "</p>";
    html += "<p>🌐 IP: " + WiFi.softAPIP().toString() + "</p>";
    html += "<p>🔌 WebSocket: ws://" + WiFi.softAPIP().toString() + "/ws</p>";
    html += "<hr><h2>🎮 測試指令</h2>";
    html += "<button onclick=\"sendWS('forward')\">前進</button> ";
    html += "<button onclick=\"sendWS('backward')\">後退</button> ";
    html += "<button onclick=\"sendWS('left')\">左轉</button> ";
    html += "<button onclick=\"sendWS('right')\">右轉</button> ";
    html += "<button onclick=\"sendWS('stop')\">停止</button>";
    html += "<script>";
    html += "var ws = new WebSocket('ws://" + WiFi.softAPIP().toString() + "/ws');";
    html += "function sendWS(cmd){ ws.send(cmd); }";
    html += "ws.onopen = function(){ console.log('Connected'); };";
    html += "ws.onmessage = function(e){ console.log('Received:', e.data); };";
    html += "</script></body></html>";
    request->send(200, "text/html", html);
  });
  
  server.on("/test", HTTP_GET, [](AsyncWebServerRequest *request){
    StaticJsonDocument<200> testDoc;
    testDoc["status"] = "ok";
    testDoc["device"] = "robotcar";
    testDoc["mode"] = "AP";
    testDoc["ip"] = WiFi.softAPIP().toString();
    testDoc["ssid"] = ap_ssid;
    testDoc["clients"] = WiFi.softAPgetStationNum();
    
    String testJson;
    serializeJson(testDoc, testJson);
    request->send(200, "application/json", testJson);
  });

  // WebSocket 設定
  ws.onEvent(onWsEvent);
  server.addHandler(&ws);
  
  // 啟動HTTP服務器
  server.begin();
  Serial.println("🌐 WebSocket 服務器已啟動");
  Serial.println("🔗 測試連接: http://192.168.4.1/");
  Serial.println("🔗 API測試: http://192.168.4.1/test");
  Serial.println("🔌 WebSocket: ws://192.168.4.1/ws");
  Serial.println("=== 系統初始化完成 ===");
  Serial.println("請連接WiFi熱點 'robotcar' 密碼 '12345678'");
}

void loop() {
  // 處理平滑移動
  updateSmoothMovement();
  
  // 處理指令緩衝區
  processCommandBuffer();

  // 定期發送狀態更新和客戶端統計
  static unsigned long lastStatusUpdate = 0;
  if (millis() - lastStatusUpdate > 5000) {
    sendStatus();
    
    // 每5秒顯示連接的客戶端數量
    int clientCount = WiFi.softAPgetStationNum();
    Serial.printf("📊 目前連接客戶端數: %d\n", clientCount);
    
    lastStatusUpdate = millis();
  }
  
  // 調試：每10秒打印緩衝區狀態
  static unsigned long lastDebug = 0;
  if (millis() - lastDebug > 10000) {
    if (bufferCount > 0) {
      printBufferStatus();
    }
    lastDebug = millis();
  }
  
  // 清理WebSocket連接
  ws.cleanupClients();
  
  // 4) 自動流程 (五階段) 判斷：
  if (isAutoMode && !isEmergencyMode) {
    // ----- 階段1：等待「同步移動到抓取前姿態」完成 -----
    if (autoStep == 1 && !isMovingToTarget) {
      // 第一階段完成後，進入第二階段：夾緊物件
      joint6Target   = 22;   // Joint6 從 90° → 22° 夾緊
      joint6LastTarget = joint6Target;
      isMovingToTarget = true;    // 只對 Joint6 啟動平滑移動
      autoStep = 2;
      Serial.println("自動抓取階段2：Joint6 夾緊 (90°→22°)");
    }
    // ----- 階段2：等待「夾緊物件」完成 -----
    else if (autoStep == 2 && !isMovingToTarget) {
      // 第二階段完成後，進入第三階段：抬起手臂
      joint5Target = 100;  // Joint5 由 180° → 100°
      joint2Target = 133;  // Joint2 由 180° → 133°
      joint3Target = 100;  // Joint3 由 80° → 100°
      // 更新「上次目標」
      joint5LastTarget = joint5Target;
      joint2LastTarget = joint2Target;
      joint3LastTarget = joint3Target;
      isMovingToTarget = true;    // 只對 joint2、3、5 啟動平滑移動
      autoStep = 3;
      Serial.println("自動抓取階段3：抬起手臂 (joint2→133°, joint3→100°, joint5→100°)");
    }
    // ----- 階段3：等待「抬起手臂」完成 -----
    else if (autoStep == 3 && !isMovingToTarget) {
      // 第三階段完成後，進入第四階段：移動到放置位置
      joint1Target = 0;    // Joint1 → 0°
      joint2Target = 150;  // Joint2 → 155°
      joint3Target = 95;  // Joint3 → 85°
      joint4Target = 70;   // Joint4 → 70° (保持夾爪張開不變)
      joint5Target = 120;  // Joint5 → 120°
      joint6Target = 22;   // Joint6 → 22° (保持夾緊狀態)
      // 更新「上次目標」
      joint1LastTarget = joint1Target;
      joint2LastTarget = joint2Target;
      joint3LastTarget = joint3Target;
      joint4LastTarget = joint4Target;
      joint5LastTarget = joint5Target;
      joint6LastTarget = joint6Target;
      isMovingToTarget = true;    // 同步對 1~6 各關節做平滑移動
      autoStep = 4;
      Serial.println("自動抓取階段4：移動到放置位置 (joint1~6 設定新角度)");
    }
    // ----- 階段4：等待「移動到放置位置」完成 -----
    else if (autoStep == 4 && !isMovingToTarget) {
      // 第四階段完成後，進入第五階段：打開夾爪
      joint6Target = 90;   // Joint6 從 22° → 90° 放開物件
      joint6LastTarget = joint6Target;
      isMovingToTarget = true;    // 只針對 Joint6 啟動平滑移動
      autoStep = 5;
      Serial.println("自動抓取階段5：Joint6 打開 (22°→90°)");
    }
    // ----- 階段5：等待「打開夾爪」完成 -----
    else if (autoStep == 5 && !isMovingToTarget) {
      // 進入第6階段：回歸初始位置
      joint1Target = INIT_JOINT_1;
      joint2Target = INIT_JOINT_2;
      joint3Target = INIT_JOINT_3;
      joint4Target = INIT_JOINT_4;
      joint5Target = INIT_JOINT_5;
      joint6Target = INIT_JOINT_6;
      joint1LastTarget = joint1Target;
      joint2LastTarget = joint2Target;
      joint3LastTarget = joint3Target;
      joint4LastTarget = joint4Target;
      joint5LastTarget = joint5Target;
      joint6LastTarget = joint6Target;
      isMovingToTarget = true;
      autoStep = 6;
      Serial.println("階段6：回歸初始位置 (joint1~6 → 90)");
    }
    // ----- 階段6：等待「回歸初始位置」完成 -----
    else if (autoStep == 6 && !isMovingToTarget) {
      // 自動流程結束
      isAutoMode = false;
      autoStep = 0;
      Serial.println("自動流程完成，手臂已回歸初始位置");
      sendArmStatus();  // 最後回報一次最終位置
    }
    // 若 autoStep==0，不在自動流程，則不執行任何自動邏輯
  }

  delay(10);
}

void auto_parallel_grab(){
  joint1Target = 95;   // 底座旋轉到水平偏左 92°
  joint2Target = 158;  // 抬升到最高 180°
  joint3Target = 65;   // 伸展到 80°
  joint4Target = 70;   // 
  joint5Target = 175;  // Joint5 旋轉到180°
  joint6Target = 90;   // Joint6 保持 90°

  // 更新「上次目標」以免誤判重複
  joint1LastTarget = joint1Target;
  joint2LastTarget = joint2Target;
  joint3LastTarget = joint3Target;
  joint4LastTarget = joint4Target;
  joint5LastTarget = joint5Target;
  joint6LastTarget = joint6Target;

  // 啟動平滑移動
  isMovingToTarget = true;

  // 設定下一個自動階段
  autoStep = 1;

  Serial.println("自動抓取第一階段：同時移動到抓取位置");
}

void arm_reset(){
  joint1Target = INIT_JOINT_1;
  joint2Target = INIT_JOINT_2;
  joint3Target = INIT_JOINT_3;
  joint4Target = INIT_JOINT_4;
  joint5Target = INIT_JOINT_5;
  joint6Target = INIT_JOINT_6;

  // 2. 更新 lastTarget，避免誤判重複
  joint1LastTarget = joint1Target;
  joint2LastTarget = joint2Target;
  joint3LastTarget = joint3Target;
  joint4LastTarget = joint4Target;
  joint5LastTarget = joint5Target;
  joint6LastTarget = joint6Target;

  // 4. 觸發平滑移動
  isMovingToTarget = true;

  Serial.println("arm_reset(): 手臂回歸初始位置，開始平滑移動");
}