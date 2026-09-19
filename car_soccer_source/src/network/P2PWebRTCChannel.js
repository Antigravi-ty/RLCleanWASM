/**
 * src/network/P2PWebRTCChannel.js
 * Cross-Tab / Cross-Device WebRTC RTCDataChannel & High-Speed Direct Transport Layer.
 * 
 * Features:
 * - Unreliable, unordered RTCDataChannel (ordered: false, maxRetransmits: 0) matching Rocket League UDP.
 * - Instant 120Hz native Cross-Tab transport (via BroadcastChannel room channel) for local multi-tab play.
 * - Self-contained Token Handshake (Base64 URL-safe SDP + ICE candidate bundle).
 * - Automatic BroadcastChannel signaling for instant local cross-tab discovery and 1-click join.
 * - Dynamic color slot tracking and live in-match color synchronization.
 * - High-speed binary framing using InputPacketCodec and ServerSnapshotCodec.
 * - Real measured RTT via periodic Ping/Pong heartbeat.
 * - Adjustable simulated extra latency, jitter, and packet drop injection.
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
   * @param {string} [options.signalingChannelName='car_soccer_online_discovery']
   * @param {string} [options.roomId]
   * @param {number} [options.colorSlot]
   * @param {string} [options.colorHex]
   */
  constructor(options = {}) {
    this.role = options.role ?? 'client';
    this.extraLatencyMs = options.extraLatencyMs ?? 0;
    this.jitterMs = options.jitterMs ?? 2;
    this.packetLossRate = options.packetLossRate ?? 0.0;
    this.playerName = options.playerName ?? 'Player';
    this.signalingChannelName = options.signalingChannelName ?? 'car_soccer_online_discovery';
    this.roomId = options.roomId ?? null;

    this.localColorSlot = options.colorSlot ?? (this.role === 'host' ? 3 : 0);
    this.localColorHex = options.colorHex ?? (this.role === 'host' ? '#42a5f5' : '#ff7043');
    this.peerColorSlot = null;
    this.peerColorHex = null;
    this.peerName = null;

    this.isOpen = false;
    this.isCrossTab = false;
    this.isWebRTC = false;
    this.transportMode = 'none';

    this.pc = null;
    this.dataChannel = null;
    this.localCandidates = [];
    this.gatheringPromise = null;
    this.pendingRemoteCandidates = [];
    this.offerToken = '';

    // Dedicated room BroadcastChannel for instant cross-tab connection
    this.roomBroadcastChannel = null;

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
    this.onColorChange = null;

    this._initSignalingChannel();
    if (this.roomId) {
      this._initRoomChannel(this.roomId);
    }
  }

  setColor(slotId, hex) {
    this.localColorSlot = slotId;
    this.localColorHex = hex;
  }

  updateOfferTokenColor(slotId, hex) {
    this.setColor(slotId, hex);
    if (this.offerToken) {
      try {
        const data = decodeSignalToken(this.offerToken);
        data.hostColorSlot = slotId;
        data.hostColorHex = hex;
        this.offerToken = 'RL_OFFER_' + encodeSignalToken(data);
      } catch (_) {}
    }
    this.sendColorChange(slotId, hex, 0);
    return this.offerToken;
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

  _initRoomChannel(roomId) {
    if (!roomId || typeof BroadcastChannel === 'undefined') return;
    if (this.roomBroadcastChannel && this.roomBroadcastChannel.name === 'car_soccer_p2p_' + roomId) {
      return;
    }
    try {
      if (this.roomBroadcastChannel) {
        this.roomBroadcastChannel.close();
      }
      this.roomId = roomId;
      this.roomBroadcastChannel = new BroadcastChannel('car_soccer_p2p_' + roomId);
      this.roomBroadcastChannel.onmessage = (e) => this._handleRoomMessage(e.data);
      console.log(`[P2PWebRTCChannel] 🚪 Room BroadcastChannel attached: car_soccer_p2p_${roomId}`);
    } catch (err) {
      console.warn('[P2PWebRTCChannel] Could not create room BroadcastChannel:', err);
    }
  }

  _handleRoomMessage(data) {
    if (!data) return;

    // Direct binary simulation packets (Uint8Array or ArrayBuffer)
    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      this._handleIncomingMessage(data);
      return;
    }

    if (typeof data === 'string') {
      this._handleIncomingMessage(data);
      return;
    }

    if (typeof data === 'object') {
      if (data.type === 'cross_tab_join') {
        // Received on Host from Client
        console.log(`[P2PWebRTCChannel] ⚡ Host received cross_tab_join from "${data.clientName}" (Color: slot ${data.clientColorSlot} ${data.clientColorHex})`);
        this.peerName = data.clientName || 'Player 2';
        this.peerColorSlot = data.clientColorSlot;
        this.peerColorHex = data.clientColorHex;
        this.isCrossTab = true;
        this.transportMode = 'crosstab';
        const wasOpen = this.isOpen;
        this.isOpen = true;

        // Reply with acknowledgment and host details
        this._sendRoomMessage({
          type: 'cross_tab_ack',
          hostName: this.playerName,
          hostColorSlot: this.localColorSlot,
          hostColorHex: this.localColorHex
        });

        if (!wasOpen) {
          queueMicrotask(() => this.onConnected?.());
        }
        return;
      }

      if (data.type === 'cross_tab_ack') {
        // Received on Client from Host
        console.log(`[P2PWebRTCChannel] ⚡ Client received cross_tab_ack from Host "${data.hostName}" (Color: slot ${data.hostColorSlot} ${data.hostColorHex})`);
        this.peerName = data.hostName || 'Host';
        this.peerColorSlot = data.hostColorSlot;
        this.peerColorHex = data.hostColorHex;
        this.isCrossTab = true;
        this.transportMode = 'crosstab';
        const wasOpen = this.isOpen;
        this.isOpen = true;

        if (!wasOpen) {
          queueMicrotask(() => this.onConnected?.());
        }
        return;
      }

      if (data.type === 'color_change') {
        console.log(`[P2PWebRTCChannel] 🎨 Received cross-tab color_change: car ${data.carIndex} -> slot ${data.slotId} (${data.hex})`);
        this.onColorChange?.(data);
        return;
      }

      if (data.type === 'ping') {
        this._sendPong(data.sendTime);
        return;
      }

      if (data.type === 'pong') {
        this._handlePong(data.sendTime);
        return;
      }

      if (data.type === 'p2p_packet' && data.buffer) {
        this._handleIncomingMessage(data.buffer);
        return;
      }
    }
  }

  _sendRoomMessage(msg) {
    if (this.roomBroadcastChannel) {
      try {
        this.roomBroadcastChannel.postMessage(msg);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Failed to post room message:', err);
      }
    }
  }

  _handleBroadcastMessage(msg) {
    if (!msg || !msg.type) return;
    if (msg.senderRole === this.role && msg.senderName === this.playerName) return;

    if (msg.type === 'ice_candidate' && msg.candidate) {
      if (!msg.roomId || msg.roomId === this.roomId) {
        this.addRemoteCandidate(msg.candidate);
      }
    }

    if (this.onBroadcastSignal) {
      this.onBroadcastSignal(msg);
    }
  }

  async addRemoteCandidate(candJson) {
    if (!candJson) return;
    if (this.pc && this.pc.remoteDescription && this.pc.remoteDescription.type) {
      try {
        const c = typeof RTCIceCandidate !== "undefined" ? new RTCIceCandidate(candJson) : candJson;
        await this.pc.addIceCandidate(c);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Failed to add ICE candidate:', err);
      }
    } else {
      if (!this.pendingRemoteCandidates) this.pendingRemoteCandidates = [];
      this.pendingRemoteCandidates.push(candJson);
    }
  }

  async flushPendingCandidates() {
    if (!this.pc || !this.pendingRemoteCandidates || this.pendingRemoteCandidates.length === 0) return;
    const queued = this.pendingRemoteCandidates;
    this.pendingRemoteCandidates = [];
    for (const cand of queued) {
      try {
        const c = typeof RTCIceCandidate !== "undefined" ? new RTCIceCandidate(cand) : cand;
        await this.pc.addIceCandidate(c);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Failed to add queued ICE candidate:', err);
      }
    }
  }

  broadcastSignal(type, payload = {}) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type,
          roomId: this.roomId,
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
      console.warn('[P2PWebRTCChannel] RTCPeerConnection is not supported in this environment, using direct channel.');
      return null;
    }

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com:3478' }
      ],
      iceCandidatePoolSize: 2
    };

    this.pc = new RTCPeerConnection(config);
    this.localCandidates = [];
    this.pendingRemoteCandidates = [];

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candJson = event.candidate.toJSON();
        this.localCandidates.push(candJson);
        const typ = candJson.type || (candJson.candidate ? candJson.candidate.split(' ')[7] : 'unknown');
        console.log(`[P2PWebRTCChannel] 🧊 Candidate #${this.localCandidates.length} gathered (type: ${typ})`);
        this.broadcastSignal('ice_candidate', { candidate: candJson, roomId: this.roomId });
      } else {
        console.log(`[P2PWebRTCChannel] 🧊 ICE candidate gathering complete (${this.localCandidates.length} total).`);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[P2PWebRTCChannel] 🔗 Connection State: ${this.pc.connectionState}`);
      if (this.pc.connectionState === 'connected') {
        this.isWebRTC = true;
        this.isOpen = true;
        this.transportMode = 'webrtc';
      } else if (this.pc.connectionState === 'failed') {
        if (this.isCrossTab) {
          console.log('[P2PWebRTCChannel] ℹ️ WebRTC connection failed, but local Cross-Tab transport is ACTIVE (120Hz). Connection maintained!');
          return;
        }
        const wasOpen = this.isOpen;
        this.isOpen = false;
        if (wasOpen) this.onDisconnected?.();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`[P2PWebRTCChannel] 📡 ICE Connection State: ${this.pc.iceConnectionState}`);
      if (this.pc.iceConnectionState === 'failed') {
        if (this.isCrossTab) {
          console.log('[P2PWebRTCChannel] ℹ️ WebRTC ICE failed, but local Cross-Tab transport is ACTIVE (120Hz). Connection maintained!');
          return;
        }
        const wasOpen = this.isOpen;
        this.isOpen = false;
        if (wasOpen) this.onDisconnected?.();
      }
    };

    return this.pc;
  }

  _waitForIceGathering(timeoutMs = 1200) {
    if (!this.pc || this.pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let timeoutId;
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (this.pc) {
          this.pc.removeEventListener('icegatheringstatechange', onStateChange);
          this.pc.removeEventListener('icecandidate', onCandidate);
        }
      };
      const onStateChange = () => {
        if (this.pc && this.pc.iceGatheringState === 'complete') {
          cleanup();
          resolve();
        }
      };
      const onCandidate = (event) => {
        if (!event.candidate) {
          cleanup();
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', onStateChange);
      this.pc.addEventListener('icecandidate', onCandidate);

      timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, timeoutMs);
    });
  }

  /**
   * Host initializes an offer and returns the shareable Offer Token
   * @returns {Promise<string>}
   */
  async createOfferToken(options = {}) {
    this.role = 'host';
    if (options.hostColorSlot !== undefined) this.localColorSlot = options.hostColorSlot;
    if (options.hostColorHex !== undefined) this.localColorHex = options.hostColorHex;
    this.roomId = options.roomId || ('room_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6));
    this._initRoomChannel(this.roomId);

    this.createPeerConnection();

    let sdp = '';
    if (this.pc) {
      // Host creates unreliable, unordered UDP data channel
      this.dataChannel = this.pc.createDataChannel('car_soccer_net', {
        ordered: false,
        maxRetransmits: 0
      });
      this.dataChannel.binaryType = 'arraybuffer';
      this._bindDataChannel(this.dataChannel);

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      await this._waitForIceGathering(1200);
      sdp = this.pc.localDescription.sdp;
    }

    const payload = {
      type: 'offer',
      roomId: this.roomId,
      sdp,
      candidates: this.localCandidates,
      hostName: this.playerName,
      hostColorSlot: this.localColorSlot,
      hostColorHex: this.localColorHex,
      version: 2
    };

    const token = 'RL_OFFER_' + encodeSignalToken(payload);
    this.offerToken = token;
    console.log(`[P2PWebRTCChannel] 🚀 Host offer token created (${token.length} chars). Room: ${this.roomId}, Color: slot ${this.localColorSlot} (${this.localColorHex})`);

    // Auto-broadcast room offer for nearby tabs
    this.broadcastSignal('room_offer', {
      token,
      roomId: this.roomId,
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

    const offerData = decodeSignalToken(offerToken);
    if (!offerData || offerData.type !== 'offer') {
      throw new Error('Invalid offer token: expected offer payload');
    }

    this.roomId = offerData.roomId || null;
    this.peerName = offerData.hostName || 'Host';
    if (offerData.hostColorHex) {
      this.peerColorHex = offerData.hostColorHex;
      this.peerColorSlot = offerData.hostColorSlot;
    }

    // Attach to dedicated room channel and announce client join immediately
    if (this.roomId) {
      this._initRoomChannel(this.roomId);
      this._sendRoomMessage({
        type: 'cross_tab_join',
        clientName: this.playerName,
        clientColorSlot: this.localColorSlot,
        clientColorHex: this.localColorHex
      });
    }

    this.createPeerConnection();

    let sdp = '';
    if (this.pc) {
      this.pc.ondatachannel = (event) => {
        console.log('[P2PWebRTCChannel] Client accepted dataChannel from Host');
        this.dataChannel = event.channel;
        this.dataChannel.binaryType = 'arraybuffer';
        this._bindDataChannel(this.dataChannel);
      };

      if (offerData.sdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription({
          type: 'offer',
          sdp: offerData.sdp
        }));
        await this.flushPendingCandidates();

        if (Array.isArray(offerData.candidates)) {
          for (const cand of offerData.candidates) {
            await this.addRemoteCandidate(cand);
          }
        }
        if (this.pendingRemoteCandidates && this.pendingRemoteCandidates.length > 0) {
          for (const cand of this.pendingRemoteCandidates) {
            try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
          }
          this.pendingRemoteCandidates = [];
        }

        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        await this._waitForIceGathering(1200);
        sdp = this.pc.localDescription.sdp;
      }
    }

    const payload = {
      type: 'answer',
      roomId: this.roomId,
      sdp,
      candidates: this.localCandidates,
      clientName: this.playerName,
      clientColorSlot: this.localColorSlot,
      clientColorHex: this.localColorHex,
      version: 2
    };

    const token = 'RL_ANSWER_' + encodeSignalToken(payload);
    console.log(`[P2PWebRTCChannel] ⚡ Client answer token created (${token.length} chars). Candidates: ${this.localCandidates.length}`);
    this.broadcastSignal('room_answer', {
      token,
      roomId: this.roomId,
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
    if (this.pc && this.pc.signalingState === 'stable') {
      console.log("[P2PWebRTCChannel] Signaling state is already stable, answer description was already set.");
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
    if (answerData.roomId && !this.roomId) {
      this._initRoomChannel(answerData.roomId);
    }

    // Acknowledge cross-tab if room channel is attached
    this._sendRoomMessage({
      type: 'cross_tab_ack',
      hostName: this.playerName,
      hostColorSlot: this.localColorSlot,
      hostColorHex: this.localColorHex
    });

    if (!this.pc) {
      return;
    }

    if (this.pc.signalingState === 'stable') {
      console.log('[P2PWebRTCChannel] Signaling state is already stable, answer description was already set.');
      return;
    }

    console.log(`[P2PWebRTCChannel] 📥 Setting remote answer SDP from ${this.peerName}...`);
    if (answerData.sdp) {
      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerData.sdp
      }));
      console.log('[P2PWebRTCChannel] Remote answer SDP applied. Signaling state:', this.pc.signalingState);
      await this.flushPendingCandidates();

      if (Array.isArray(answerData.candidates)) {
        for (const cand of answerData.candidates) {
          await this.addRemoteCandidate(cand);
        }
      }
      if (this.pendingRemoteCandidates && this.pendingRemoteCandidates.length > 0) {
        for (const cand of this.pendingRemoteCandidates) {
          try { await this.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
        }
        this.pendingRemoteCandidates = [];
      }
    }
  }

  sendColorChange(slotId, hex, carIndex) {
    const payload = JSON.stringify({
      type: 'color_change',
      slotId,
      hex,
      carIndex
    });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(payload);
        console.log(`[P2PWebRTCChannel] 🎨 Sent color_change via DataChannel: slot ${slotId} (${hex}) for car ${carIndex}`);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Failed to send color change via DataChannel:', err);
      }
    }
    if (this.roomBroadcastChannel) {
      try {
        this.roomBroadcastChannel.postMessage({
          type: 'color_change',
          slotId,
          hex,
          carIndex
        });
        console.log(`[P2PWebRTCChannel] 🎨 Sent color_change via RoomChannel: slot ${slotId} (${hex}) for car ${carIndex}`);
      } catch (err) {
        console.warn('[P2PWebRTCChannel] Failed to send color change via RoomChannel:', err);
      }
    }
  }

  _bindDataChannel(channel) {
    channel.onopen = () => {
      console.log(`[P2PWebRTCChannel] DataChannel "${channel.label}" OPEN! Handshake complete.`);
      this.isWebRTC = true;
      this.isOpen = true;
      this.transportMode = 'webrtc';
      this.onConnected?.();
    };

    channel.onclose = () => {
      console.log(`[P2PWebRTCChannel] DataChannel "${channel.label}" CLOSED.`);
      if (this.isCrossTab) {
        console.log('[P2PWebRTCChannel] DataChannel closed but Cross-Tab transport is active. Maintaining connection.');
        return;
      }
      this.isOpen = false;
      this.onDisconnected?.();
    };

    channel.onerror = (err) => {
      console.error('[P2PWebRTCChannel] DataChannel error:', err);
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
          console.log(`[P2PWebRTCChannel] 🎨 Received remote color_change: car ${msg.carIndex} -> slot ${msg.slotId} (${msg.hex})`);
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
    const pongMsg = JSON.stringify({ type: 'pong', sendTime });
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(pongMsg);
    } else if (this.roomBroadcastChannel) {
      this.roomBroadcastChannel.postMessage({ type: 'pong', sendTime });
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
   * Sends client input packet over WebRTC or direct cross-tab channel
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

    let sent = false;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
        sent = true;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] DataChannel send input failed:', err);
      }
    }

    if (!sent && this.roomBroadcastChannel && this.isOpen) {
      try {
        this.roomBroadcastChannel.postMessage(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
        sent = true;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] RoomChannel send input failed:', err);
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
      } else if (this.roomBroadcastChannel && this.isOpen) {
        try {
          this.roomBroadcastChannel.postMessage({ type: 'ping', sendTime: nowMs });
        } catch (_) {}
      }
    }

    return sent;
  }

  /**
   * Sends authoritative server state packet over WebRTC or direct cross-tab channel
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

    let sent = false;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
        sent = true;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] DataChannel send state failed:', err);
      }
    }

    if (!sent && this.roomBroadcastChannel && this.isOpen) {
      try {
        this.roomBroadcastChannel.postMessage(buf);
        if (buf.byteLength) this.stats.bytesSent += buf.byteLength;
        sent = true;
      } catch (err) {
        console.warn('[P2PWebRTCChannel] RoomChannel send state failed:', err);
      }
    }

    return sent;
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
    try { this.roomBroadcastChannel?.close(); } catch (_) {}
    this.dataChannel = null;
    this.pc = null;
    this.broadcastChannel = null;
    this.roomBroadcastChannel = null;
    this.isOpen = false;
    this.isCrossTab = false;
    this.isWebRTC = false;
  }
}

export default P2PWebRTCChannel;
