/**
 * src/network/EstablishedSessionManager.js
 * Established Peer Session Registry and Tailored Packet Assembly.
 * 
 * Features:
 * 1. Strict Encapsulation:
 *    - Tracks latestClientTimestamp per session: public read-only (e.g. for All-User RTT),
 *      writable solely within EstablishedSessionManager on packet ingestion.
 * 2. Physics Manager Coupling for Input Buffer:
 *    - Dynamically queries physicsEngineManager.getInputBufferSize(entityId) per tick.
 * 3. Decoupled Per-Client Header Framing:
 *    - Prepends a fixed 17-byte header:
 *      [0..7]   clientTimestamp (Float64 BE, echoed back for RTT calculation)
 *      [8..15]  serverTimestamp (Float64 BE, current server time)
 *      [16]     inputBufferSize (Uint8, 0..10)
 *    - Concatenates the shared GlobalPayload directly after byte 16.
 */

export const CLIENT_HEADER_SIZE = 17; // 8 + 8 + 1 bytes

export class PeerSession {
  /**
   * @param {string} sessionId Unique peer identifier / channel id
   * @param {object} [options]
   * @param {string} [options.role='player'] 'player' | 'spectator'
   * @param {number} [options.entityId=-1] Car index 0..5 or -1 for spectator
   * @param {string} [options.playerName='Player']
   */
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.role = options.role || 'player';
    this.entityId = options.entityId ?? -1;
    this.playerName = options.playerName || 'Player';

    this._latestClientTimestamp = 0;
    this._latestServerReceiptTime = 0;

    this.rttMs = 0;
    this.jitterMs = 0;
    this.lastEchoedServerTimestamp = 0;
  }

  /**
   * Read-only getter for latest client timestamp (accessible by RTT observer)
   */
  get latestClientTimestamp() {
    return this._latestClientTimestamp;
  }

  /**
   * Read-only getter for local server arrival timestamp
   */
  get latestServerReceiptTime() {
    return this._latestServerReceiptTime;
  }

  /**
   * Package-private update method: strictly called only by EstablishedSessionManager
   * @internal
   */
  _recordClientPacket(clientTs, serverNowMs) {
    this._latestClientTimestamp = clientTs;
    this._latestServerReceiptTime = serverNowMs;
  }

  /**
   * Updates smoothed RTT from ping/pong heartbeat or echoed timestamp
   * @param {number} measuredRtt
   */
  updateRtt(measuredRtt) {
    if (this.rttMs === 0) {
      this.rttMs = measuredRtt;
    } else {
      // Exponential moving average (alpha = 0.2)
      this.rttMs = (this.rttMs * 0.8) + (measuredRtt * 0.2);
    }
  }
}

export class EstablishedSessionManager {
  /**
   * @param {import('./PhysicsEngineManager.js').PhysicsEngineManager} physicsManager
   * @param {() => number} [timeProvider=Date.now] Monotonic or high-res time source
   */
  constructor(physicsManager, timeProvider = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.physicsManager = physicsManager;
    this.getTime = timeProvider;

    this.sessions = new Map();

    this.entitySessionMap = new Map();
  }

  /**
   * Register an established peer session
   * @param {string} sessionId
   * @param {object} options
   * @param {string} [options.role='player']
   * @param {number} [options.entityId=-1]
   * @param {string} [options.playerName]
   * @returns {PeerSession}
   */
  registerSession(sessionId, options = {}) {
    const session = new PeerSession(sessionId, options);
    this.sessions.set(sessionId, session);

    if (session.entityId >= 0) {
      this.entitySessionMap.set(session.entityId, sessionId);
      if (typeof this.physicsManager?.registerCarEntity === "function") {
        this.physicsManager.registerCarEntity(session.entityId);
      }
    }
    return session;
  }

  /**
   * Remove an established session
   * @param {string} sessionId
   */
  unregisterSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.entityId >= 0) {
      this.entitySessionMap.delete(session.entityId);
      if (this.physicsManager) {
        this.physicsManager.unregisterCarEntity(session.entityId);
      }
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Get session by sessionId
   * @param {string} sessionId
   * @returns {PeerSession|null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session by entityId
   * @param {number} entityId
   * @returns {PeerSession|null}
   */
  getSessionByEntityId(entityId) {
    const sessionId = this.entitySessionMap.get(entityId);
    return sessionId ? (this.sessions.get(sessionId) || null) : null;
  }

  /**
   * Ingests a received packet from a client, updating its timestamp strictly
   * @param {string} sessionId
   * @param {number} clientTimestamp
   * @returns {boolean}
   */
  recordClientTimestamp(sessionId, clientTimestamp) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session._recordClientPacket(clientTimestamp, this.getTime());
    return true;
  }

  /**
   * Collects all active sessions for RTT telemetry calculation
   * @returns {Array<PeerSession>}
   */
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  /**
   * Serializes a tailored datagram for a specific session by prepending the 17-byte client header
   * to the pre-rendered shared GlobalPayload.
   * 
   * Header Layout:
   * [0..7]   clientTimestamp (Float64 BE) - Echo of user's latest timestamp
   * [8..15]  serverTimestamp (Float64 BE) - Current server timestamp
   * [16]     inputBufferSize (Uint8)      - Clamped queue size (0..10) from PhysicsEngineManager
   * [17..]   GlobalPayload Uint8Array
   * 
   * @param {string} sessionId
   * @param {Uint8Array} globalPayloadBytes
   * @returns {Uint8Array}
   */
  buildClientPacket(sessionId, globalPayloadBytes) {
    const session = this.sessions.get(sessionId);
    const clientTs = session ? session.latestClientTimestamp : 0;
    const serverTs = this.getTime();

    let bufferSize = 0;
    if (session && session.entityId >= 0 && this.physicsManager) {
      bufferSize = this.physicsManager.getInputBufferSize(session.entityId);
    }
    bufferSize = Math.max(0, Math.min(255, Math.round(bufferSize)));

    const payloadLen = globalPayloadBytes ? globalPayloadBytes.length : 0;
    const totalLen = CLIENT_HEADER_SIZE + payloadLen;

    const buffer = new ArrayBuffer(totalLen);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // [0..7] client timestamp
    view.setFloat64(0, clientTs, false);
    // [8..15] server timestamp
    view.setFloat64(8, serverTs, false);
    // [16] input buffer size
    view.setUint8(16, bufferSize);

    // [17..] Append GlobalPayload directly
    if (payloadLen > 0) {
      uint8.set(globalPayloadBytes, CLIENT_HEADER_SIZE);
    }

    return uint8;
  }

  /**
   * Deserializes the 17-byte client header and slices the remaining GlobalPayload
   * @param {Uint8Array|ArrayBuffer} rawPacket
   * @returns {{ clientTimestamp: number, serverTimestamp: number, inputBufferSize: number, globalPayloadSlice: Uint8Array }|null}
   */
  static parseClientPacket(rawPacket) {
    if (!rawPacket) return null;
    const bytes = rawPacket instanceof Uint8Array ? rawPacket : new Uint8Array(rawPacket);
    if (bytes.length < CLIENT_HEADER_SIZE) return null;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const clientTimestamp = view.getFloat64(0, false);
    const serverTimestamp = view.getFloat64(8, false);
    const inputBufferSize = view.getUint8(16);
    const globalPayloadSlice = bytes.subarray(CLIENT_HEADER_SIZE);

    return {
      clientTimestamp,
      serverTimestamp,
      inputBufferSize,
      globalPayloadSlice
    };
  }

  destroy() {
    this.sessions.clear();
    this.entitySessionMap.clear();
    this.physicsManager = null;
  }
}
