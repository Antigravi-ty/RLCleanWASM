/**
 * src/network/WebSocketSignalingClient.js
 * Client-Side Signaling Adapter for Cloudflare WebSocket Worker.
 * 
 * Provides automated, sub-5-second WebRTC handshake orchestration:
 * - Automatically connects to Cloudflare Worker endpoint with roomId, role, and password.
 * - Handles WebRTC Offer / Answer exchange and Trickle ICE routing without manual user copy-paste.
 * - Dispatches 'peer_joined', 'peer_left', 'offer', 'answer', and 'candidate' events.
 */

import { SIGNALING_ROOM_PREFIX } from './SignalingConfig.js';

export class WebSocketSignalingClient {
  /**
   * @param {string} workerUrl e.g. "wss://signaling.yourdomain.com/ws"
   * @param {object} options
   * @param {string} options.roomId
   * @param {string} [options.role='client'] 'host' | 'client'
   * @param {string} [options.peerId]
   * @param {string} [options.password='']
   * @param {string} [options.playerName='Player']
   * @param {string} [options.gameMode='3v3']
   */
  constructor(workerUrl, options = {}) {
    this.workerUrl = (workerUrl || '').trim();
    this.roomId = options.roomId;
    this.role = options.role || 'client';
    this.peerId = options.peerId || `peer_${Math.random().toString(36).slice(2, 8)}`;
    this.password = options.password || '';
    this.playerName = options.playerName || (this.role === 'host' ? 'Host' : 'Player');
    this.gameMode = options.gameMode || '3v3';

    this.ws = null;
    this.isConnected = false;
    this.eventListeners = new Map();
  }

  /**
   * Builds the WebSocket connection URL with parameters
   */
  get connectUrl() {
    let base = this.workerUrl;
    if (!base.startsWith('ws://') && !base.startsWith('wss://')) {
      base = base.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
      if (!base.startsWith('ws://') && !base.startsWith('wss://')) {
        base = 'wss://' + base;
      }
    }
    const url = new URL(base);
    const cleanRoomId = (this.roomId || '').trim();
    const fullRoomId = cleanRoomId.startsWith(SIGNALING_ROOM_PREFIX)
      ? cleanRoomId
      : `${SIGNALING_ROOM_PREFIX}${cleanRoomId}`;

    url.searchParams.set('room', fullRoomId);
    url.searchParams.set('roomId', fullRoomId);
    url.searchParams.set('password', this.password || '');
    url.searchParams.set('peerId', this.peerId);
    url.searchParams.set('isHost', String(this.role === 'host'));
    url.searchParams.set('role', this.role);
    url.searchParams.set('name', this.playerName);
    url.searchParams.set('gameMode', this.gameMode);
    return url.toString();
  }

  /**
   * Connect to the Cloudflare Worker signaling endpoint
   * @param {number} [timeoutMs=8000] Connection timeout in milliseconds
   * @returns {Promise<void>}
   */
  async connect(timeoutMs = 8000) {
    const WebSocketConstructor = typeof WebSocket !== 'undefined'
      ? WebSocket
      : (globalThis.WebSocket || null);

    if (!WebSocketConstructor) {
      throw new Error('WebSocket is not supported in this environment');
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const wsUrl = this.connectUrl;

      let timer = null;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            console.warn(`[WebSocketSignalingClient] ⏱️ WebSocket connect timed out after ${timeoutMs}ms: ${wsUrl}`);
            try {
              if (this.ws) {
                this.ws.onopen = null;
                this.ws.onerror = null;
                this.ws.onclose = null;
                this.ws.close();
              }
            } catch (_) {}
            const err = new Error(`WebSocket connection timed out after ${timeoutMs}ms`);
            this.emit('error', err);
            reject(err);
          }
        }, timeoutMs);
      }

      try {
        console.log(`[WebSocketSignalingClient] 🔌 Opening WebSocket connection: ${wsUrl}`);
        this.ws = new WebSocketConstructor(wsUrl);
      } catch (err) {
        if (timer) clearTimeout(timer);
        this.emit('error', err);
        return reject(err);
      }

      this.ws.onopen = () => {
        if (timer) clearTimeout(timer);
        console.log(`[WebSocketSignalingClient] 🌐 WebSocket open: room=${this.roomId}, role=${this.role}, peerId=${this.peerId}`);
        if (!isSettled) {
          isSettled = true;
          this.isConnected = true;
          this._startHeartbeat();
          this.emit('open');
          resolve();
        }
      };

      this.ws.onerror = err => {
        if (timer) clearTimeout(timer);
        console.warn('[WebSocketSignalingClient] ⚠️ WebSocket error:', err);
        this.emit('error', err);
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };

      this.ws.onclose = ev => {
        if (timer) clearTimeout(timer);
        console.log(`[WebSocketSignalingClient] 🔌 WebSocket closed: code=${ev.code}, reason=${ev.reason}`);
        this.isConnected = false;
        this._stopHeartbeat();
        this.emit('close', ev);
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`WebSocket closed before open (code: ${ev.code})`));
        }
      };

      this.ws.onmessage = ev => {
        try {
          const data = JSON.parse(ev.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('[WebSocketSignalingClient] Failed to parse message:', err);
        }
      };
    });
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', peerId: this.peerId, timestamp: Date.now() }));
        } catch (_) {}
      }
    }, 12000);
  }

  _stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * Dispatch parsed signaling message
   */
  handleMessage(msg) {
    if (!msg) return;
    if (msg.type === 'ping') {
      this.send({ type: 'pong', peerId: this.peerId, timestamp: Date.now() });
      return;
    }
    if (msg.type) {
      this.emit(msg.type, msg);
    }
  }

  /**
   * Send WebRTC Offer to a specific peer (Host only)
   * @param {string} targetPeerId
   * @param {object} sdpOffer
   */
  sendOffer(targetPeerId, sdpOffer) {
    this.send({
      type: 'offer',
      targetPeerId,
      fromPeerId: this.peerId,
      senderName: this.playerName,
      sdp: sdpOffer
    });
  }

  /**
   * Send WebRTC Answer back to the host (Client only)
   * @param {object} sdpAnswer
   */
  sendAnswer(sdpAnswer, targetPeerId = null) {
    this.send({
      type: 'answer',
      targetPeerId,
      fromPeerId: this.peerId,
      senderName: this.playerName,
      sdp: sdpAnswer
    });
  }

  /**
   * Send ICE Candidate
   * @param {string|null} targetPeerId Target peer ID if host, null if client sending to host
   * @param {object} candidate
   */
  sendCandidate(targetPeerId, candidate) {
    this.send({
      type: 'candidate',
      targetPeerId,
      fromPeerId: this.peerId,
      senderName: this.playerName,
      candidate
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(event, cb) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(cb);
  }

  off(event, cb) {
    const list = this.eventListeners.get(event);
    if (!list) return;
    this.eventListeners.set(event, list.filter(fn => fn !== cb));
  }

  emit(event, data) {
    const list = this.eventListeners.get(event);
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      try {
        list[i](data);
      } catch (err) {
        console.error('[WebSocketSignalingClient] Listener error:', err);
      }
    }
  }

  close() {
    this._stopHeartbeat();
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
  }
}
