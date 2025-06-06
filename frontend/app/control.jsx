// ControlPage.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Vibration,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  GestureHandlerRootView,
  TapGestureHandler,
  LongPressGestureHandler,
  State,
} from 'react-native-gesture-handler';
import { useWebSocket } from '/Users/changyue/MCU/service/websocketService.js'; // 導入WebSocket服務

const { width, height } = Dimensions.get('window');

export default function ControlPage() {
  const [isMoving, setIsMoving] = useState(false);
  const [currentDirection, setCurrentDirection] = useState('stop');
  const [currentAngle, setCurrentAngle] = useState(90); // 初始角度為90度
  
  // 分離前進/後退和左右轉的狀態
  const [leftPressed, setLeftPressed] = useState(false);
  const [rightPressed, setRightPressed] = useState(false);
  const [forwardPressed, setForwardPressed] = useState(false);
  const [backwardPressed, setBackwardPressed] = useState(false);
  
  // 追蹤當前的運動狀態
  const [isMovingForward, setIsMovingForward] = useState(false);
  const [isMovingBackward, setIsMovingBackward] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  
  const router = useRouter();
  
  // 使用全域WebSocket服務
  const { isConnected, sendCommand, addMessageHandler } = useWebSocket();
  
  // Gesture handler refs
  const forwardGestureRef = useRef(null);
  const backwardGestureRef = useRef(null);
  const leftGestureRef = useRef(null);
  const rightGestureRef = useRef(null);
  const emergencyGestureRef = useRef(null);
  const backButtonGestureRef = useRef(null);

  // 處理接收到的訊息
  useEffect(() => {
    const removeMessageHandler = addMessageHandler((data) => {
      if (data.type === 'status') {
        setIsMoving(data.isMoving);
        // 如果WebSocket回傳角度資訊，可以在這裡更新
        if (data.angle !== undefined) {
          setCurrentAngle(data.angle);
        }
      }
    });

    return () => {
      removeMessageHandler();
    };
  }, [addMessageHandler]);

  // 前進控制手勢處理 - 使用 LongPressGestureHandler
  const onForwardGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    console.log('Forward gesture state:', state);
    
    if (state === State.ACTIVE) {
      console.log('Forward button pressed');
      setForwardPressed(true);
      // 如果當前在後退，先停止後退
      if (isMovingBackward) {
        setIsMovingBackward(false);
      }
      sendCommand('forward');
      setIsMovingForward(true);
      setCurrentDirection('forward');
      setIsMoving(true);
      Vibration.vibrate(30);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      console.log('Forward button released');
      setForwardPressed(false);
      // 放開時停止前進
      sendCommand('stop');
      setIsMovingForward(false);
      setCurrentDirection('stop');
      setIsMoving(false);
    }
  };

  // 後退控制手勢處理 - 使用 LongPressGestureHandler
  const onBackwardGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    console.log('Backward gesture state:', state);
    
    if (state === State.ACTIVE) {
      console.log('Backward button pressed');
      setBackwardPressed(true);
      // 如果當前在前進，先停止前進
      if (isMovingForward) {
        setIsMovingForward(false);
      }
      sendCommand('backward');
      setIsMovingBackward(true);
      setCurrentDirection('backward');
      setIsMoving(true);
      Vibration.vibrate(30);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      console.log('Backward button released');
      setBackwardPressed(false);
      // 放開時停止後退
      sendCommand('stop');
      setIsMovingBackward(false);
      setCurrentDirection('stop');
      setIsMoving(false);
    }
  };

  // 左轉控制手勢處理 - 使用 TapGestureHandler
  const onLeftGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    console.log('Left gesture state:', state);
    
    if (state === State.BEGAN) {
      console.log('Left button pressed');
      setLeftPressed(true);
      sendCommand('right');
      // 左轉減少10度，最小值為50度
      setCurrentAngle(prevAngle => {
        const newAngle = prevAngle + 10;
        return newAngle > 130 ? 130 : newAngle;
      });
      Vibration.vibrate(30);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      console.log('Left button released');
      setLeftPressed(false);
    }
  };

  // 右轉控制手勢處理 - 使用 TapGestureHandler
  const onRightGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    console.log('Right gesture state:', state);
    
    if (state === State.BEGAN) {
      console.log('Right button pressed');
      setRightPressed(true);
      sendCommand('left');
      // 右轉增加10度，最大值為130度
      setCurrentAngle(prevAngle => {
        const newAngle = prevAngle - 10;
        return newAngle < 50 ? 50 : newAngle;
      });
      Vibration.vibrate(30);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      console.log('Right button released');
      setRightPressed(false);
    }
  };

  // 緊急停止
  const onEmergencyGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      if (!isEmergencyMode) {
        emergencyStop();
      } else {
        resumeControl();
      }
    }
  };

  const emergencyStop = () => {
    sendCommand('emgStop');
    setCurrentDirection('emgStop');
    setIsMoving(false);
    setIsMovingForward(false);
    setIsMovingBackward(false);
    setLeftPressed(false);
    setRightPressed(false);
    setForwardPressed(false);
    setBackwardPressed(false);
    setCurrentAngle(90); // 緊急停止時重置角度到90度
    setIsEmergencyMode(true);
    Vibration.vibrate([100, 50, 100]);
    console.log('緊急停止');
  };

  // 恢復控制
  const resumeControl = () => {
    sendCommand('resume');
    setIsEmergencyMode(false);
    setCurrentDirection('stop');
    Vibration.vibrate(50);
    console.log('恢復控制');
  };

  // 返回按鈕手勢處理
  const onBackButtonGestureStateChange = (event) => {
    const { state } = event.nativeEvent;
    
    if (state === State.ACTIVE) {
      router.back();
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <StatusBar hidden />
        
        {/* 左上角返回按鈕 */}
        <TapGestureHandler
          ref={backButtonGestureRef}
          onHandlerStateChange={onBackButtonGestureStateChange}
          shouldCancelWhenOutside={true}
        >
          <View style={styles.topLeftBackButton}>
            <MaterialIcons name="keyboard-arrow-up" size={24} color="#333" />
            <Text style={styles.topBackText}>返回</Text>
          </View>
        </TapGestureHandler>

        {/* 主要內容容器 */}
        <View style={styles.mainContent}>
          {/* 左側控制區域 */}
          <View style={styles.leftSection}>
            {/* 上方控制圓圈 - 轉向控制 */}
            <View style={styles.topControlContainer}>
              <View style={styles.controlWithLabel}>
                <View style={styles.controlCircle}>
                  <TapGestureHandler
                    ref={leftGestureRef}
                    onHandlerStateChange={onLeftGestureStateChange}
                    shouldCancelWhenOutside={true}
                    simultaneousHandlers={[forwardGestureRef, backwardGestureRef]}
                  >
                    <View
                      style={[
                        styles.circleButton,
                        styles.topButton,
                        leftPressed && styles.pressedButton
                      ]}
                    >
                      <MaterialIcons name="keyboard-arrow-up" size={24} color="#FFF" />
                      <Text style={styles.buttonText}>左轉</Text>
                    </View>
                  </TapGestureHandler>
                  
                  <TapGestureHandler
                    ref={rightGestureRef}
                    onHandlerStateChange={onRightGestureStateChange}
                    shouldCancelWhenOutside={true}
                    simultaneousHandlers={[forwardGestureRef, backwardGestureRef]}
                  >
                    <View
                      style={[
                        styles.circleButton,
                        styles.bottomButton,
                        rightPressed && styles.pressedButton
                      ]}
                    >
                      <MaterialIcons name="keyboard-arrow-down" size={24} color="#FFF" />
                      <Text style={styles.buttonText}>右轉</Text>
                    </View>
                  </TapGestureHandler>
                </View>
                <View style={styles.sectionLabelWrapper}>
                  <Text style={styles.sectionLabel}>轉向控制</Text>
                </View>
              </View>
            </View>

            {/* 中間緊急停止按鈕 */}
            <View style={styles.middleSection}>
              <TapGestureHandler
                ref={emergencyGestureRef}
                onHandlerStateChange={onEmergencyGestureStateChange}
                shouldCancelWhenOutside={true}
              >
                <View
                  style={[
                    styles.emergencyButton,
                    isEmergencyMode && styles.resumeButton
                  ]}
                >
                  <Text style={styles.emergencyText}>
                    {!isEmergencyMode ? '緊急停止' : '恢復控制'}
                  </Text>
                </View>
              </TapGestureHandler>
            </View>

            {/* 下方控制圓圈 - 前進後退 */}
            <View style={styles.bottomControlContainer}>
              <View style={styles.controlWithLabel}>
                <View style={styles.controlCircle}>
                  <LongPressGestureHandler
                    ref={backwardGestureRef}
                    onHandlerStateChange={onBackwardGestureStateChange}
                    shouldCancelWhenOutside={true}
                    simultaneousHandlers={[leftGestureRef, rightGestureRef]}
                    minDurationMs={0}
                  >
                    <View
                      style={[
                        styles.circleButton,
                        styles.leftButton,
                        (backwardPressed || isMovingBackward) && styles.pressedButton,
                        isMovingBackward && styles.activeButton
                      ]}
                    >
                      <MaterialIcons name="keyboard-arrow-left" size={24} color="#FFF" />
                      <Text style={styles.buttonText}>後退</Text>
                    </View>
                  </LongPressGestureHandler>
                  
                  <LongPressGestureHandler
                    ref={forwardGestureRef}
                    onHandlerStateChange={onForwardGestureStateChange}
                    shouldCancelWhenOutside={true}
                    simultaneousHandlers={[leftGestureRef, rightGestureRef]}
                    minDurationMs={0}
                  >
                    <View
                      style={[
                        styles.circleButton,
                        styles.rightButton,
                        (forwardPressed || isMovingForward) && styles.pressedButton,
                        isMovingForward && styles.activeButton
                      ]}
                    >
                      <MaterialIcons name="keyboard-arrow-right" size={24} color="#FFF" />
                      <Text style={styles.buttonText}>前進</Text>
                    </View>
                  </LongPressGestureHandler>
                </View>
                <View style={styles.sectionLabelWrapper}>
                  <Text style={styles.sectionLabel}>前進後退</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 右側資訊區域 */}
          <View style={styles.rightSection}>
            <View style={styles.deviceInfoCard}>
              <Text style={styles.deviceLabel}>Device: robotcar</Text>
              <Text style={[styles.connectionStatus, { color: isConnected ? '#4CAF50' : '#F44336' }]}>
                <Text style={styles.deviceType}>連線狀態：</Text>
                {isConnected ? '已連線' : '未連線'}
              </Text>
              <Text style={styles.wifiInfo}>連線方式：WiFi</Text>
              <Text style={styles.statusInfo}>
                狀態：{isEmergencyMode ? '緊急停止模式' : 
                       isMovingForward ? '前進中' : 
                       isMovingBackward ? '後退中' : '停止'}
              </Text>
              <Text style={styles.statusInfo}>目前角度：{currentAngle}°</Text>
            </View>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
    padding: 40,
  },
  leftSection: {
    flex: 3,
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  rightSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 20,
  },
  topLeftBackButton: {
    position: 'absolute',
    top: 30,
    right: 30,
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 10,
    width: 50,
    height: 70,
    justifyContent: 'center',
  },
  topBackText: {
    fontSize: 12,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 4,
    transform: [{ rotate: '90deg' }],
  },
  topControlContainer: {
    alignItems: 'center',
  },
  bottomControlContainer: {
    alignItems: 'center',
  },
  controlWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionLabelWrapper: {
    marginLeft: 15,
    transform: [{ rotate: '90deg' }],
  },
  sectionLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  controlCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#2C2C2C',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleButton: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  topButton: {
    top: 18,
  },
  bottomButton: {
    bottom: 18,
  },
  leftButton: {
    left: 18,
  },
  rightButton: {
    right: 18,
  },
  pressedButton: {
    backgroundColor: 'rgba(33,150,243,0.8)',
    transform: [{ scale: 0.9 }],
  },
  activeButton: {
    backgroundColor: 'rgba(33,150,243,0.6)',
    borderColor: 'rgba(33,150,243,0.8)',
    borderWidth: 2,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
    transform: [{ rotate: '90deg' }],
  },
  middleSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emergencyButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E53E3E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  resumeButton: {
    backgroundColor: '#4CAF50',
  },
  emergencyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },
  deviceInfoCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 25,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    width: 300,
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  deviceLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 5,
    fontWeight: 'bold',
  },
  connectionStatus: {
    fontSize: 13,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  deviceType: {
    fontSize: 11,
    color: '#666',
    marginBottom: 10,
    textAlign: 'center',
  },
  wifiInfo: {
    fontSize: 11,
    color: '#2196F3',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statusInfo: {
    fontSize: 11,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 5,
  },
});