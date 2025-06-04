// services/websocketService.js (適配 AsyncWebServer)
import { useState, useEffect } from 'react';

// const ESP_IP = '192.168.0.100';
const ESP_IP = '192.168.4.1'; // ESP32s的IP位址
// AsyncWebServer 的 WebSocket 路徑是 /ws
const WS_URL = `ws://${ESP_IP}:80/ws`;

// 全局變數
let globalWebSocket = null;
let isGlobalConnected = false;
let connectionListeners = [];
let messageHandlers = [];
let isManualDisconnect = false;
let reconnectTimer = null;
let heartbeatTimer = null;

// // 通知所有監聽者連線狀態變化
const notifyConnectionChange = (status) => {
  isGlobalConnected = status;
  connectionListeners.forEach(listener => listener(status));
};

// 通知所有訊息處理器
const notifyMessageHandlers = (data) => {
  messageHandlers.forEach(handler => handler(data));
};

// 清除重連定時器
const clearReconnectTimer = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

// 清除心跳定時器
const clearHeartbeatTimer = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

// 開始心跳檢測
const startHeartbeat = () => {
  clearHeartbeatTimer();
  heartbeatTimer = setInterval(() => {
    if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
      // 發送心跳包
      const heartbeat = JSON.stringify({ action: 'ping', timestamp: Date.now() });
      globalWebSocket.send(heartbeat);
    }
  }, 30000); // 每30秒發送一次心跳
};

// 建立WebSocket連線
const connectWebSocket = () => {
  // 清除任何現有的定時器
  clearReconnectTimer();
  clearHeartbeatTimer();
  
  if (globalWebSocket && (globalWebSocket.readyState === WebSocket.OPEN || globalWebSocket.readyState === WebSocket.CONNECTING)) {
    console.log('WebSocket已經連線或正在連線中');
    return Promise.resolve(true);
  }
  
  console.log('正在建立WebSocket連線到:', WS_URL);
  isManualDisconnect = false;
  
  return new Promise((resolve, reject) => {
    try {
      globalWebSocket = new WebSocket(WS_URL);
      
      // 設置連線超時
      const connectionTimeout = setTimeout(() => {
        if (globalWebSocket && globalWebSocket.readyState === WebSocket.CONNECTING) {
          globalWebSocket.close();
          reject(new Error('連線超時'));
        }
      }, 10000); // 10秒超時，AsyncWebServer 可能需要更長時間
      
      globalWebSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('AsyncWebServer WebSocket連線成功');
        notifyConnectionChange(true);
        startHeartbeat(); // 開始心跳檢測
        resolve(true);
      };
      
      globalWebSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('收到訊息:', data);
          
          // 處理特殊訊息類型
          if (data.type === 'heartbeat') {
            console.log('收到心跳回應');
            return;
          }
          
          if (data.type === 'error') {
            console.error('伺服器錯誤:', data.message);
          }
          
          notifyMessageHandlers(data);
        } catch (err) {
          console.warn('解析WebSocket訊息失敗:', err, '原始訊息:', event.data);
        }
      };
      
      globalWebSocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('AsyncWebServer WebSocket錯誤:', error);
        notifyConnectionChange(false);
        clearHeartbeatTimer();
        reject(error);
      };
      
      globalWebSocket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        clearHeartbeatTimer();
        console.log('AsyncWebServer WebSocket連線關閉, code:', event.code, 'reason:', event.reason);
        notifyConnectionChange(false);
        globalWebSocket = null;
        
        // 只有在非手動斷線且連線曾經成功建立的情況下才自動重連
        if (!isManualDisconnect && event.code !== 1000) {
          console.log('5秒後嘗試自動重新連線...');
          reconnectTimer = setTimeout(() => {
            if (!isGlobalConnected && !isManualDisconnect) {
              console.log('執行自動重新連線...');
              connectWebSocket().catch(err => {
                console.log('自動重連失敗:', err);
              });
            }
          }, 5000); // AsyncWebServer 重連間隔稍長一些
        }
      };
      
    } catch (error) {
      console.error('建立WebSocket連線時發生錯誤:', error);
      reject(error);
    }
  });
};

