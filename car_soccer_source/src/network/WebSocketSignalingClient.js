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
   * Connect to the Cloudflare Worker signaling endpoint using standard Happy Eyeballs.
   * Starts primary connection immediately; if uncompleted after 1500ms or on error, launches a backup attempt.
   * Cleans up connecting sockets gracefully without triggering browser console errors.
   * @param {number} [timeoutMs=8000] Connection timeout in milliseconds
   * @returns {Promise<void>}
   */
  async connect(timeoutMs = 8000) {
    if (this.isConnected && this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
      return;
    }

    const WebSocketConstructor = typeof WebSocket !== 'undefined'
      ? WebSocket
      : (globalThis.WebSocket || null);

    if (!WebSocketConstructor) {
      throw new Error('WebSocket is not supported in this environment');
    }

    const wsUrl = this.connectUrl;
    console.log(`[WebSocketSignalingClient] 🔌 Opening WebSocket connection: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const attempts = [];
      let backupTimer = null;
      let globalTimer = null;

      const safeCloseConnecting = (sock) => {
        try {
          if (sock.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.CONNECTING : 0)) {
            // Wait for handshake to complete before closing to eliminate browser error:
            // "WebSocket is closed before the connection is established"
            sock.onopen = () => {
              try { sock.close(1000, 'Superseded'); } catch (err) {
                console.warn('[WebSocketSignalingClient] Error closing superseded socket on open:', err);
              }
            };
            sock.onerror = null;
            sock.onclose = null;
            sock.onmessage = null;
          } else if (sock.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
            sock.close(1000, 'Superseded');
          }
        } catch (err) {
          console.warn('[WebSocketSignalingClient] Error during safeCloseConnecting:', err);
        }
      };

      const cleanupExcept = (winner = null) => {
        if (backupTimer) {
          clearTimeout(backupTimer);
          backupTimer = null;
        }
        if (globalTimer) {
          clearTimeout(globalTimer);
          globalTimer = null;
        }
        for (const sock of attempts) {
          if (sock !== winner) {
            safeCloseConnecting(sock);
          }
        }
        attempts.length = 0;
      };

      const settleSuccess = (winnerWs) => {
        if (isSettled) return;
        isSettled = true;
        cleanupExcept(winnerWs);
        this.ws = winnerWs;
        this.isConnected = true;
        console.log(`[WebSocketSignalingClient] 🌐 WebSocket open: room=${this.roomId}, role=${this.role}, peerId=${this.peerId}`);
        this._bindSocketEvents(winnerWs);
        this._startHeartbeat();
        this.emit('open');
        resolve();
      };

      const settleFailure = (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanupExcept(null);
        this.isConnected = false;
        console.warn('[WebSocketSignalingClient] ⚠️ WebSocket connection failed:', err?.message || err);
        this.emit('error', err);
        reject(err);
      };

      if (timeoutMs > 0) {
        globalTimer = setTimeout(() => {
          settleFailure(new Error(`WebSocket connect timed out after ${timeoutMs}ms: ${wsUrl}`));
        }, timeoutMs);
      }

      let attemptCount = 0;
      const launchAttempt = () => {
        if (isSettled || attemptCount >= 2) return;
        attemptCount++;

        let sock;
        try {
          sock = new WebSocketConstructor(wsUrl);
          attempts.push(sock);
        } catch (e) {
          console.warn('[WebSocketSignalingClient] WebSocket constructor error during attempt:', e);
          if (attemptCount >= 2) settleFailure(e);
          return;
        }

        sock.onopen = () => {
          settleSuccess(sock);
        };

        sock.onerror = (err) => {
          if (isSettled) return;
          if (attemptCount < 2) {
            launchAttempt();
          } else if (attempts.every(s => s.readyState >= 2)) {
            settleFailure(err instanceof Error ? err : new Error('WebSocket connection error'));
          }
        };

        sock.onclose = (ev) => {
          if (isSettled) return;
          if (attemptCount < 2) {
            launchAttempt();
          } else if (attempts.every(s => s.readyState >= 2)) {
            settleFailure(new Error(`WebSocket closed before open (code: ${ev.code})`));
          }
        };
      };

      launchAttempt();
      // If primary attempt hasn't connected within 2500ms, launch backup attempt
      backupTimer = setTimeout(() => {
        if (!isSettled && attemptCount < 2) {
          console.log('[WebSocketSignalingClient] 🔄 Primary attempt in progress, initiating backup attempt...');
          launchAttempt();
        }
      }, 2500);
    });
  }

  _bindSocketEvents(ws) {
    ws.onmessage = ev => {
      try {
        const data = JSON.parse(ev.data);
        this.handleMessage(data);
      } catch (err) {
        console.error('[WebSocketSignalingClient] Failed to parse message:', err);
      }
    };

    ws.onerror = err => {
      console.warn('[WebSocketSignalingClient] ⚠️ WebSocket runtime error:', err);
      this.emit('error', err);
    };

    ws.onclose = ev => {
      console.log(`[WebSocketSignalingClient] 🔌 WebSocket closed: code=${ev.code}, reason=${ev.reason}`);
      this.isConnected = false;
      this._stopHeartbeat();
      this.emit('close', ev);
    };
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1)) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping', peerId: this.peerId, timestamp: Date.now() }));
        } catch (err) {
          console.warn('[WebSocketSignalingClient] Heartbeat ping send failed:', err);
        }
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
      try { this.ws.close(); } catch (err) {
        console.warn('[WebSocketSignalingClient] Error closing WebSocket on disconnect:', err);
      }
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Diagnostic helper to test signaling server WebSocket handshake and round-trip latency.
   * Eliminates unhandled console errors during probe.
   * @param {string} endpointUrl
   * @param {number} [timeoutMs=5000]
   * @returns {Promise<{ ok: boolean, rttMs: number, error: string | null }>}
   */
  static async testConnectivity(endpointUrl, timeoutMs = 5000) {
    const wsUrl = endpointUrl || 'wss://unstable.test.breadguy.link/ws';
    const separator = wsUrl.includes('?') ? '&' : '?';
    const testUrl = `${wsUrl}${separator}ping_test=1&t=${Date.now()}`;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return new Promise((resolve) => {
      let resolved = false;
      let timer = null;
      let sock = null;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        if (sock) {
          try {
            if (sock.readyState === 0) {
              sock.onopen = () => { try { sock.close(1000, 'Diagnostic probe finished'); } catch (err) { console.warn('[WebSocketSignalingClient] Diagnostic probe close error on open:', err); } };
              sock.onerror = null;
              sock.onclose = null;
            } else if (sock.readyState === 1) {
              sock.close(1000, 'Diagnostic probe finished');
            }
          } catch (err) {
            console.warn('[WebSocketSignalingClient] Diagnostic probe close error:', err);
          }
        }
        resolve(result);
      };

      timer = setTimeout(() => {
        finish({
          ok: false,
          rttMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
          error: `Connection timed out after ${timeoutMs}ms (server unreachable or cold start)`,
        });
      }, timeoutMs);

      try {
        const WebSocketConstructor = typeof WebSocket !== 'undefined' ? WebSocket : null;
        if (!WebSocketConstructor) {
          return finish({ ok: false, rttMs: 0, error: 'WebSocket is not supported in this environment' });
        }
        sock = new WebSocketConstructor(testUrl);
        sock.onopen = () => {
          const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
          finish({ ok: true, rttMs, error: null });
        };
        sock.onerror = () => {
          const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
          finish({ ok: false, rttMs, error: 'WebSocket connection failed (network unreachable or TLS error)' });
        };
        sock.onclose = (ev) => {
          if (!resolved) {
            const rttMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
            finish({ ok: false, rttMs, error: `Connection closed immediately by server (code ${ev.code})` });
          }
        };
      } catch (err) {
        console.warn('[WebSocketSignalingClient] testConnectivity unexpected failure:', err);
        finish({ ok: false, rttMs: 0, error: err?.message || String(err) });
      }
    });
  }
}
