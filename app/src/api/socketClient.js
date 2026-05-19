import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SOCKET_URL = 'http://192.168.100.66:3000';

class SocketClient {
  constructor() {
    this.socket = null;
    // Buffer listeners registered before socket is connected
    this._pendingListeners = [];
    this._connecting = false;
  }

  async connect() {
    if (this.socket) return;
    if (this._connecting) return;

    this._connecting = true;
    try {
      const token = await AsyncStorage.getItem('@access_token');
      if (!token) {
        console.warn('[Socket] No token found, cannot connect.');
        this._connecting = false;
        return;
      }

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: { token },
        extraHeaders: { Authorization: `Bearer ${token}` },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });

      // Flush buffered listeners that were registered before connect()
      for (const { event, callback } of this._pendingListeners) {
        this.socket.on(event, callback);
      }
      this._pendingListeners = [];

      this.socket.on('connect', () => {
        console.log('[Socket] Connected:', this.socket.id);
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('[Socket] Disconnected:', reason);
      });

      this.socket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
      });

    } catch (err) {
      console.error('[Socket] Initialization failed:', err);
    } finally {
      this._connecting = false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._pendingListeners = [];
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`[Socket] Cannot emit "${event}" — not connected.`);
    }
  }

  on(event, callback) {
    if (this.socket) {
      // Remove existing listener to prevent duplicate registration
      this.socket.off(event, callback);
      this.socket.on(event, callback);
    } else {
      // Buffer the listener — will be registered once socket connects
      // Deduplicate pending listeners
      this._pendingListeners = this._pendingListeners.filter(
        (l) => !(l.event === event && l.callback === callback)
      );
      this._pendingListeners.push({ event, callback });
    }
  }

  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
    // Also remove from pending buffer if not yet connected
    this._pendingListeners = this._pendingListeners.filter(
      (l) => {
        if (callback) {
          return !(l.event === event && l.callback === callback);
        } else {
          return l.event !== event;
        }
      }
    );
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }
}

const socketClient = new SocketClient();
export default socketClient;
