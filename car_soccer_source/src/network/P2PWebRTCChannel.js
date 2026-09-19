/**
 * src/network/P2PWebRTCChannel.js
 * Cross-Tab / Cross-Device WebRTC RTCDataChannel Transport Layer.
 * 
 * Features:
 * - Unreliable, unordered RTCDataChannel (ordered: false, maxRetransmits: 0) matching Rocket League UDP.
 * - Self-contained Token Handshake (Base64 URL-safe SDP + ICE candidate bundle).
 * - Automatic BroadcastChannel signaling for instant local cross-tab discovery.
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
   * @param {number} [options.extraLatencyMs=0] Simulated extra latency in ms (default 0ms = no added latency)
   * @param {number} [options.jitterMs=2] Simulated jitter in ms
   * @param {number} [options.packetLossRate=0.0] Simulated packet loss rate (0.0 - 1.0)
   * @param {string} [options.playerName='Player']
   * @param {string} [options.signalingChannelName='car_soccer_online_p2p']
   */
  constructor(options = {}) {
    this.role = options.role ?? 'client';
    this.extraLatencyMs = options.extraLatencyMs ?? 0;
    this.jitterMs = options.jitterMs ?? 2;
    this.packetLossRate = options.packetLossRate ?? 0.0;
    this.playerName = options.playerName ?? 'Player';
    this.signalingChannelName = options.signalingChannelName ?? 'car_soccer_online_p2p';

    this.isOpen = false;
    this.pc = null;
    this.dataChannel = null;
    this.localCandidates = [];
    this.gatheringPromise = null;

    // Simulation delivery queues
    this.inboundQueue = [];  // Packets received from peer, queued for deliverAt
    this.outboundQueue = []; // Packets queued before sending (if latency applied)

    // Measured stats
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
    if (this.onBroadcastSignal) {
      this.onBroadcastSignal(msg);
    }
  }

  broadcastSignal(type, payload = {}) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type,
        senderRole: this.role,
        senderName: this.playerName,
        timestamp: Date.now(),
        ...payload
      });
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
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    };

    this.pc = new RTCPeerConnection(config);
    this.localCandidates = [];

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.localCandidates.push(event.candidate.toJSON());
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc.iceConnectionState === 'disconnected' || this.pc.iceConnectionState === 'failed') {
        this.isOpen = false;
        this.onDisconnected?.();
      }
    };

    this.gatheringPromise = new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const onStateChange = () => {
        if (this.pc && this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', onStateChange);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', onStateChange);
      // Failsafe timeout: resolve after 600ms so token is generated even if remote STUN is slow
      setTimeout(() => {
        if (this.pc) this.pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      }, 600);
    });

    return this.pc;
  }

  /**
   * Host initializes an offer and returns the shareable Offer Token
   * @returns {Promise<string>}
   */
  async createOfferToken() {
    this.role = 'host';
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

    await this.gatheringPromise;

    const payload = {
      type: 'offer',
      sdp: this.pc.localDescription.sdp,
      candidates: this.localCandidates,
      hostName: this.playerName,
      version: 1
    };

    const token = 'RL_OFFER_' + encodeSignalToken(payload);
    // Auto-broadcast room offer for nearby tabs
    this.broadcastSignal('room_offer', { token, hostName: this.playerName });
    return token;
  }

  /**
   * Client ingests Host Offer Token and generates shareable Answer Token
   * @param {string} offerToken
   * @returns {Promise<string>}
   */
  async acceptOfferAndCreateAnswer(offerToken) {
    this.role = 'client';
    this.createPeerConnection();

    const offerData = decodeSignalToken(offerToken);
    if (!offerData || offerData.type !== 'offer') {
      throw new Error('Invalid offer token: expected offer payload');
    }

    this.pc.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.dataChannel.binaryType = 'arraybuffer';
      this._bindDataChannel(this.dataChannel);
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: offerData.sdp
    }));

    // Ingest any bundled candidates
    if (Array.isArray(offerData.candidates)) {
      for (const cand of offerData.candidates) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
      }
    }

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await this.gatheringPromise;

    const payload = {
      type: 'answer',
      sdp: this.pc.localDescription.sdp,
      candidates: this.localCandidates,
      clientName: this.playerName,
      version: 1
    };

    const token = 'RL_ANSWER_' + encodeSignalToken(payload);
    this.broadcastSignal('room_answer', { token, clientName: this.playerName });
    return token;
  }

  /**
   * Host ingests Client Answer Token to complete WebRTC handshake
   * @param {string} answerToken
   */
  async acceptAnswerToken(answerToken) {
    if (!this.pc) throw new Error('Host RTCPeerConnection not initialized');
    const answerData = decodeSignalToken(answerToken);
    if (!answerData || answerData.type !== 'answer') {
      throw new Error('Invalid answer token: expected answer payload');
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'answer',
      sdp: answerData.sdp
    }));

    if (Array.isArray(answerData.candidates)) {
      for (const cand of answerData.candidates) {
        try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
      }
    }
  }

  _bindDataChannel(channel) {
    channel.onopen = () => {
      this.isOpen = true;
      this.onConnected?.();
    };

    channel.onclose = () => {
      this.isOpen = false;
      this.onDisconnected?.();
    };

    channel.onerror = (err) => {
      console.warn('[P2PWebRTCChannel] DataChannel error:', err);
    };

    channel.onmessage = (event) => {
      this._handleIncomingMessage(event.data);
    };
  }

  _handleIncomingMessage(data) {
    const now = performance.now();
    this.stats.packetsReceived++;

    // Text / JSON handling (Ping / Pong heartbeats)
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ping') {
          this._sendPong(msg.sendTime);
          return;
        } else if (msg.type === 'pong') {
          this._handlePong(msg.sendTime);
          return;
        }
      } catch (_) {}
    }

    // Binary packet decoding (InputPacketCodec vs ServerSnapshotCodec)
    let payload = data;
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      this.stats.bytesReceived += data.byteLength;
      if (ServerSnapshotCodec.isSnapshotPacket(data)) {
        payload = ServerSnapshotCodec.decode(data);
      } else {
        const decoded = InputPacketCodec.decode(data);
        if (decoded) payload = decoded;
      }
    }

    if (!payload) return;

    // Apply simulated inbound extra latency if configured
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
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'pong', sendTime }));
    }
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

  // Latency & drop setters matching NetworkChannel interface
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

  forceDropNextInput(count = 5) {
    this.packetsToDrop = count;
    this.dropNextPacket = true;
  }

  dropSinglePacket() {
    this.forceDropNextInput(1);
  }

  /**
   * Sends client input packet over WebRTC
   * @param {object|Uint8Array} packet
   * @param {number} [nowMs=performance.now()]
   */
  sendClientInput(packet, nowMs = performance.now()) {
    this.stats.packetsSent++;

    if (this.dropNextPacket || this.packetsToDrop > 0) {
      if (this.packetsToDrop > 0) this.packetsToDrop--;
      this.dropNextPacket = false;
      this.stats.packetsDropped++;
      return false;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return false;
    }

    // Binary encode input if object
    let buf = packet;
    if (!(packet instanceof Uint8Array) && !(packet instanceof ArrayBuffer)) {
      if (packet.history) {
        buf = InputPacketCodec.encode(packet.carIndex ?? 0, packet.targetTick ?? packet.tick, packet.history);
      } else if (packet.controls) {
        buf = InputPacketCodec.encode(packet.carIndex ?? 0, packet.tick, [
          { tick: packet.tick, controls: packet.controls }
        ]);
      }
    }

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Error sending input:', err);
      }
    }

    // Check heartbeat ping
    if (nowMs - this.lastPingSentTime > this.pingIntervalMs) {
      this.lastPingSentTime = nowMs;
      this.stats.pingsSent++;
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(JSON.stringify({ type: 'ping', sendTime: nowMs }));
        } catch (_) {}
      }
    }

    return true;
  }

  /**
   * Sends authoritative server state packet over WebRTC
   * @param {object|Uint8Array} packet
   * @param {number} [nowMs=performance.now()]
   */
  sendServerState(packet, nowMs = performance.now()) {
    this.stats.packetsSent++;

    if (this.dropNextPacket || this.packetsToDrop > 0) {
      if (this.packetsToDrop > 0) this.packetsToDrop--;
      this.dropNextPacket = false;
      this.stats.packetsDropped++;
      return false;
    }

    if (this.packetLossRate > 0 && Math.random() < this.packetLossRate) {
      this.stats.packetsDropped++;
      return false;
    }

    let buf = packet;
    if (!(packet instanceof Uint8Array) && !(packet instanceof ArrayBuffer)) {
      buf = ServerSnapshotCodec.encode(packet);
    }

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Error sending state:', err);
      }
    }

    return true;
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

  reset() {
    this.inboundQueue = [];
    this.outboundQueue = [];
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
  }

  destroy() {
    this.reset();
    try { this.dataChannel?.close(); } catch (_) {}
    try { this.pc?.close(); } catch (_) {}
    try { this.broadcastChannel?.close(); } catch (_) {}
    this.dataChannel = null;
    this.pc = null;
    this.broadcastChannel = null;
    this.isOpen = false;
  }
}

export default P2PWebRTCChannel;
