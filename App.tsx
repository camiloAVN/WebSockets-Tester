import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface Message {
  id: string;
  text: string;
  timestamp: string;
  type: 'sent' | 'received';
}

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [serverUrl, setServerUrl] = useState('ws://192.168.41.164:8080'); // Cambia por la IP de tu PC
  const [networkInfo, setNetworkInfo] = useState<NetInfoState | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Función para obtener info de red (sin errores de tipos)
  const getNetworkInfo = async () => {
    try {
      const netInfo = await NetInfo.fetch();
      setNetworkInfo(netInfo);
      console.log('Network Info:', netInfo);
      
      let connectionType = 'Desconocido';
      let connectionIcon = '❓';
      
      switch (netInfo.type) {
        case 'ethernet':
          connectionType = 'Ethernet';
          connectionIcon = '🔌';
          break;
        case 'wifi':
          connectionType = 'WiFi';
          connectionIcon = '📶';
          break;
        case 'cellular':
          connectionType = 'Datos móviles';
          connectionIcon = '📱';
          break;
        case 'other':
          connectionType = 'Cable/USB';
          connectionIcon = '🔌';
          break;
        default:
          connectionType = 'Desconocido';
          connectionIcon = '❓';
      }
      
      addMessage(`${connectionIcon} Conexión: ${connectionType}`, 'received');
      
      if (netInfo.type === 'ethernet') {
        addMessage('🎉 ¡Ethernet detectado! Conexión física activa', 'received');
      }
      
    } catch (error) {
      console.error('Error obteniendo info de red:', error);
      addMessage('❌ Error al obtener información de red', 'received');
    }
  };

  // Función para conectar WebSocket
  const connectWebSocket = () => {
    try {
      ws.current = new WebSocket(serverUrl);

      ws.current.onopen = () => {
        console.log('WebSocket conectado');
        setIsConnected(true);
        addMessage('✅ Conectado al servidor', 'received');
        
        // Enviar info de conexión al servidor
        if (networkInfo) {
          const connectionType = networkInfo.type === 'ethernet' ? 'Ethernet' : 
                                networkInfo.type === 'wifi' ? 'WiFi' : 
                                networkInfo.type === 'cellular' ? 'Cellular' : 'Unknown';
          ws.current?.send(`Conectado desde: ${connectionType}`);
        }
      };

      ws.current.onmessage = (event) => {
        console.log('Mensaje recibido:', event.data);
        addMessage(event.data, 'received');
      };

      ws.current.onclose = () => {
        console.log('WebSocket desconectado');
        setIsConnected(false);
        addMessage('❌ Desconectado del servidor', 'received');
      };

      ws.current.onerror = (error) => {
        console.error('Error WebSocket:', error);
        Alert.alert('Error de conexión', 'No se pudo conectar al servidor WebSocket. Verifica la IP y que el servidor esté ejecutándose.');
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Error al crear WebSocket:', error);
      Alert.alert('Error', 'URL de servidor inválida');
    }
  };

  // Función para desconectar WebSocket
  const disconnectWebSocket = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  // Función para agregar mensajes
  const addMessage = (text: string, type: 'sent' | 'received') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date().toLocaleTimeString(),
      type,
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Auto-scroll al último mensaje
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Función para enviar mensaje
  const sendMessage = () => {
    if (!inputText.trim()) return;
    
    if (!isConnected || !ws.current) {
      Alert.alert('Error', 'No hay conexión WebSocket activa');
      return;
    }

    try {
      ws.current.send(inputText);
      addMessage(inputText, 'sent');
      setInputText('');
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    }
  };

  // Función para limpiar mensajes
  const clearMessages = () => {
    setMessages([]);
  };

  // Función para sugerir IPs comunes
  const suggestCommonIPs = () => {
    const commonIPs = [
      'ws://192.168.1.100:8080',
      'ws://192.168.0.100:8080',
      'ws://10.0.0.100:8080',
      'ws://172.16.0.100:8080'
    ];
    
    Alert.alert(
      'IPs comunes',
      'Prueba con estas IPs comunes:\n\n' + commonIPs.map(ip => ip.replace('ws://', '')).join('\n'),
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: '192.168.1.100', onPress: () => setServerUrl('ws://192.168.1.100:8080') },
        { text: '192.168.0.100', onPress: () => setServerUrl('ws://192.168.0.100:8080') },
      ]
    );
  };

  // Test de conectividad
  const testConnection = () => {
    addMessage('🔍 Probando conectividad...', 'received');
    getNetworkInfo();
  };

  // Cleanup al desmontar componente
  useEffect(() => {
    // Obtener info inicial de red
    getNetworkInfo();
    
    // Suscribirse a cambios de red
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkInfo(state);
      console.log('Network state changed:', state);
      
      // Notificar cambios importantes
      if (state.type === 'ethernet') {
        addMessage('🔌 ¡Ethernet conectado!', 'received');
      } else if (state.type === 'wifi') {
        addMessage('📶 Cambiado a WiFi', 'received');
      }
    });

    return () => {
      disconnectWebSocket();
      unsubscribe();
    };
  }, []);

  // Función para obtener el icono y texto del estado de red
  const getNetworkStatus = () => {
    if (!networkInfo) return { icon: '❓', text: 'Detectando...' };
    
    const isConnected = networkInfo.isConnected;
    const type = networkInfo.type;
    
    let icon = '❓';
    let text = 'Desconocido';
    
    switch (type) {
      case 'ethernet':
        icon = '🔌';
        text = 'Ethernet';
        break;
      case 'wifi':
        icon = '📶';
        text = 'WiFi';
        break;
      case 'cellular':
        icon = '📱';
        text = 'Datos móviles';
        break;
      case 'other':
        icon = '🔌';
        text = 'Cable/USB';
        break;
      default:
        icon = '❓';
        text = 'Desconocido';
    }
    
    return {
      icon,
      text: isConnected ? text : `${text} (Sin conexión)`
    };
  };

  const networkStatus = getNetworkStatus();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>WebSocket Ethernet Test</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>

      {/* Network Info */}
      <View style={styles.networkInfoContainer}>
        <Text style={styles.label}>🌐 Estado de la red:</Text>
        <View style={[
          styles.networkDetails,
          networkInfo?.type === 'ethernet' ? styles.ethernetHighlight : {}
        ]}>
          <Text style={styles.networkText}>
            {networkStatus.icon} Tipo: {networkStatus.text}
          </Text>
          <Text style={styles.networkText}>
            {networkInfo?.isConnected ? '✅ Conectado a Internet' : '❌ Sin conexión a Internet'}
          </Text>
          {networkInfo?.type === 'ethernet' && (
            <Text style={[styles.networkText, styles.ethernetText]}>
              🎉 ¡Conexión Ethernet activa!
            </Text>
          )}
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.smallButton} onPress={testConnection}>
              <Text style={styles.smallButtonText}>🔄 Actualizar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.smallButton} onPress={suggestCommonIPs}>
              <Text style={styles.smallButtonText}>💡 IPs comunes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Server URL Input */}
      <View style={styles.serverInputContainer}>
        <Text style={styles.label}>🎯 URL del servidor:</Text>
        <TextInput
          style={styles.serverInput}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="ws://192.168.1.100:8080"
          editable={!isConnected}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.hint}>
          💡 Asegúrate de que tu PC y móvil estén en la misma red
        </Text>
      </View>

      {/* Connection Controls */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.connectButton, isConnected && styles.disabledButton]}
          onPress={connectWebSocket}
          disabled={isConnected}
        >
          <Text style={styles.buttonText}>🔌 Conectar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.disconnectButton, !isConnected && styles.disabledButton]}
          onPress={disconnectWebSocket}
          disabled={!isConnected}
        >
          <Text style={styles.buttonText}>❌ Desconectar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearMessages}
        >
          <Text style={styles.buttonText}>🗑️ Limpiar</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <View style={styles.messagesContainer}>
        <Text style={styles.label}>💬 Mensajes ({messages.length}):</Text>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesScroll}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <Text style={styles.emptyMessage}>
              📝 Los mensajes aparecerán aquí...
            </Text>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.type === 'sent' ? styles.sentMessage : styles.receivedMessage
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.type === 'sent' ? styles.sentMessageText : styles.receivedMessageText
                ]}>
                  {message.text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  message.type === 'sent' ? styles.sentMessageTime : styles.receivedMessageTime
                ]}>
                  {message.timestamp}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={isConnected ? "Escribe un mensaje..." : "Conecta primero al servidor"}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          editable={isConnected}
        />
        <TouchableOpacity
          style={[styles.sendButton, !isConnected && styles.disabledButton]}
          onPress={sendMessage}
          disabled={!isConnected}
        >
          <Text style={styles.sendButtonText}>📤</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  networkInfoContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  networkDetails: {
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  ethernetHighlight: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#4CAF50',
  },
  networkText: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  ethernetText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  smallButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 12,
  },
  smallButtonText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  serverInputContainer: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  serverInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  hint: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  clearButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 16,
  },
  messagesScroll: {
    flex: 1,
  },
  emptyMessage: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginTop: 20,
  },
  messageContainer: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    maxWidth: '80%',
  },
  sentMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  receivedMessage: {
    backgroundColor: '#E5E5EA',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 14,
  },
  sentMessageText: {
    color: '#fff',
  },
  receivedMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
  },
  sentMessageTime: {
    color: 'rgba(255,255,255,0.8)',
  },
  receivedMessageTime: {
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  sendButtonText: {
    fontSize: 16,
  },
});