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
// Decoupled from ServerSnapshotCodec - uses GlobalPayloadCodec & EstablishedSessionManager


/**
 * Extracts the port from an ICE candidate object or candidate string.
 * Supports standard RFC 5245 candidate line:
 * candidate:<foundation> <component> <transport> <priority> <address> <port> typ <type> ...
 * @param {object|string} cand
 * @returns {number|null}
 */
export function extractCandidatePort(cand) {
  if (!cand) return null;
  if (typeof cand === "object" && cand.port) {
    const p = parseInt(cand.port, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  const candStr = typeof cand === "string" ? cand : (cand?.candidate || "");
  if (typeof candStr === "string") {
    // 1. Try splitting by whitespace (port is at index 5)
    const parts = candStr.trim().split(/\s+/);
    if (parts.length >= 6) {
      const p = parseInt(parts[5], 10);
      if (!isNaN(p) && p > 0) return p;
    }
    // 2. Regex fallback: number preceding typ
    const match = candStr.match(/\s(\d{1,5})\styp\b/);
    if (match) {
      const p = parseInt(match[1], 10);
      if (!isNaN(p) && p > 0) return p;
    }
  }
  return null;
}

/**
 * Extracts the loopback port prioritizing candidate #1, then candidate #0.
 * In WebRTC environments, port1 is often the active data component port.
 * @param {Array} candidates
 * @param {string} [sdp]
 * @returns {number}
 */
export function getLoopbackPortFromCandidates(candidates, sdp = "") {
  let cand0 = null;
  let cand1 = null;

  if (Array.isArray(candidates) && candidates.length > 0) {
    cand0 = candidates[0];
    if (candidates.length > 1) {
      cand1 = candidates[1];
    }
  }

  // Fallback: extract candidate lines from SDP
  if (!cand0 && typeof sdp === "string") {
    const matches = [...sdp.matchAll(/a=(candidate:[^\r\n]+)/g)];
    if (matches.length > 0) cand0 = matches[0][1];
    if (matches.length > 1) cand1 = matches[1][1];
  }

  const port0 = cand0 ? extractCandidatePort(cand0) : null;
  const port1 = cand1 ? extractCandidatePort(cand1) : port0;

  return port1 || port0 || 50000;
}

/**
 * Creates a loopback (127.0.0.1) candidate using candidate #1 / #0 gathered port.
 * Assigns maximum host priority (2130706431) to guarantee local loopback is preferred.
 * @param {object|string} sourceCandidate
 * @param {number|null} customPort
 * @returns {object}
 */
export function createLoopbackCandidate(sourceCandidate, customPort = null) {
  const port = customPort || (sourceCandidate ? extractCandidatePort(sourceCandidate) : null) || 50000;
  const sdpMid = typeof sourceCandidate === "object" ? (sourceCandidate?.sdpMid ?? "0") : "0";
  const sdpMLineIndex = typeof sourceCandidate === "object" ? (sourceCandidate?.sdpMLineIndex ?? 0) : 0;

  const foundation = Math.floor(Math.random() * 100000) + 100000;
  const loopbackCandStr = `candidate:${foundation} 1 udp 2130706431 127.0.0.1 ${port} typ host generation 0`;

  return {
    candidate: loopbackCandStr,
    sdpMid: String(sdpMid),
    sdpMLineIndex: Number(sdpMLineIndex),
    address: "127.0.0.1",
    ip: "127.0.0.1",
    port: Number(port),
    type: "host"
  };
}

/**
 * Injects a 127.0.0.1 loopback candidate into the candidates array at index 0.
 * Prioritizing index 0 ensures the local ICE agent and remote peer process 127.0.0.1 before LAN/mDNS addresses.
 * @param {Array} candidates
 * @param {string} [sdp]
 * @returns {Array}
 */
export function injectLoopbackCandidate(candidates, sdp = "") {
  let list = Array.isArray(candidates) ? [...candidates] : [];
  
  // Filter out any stale loopback candidate so we can reinsert at index 0 with latest gathered port
  list = list.filter(c => {
    const s = typeof c === "string" ? c : (c?.candidate || c?.ip || c?.address || "");
    return !s.includes("127.0.0.1");
  });

  let sourceCand = list.length > 0 ? list[0] : null;
  if (!sourceCand && typeof sdp === "string") {
    const m = sdp.match(/a=(candidate:[^\r\n]+)/);
    if (m) {
      sourceCand = { candidate: m[1], sdpMid: "0", sdpMLineIndex: 0 };
    }
  }

  const port = getLoopbackPortFromCandidates(list, sdp);
  const loopback = createLoopbackCandidate(sourceCand, port);

  // Return with 127.0.0.1 strictly placed at index 0
  return [loopback, ...list];
}

/**
 * Injects the loopback candidate line into the SDP BEFORE existing candidate lines.
 * Placing 127.0.0.1 before existing a=candidate: lines ensures the WebRTC parser
 * processes the loopback candidate first and avoids connection timeout on local interfaces.
 * @param {string} sdp
 * @param {object|string} loopbackCand
 * @returns {string}
 */
/**
 * Ensures the SDP strictly conforms to RFC 4566 mandatory session header structure:
 * v=0
 * o=- <session-id> <session-version> IN IP4 <address>
 * s=-
 * t=0 0
 * WebRTC implementations (especially WebKit/Safari) throw "SyntaxError: Expect line: o="
 * if the o= line is missing or stripped.
 * @param {string} sdp
 * @returns {string}
 */
export function ensureValidSdp(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;

  const normalized = sdp.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  // 1. Ensure v= line
  if (!lines.some(l => l.startsWith("v="))) {
    lines.unshift("v=0");
  }

  // 2. Ensure o= line (RFC 4566 mandatory directly after v=)
  if (!lines.some(l => l.startsWith("o="))) {
    const vIdx = lines.findIndex(l => l.startsWith("v="));
    const sessionId = Math.floor(Math.random() * 1000000000) + 1000000000;
    const oLine = `o=- ${sessionId} 2 IN IP4 127.0.0.1`;
    if (vIdx !== -1) {
      lines.splice(vIdx + 1, 0, oLine);
    } else {
      lines.unshift(oLine);
    }
  }

  // 3. Ensure s= line
  if (!lines.some(l => l.startsWith("s="))) {
    const oIdx = lines.findIndex(l => l.startsWith("o="));
    if (oIdx !== -1) {
      lines.splice(oIdx + 1, 0, "s=-");
    } else {
      lines.push("s=-");
    }
  }

  // 4. Ensure t= line
  if (!lines.some(l => l.startsWith("t="))) {
    const sIdx = lines.findIndex(l => l.startsWith("s="));
    if (sIdx !== -1) {
      lines.splice(sIdx + 1, 0, "t=0 0");
    } else {
      lines.push("t=0 0");
    }
  }

  return lines.join("\r\n");
}

export function injectLoopbackIntoSdp(sdp, loopbackCand) {
  if (!sdp || typeof sdp !== "string") return sdp;

  let candStr = "";
  if (typeof loopbackCand === "string") {
    candStr = loopbackCand.startsWith("a=") ? loopbackCand.slice(2) : loopbackCand;
  } else if (loopbackCand && loopbackCand.candidate) {
    candStr = loopbackCand.candidate.startsWith("a=") ? loopbackCand.candidate.slice(2) : loopbackCand.candidate;
  }

  const validSdp = ensureValidSdp(sdp);
  if (!candStr) return validSdp;

  // CRITICAL: Only filter out candidate lines starting with "a=candidate:" that contain "127.0.0.1"!
  // NEVER filter out "o=" (origin) lines like "o=- ... IN IP4 127.0.0.1", which breaks RFC 4566
  // and causes WebKit/Safari to throw "SyntaxError: Expect line: o="!
  const cleanLines = validSdp.split("\r\n").filter(l => !(l.startsWith("a=candidate:") && l.includes("127.0.0.1")));
  const customLine = `a=${candStr.trim()}`;
  let inserted = false;
  const res = [];

  for (const l of cleanLines) {
    // Insert customLine BEFORE the very first a=candidate: line!
    if (!inserted && l.startsWith("a=candidate:")) {
      res.push(customLine);
      inserted = true;
    }
    res.push(l);
  }

  if (!inserted) {
    // If no candidate line exists yet, insert right after m= section
    const mIdx = res.findIndex(l => l.startsWith("m="));
    if (mIdx !== -1) {
      res.splice(mIdx + 1, 0, customLine);
    } else {
      res.push(customLine);
    }
  }

  return ensureValidSdp(res.join("\r\n"));
}

/**
 * Convenience helper matching minimal WebRTC test injectLoopback signature
 * @param {string} sdp
 * @param {Array} [candidates=[]]
 * @returns {string}
 */
export function injectLoopback(sdp, candidates = []) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const port = getLoopbackPortFromCandidates(candidates, sdp);
  const foundation = Math.floor(Math.random() * 100000);
  const customLine = `a=candidate:${foundation} 1 udp 2130706431 127.0.0.1 ${port} typ host generation 0`;
  return injectLoopbackIntoSdp(sdp, customLine);
}

/**
 * Base64 URL-safe pack / unpack compatible with both RL tokens and minimal test tokens
 */
export function packSdp(sdpObj, candidates = []) {
  const sdpStr = typeof sdpObj === "string" ? sdpObj : (sdpObj?.sdp || "");
  const type = (typeof sdpObj === "object" && sdpObj?.type) ? sdpObj.type : "offer";
  return btoa(encodeURIComponent(JSON.stringify({ type, sdp: injectLoopback(sdpStr, candidates) })));
}

export function unpackSdp(str) {
  if (!str) return null;
  return JSON.parse(decodeURIComponent(atob(str.trim())));
}

export const pack = packSdp;
export const unpack = unpackSdp;

export function encodeSignalToken(obj) {
  const json = JSON.stringify(obj);
  return btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export function decodeSignalToken(tokenStr) {
  if (!tokenStr) throw new Error("Token string is empty");
  const clean = tokenStr.trim().replace(/^RL_(OFFER|ANSWER)_/, "");
  try {
    const raw = atob(clean);
    try {
      const json = decodeURIComponent(
        raw.split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      return JSON.parse(json);
    } catch (_) {
      return JSON.parse(raw);
    }
  } catch (_) {
    // If passed directly as JSON
    return JSON.parse(tokenStr.trim());
  }
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
        if (typeof this.broadcastChannel.unref === 'function') this.broadcastChannel.unref();
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

  async addIceCandidate(candJson) {
    return this.addRemoteCandidate(candJson);
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
        let candJson = event.candidate.toJSON ? event.candidate.toJSON() : {
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        };
        this.localCandidates.push(candJson);

        if (candJson.candidate && candJson.candidate.includes('.local')) {
          const clonedCandStr = candJson.candidate.replace(/\S+\.local/, '127.0.0.1');
          const clonedCand = {
            ...candJson,
            candidate: clonedCandStr,
            address: '127.0.0.1',
            ip: '127.0.0.1'
          };
          this.localCandidates.push(clonedCand);
        }

        // Prioritize 127.0.0.1 at index 0 using candidate #1 / #0 gathered port
        this.localCandidates = injectLoopbackCandidate(this.localCandidates, this.pc?.localDescription?.sdp || "");
        const loopbackCand = this.localCandidates[0];
        if (loopbackCand && this.localCandidates.length === 2) {
          this.broadcastSignal("ice_candidate", { candidate: loopbackCand, roomId: this.roomId });
        }

        const typ = candJson.type || (candJson.candidate ? candJson.candidate.split(' ')[7] : 'unknown');
        console.log(`[P2PWebRTCChannel] 🧊 Candidate #${this.localCandidates.length} gathered (type: ${typ})`);
        this.broadcastSignal('ice_candidate', { candidate: candJson, roomId: this.roomId });
        if (typeof this.onIceCandidate === 'function') {
          try {
            this.onIceCandidate(candJson);
          } catch (_) {}
        }
      } else {
        this.localCandidates = injectLoopbackCandidate(this.localCandidates, this.pc?.localDescription?.sdp || "");
        console.log(`[P2PWebRTCChannel] 🧊 ICE candidate gathering complete (${this.localCandidates.length} total). Prioritized loopback candidate #0:`, this.localCandidates[0]?.candidate);
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

    this.localCandidates = injectLoopbackCandidate(this.localCandidates, sdp);
    const loopbackCand = (this.localCandidates || []).find(c => (c.candidate || '').includes('127.0.0.1'));
    if (loopbackCand && sdp) {
      sdp = injectLoopbackIntoSdp(sdp, loopbackCand);
    }
    sdp = ensureValidSdp(sdp);

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
  async createAnswerToken(offerToken, options = {}) {
    return this.acceptOfferAndCreateAnswer(offerToken, options);
  }

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
        let remoteSdp = ensureValidSdp(offerData.sdp);
        const remoteLoopback = Array.isArray(offerData.candidates)
          ? offerData.candidates.find(c => (c?.candidate || c?.address || c?.ip || "").includes("127.0.0.1"))
          : null;
        if (remoteLoopback) {
          remoteSdp = injectLoopbackIntoSdp(remoteSdp, remoteLoopback);
        }
        remoteSdp = ensureValidSdp(remoteSdp);

        await this.pc.setRemoteDescription(new RTCSessionDescription({
          type: "offer",
          sdp: remoteSdp
        }));
        await this.flushPendingCandidates();

        if (Array.isArray(offerData.candidates)) {
          const sortedCandidates = [...offerData.candidates].sort((a, b) => {
            const aIs127 = (a?.candidate || a?.address || a?.ip || "").includes("127.0.0.1");
            const bIs127 = (b?.candidate || b?.address || b?.ip || "").includes("127.0.0.1");
            if (aIs127 && !bIs127) return -1;
            if (!aIs127 && bIs127) return 1;
            return 0;
          });
          for (const cand of sortedCandidates) {
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

    this.localCandidates = injectLoopbackCandidate(this.localCandidates, sdp);
    const loopbackCand = (this.localCandidates || []).find(c => (c.candidate || '').includes('127.0.0.1'));
    if (loopbackCand && sdp) {
      sdp = injectLoopbackIntoSdp(sdp, loopbackCand);
    }
    sdp = ensureValidSdp(sdp);

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
      answerToken: token,
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
      let remoteSdp = ensureValidSdp(answerData.sdp);
      const remoteLoopback = Array.isArray(answerData.candidates)
        ? answerData.candidates.find(c => (c?.candidate || c?.address || c?.ip || "").includes("127.0.0.1"))
        : null;
      if (remoteLoopback) {
        remoteSdp = injectLoopbackIntoSdp(remoteSdp, remoteLoopback);
      }
      remoteSdp = ensureValidSdp(remoteSdp);

      await this.pc.setRemoteDescription(new RTCSessionDescription({
        type: "answer",
        sdp: remoteSdp
      }));
      console.log("[P2PWebRTCChannel] Remote answer SDP applied. Signaling state:", this.pc.signalingState);
      await this.flushPendingCandidates();

      if (Array.isArray(answerData.candidates)) {
        const sortedCandidates = [...answerData.candidates].sort((a, b) => {
          const aIs127 = (a?.candidate || a?.address || a?.ip || "").includes("127.0.0.1");
          const bIs127 = (b?.candidate || b?.address || b?.ip || "").includes("127.0.0.1");
          if (aIs127 && !bIs127) return -1;
          if (!aIs127 && bIs127) return 1;
          return 0;
        });
        for (const cand of sortedCandidates) {
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
    this.localColorSlot = slotId;
    this.localColorHex = hex;
    const payload = JSON.stringify({
      type: 'color_change',
      slotId,
      hex,
      carIndex
    });
    if (!this.isOpen && (!this.dataChannel || this.dataChannel.readyState !== 'open') && !this.roomBroadcastChannel) {
      this.pendingColorChange = { slotId, hex, carIndex };
    }
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

    let payload = data;
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      this.stats.bytesReceived += data.byteLength;
    }

    if (!payload) return;

    // Apply simulated inbound extra latency if configured
    const delay = this.extraLatencyMs > 0
      ? Math.max(0, this.extraLatencyMs + (Math.random() * 2 - 1) * this.jitterMs)
      : 0;
    const deliverAt = delay > 0 ? now + delay : 0;

    if (deliverAt === 0) {
      this.inboundQueue.push(payload);
      this.onPacketReceived?.(payload);
      this.onMessage?.(payload);
    } else {
      this.inboundQueue.push({ payload, deliverAt });
      setTimeout(() => {
        this.onPacketReceived?.(payload);
        this.onMessage?.(payload);
      }, delay);
    }
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

  setLatency(latencyMs) {
    this.setExtraLatency(latencyMs);
  }

  get latencyMs() {
    return Math.round(this.rttMs * 0.5);
  }

  setRtt(rttMs) {
    this.setExtraLatency(Math.round(rttMs * 0.5));
  }

  get rttMs() {
    if (this.measuredRttMs > 0) {
      return Math.round(this.measuredRttMs);
    }
    return Math.round(this.extraLatencyMs * 2);
  }

  set rttMs(val) {
    this.measuredRttMs = Math.max(0, Number(val) || 0);
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
  /**
   * Generic transmit method sending binary datagrams or string messages
   * across DataChannel or Cross-Tab RoomChannel.
   * Compatible with NetworkDataHandler.sendPacket().
   * @param {Uint8Array|ArrayBuffer|string} packet
   * @param {number} [nowMs=performance.now()]
   * @returns {boolean}
   */
  send(packet, nowMs = performance.now()) {
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

    const doTransmit = () => {
      let dispatched = false;
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(packet);
          if (packet.byteLength) this.stats.bytesSent += packet.byteLength;
          dispatched = true;
        } catch (err) {
          console.warn('[P2PWebRTCChannel] DataChannel send failed:', err);
        }
      }

      if (!dispatched && this.roomBroadcastChannel && this.isOpen) {
        try {
          this.roomBroadcastChannel.postMessage(packet);
          if (packet.byteLength) this.stats.bytesSent += packet.byteLength;
          dispatched = true;
        } catch (err) {
          console.warn('[P2PWebRTCChannel] RoomChannel send failed:', err);
        }
      }
      return dispatched;
    };

    if (this.extraLatencyMs > 0) {
      const delay = Math.max(0, this.extraLatencyMs + (Math.random() * 2 - 1) * this.jitterMs);
      setTimeout(doTransmit, delay);
      return true;
    }
    return doTransmit();
  }

  /**
   * Sends client input packet over WebRTC or cross-tab channel
   * @param {object|Uint8Array|string} packet
   * @param {number} [nowMs=performance.now()]
   */
  sendClientInput(packet, nowMs = performance.now()) {
    let buf = packet;
    if (!(packet instanceof Uint8Array) && !(packet instanceof ArrayBuffer) && typeof packet !== 'string') {
      if (packet.history) {
        buf = InputPacketCodec.encode(packet.carIndex ?? 0, packet.targetTick ?? packet.tick, packet.history);
      } else if (packet.controls) {
        buf = InputPacketCodec.encode(packet.carIndex ?? 0, packet.tick, [
          { tick: packet.tick, controls: packet.controls }
        ]);
      }
    }

    const sent = this.send(buf, nowMs);

    // Heartbeat ping check
    if (nowMs - this.lastPingSentTime > this.pingIntervalMs) {
      this.lastPingSentTime = nowMs;
      this.stats.pingsSent++;
      this.send(JSON.stringify({ type: 'ping', sendTime: nowMs, rtt: Math.round(this.rttMs) }), nowMs);
    }

    return sent;
  }

  /**
   * Sends authoritative server state packet over WebRTC or direct cross-tab channel
   * @param {object|Uint8Array|string} packet
   * @param {number} [nowMs=performance.now()]
   */
  sendServerState(packet, nowMs = performance.now()) {
    return this.send(packet, nowMs);
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
