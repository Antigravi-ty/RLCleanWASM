/**
 * src/network/P2PWebRTCChannel.js
 * Cross-Tab / Cross-Device WebRTC RTCDataChannel Transport Layer.
 * 
 * Features:
 * - Unreliable, unordered RTCDataChannel (ordered: false, maxRetransmits: 0) matching Rocket League UDP.
 * - Self-contained Token Handshake (Base64 URL-safe SDP + ICE candidate bundle).
 * - Automatic BroadcastChannel signaling & real-time trickle ICE candidate exchange.
 * - Robust dual-transport: DataChannel primary with seamless BroadcastChannel fallback.
 * - High-speed binary framing using InputPacketCodec and ServerSnapshotCodec.
 * - Real measured RTT via periodic Ping/Pong heartbeat.
 * - Adjustable simulated extra latency (default 0ms), jitter, and packet drop injection.
 */

import { InputPacketCodec } from './InputPacketCodec.js';
import { ServerSnapshotCodec } from './ServerSnapshotCodec.js';

export function encodeSignalToken(obj) {
  const json = JSON.stringify(obj);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function decodeSignalToken(tokenStr) {
  if (!tokenStr) throw new Error('Token string is empty');
  const clean = tokenStr.trim().replace(/^RL_(OFFER|ANSWER)_/, '');
  const raw = atob(clean);
  const json = decodeURIComponent(
    raw.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
  return JSON.parse(json);
}

export class P2PWebRTCChannel {
  /**
   * @param {object} [options]
   * @param {'host'|'client'} [options.role='client']
   * @param {number} [options.extraLatencyMs=0] Simulated extra latency in ms
   * @param {number} [options.jitterMs=2] Simulated jitter in ms
   * @param {number} [options.packetLossRate=0.0] Simulated packet loss rate (0.0 - 1.0)
   * @param {string} [options.playerName='Player']
   * @param {number} [options.colorSlot=0]
   * @param {string} [options.colorHex='#ff7043']
   * @param {string} [options.signalingChannelName='car_soccer_online_p2p']
   */
  constructor(options = {}) {
    this.role = options.role ?? 'client';
    this.extraLatencyMs = options.extraLatencyMs ?? 0;
    this.jitterMs = options.jitterMs ?? 2;
    this.packetLossRate = options.packetLossRate ?? 0.0;
    this.playerName = options.playerName ?? 'Player';
    this.localColorSlot = options.colorSlot ?? (this.role === 'host' ? 3 : 0);
    this.localColorHex = options.colorHex ?? (this.role === 'host' ? '#42a5f5' : '#ff7043');
    this.peerName = null;
    this.peerColorSlot = null;
    this.peerColorHex = null;
    this.signalingChannelName = options.signalingChannelName ?? 'car_soccer_online_p2p';

    this.isOpen = false;
    this.pc = null;
    this.dataChannel = null;
    this.localCandidates = [];
    this.pendingRemoteCandidates = [];

    // Delivery queues
    this.inboundQueue = [];
    this.outboundQueue = [];

    // Latency & stats
    this.measuredRttMs = 0;
    this.measuredJitterMs = 0;
    this.lastPingSentTime = 0;
    this.pingIntervalMs = 500;

    this.dropNextPacket = false;
    this.packetsToDrop = 0;

    this.stats = {
      packetsSent: 0,
      packetsReceived: 0,
      packetsDropped: 0,
      bytesSent: 0,
      bytesReceived: 0,
      pingsSent: 0,
      pongsReceived: 0
    };

    this.onConnected = null;
    this.onDisconnected = null;
    this.onPacketReceived = null;
    this.onColorChange = null;

    this._initSignalingChannel();
  }

  _initSignalingChannel() {
    if (typeof BroadcastChannel !== 'undefined' && this.signalingChannelName) {
      try {
        this.broadcastChannel = new BroadcastChannel(this.signalingChannelName);
        this.broadcastChannel.onmessage = (e) => this._handleBroadcastMessage(e.data);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] BroadcastChannel unavailable:', err);
      }
    }
  }

  _handleBroadcastMessage(msg) {
    if (!msg || !msg.type) return;

    // Cross-tab real-time trickle ICE candidate exchange
    if (msg.type === 'ice_candidate' && msg.candidate && msg.senderRole !== this.role) {
      if (this.pc && this.pc.remoteDescription) {
        try {
          this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch (_) {}
      } else {
        this.pendingRemoteCandidates.push(msg.candidate);
      }
      return;
    }

    // Cross-tab data frame transport fallback
    if (msg.type === 'cross_tab_frame' && msg.senderRole !== this.role && msg.frame) {
      if (!this.isOpen) {
        this.isOpen = true;
        this.onConnected?.();
      }
      this._handleIncomingMessage(msg.frame);
      return;
    }

    if (this.onBroadcastSignal) {
      this.onBroadcastSignal(msg);
    }
  }

  broadcastSignal(type, payload = {}) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type,
          senderRole: this.role,
          senderName: this.playerName,
          timestamp: Date.now(),
          ...payload
        });
      } catch (_) {}
    }
  }

  /**
   * Creates RTCPeerConnection and sets up candidate gathering
   */
  createPeerConnection() {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('RTCPeerConnection is not supported in this environment');
    }

    const config = {
      iceServers: [
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.miwifi.com:3478' },
        { urls: 'stun:stun.chat.bilibili.com:3478' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.pc = new RTCPeerConnection(config);
    this.localCandidates = [];
    this.pendingRemoteCandidates = [];

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        this.localCandidates.push(candJson);
        this.broadcastSignal('ice_candidate', { candidate: candJson });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`[P2PWebRTCChannel] ICE Connection State: ${this.pc?.iceConnectionState}`);
      if (this.pc?.iceConnectionState === 'connected' || this.pc?.iceConnectionState === 'completed') {
        this._markConnected();
      } else if (this.pc?.iceConnectionState === 'failed' || this.pc?.iceConnectionState === 'disconnected') {
        if (this.isOpen && !this.broadcastChannel) {
          this.isOpen = false;
          this.onDisconnected?.();
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[P2PWebRTCChannel] Connection State: ${this.pc?.connectionState}`);
      if (this.pc?.connectionState === 'connected') {
        this._markConnected();
      } else if (this.pc?.connectionState === 'failed' || this.pc?.connectionState === 'closed') {
        if (this.isOpen && !this.broadcastChannel) {
          this.isOpen = false;
          this.onDisconnected?.();
        }
      }
    };

    return this.pc;
  }

  _waitForIceGathering(timeoutMs = 2000) {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let timer = null;
      const onStateChange = () => {
        if (this.pc && this.pc.iceGatheringState === 'complete') {
          cleanup();
          resolve();
        }
      };
      const onCandidate = (e) => {
        if (!e.candidate) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.pc?.removeEventListener('icegatheringstatechange', onStateChange);
        this.pc?.removeEventListener('icecandidate', onCandidate);
      };
      this.pc.addEventListener('icegatheringstatechange', onStateChange);
      this.pc.addEventListener('icecandidate', onCandidate);
      timer = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
    });
  }

  _markConnected() {
    if (!this.isOpen) {
      this.isOpen = true;
      console.log(`[P2PWebRTCChannel] Connected successfully as ${this.role}!`);
      this.onConnected?.();
    }
  }

  /**
   * Host initializes an offer and returns the shareable Offer Token
   * @returns {Promise<string>}
   */
  async createOfferToken(options = {}) {
    this.role = 'host';
    if (options.hostColorSlot !== undefined) this.localColorSlot = options.hostColorSlot;
    if (options.hostColorHex !== undefined) this.localColorHex = options.hostColorHex;
    this.createPeerConnection();

    // Host creates unreliable, unordered UDP data channel
    this.dataChannel = this.pc.createDataChannel('car_soccer_net', {
      ordered: false,
      maxRetransmits: 0
    });
    this.dataChannel.binaryType = 'arraybuffer';
    this._bindDataChannel(this.dataChannel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Wait for local candidates to be gathered
    await this._waitForIceGathering(1500);

    const payload = {
      type: 'offer',
      sdp: this.pc.localDescription.sdp,
      candidates: this.localCandidates,
      hostName: this.playerName,
      hostColorSlot: this.localColorSlot,
      hostColorHex: this.localColorHex,
      version: 1
    };

    const token = 'RL_OFFER_' + encodeSignalToken(payload);
    console.log(`[P2PWebRTCChannel] Host offer token created (${token.length} chars). Candidates gathered: ${this.localCandidates.length}`);
    this.broadcastSignal('room_offer', {
      token,
      hostName: this.playerName,
      hostColorSlot: this.localColorSlot,
      hostColorHex: this.localColorHex
    });
    return token;
  }

  /**
   * Client ingests Host Offer Token and generates shareable Answer Token
   * @param {string} offerToken
   * @returns {Promise<string>}
   */
  async acceptOfferAndCreateAnswer(offerToken, options = {}) {
    this.role = 'client';
    if (options.clientColorSlot !== undefined) this.localColorSlot = options.clientColorSlot;
    if (options.clientColorHex !== undefined) this.localColorHex = options.clientColorHex;
    this.createPeerConnection();

    const offerData = decodeSignalToken(offerToken);
    if (!offerData || offerData.type !== 'offer') {
      throw new Error('Invalid offer token: expected offer payload');
    }

    this.peerName = offerData.hostName || 'Host';
    if (offerData.hostColorHex) {
      this.peerColorHex = offerData.hostColorHex;
      this.peerColorSlot = offerData.hostColorSlot;
    }

    this.pc.ondatachannel = (event) => {
      console.log('[P2PWebRTCChannel] Client accepted dataChannel from Host');
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this._bindDataChannel(this.dataChannel);
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerData.sdp
    }));

    // Ingest bundled offer candidates
    if (Array.isArray(offerData.candidates)) {
      for (const cand of offerData.candidates) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
      }
    }
    // Ingest any queued trickle candidates
    for (const cand of this.pendingRemoteCandidates) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
    }
    this.pendingRemoteCandidates = [];

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    // Wait for client candidates to be gathered
    await this._waitForIceGathering(1500);

    const payload = {
      type: 'answer',
      sdp: this.pc.localDescription.sdp,
      candidates: this.localCandidates,
      clientName: this.playerName,
      clientColorSlot: this.localColorSlot,
      clientColorHex: this.localColorHex,
      version: 1
    };

    const token = 'RL_ANSWER_' + encodeSignalToken(payload);
    console.log(`[P2PWebRTCChannel] Client answer token created (${token.length} chars). Candidates gathered: ${this.localCandidates.length}`);
    this.broadcastSignal('room_answer', {
      token,
      clientName: this.playerName,
      clientColorSlot: this.localColorSlot,
      clientColorHex: this.localColorHex
    });
    return token;
  }

  /**
   * Host ingests Client Answer Token to complete WebRTC handshake
   * @param {string} answerToken
   */
  async acceptAnswerToken(answerToken) {
    if (!this.pc) throw new Error('Host RTCPeerConnection not initialized');
    if (this.pc.signalingState === 'stable') {
      console.warn('[P2PWebRTCChannel] Signaling state is already stable, answer description was already set.');
      return;
    }
    const answerData = decodeSignalToken(answerToken);
    if (!answerData || answerData.type !== 'answer') {
      throw new Error('Invalid answer token: expected answer payload');
    }

    this.peerName = answerData.clientName || 'Player 2';
    if (answerData.clientColorHex) {
      this.peerColorHex = answerData.clientColorHex;
      this.peerColorSlot = answerData.clientColorSlot;
    }

    console.log(`[P2PWebRTCChannel] Setting remote answer SDP from ${this.peerName}...`);
    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerData.sdp
    }));
    console.log('[P2PWebRTCChannel] Remote answer SDP applied. Signaling state:', this.pc.signalingState);

    if (Array.isArray(answerData.candidates)) {
      for (const cand of answerData.candidates) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
      }
    }
    for (const cand of this.pendingRemoteCandidates) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
    }
    this.pendingRemoteCandidates = [];
  }

  sendColorChange(slotId, hex, carIndex) {
    const payload = JSON.stringify({
      type: 'color_change',
      slotId,
      hex,
      carIndex
    });
    this._sendRaw(payload);
  }

  _bindDataChannel(channel) {
    channel.onopen = () => {
      console.log('[P2PWebRTCChannel] RTCDataChannel is OPEN and ready for UDP streaming!');
      this._markConnected();
      this._startPingInterval();
    };

    channel.onclose = () => {
      console.log('[P2PWebRTCChannel] RTCDataChannel CLOSED');
      if (!this.broadcastChannel) {
        this.isOpen = false;
        this.onDisconnected?.();
      }
      this._stopPingInterval();
    };

    channel.onerror = (err) => {
      console.error('[P2PWebRTCChannel] RTCDataChannel error:', err);
    };

    channel.onmessage = (event) => {
      this._handleIncomingMessage(event.data);
    };
  }

  _handleIncomingMessage(data) {
    const now = performance.now();
    this.stats.packetsReceived++;

    // Text / JSON handling (Ping / Pong heartbeats, color sync)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'color_change') {
          console.log(`[P2PWebRTCChannel] Received remote color_change: car ${msg.carIndex} -> ${msg.hex}`);
          this.onColorChange?.(msg);
          return;
        }
        if (msg.type === 'ping') {
          this._sendPong(msg.sendTime);
          return;
        } else if (msg.type === 'pong') {
          this._handlePong(msg.sendTime);
          return;
        }
      } catch (_) {}
    }

    // Binary packet decoding (InputPacketCodec vs ServerSnapshotCodec vs Text)
    let payload = data;
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
      this.stats.bytesReceived += uint8.byteLength;
      if (ServerSnapshotCodec.isSnapshotPacket(uint8)) {
        payload = ServerSnapshotCodec.decode(uint8);
      } else {
        const decoded = InputPacketCodec.decode(uint8);
        if (decoded) {
          payload = decoded;
        } else {
          try {
            const str = new TextDecoder().decode(uint8);
            payload = JSON.parse(str);
          } catch (_) {}
        }
      }
    }

    if (!payload) return;

    const deliverAt = this.extraLatencyMs > 0
      ? now + this.extraLatencyMs + (Math.random() * 2 - 1) * this.jitterMs
      : 0;

    if (deliverAt === 0) {
      this.inboundQueue.push(payload);
    } else {
      this.inboundQueue.push({ payload, deliverAt });
    }

    this.onPacketReceived?.(payload);
  }

  _sendPong(sendTime) {
    this._sendRaw(JSON.stringify({ type: 'pong', sendTime }));
  }

  _handlePong(sendTime) {
    const now = performance.now();
    const sample = Math.max(0, now - sendTime);
    this.stats.pongsReceived++;
    if (this.measuredRttMs === 0) {
      this.measuredRttMs = sample;
    } else {
      const diff = Math.abs(sample - this.measuredRttMs);
      this.measuredRttMs = this.measuredRttMs * 0.85 + sample * 0.15;
      this.measuredJitterMs = this.measuredJitterMs * 0.85 + diff * 0.15;
    }
  }

  setExtraLatency(extraLatencyMs) {
    this.extraLatencyMs = Math.max(0, extraLatencyMs);
  }

  setRtt(rttMs) {
    this.setExtraLatency(Math.round(rttMs * 0.5));
  }

  get rttMs() {
    return Math.round(this.measuredRttMs + this.extraLatencyMs * 2);
  }

  setPacketLossRate(rate) {
    this.packetLossRate = Math.min(1.0, Math.max(0.0, rate));
  }

  forceDropNextInput(count = 1) {
    this.dropNextPacket = true;
    this.packetsToDrop = Math.max(1, count);
  }

  _startPingInterval() {
    this._stopPingInterval();
    this.pingTimer = setInterval(() => {
      if (this.isOpen) {
        this.lastPingSentTime = performance.now();
        this.stats.pingsSent++;
        this._sendRaw(JSON.stringify({
          type: 'ping',
          sendTime: this.lastPingSentTime
        }));
      }
    }, this.pingIntervalMs);
  }

  _stopPingInterval() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Sends binary or string data via WebRTC dataChannel or fallback BroadcastChannel
   */
  _sendRaw(buffer) {
    let sent = false;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(buffer);
        sent = true;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] dataChannel send error:', err);
      }
    }

    // BroadcastChannel fallback for local tab pairing
    if (!sent && this.broadcastChannel) {
      try {
        this.broadcastSignal('cross_tab_frame', { frame: buffer });
        sent = true;
      } catch (_) {}
    }

    return sent;
  }

  /**
   * Client sends input packet to Server
   * @param {object} packet
   * @param {number} [nowMs=performance.now()]
   * @returns {boolean}
   */
  sendClientInput(packet, nowMs = performance.now()) {
    if (this.dropNextPacket) {
      this.packetsToDrop--;
      if (this.packetsToDrop <= 0) this.dropNextPacket = false;
      this.stats.packetsDropped++;
      return false;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return false;
    }

    let buffer;
    if (packet instanceof Uint8Array) {
      buffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
    } else if (packet instanceof ArrayBuffer) {
      buffer = packet;
    } else if (packet && packet.history) {
      const encoded = InputPacketCodec.encode(packet.carIndex ?? 0, packet.targetTick ?? packet.tick ?? 0, packet.history);
      buffer = encoded.buffer;
    } else {
      buffer = new TextEncoder().encode(JSON.stringify(packet)).buffer;
    }

    this.stats.packetsSent++;
    this.stats.bytesSent += buffer.byteLength;

    return this._sendRaw(buffer);
  }

  /**
   * Server sends state snapshot to Client
   * @param {object} packet
   * @param {number} [nowMs=performance.now()]
   * @returns {boolean}
   */
  sendServerState(packet, nowMs = performance.now()) {
    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return false;
    }

    let buffer;
    if (packet instanceof Uint8Array) {
      buffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
    } else if (packet instanceof ArrayBuffer) {
      buffer = packet;
    } else if (packet && (packet.stateSnapshot || packet.serverTick !== undefined)) {
      const binary = ServerSnapshotCodec.encode(packet);
      buffer = binary.buffer;
    } else {
      buffer = new TextEncoder().encode(JSON.stringify(packet)).buffer;
    }

    this.stats.packetsSent++;
    this.stats.bytesSent += buffer.byteLength;

    return this._sendRaw(buffer);
  }

  sendInput(packet, nowMs = performance.now()) {
    return this.sendClientInput(packet, nowMs);
  }

  /**
   * Receive delivered client input packets (Server side)
   * @param {number} [nowMs=performance.now()]
   * @returns {Array<object>}
   */
  receiveServerPackets(nowMs = performance.now()) {
    return this._drainInboundQueue(nowMs);
  }

  /**
   * Receive delivered server state snapshots (Client side)
   * @param {number} [nowMs=performance.now()]
   * @returns {Array<object>}
   */
  receiveClientPackets(nowMs = performance.now()) {
    return this._drainInboundQueue(nowMs);
  }

  _drainInboundQueue(nowMs) {
    const delivered = [];
    const remaining = [];

    for (let i = 0; i < this.inboundQueue.length; i++) {
      const item = this.inboundQueue[i];
      if (item && item.deliverAt !== undefined) {
        if (item.deliverAt <= nowMs) {
          delivered.push(item.payload);
        } else {
          remaining.push(item);
        }
      } else {
        delivered.push(item);
      }
    }

    this.inboundQueue = remaining;
    return delivered;
  }

  destroy() {
    this.isOpen = false;
    this._stopPingInterval();
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch (_) {}
      this.dataChannel = null;
    }
    if (this.pc) {
      try { this.pc.close(); } catch (_) {}
      this.pc = null;
    }
    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch (_) {}
      this.broadcastChannel = null;
    }
    this.inboundQueue = [];
    this.outboundQueue = [];
  }
}

export default P2PWebRTCChannel;
