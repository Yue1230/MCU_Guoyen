import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  Vibration,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import {
  GestureHandlerRootView,
  State,
} from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import { useWebSocket } from '../service/websocketService'; // 更新導入路徑

const { width, height } = Dimensions.get('window');

// 可自定義的位置設定 - 你可以根據需要修改這些值
const POSITION_CONFIGS = {
  // 第一階段：移動到物品位置
  PICK_POSITION: {
    joint1: 92,    // Joint1旋轉到物品位置
    joint2: 180,    // Joint2抬升到合適高度
    joint3: 80,    // Joint3伸展到物品位置
    joint4: 70,    // Joint4
    joint5: 180,    // Joint5角度
    joint6: 90     // Joint6夾爪張開準備夾取
  },
  
  // 第三階段：運送到指定位置
  TARGET_POSITION: {
    joint1: 0,   // Joint1旋轉到指定位置
    joint2: 150,    // Joint2抬升高度
    joint3: 100,   // Joint3伸展距離
    joint4: 70,    // Joint4
    joint5: 125,    // Joint5角度
    joint6: 90     // Joint6夾爪夾緊
  },
  
  // 初始位置
  INITIAL_POSITION: {
    joint1: 95,
    joint2: 90,
    joint3: 90,
    joint4: 72,
    joint5: 70,
    joint6: 90
  }
};

// 動畫設定
const ANIMATION_SETTINGS = {
  DURATION: 500,         // 動畫持續時間(毫秒) - 加快速度
  DELAY: 300,            // 關節之間的動畫延遲時間(毫秒) - 縮短延遲
  GRIP_WAIT_TIME: 500    // 夾取動作的等待時間 - 縮短等待
};

