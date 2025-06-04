// app/index.jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWebSocket } from '../service/websocketService'; // 修正導入路徑

const { width, height } = Dimensions.get('window');

export default function HomePage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [carStatus, setCarStatus] = useState({
    isMoving: false,
    action: 'stop',
  });

  const router = useRouter();
  const { isConnected, connect, disconnect, addMessageHandler } = useWebSocket();

  // 處理接收到的訊息
  useEffect(() => {
    const removeMessageHandler = addMessageHandler((data) => {
      if (data.type === 'status') {
        setCarStatus({
          isMoving: data.isMoving,
          action: data.action,
        });
      }
    });

    return () => {
      removeMessageHandler();
    };
  }, [addMessageHandler]);

  // 連接到車子
  const connectToCar = async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    
    try {
      await connect();
      setIsConnecting(false);
      Alert.alert('連線成功', '已成功連接到ESP32');
    } catch (error) {
      setIsConnecting(false);
      console.error('連線失敗:', error);
      Alert.alert('連線失敗', '無法連接到車子，請檢查：\n1. ESP32是否開啟\n2. WiFi網路是否正確\n3. IP位址是否正確');
    }
  };

  // 斷開連線
  const disconnectFromCar = () => {
    disconnect();
    Alert.alert('連線中斷', '與車子的連線已關閉');
  };

  // 導航到控制頁面
  const goToControl = () => {
    router.push('/control');
  };
  
  // 導航到手臂控制頁面
  const goToArmControl = () => {
    router.push('/armcontrol');
  };

  return (
    <View style={styles.container}>
      {/* 標題 */}
      <View style={styles.header}>
        <Text style={styles.title}>車子遙控器</Text>
        <Text style={styles.subtitle}>Remote Car Controller</Text>
      </View>

      {/* 連線狀態 */}
      <View style={styles.statusContainer}>
        <MaterialIcons 
          name={isConnected ? 'wifi' : 'wifi-off'} 
          size={60} 
          color={isConnected ? '#4CAF50' : '#757575'} 
        />
        <Text style={[styles.statusText, { color: isConnected ? '#4CAF50' : '#757575' }]}>
          {isConnected ? '已連線到robotcar' : '未連線'}
        </Text>
        {isConnected && (
          <Text style={styles.signalText}>
            車子狀態：{carStatus.isMoving ? '移動中 ('+carStatus.action+')' : '停止'}
          </Text>
        )}
        {isConnecting && (
          <Text style={styles.connectingText}>正在連線中...</Text>
        )}
      </View>

      {/* 按鈕區域 */}
      <View style={styles.buttonContainer}>
        {/* 連/斷線按鈕 */}
        <TouchableOpacity
          style={[styles.wifiButton, isConnected && styles.connectedButton]}
          onPress={isConnected ? disconnectFromCar : connectToCar}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <MaterialIcons 
              name={isConnected ? 'wifi-off' : 'wifi'} 
              size={24} 
              color="#FFFFFF" 
              style={styles.buttonIcon}
            />
          )}
          <Text style={styles.buttonText}>
            {isConnecting
              ? '連線中...'
              : isConnected
                ? '斷開連線'
                : '連接車子'}
          </Text>
        </TouchableOpacity>

        {/* 控制介面按鈕 */}
        <TouchableOpacity
          style={styles.controlButton}
          onPress={goToControl}
        >
          <MaterialIcons 
            name="gamepad" 
            size={24} 
            color="#FFFFFF" 
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>車輪控制</Text>
        </TouchableOpacity>
        
        {/* 手臂控制按鈕 */}
        <TouchableOpacity
          style={styles.armControlButton}
          onPress={goToArmControl}
        >
          <MaterialIcons 
            name="build" 
            size={24} 
            color="#FFFFFF" 
            style={styles.buttonIcon}
          />
          <Text style={styles.buttonText}>手臂控制</Text>
        </TouchableOpacity>
      </View>
      
      {/* 說明 */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          請先確定ESP32已開啟，按「連接車子」建立WebSocket連線
        </Text>
        <Text style={styles.footerSubText}>
          連線後所有控制頁面都會共享連線狀態
        </Text>
        {isConnected && (
          <Text style={styles.footerSubText}>
            現在可以進入任何控制頁面進行操作
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingHorizontal: 20 },
  header: { alignItems: 'center', marginTop: height * 0.1, marginBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 16, color: '#666', fontStyle: 'italic' },
  statusContainer: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 40
  },
  statusText: { fontSize: 20, fontWeight: '600', marginTop: 15 },
  signalText: { fontSize: 14, color: '#666', marginTop: 8 },
  connectingText: { fontSize: 14, color: '#2196F3', marginTop: 8, fontStyle: 'italic' },
  buttonContainer: { alignItems: 'center', gap: 20 },
  wifiButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    elevation: 3
  },
  connectedButton: { backgroundColor: '#FF5722' },
  controlButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    elevation: 3
  },
  armControlButton: {
    backgroundColor: '#9C27B0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    elevation: 3
  },
  disabledButton: {
    backgroundColor: '#BDBDBD',
    elevation: 1
  },
  buttonIcon: { marginRight: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 30, left: 20, right: 20, alignItems: 'center' },
  footerText: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 5 },
  footerSubText: { color: '#999', fontSize: 12, textAlign: 'center', marginBottom: 3 }
});