// 斷開WebSocket連線
const disconnectWebSocket = () => {
  console.log('手動斷開WebSocket連線');
  isManualDisconnect = true;
  clearReconnectTimer();
  clearHeartbeatTimer();
  
  if (globalWebSocket) {
    // 使用正常關閉代碼
    globalWebSocket.close(1000, 'User disconnected');
    globalWebSocket = null;
  }
  
  notifyConnectionChange(false);
};

// 發送指令
const sendCommand = (action, value = null) => {
  if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
    const command = {
      action: action,
      timestamp: Date.now()
    };
    
    if (value !== null) {
      command.value = value;
    }
    
    const jsonString = JSON.stringify(command);
    globalWebSocket.send(jsonString);
    console.log('發送指令到 AsyncWebServer:', command);
    return true;
  } else {
    console.log('WebSocket未連線，無法發送指令:', action);
    return false;
  }
};

// 發送自定義訊息
const sendMessage = (message) => {
  if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
    const messageObj = {
      type: 'custom',
      data: message,
      timestamp: Date.now()
    };
    
    globalWebSocket.send(JSON.stringify(messageObj));
    console.log('發送自定義訊息:', messageObj);
    return true;
  } else {
    console.log('WebSocket未連線，無法發送訊息');
    return false;
  }
};

// 添加連線狀態監聽器
const addConnectionListener = (listener) => {
  connectionListeners.push(listener);
  // 立即通知目前的連線狀態
  listener(isGlobalConnected);
  
  // 返回移除監聽器的函數
  return () => {
    connectionListeners = connectionListeners.filter(l => l !== listener);
  };
};

// 添加訊息處理器
const addMessageHandler = (handler) => {
  messageHandlers.push(handler);
  
  // 返回移除處理器的函數
  return () => {
    messageHandlers = messageHandlers.filter(h => h !== handler);
  };
};

// 獲取連線狀態
const getConnectionStatus = () => {
  return {
    isConnected: isGlobalConnected,
    readyState: globalWebSocket ? globalWebSocket.readyState : WebSocket.CLOSED,
    url: WS_URL
  };
};

// React Hook for WebSocket
export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(isGlobalConnected);
  const [connectionState, setConnectionState] = useState('CLOSED');
  
  useEffect(() => {
    // 添加連線狀態監聽器
    const removeConnectionListener = addConnectionListener((connected) => {
      setIsConnected(connected);
      setConnectionState(connected ? 'OPEN' : 'CLOSED');
    });
    
    // 清理函數
    return () => {
      removeConnectionListener();
    };
  }, []);
  
  return {
    isConnected,
    connectionState,
    connect: connectWebSocket,
    disconnect: disconnectWebSocket,
    sendCommand,
    sendMessage,
    addMessageHandler,
    getStatus: getConnectionStatus
  };
};

// 導出函數
export {
  connectWebSocket,
  disconnectWebSocket,
  sendCommand,
  sendMessage,
  addConnectionListener,
  addMessageHandler,
  getConnectionStatus
};

// // services/websocketService.js (適配 WebSocketsServer)
// import { useState, useEffect } from 'react';

// const ESP_IP = '192.168.0.110';
// // WebSocketsServer 使用端口 81
// const WS_URL = `ws://${ESP_IP}:81`;

// // 全局變數
// let globalWebSocket = null;
// let isGlobalConnected = false;
// let connectionListeners = [];
// let messageHandlers = [];
// let isManualDisconnect = false;
// let reconnectTimer = null;
// let heartbeatTimer = null;

// // 通知所有監聽者連線狀態變化
// const notifyConnectionChange = (status) => {
//   isGlobalConnected = status;
//   connectionListeners.forEach(listener => listener(status));

// };

// // 通知所有訊息處理器
// const notifyMessageHandlers = (data) => {
//   messageHandlers.forEach(handler => handler(data));
// };

// // 清除重連定時器
// const clearReconnectTimer = () => {
//   if (reconnectTimer) {
//     clearTimeout(reconnectTimer);
//     reconnectTimer = null;
//   }
// };

// // 清除心跳定時器
// const clearHeartbeatTimer = () => {
//   if (heartbeatTimer) {
//     clearInterval(heartbeatTimer);
//     heartbeatTimer = null;
//   }
// };