export default function ArmControlPage() {
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('待機中'); // 固定顯示當前狀態
  const [phaseStep, setPhaseStep] = useState(0); // 當前步驟
  
  // 機械臂位置狀態
  const [joint1Pos, setJoint1Pos] = useState(95);    // Joint1 - 底座旋轉
  const [joint2Pos, setJoint2Pos] = useState(90);    // Joint2 - 抬升控制
  const [joint3Pos, setJoint3Pos] = useState(90);    // Joint3 - 伸展控制
  const [joint4Pos, setJoint4Pos] = useState(72);    // Joint4
  const [joint5Pos, setJoint5Pos] = useState(70);    // Joint5
  const [joint6Pos, setJoint6Pos] = useState(90);    // Joint6 - 夾爪控制
  
  // 動畫值
  const joint1PosAnim = useRef(new Animated.Value(joint1Pos)).current;
  const joint2PosAnim = useRef(new Animated.Value(joint2Pos)).current;
  const joint3PosAnim = useRef(new Animated.Value(joint3Pos)).current;
  const joint4PosAnim = useRef(new Animated.Value(joint4Pos)).current;
  const joint5PosAnim = useRef(new Animated.Value(joint5Pos)).current;
  const joint6PosAnim = useRef(new Animated.Value(joint6Pos)).current;
  
  const router = useRouter();
  
  // 使用全域WebSocket服務
  const { isConnected, sendCommand, addMessageHandler } = useWebSocket();
  
  // 處理接收到的訊息
  useEffect(() => {
    const removeMessageHandler = addMessageHandler((data) => {
      if (data.type === 'armStatus') {
        // 如果不在自動模式和動畫中，才更新機械臂位置狀態
        if (!isAutoMode && !isAnimating && !isEmergencyMode) {
          updatePositionsFromServer(data);
        }
      }
    });

    return () => {
      removeMessageHandler();
    };
  }, [isAutoMode, isAnimating, isEmergencyMode, addMessageHandler]);

  // 當頁面載入時，如果已連線則獲取初始位置
  useEffect(() => {
    if (isConnected && !isEmergencyMode) {
      sendCommand('getArmPosition');
    }
  }, [isConnected, isEmergencyMode]);
  
  // 修正後的動畫監聽器 - 只在手動模式時發送命令
  useEffect(() => {
    const joint1Sub = joint1PosAnim.addListener(({ value }) => {
      // 緊急停止時不更新UI狀態
      if (!isEmergencyMode) {
        setJoint1Pos(value);
        // 只在手動模式時發送命令（非自動模式且非動畫中）
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint1', Math.round(value));
        }
      }
    });
    
    const joint2Sub = joint2PosAnim.addListener(({ value }) => {
      if (!isEmergencyMode) {
        setJoint2Pos(value);
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint2', Math.round(value));
        }
      }
    });
    
    const joint3Sub = joint3PosAnim.addListener(({ value }) => {
      if (!isEmergencyMode) {
        setJoint3Pos(value);
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint3', Math.round(value));
        }
      }
    });
    
    const joint4Sub = joint4PosAnim.addListener(({ value }) => {
      if (!isEmergencyMode) {
        setJoint4Pos(value);
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint4', Math.round(value));
        }
      }
    });
    
    const joint5Sub = joint5PosAnim.addListener(({ value }) => {
      if (!isEmergencyMode) {
        setJoint5Pos(value);
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint5', Math.round(value));
        }
      }
    });
    
    const joint6Sub = joint6PosAnim.addListener(({ value }) => {
      if (!isEmergencyMode) {
        setJoint6Pos(value);
        if (!isAutoMode && !isAnimating) {
          sendCommand('joint6', Math.round(value));
        }
      }
    });
    
    return () => {
      joint1PosAnim.removeListener(joint1Sub);
      joint2PosAnim.removeListener(joint2Sub);
      joint3PosAnim.removeListener(joint3Sub);
      joint4PosAnim.removeListener(joint4Sub);
      joint5PosAnim.removeListener(joint5Sub);
      joint6PosAnim.removeListener(joint6Sub);
    };
  }, [isAutoMode, isAnimating, isEmergencyMode]); // 加入 isAnimating 依賴
  
  const updatePositionsFromServer = (data) => {
    // 更新狀態和動畫值
    const updatePositionAndAnim = (value, setState, animValue, defaultValue = 50) => {
      const newValue = value !== undefined ? value : defaultValue;
      setState(newValue);
      animValue.setValue(newValue);
    };
    
    updatePositionAndAnim(data.joint1, setJoint1Pos, joint1PosAnim);
    updatePositionAndAnim(data.joint2, setJoint2Pos, joint2PosAnim);
    updatePositionAndAnim(data.joint3, setJoint3Pos, joint3PosAnim);
    updatePositionAndAnim(data.joint4, setJoint4Pos, joint4PosAnim);
    updatePositionAndAnim(data.joint5, setJoint5Pos, joint5PosAnim);
    updatePositionAndAnim(data.joint6, setJoint6Pos, joint6PosAnim);
  };

  // 控制函數
  const handleJoint1Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return; // 緊急停止時不允許手動調整
    setJoint1Pos(value);
    joint1PosAnim.setValue(value); // 同步更新動畫值
    sendCommand('joint1', value);
  };
  
  const handleJoint2Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return;
    setJoint2Pos(value);
    joint2PosAnim.setValue(value);
    sendCommand('joint2', value);
  };
  
  const handleJoint3Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return;
    setJoint3Pos(value);
    joint3PosAnim.setValue(value);
    sendCommand('joint3', value);
  };
  
  const handleJoint4Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return;
    setJoint4Pos(value);
    joint4PosAnim.setValue(value);
    sendCommand('joint4', value);
  };
  
  const handleJoint5Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return;
    setJoint5Pos(value);
    joint5PosAnim.setValue(value);
    sendCommand('joint5', value);
  };
  
  const handleJoint6Change = (value) => {
    if (isAutoMode || isAnimating || isEmergencyMode) return;
    setJoint6Pos(value);
    joint6PosAnim.setValue(value);
    sendCommand('joint6', value);
  };

  // 純動畫演示函數（不發送命令給ESP32）
  const startSequentialAnimation = () => {
    setIsAnimating(true);
    setPhaseStep(1);
    setCurrentPhase('階段1：移動到物品位置');
    
    // 第一階段：移動到物品位置
    const moveToPickPosition = () => {
      return Animated.parallel([
        // 所有關節同時移動到物品位置
        Animated.timing(joint1PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint1,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint2PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint2,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint3PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint3,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint4PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint4,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint5PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint5,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint6PosAnim, {
          toValue: POSITION_CONFIGS.PICK_POSITION.joint6,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
      ]);
    };

    // 第二階段：夾取物品並抬升
    const gripAndLiftAction = () => {
      return Animated.sequence([
        // 等待一下確保到位
        Animated.delay(ANIMATION_SETTINGS.GRIP_WAIT_TIME),
        
        // 夾爪夾緊
        Animated.timing(joint6PosAnim, {
          toValue: 22, // 夾緊
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        
        Animated.delay(ANIMATION_SETTINGS.DELAY),
        
        // 抬升動作 - 同時進行
        Animated.parallel([
          Animated.timing(joint2PosAnim, {
            toValue: POSITION_CONFIGS.PICK_POSITION.joint2 - 50,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint3PosAnim, {
            toValue: POSITION_CONFIGS.PICK_POSITION.joint3 + 20,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint5PosAnim, {
            toValue: POSITION_CONFIGS.PICK_POSITION.joint5 - 80,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
        ]),
      ]);
    };

    // 第三階段：運送到指定位置
    const moveToTargetPosition = () => {
      return Animated.sequence([
        Animated.delay(ANIMATION_SETTINGS.DELAY),
        
        // 所有關節同時移動到目標位置
        Animated.parallel([
          Animated.timing(joint1PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint1,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint2PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint2,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint3PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint3,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint4PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint4,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint5PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint5,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(joint6PosAnim, {
            toValue: POSITION_CONFIGS.TARGET_POSITION.joint6,
            duration: ANIMATION_SETTINGS.DURATION,
            useNativeDriver: false,
          }),
        ]),
      ]);
    };

    // 第四階段：回到初始狀態
    const moveToInitialPosition = () => {
      return Animated.parallel([
        // 所有關節同時回到初始位置
        Animated.timing(joint1PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint1,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint2PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint2,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint3PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint3,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint4PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint4,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint5PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint5,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(joint6PosAnim, {
          toValue: POSITION_CONFIGS.INITIAL_POSITION.joint6,
          duration: ANIMATION_SETTINGS.DURATION,
          useNativeDriver: false,
        }),
      ]);
    };

    // 執行完整序列 - 修正階段更新時機
    Animated.sequence([
      // 第一階段
      moveToPickPosition(),
      // 階段完成，更新到第二階段
      Animated.timing(new Animated.Value(0), {
        toValue: 1,
        duration: 1,
        useNativeDriver: false,
      }),
    ]).start(() => {
      // 檢查是否被緊急停止打斷
      if (isEmergencyMode) return;
      
      // 第一階段完成，開始第二階段
      setPhaseStep(2);
      setCurrentPhase('階段2：夾取物品中');
      
      Animated.sequence([
        gripAndLiftAction(),
        // 階段完成，更新到第三階段
        Animated.timing(new Animated.Value(0), {
          toValue: 1,
          duration: 1,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // 檢查是否被緊急停止打斷
        if (isEmergencyMode) return;
        
        // 第二階段完成，開始第三階段
        setPhaseStep(3);
        setCurrentPhase('階段3：運送到指定位置');
        
        moveToTargetPosition().start(() => {
          // 檢查是否被緊急停止打斷
          if (isEmergencyMode) return;
          
          // 第三階段完成，開始第四階段：回到初始狀態
          setPhaseStep(4);
          setCurrentPhase('階段4：回到初始狀態');
          
          moveToInitialPosition().start(() => {
            // 檢查是否被緊急停止打斷
            if (isEmergencyMode) return;
            
            // 所有動畫演示完成，直接恢復按鈕狀態
            setIsAnimating(false);
            setIsAutoMode(false);
            setCurrentPhase('任務完成！');
            setPhaseStep(0);
            console.log('動畫演示完成：移動->夾取->運送->回到初始位置');
            
            // 3秒後回到待機狀態
            setTimeout(() => {
              if (!isEmergencyMode) {
                setCurrentPhase('待機中');
              }
            }, 3000);
          });
        });
      });
    });
  };

  const resetToInitialPosition = () => {
    if (isAnimating || isEmergencyMode || isAutoMode) return; // 自動模式時也不能重置
    
    setIsAnimating(true);
    // 只發送 armResume JSON，不發送具體的關節控制指令
    sendCommand('armResume');
    setCurrentPhase('重置到初始位置...');
    
    // 只執行動畫，不在動畫監聽器中發送控制指令
    Animated.parallel([
      Animated.timing(joint1PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint1,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(joint2PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint2,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(joint3PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint3,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(joint4PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint4,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(joint5PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint5,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(joint6PosAnim, {
        toValue: POSITION_CONFIGS.INITIAL_POSITION.joint6,
        duration: ANIMATION_SETTINGS.DURATION,
        useNativeDriver: false,
      }),
    ]).start(() => {
      if (!isEmergencyMode) {
        setIsAnimating(false);
        setCurrentPhase('待機中');
        console.log('重置動畫完成 - 僅顯示效果，ESP32自行處理硬體重置');
      }
    });
  };

  // 啟動自動控制模式 - 只發送startAutoMode命令
  const startAutoMode = () => {
    if (isEmergencyMode || isAutoMode) return; // 緊急停止模式下或已在自動模式時不能啟動
    
    setIsAutoMode(true);
    // 只發送 startAutoMode 命令給 ESP32，讓ESP32自己控制機械臂
    sendCommand('startAutoMode');
    // 同時播放動畫演示（純視覺效果，不影響硬體）
    startSequentialAnimation();
    Vibration.vibrate(30);
    console.log('自動控制模式已啟動 - ESP32控制硬體，畫面顯示動畫演示');
  };

  // 改進的緊急停止函數
  const toggleEmergencyMode = () => {
    if (!isEmergencyMode) {
      // 進入緊急停止模式
      sendCommand('armEmgStop');
      setIsEmergencyMode(true);
      setCurrentPhase('緊急停止中');
      
      // 立即停止所有動畫並保存當前位置
      joint1PosAnim.stopAnimation((value) => {
        setJoint1Pos(value);
        joint1PosAnim.setValue(value);
      });
      joint2PosAnim.stopAnimation((value) => {
        setJoint2Pos(value);
        joint2PosAnim.setValue(value);
      });
      joint3PosAnim.stopAnimation((value) => {
        setJoint3Pos(value);
        joint3PosAnim.setValue(value);
      });
      joint4PosAnim.stopAnimation((value) => {
        setJoint4Pos(value);
        joint4PosAnim.setValue(value);
      });
      joint5PosAnim.stopAnimation((value) => {
        setJoint5Pos(value);
        joint5PosAnim.setValue(value);
      });
      joint6PosAnim.stopAnimation((value) => {
        setJoint6Pos(value);
        joint6PosAnim.setValue(value);
      });
      
      // 如果在自動模式，強制關閉自動模式
      if (isAutoMode) {
        setIsAutoMode(false);
        setIsAnimating(false);
        setPhaseStep(0);
        sendCommand('stopAutoMode');
      }
      
      Vibration.vibrate([100, 50, 100]);
      console.log('緊急停止 - 所有動畫已停止在當前位置，自動控制已關閉');
    } else {
      // 離開緊急停止模式，恢復到停止時的位置
      sendCommand('armResume');
      setIsEmergencyMode(false);
      setCurrentPhase('待機中');
      
      // 發送當前位置到後端，確保硬體與UI同步
      sendCommand('joint1', Math.round(joint1Pos));
      sendCommand('joint2', Math.round(joint2Pos));
      sendCommand('joint3', Math.round(joint3Pos));
      sendCommand('joint4', Math.round(joint4Pos));
      sendCommand('joint5', Math.round(joint5Pos));
      sendCommand('joint6', Math.round(joint6Pos));
      
      Vibration.vibrate(50);
      console.log('恢復控制 - 位置已同步，可進行手動操作');
    }
  };

  // 返回按鈕
  const handleBack = () => {
    // 如果在自動模式，先關閉
    if (isAutoMode) {
      setIsAutoMode(false);
      sendCommand('stopAutoMode');
    }
    router.back();
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />
      
      {/* 固定頭部 */}
      <View style={styles.header}>
        {/* 返回按鈕 */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
          <Text style={styles.backButtonText}>返回</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>機械臂控制</Text>
        
        {/* 連接狀態 */}
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, {backgroundColor: isConnected ? '#4CAF50' : '#F44336'}]} />
          <Text style={styles.statusText}>{isConnected ? '已連接' : '未連接'}</Text>
        </View>
      </View>
      
      {/* 固定狀態顯示 */}
      <View style={styles.phaseIndicator}>
        <Text style={styles.phaseText}>{currentPhase}</Text>
        {phaseStep > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(phaseStep / 4) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{phaseStep}/4</Text>
          </View>
        )}
      </View>
      
      {/* 主要內容區域 */}
      <View style={styles.mainContent}>
        {/* 滑動條控制區域 */}
        <View style={styles.slidersContainer}>
          {/* Joint 1 - 底座旋轉 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint1</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={180}
                value={joint1Pos}
                onValueChange={handleJoint1Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint1Pos)}°</Text>
          </View>
          
          {/* Joint 2 - 抬升控制 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint2</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={180}
                value={joint2Pos}
                onValueChange={handleJoint2Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint2Pos)}°</Text>
          </View>
          
          {/* Joint 3 - 伸展控制 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint3</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={180}
                value={joint3Pos}
                onValueChange={handleJoint3Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint3Pos)}°</Text>
          </View>
          
          {/* Joint 4 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint4</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                value={joint4Pos}
                onValueChange={handleJoint4Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint4Pos)}°</Text>
          </View>
          
          {/* Joint 5 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint5</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={180}
                value={joint5Pos}
                onValueChange={handleJoint5Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint5Pos)}°</Text>
          </View>
          
          {/* Joint 6 - 夾爪控制 */}
          <View style={styles.sliderRow}>
            <Text style={styles.jointLabel}>Joint6</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={180}
                value={joint6Pos}
                onValueChange={handleJoint6Change}
                minimumTrackTintColor="#4287f5"
                maximumTrackTintColor="#EEEEEE"
                thumbTintColor="#4287f5"
                step={1}
                disabled={isAutoMode || isAnimating || isEmergencyMode}
              />
            </View>
            <Text style={styles.sliderValue}>{Math.round(joint6Pos)}°</Text>
          </View>
        </View>
        
        {/* 控制按鈕區域 */}
        <View style={styles.buttonContainer}>
          {/* 重置位置按鈕 */}
          <TouchableOpacity 
            style={[styles.resetButton, (isAutoMode || isAnimating || isEmergencyMode) && styles.disabledButton]}
            onPress={resetToInitialPosition}
            disabled={isAutoMode || isAnimating || isEmergencyMode}
          >
            <Text style={styles.resetButtonText}>重置位置</Text>
          </TouchableOpacity>
          
          {/* 自動控制按鈕 */}
          <TouchableOpacity 
            style={[styles.autoButton, isAutoMode && styles.autoActiveButton, isEmergencyMode && styles.disabledButton]}
            onPress={startAutoMode}
            disabled={isEmergencyMode || isAutoMode}
          >
            <Text style={styles.autoButtonText}>
              {isAutoMode ? '自動控制執行中' : '開啟自動控制'}
            </Text>
          </TouchableOpacity>
          
          {/* 緊急停止按鈕 */}
          <TouchableOpacity 
            style={[styles.emergencyButton, isEmergencyMode && styles.resumeButton]}
            onPress={toggleEmergencyMode}
          >
            <Text style={styles.emergencyText}>
              {!isEmergencyMode ? '緊急停止' : '恢復控制'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButtonText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#333333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    flex: 2,
    textAlign: 'center',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
  },
  phaseIndicator: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  phaseText: {
    fontSize: 16,
    color: '#1976D2',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#BBDEFB',
    borderRadius: 3,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1976D2',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#1976D2',
    fontWeight: 'bold',
    minWidth: 30,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  slidersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    flex: 1,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    justifyContent: 'space-around',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    minHeight: 60,
  },
  jointLabel: {
    width: 60,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  sliderContainer: {
    flex: 1,
    height: 45,
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  slider: {
    width: '100%',
    height: 45,
  },
  sliderValue: {
    width: 55,
    fontSize: 18,
    textAlign: 'right',
    color: '#333333',
    fontWeight: 'bold',
  },
  buttonContainer: {
    gap: 10,
  },
  resetButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  autoButton: {
    backgroundColor: '#673AB7',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
  },
  autoActiveButton: {
    backgroundColor: '#9C27B0',
  },
  disabledButton: {
    backgroundColor: '#9E9E9E',
    opacity: 0.5,
  },
  autoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencyButton: {
    height: 70,
    borderRadius: 35,
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});