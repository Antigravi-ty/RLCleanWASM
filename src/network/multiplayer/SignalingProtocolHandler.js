/**
 * src/network/multiplayer/SignalingProtocolHandler.js
 * Headless WebSocket signaling protocol dispatcher for multiplayer matchmaking.
 */

import { WebSocketSignalingClient } from '../WebSocketSignalingClient.js';
import { getSignalingUrl } from '../../config/signalingConfig.js';

export class SignalingProtocolHandler {
  /**
   * @param {object} options
   * @param {string} options.roomId
   * @param {string} [options.password='']
   * @param {'host'|'client'} options.role
   * @param {string} options.playerName
   * @param {object} callbacks
   */
  constructor(options, callbacks = {}) {
    this.roomId = options.roomId;
    this.password = options.password || '';
    this.role = options.role;
    this.playerName = options.playerName;
    this.callbacks = callbacks;

    this.client = null;
    this.status = 'idle'; // 'idle' | 'connecting' | 'connected' | 'error'
    this._reconnectTimer = null;
  }

  connect(timeoutMs = 8000) {
    this.cleanup();
    const sigUrl = getSignalingUrl();
    this.client = new WebSocketSignalingClient(sigUrl, {
      roomId: this.roomId,
      password: this.password,
      role: this.role,
      playerName: this.playerName,
    });
    this.status = 'connecting';

    this.client.on('open', () => {
      this.status = 'connected';
      this.callbacks.onOpen?.();
    });

    this.client.on('close', () => {
      this.status = 'error';
      this.callbacks.onClose?.();
    });

    this.client.on('error', (err) => {
      this.status = 'error';
      this.callbacks.onError?.(err);
    });

    this.client.on('peer_joined', (data) => {
      this.callbacks.onPeerJoined?.(data);
    });

    this.client.on('room_info', (data) => {
      this.callbacks.onRoomInfo?.(data);
    });

    this.client.on('request_offer', (data) => {
      this.callbacks.onRequestOffer?.(data);
    });

    this.client.on('offer', (data) => {
      this.callbacks.onOffer?.(data);
    });

    this.client.on('answer', (data) => {
      this.callbacks.onAnswer?.(data);
    });

    this.client.on('candidate', (data) => {
      this.callbacks.onCandidate?.(data);
    });

    return this.client.connect(timeoutMs);
  }

  scheduleReconnect(delayMs = 3000, reconnectFn) {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      if (typeof reconnectFn === 'function') reconnectFn();
    }, delayMs);
  }

  send(data) {
    if (!this.client) {
      throw new Error('[SignalingProtocolHandler] Cannot send message: client is not initialized');
    }
    return this.client.send(data);
  }

  sendOffer(peerId, token) {
    if (!this.client) {
      throw new Error('[SignalingProtocolHandler] Cannot send offer: client is not initialized');
    }
    return this.client.sendOffer(peerId, token);
  }

  sendAnswer(token, targetPeerId) {
    if (!this.client) {
      throw new Error('[SignalingProtocolHandler] Cannot send answer: client is not initialized');
    }
    return this.client.sendAnswer(token, targetPeerId);
  }

  sendCandidate(targetPeerId, candidate) {
    if (!this.client) {
      throw new Error('[SignalingProtocolHandler] Cannot send candidate: client is not initialized');
    }
    return this.client.sendCandidate(targetPeerId, candidate);
  }

  get peerId() {
    return this.client?.peerId || null;
  }

  cleanup() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.client) {
      try {
        this.client.close();
      } catch (err) {
        console.warn('[SignalingProtocolHandler] Error closing client:', err);
      }
      this.client = null;
    }
    this.status = 'idle';
  }
}