// // 開始心跳檢測（可選，因為 ESP32 沒有實現心跳回應）
// const startHeartbeat = () => {
//   clearHeartbeatTimer();
//   // WebSocketsServer 會自動處理心跳，這裡保持連線活躍
//   heartbeatTimer = setInterval(() => {
//     if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
//       // 發送簡單的 ping 指令
//       const ping = JSON.stringify({ action: 'ping', timestamp: Date.now() });
//       globalWebSocket.send(ping);
//     }
//   }, 30000); // 每30秒發送一次
// };

// // 建立WebSocket連線
// const connectWebSocket = () => {
//   // 清除任何現有的定時器
//   clearReconnectTimer();
//   clearHeartbeatTimer();
  
//   if (globalWebSocket && (globalWebSocket.readyState === WebSocket.OPEN || globalWebSocket.readyState === WebSocket.CONNECTING)) {
//     console.log('WebSocket已經連線或正在連線中');
//     return Promise.resolve(true);
//   }
  
//   console.log('正在建立WebSocket連線到:', WS_URL);
//   isManualDisconnect = false;
  
//   return new Promise((resolve, reject) => {
//     try {
//       globalWebSocket = new WebSocket(WS_URL);
      
//       // 設置連線超時
//       const connectionTimeout = setTimeout(() => {
//         if (globalWebSocket && globalWebSocket.readyState === WebSocket.CONNECTING) {
//           globalWebSocket.close();
//           reject(new Error('連線超時'));
//         }
//       }, 8000); // 8秒超時，WebSocketsServer 通常連線較快
      
//       globalWebSocket.onopen = () => {
//         clearTimeout(connectionTimeout);
//         console.log('WebSocketsServer 連線成功');
//         notifyConnectionChange(true);
//         startHeartbeat(); // 開始心跳檢測
//         resolve(true);
//       };
      
//       globalWebSocket.onmessage = (event) => {
//         try {
//           console.log('收到原始訊息:', event.data);
          
//           // 嘗試解析為 JSON
//           let data;
//           try {
//             data = JSON.parse(event.data);
//             console.log('解析後的 JSON 訊息:', data);
//           } catch (parseError) {
//             // 如果不是 JSON，直接作為文字處理
//             data = {
//               type: 'text',
//               message: event.data,
//               timestamp: Date.now()
//             };
//             console.log('文字訊息:', data);
//           }
          
//           // 處理特殊訊息類型
//           if (data.type === 'heartbeat' || data.action === 'ping') {
//             console.log('收到心跳相關訊息');
//             return;
//           }
          
//           if (data.type === 'error') {
//             console.error('伺服器錯誤:', data.message);
//           }
          
//           notifyMessageHandlers(data);
//         } catch (err) {
//           console.warn('處理WebSocket訊息失敗:', err, '原始訊息:', event.data);
//           // 即使處理失敗，也嘗試傳遞原始訊息
//           notifyMessageHandlers({
//             type: 'raw',
//             data: event.data,
//             timestamp: Date.now()
//           });
//         }
//       };
      
//       globalWebSocket.onerror = (error) => {
//         clearTimeout(connectionTimeout);
//         console.error('WebSocketsServer 連線錯誤:', error);
//         notifyConnectionChange(false);
//         clearHeartbeatTimer();
//         reject(error);
//       };
      
//       globalWebSocket.onclose = (event) => {
//         clearTimeout(connectionTimeout);
//         clearHeartbeatTimer();
//         console.log('WebSocketsServer 連線關閉, code:', event.code, 'reason:', event.reason);
//         notifyConnectionChange(false);
//         globalWebSocket = null;
        
//         // 只有在非手動斷線且連線曾經成功建立的情況下才自動重連
//         if (!isManualDisconnect && event.code !== 1000) {
//           console.log('3秒後嘗試自動重新連線...');
//           reconnectTimer = setTimeout(() => {
//             if (!isGlobalConnected && !isManualDisconnect) {
//               console.log('執行自動重新連線...');
//               connectWebSocket().catch(err => {
//                 console.log('自動重連失敗:', err);
//               });
//             }
//           }, 3000); // WebSocketsServer 重連間隔較短
//         }
//       };
      
