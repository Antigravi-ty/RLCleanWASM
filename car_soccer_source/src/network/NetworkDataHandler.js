/**
 * src/network/NetworkDataHandler.js
 * Ingress & Egress Network Gateway and Decoupled Packet Dispatcher.
 * 
 * Architectural Highlights:
 * 1. Front-Door Gateway:
 *    All unknown incoming packets enter here first before evaluation.
 *    Decouples raw transport protocols (WebRTC DataChannel, WebSocket, BroadcastChannel)
 *    from domain logic in MatchSessionAdmin.
 * 2. Unknown Packet Ingestion:
 *    Routes unauthenticated / unassigned packets to the match manager
 *    for evaluation (player ID, password, room authorization).
 * 3. High-Speed Fast-Path Routing:
 *    Known established session packets bypass high-level management overhead
 *    and feed directly into EstablishedSessionManager and PhysicsEngineManager.
 * 4. Extensible Egress Abstraction:
 *    Allows sending tailored client datagrams or broadcasting global payloads
 *    without coupling server logic to specific network sockets.
 */

import { InputPacketCodec, MAGIC_BYTE } from './InputPacketCodec.js';

export const PACKET_TYPES = Object.freeze({
  UNKNOWN: 'unknown',
  CLIENT_INPUT: 'client_input',
  HANDSHAKE_REQUEST: 'handshake_request',
  HANDSHAKE_RESPONSE: 'handshake_response',
  COLOR_CHANGE: 'color_change',
  HEARTBEAT_PING: 'heartbeat_ping',
  HEARTBEAT_PONG: 'heartbeat_pong'
});

export class NetworkDataHandler {
  /**
   * @param {object} options
   * @param {import('./MatchSessionAdmin.js').MatchSessionAdmin} options.matchManager
   * @param {import('./EstablishedSessionManager.js').EstablishedSessionManager} options.sessionManager
   * @param {import('./PhysicsEngineManager.js').PhysicsEngineManager} options.physicsManager
   */
  constructor(options = {}) {
    this.matchManager = options.matchManager;
    this.sessionManager = options.sessionManager;
    this.physicsManager = options.physicsManager;

    this.channels = new Map();

    this.interceptors = [];
  }

  /**
   * Register a network transport channel (e.g. WebRTC DataChannel, WebSocket, BroadcastChannel)
   * @param {string} channelId
   * @param {object} channel
   */
  registerChannel(channelId, channel) {
    this.channels.set(channelId, channel);
  }

  /**
   * Unregister a channel
   * @param {string} channelId
   */
  unregisterChannel(channelId) {
    this.channels.delete(channelId);
  }

  /**
   * Primary entry point for all incoming network data packets.
   * Classifies the packet, records arrival timestamp, and dispatches to appropriate handler.
   * 
   * @param {string} channelId
   * @param {Uint8Array|ArrayBuffer|string} rawData
   * @param {number} [arrivalTimestamp]
   */
  handleIncomingPacket(channelId, rawData, arrivalTimestamp = Date.now()) {
    for (let i = 0; i < this.interceptors.length; i++) {
      if (this.interceptors[i](channelId, rawData, arrivalTimestamp) === false) {
        return; // Interceptor dropped packet
      }
    }

    const packetType = this.classifyPacket(rawData);

    if (packetType === PACKET_TYPES.CLIENT_INPUT) {
      this.handleClientInputPacket(channelId, rawData, arrivalTimestamp);
      return;
    }

    this.handleUnknownOrControlPacket(channelId, packetType, rawData);
  }