//     } catch (error) {
//       console.error('建立WebSocket連線時發生錯誤:', error);
//       reject(error);
//     }
//   });
// };

// // 斷開WebSocket連線
// const disconnectWebSocket = () => {
//   console.log('手動斷開WebSocket連線');
//   isManualDisconnect = true;
//   clearReconnectTimer();
//   clearHeartbeatTimer();
  
//   if (globalWebSocket) {
//     // 使用正常關閉代碼
//     globalWebSocket.close(1000, 'User disconnected');
//     globalWebSocket = null;
//   }
  
//   notifyConnectionChange(false);
// };

// // 發送指令（匹配你的 ESP32 格式）
// const sendCommand = (action, value = null) => {
//   if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
//     const command = {
//       action: action,
//       timestamp: Date.now()
//     };
    
//     if (value !== null) {
//       command.value = value;
//     }
    
//     const jsonString = JSON.stringify(command);
//     globalWebSocket.send(jsonString);
//     console.log('發送指令到 WebSocketsServer:', command);
//     return true;
//   } else {
//     console.log('WebSocket未連線，無法發送指令:', action);
//     return false;
//   }
// };

// // 發送純文字訊息（直接發送，不包裝 JSON）
// const sendTextMessage = (message) => {
//   if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
//     globalWebSocket.send(message);
//     console.log('發送文字訊息:', message);
//     return true;
//   } else {
//     console.log('WebSocket未連線，無法發送訊息');
//     return false;
//   }
// };

// // 發送 JSON 格式訊息
// const sendMessage = (message) => {
//   if (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN) {
//     const messageObj = {
//       type: 'custom',
//       data: message,
//       timestamp: Date.now()
//     };
    
//     globalWebSocket.send(JSON.stringify(messageObj));
//     console.log('發送 JSON 訊息:', messageObj);
//     return true;
//   } else {
//     console.log('WebSocket未連線，無法發送訊息');
//     return false;
//   }
// };

// // 添加連線狀態監聽器
// const addConnectionListener = (listener) => {
//   connectionListeners.push(listener);
//   // 立即通知目前的連線狀態
//   listener(isGlobalConnected);
  
//   // 返回移除監聽器的函數
//   return () => {
//     connectionListeners = connectionListeners.filter(l => l !== listener);
//   };
// };

// // 添加訊息處理器
// const addMessageHandler = (handler) => {
//   messageHandlers.push(handler);
  
//   // 返回移除處理器的函數
//   return () => {
//     messageHandlers = messageHandlers.filter(h => h !== handler);
//   };
// };

// // 獲取連線狀態
// const getConnectionStatus = () => {
//   return {
//     isConnected: isGlobalConnected,
//     readyState: globalWebSocket ? globalWebSocket.readyState : WebSocket.CLOSED,
//     url: WS_URL,
//     serverType: 'WebSocketsServer'
//   };
// };

// // React Hook for WebSocket
// export const useWebSocket = () => {
//   const [isConnected, setIsConnected] = useState(isGlobalConnected);
//   const [connectionState, setConnectionState] = useState('CLOSED');
//   const [lastMessage, setLastMessage] = useState(null);
  
//   useEffect(() => {
//     // 添加連線狀態監聽器
//     const removeConnectionListener = addConnectionListener((connected) => {
//       setIsConnected(connected);
//       setConnectionState(connected ? 'OPEN' : 'CLOSED');
//     });
    
//     // 添加訊息處理器
//     const removeMessageHandler = addMessageHandler((data) => {
//       setLastMessage(data);
//     });
    
//     // 清理函數
//     return () => {
//       removeConnectionListener();
//       removeMessageHandler();
//     };
//   }, []);
  
//   return {
//     isConnected,
//     connectionState,
//     lastMessage,
//     connect: connectWebSocket,
//     disconnect: disconnectWebSocket,
//     sendCommand,
//     sendMessage,
//     sendTextMessage, // 新增：發送純文字
//     addMessageHandler,
//     getStatus: getConnectionStatus
//   };
// };

// // 導出函數
// export {
//   connectWebSocket,
//   disconnectWebSocket,
//   sendCommand,
//   sendMessage,
//   sendTextMessage, // 新增導出
//   addConnectionListener,
//   addMessageHandler,
//   getConnectionStatus
// };