  /**
   * Classifies the incoming raw packet
   * @param {any} rawData
   * @returns {string}
   */
  classifyPacket(rawData) {
    if (!rawData) return PACKET_TYPES.UNKNOWN;

    if (rawData instanceof Uint8Array || rawData instanceof ArrayBuffer) {
      const u8 = rawData instanceof Uint8Array ? rawData : new Uint8Array(rawData);
      if (u8.length >= 7 && u8[0] === MAGIC_BYTE) {
        return PACKET_TYPES.CLIENT_INPUT;
      }
    }

    if (typeof rawData === 'string') {
      try {
        const obj = JSON.parse(rawData);
        if (obj.type === 'join' || obj.type === 'join_training' || obj.type === 'token' || obj.type === 'handshake_request') return PACKET_TYPES.HANDSHAKE_REQUEST;
        if (obj.type === 'handshake_response' || obj.type === 'handshake_accept') return PACKET_TYPES.HANDSHAKE_RESPONSE;
        if (obj.type === 'color_change') return PACKET_TYPES.COLOR_CHANGE;
        if (obj.type === 'ping') return PACKET_TYPES.HEARTBEAT_PING;
        if (obj.type === 'pong') return PACKET_TYPES.HEARTBEAT_PONG;
      } catch (_) {}
    }

    return PACKET_TYPES.UNKNOWN;
  }

  /**
   * Handles binary client input packet:
   * - Records client timestamp into EstablishedSessionManager
   * - Unpacks inputs and buffers into PhysicsEngineManager
   */
  handleClientInputPacket(channelId, rawData, arrivalTimestamp) {
    const session = this.sessionManager?.getSession(channelId);
    if (!session) {
      this.handleUnknownOrControlPacket(channelId, PACKET_TYPES.UNKNOWN, rawData);
      return;
    }

    let decoded = null;
    try {
      decoded = InputPacketCodec.decode(rawData);
    } catch (err) {
      console.warn(`[NetworkDataHandler] Failed to decode input packet from ${channelId}:`, err);
    }

    const clientTs = (decoded && typeof decoded.clientTimestamp === 'number' && decoded.clientTimestamp > 0)
      ? decoded.clientTimestamp
      : arrivalTimestamp;
    this.sessionManager.recordClientTimestamp(channelId, clientTs);

    if (session.role === 'spectator') {
      return;
    }

    if (decoded && (decoded.history || decoded.inputs) && this.physicsManager) {
      const targetEntityId = (session.entityId >= 0) ? session.entityId : (decoded.carIndex ?? 0);
      this.physicsManager.pushRedundantInputs(targetEntityId, decoded.history || decoded.inputs);
    }
  }

  /**
   * Passes unknown or control packets to MatchSessionAdmin for evaluation
   */
  handleUnknownOrControlPacket(channelId, packetType, rawData) {
    if (!this.matchManager) {
      console.warn(`[NetworkDataHandler] No match manager configured to handle packet from ${channelId}`);
      return;
    }

    let parsed = rawData;
    if (typeof rawData === 'string') {
      try { parsed = JSON.parse(rawData); } catch (_) {}
    }

    if (typeof this.matchManager.evaluateUnknownPacket === 'function') {
      this.matchManager.evaluateUnknownPacket(channelId, packetType, parsed);
    }
  }

  /**
   * Transmits a packet to a specific channel
   * @param {string} channelId
   * @param {Uint8Array|string} packetData
   * @returns {boolean}
   */
  sendPacket(channelId, packetData) {
    const channel = this.channels.get(channelId);
    if (!channel) return false;

    if (typeof channel.send === 'function') {
      channel.send(packetData);
      return true;
    }
    if (typeof channel.postMessage === 'function') {
      channel.postMessage(packetData);
      return true;
    }
    return false;
  }

  /**
   * Broadcasts packet data across all or filtered channels
   * @param {Uint8Array|string} packetData
   * @param {(channelId: string, channel: object) => boolean} [filterFn]
   */
  broadcast(packetData, filterFn = null) {
    for (const [chId, channel] of this.channels.entries()) {
      if (!filterFn || filterFn(chId, channel)) {
        this.sendPacket(chId, packetData);
      }
    }
  }

  /**
   * Dispatches the tailored frame packet to each active established session
   * @param {Uint8Array} globalPayloadBytes Pre-rendered shared GlobalPayload
   */
  dispatchFrameToSessions(globalPayloadBytes) {
    if (!this.sessionManager) return;
    const sessions = this.sessionManager.getAllSessions();

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const packet = this.sessionManager.buildClientPacket(s.sessionId, globalPayloadBytes);
      this.sendPacket(s.sessionId, packet);
    }
  }

  destroy() {
    this.channels.clear();
    this.interceptors = [];
    this.matchManager = null;
    this.sessionManager = null;
    this.physicsManager = null;
  }
}
