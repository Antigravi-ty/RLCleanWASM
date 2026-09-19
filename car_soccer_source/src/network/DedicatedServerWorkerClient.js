/**
 * src/network/DedicatedServerWorkerClient.js
 * Client-side Controller and Proxy for Dedicated Web Worker AuthoritativeServer.
 * 
 * Guarantees zero simulation slowdown/stalling when the host player tab loses focus:
 * - Spawns and manages AuthoritativeServerWorker in a dedicated OS thread.
 * - Bridges main-thread client channels (WebRTCNetworkChannel / NetworkChannel).
 * - Forwards incoming client packets and delivers authoritative state snapshots.
 * - Provides synchronous/reactive proxy methods matching AuthoritativeServer & RocketSimPhysicsEngine.
 * - Gracefully falls back to in-memory AuthoritativeServer in Node.js headless environments.
 */

import { AuthoritativeServer } from './AuthoritativeServer.js';

export class DedicatedServerWorkerClient {
  /**
   * @param {import('./NetworkChannel.js').NetworkChannel|import('./WebRTCChannel.js').WebRTCChannel} [channel=null]
   * @param {object} [options={}]
   */
  constructor(channel = null, options = {}) {
    this.options = { snapshotInterval: 1, ...options };
    this.channels = [];
    this.channelMap = new Map(); // channel -> channelId
    this.nextChannelId = 0;

    this.isWorker = typeof Worker !== 'undefined' && !options.forceFallback;
    this.worker = null;
    this.fallbackServer = null;
    this.active = false;

    this.cachedSnapshot = new Float32Array(4201);
    this.lastServerTick = 0;
    this.lastGoal = 0;

    this.pendingRequests = new Map();
    this.reqId = 0;

    // Direct proxy sim object matching RocketSimPhysicsEngine API for GameRuntime & HeadlessClient
    this.sim = {
      isUnlimitedBoost: false,
      numCars: 1,
      setUnlimitedBoost: (enabled) => {
        this.sim.isUnlimitedBoost = !!enabled;
        if (this.isWorker) {
          this._postCommand('setUnlimitedBoost', { enabled });
        } else if (this.fallbackServer?.sim) {
          this.fallbackServer.sim.setUnlimitedBoost(enabled);
        }
      },
      restoreState: (state) => {
        if (state) {
          if (state instanceof Float32Array) {
            this.cachedSnapshot.set(state);
          } else {
            this.cachedSnapshot.set(new Float32Array(state));
          }
        }
        if (this.isWorker) {
          return this._sendRequest('restoreState', {
            state: state instanceof Float32Array ? Array.from(state) : state
          }).then((res) => {
            if (res.snapshot) this.cachedSnapshot.set(res.snapshot);
            if (res.tickCount !== undefined) this.lastServerTick = res.tickCount;
            return this.cachedSnapshot;
          });
        } else if (this.fallbackServer?.sim) {
          return this.fallbackServer.sim.restoreState(state);
        }
      },
      saveState: (targetBuf) => {
        if (!this.isWorker && this.fallbackServer?.sim) {
          return this.fallbackServer.sim.saveState(targetBuf);
        }
        if (targetBuf) {
          targetBuf.set(this.cachedSnapshot);
          return targetBuf;
        }
        return new Float32Array(this.cachedSnapshot);
      },
      getHeaderView: () => {
        if (!this.isWorker && this.fallbackServer?.sim) {
          return this.fallbackServer.sim.getHeaderView();
        }
        return { tickCount: this.lastServerTick };
      },
      resetKickoff: (seed) => {
        if (this.isWorker) {
          this._postCommand('resetKickoff', { seed });
        } else if (this.fallbackServer?.sim) {
          this.fallbackServer.sim.resetKickoff(seed);
        }
      },
      pollGoal: () => {
        if (!this.isWorker && this.fallbackServer?.sim) {
          return this.fallbackServer.sim.pollGoal();
        }
        const g = this.lastGoal;
        this.lastGoal = 0;
        return g;
      },
      getStateSnapshotSize: () => {
        if (!this.isWorker && this.fallbackServer?.sim) {
          return this.fallbackServer.sim.getStateSnapshotSize();
        }
        return this.cachedSnapshot.length || 4201;
      }
    };

    this.clientInputBuffer = {
      clear: () => {
        if (this.isWorker) this._postCommand('clearInputBuffer', {});
        else this.fallbackServer?.clientInputBuffer?.clear();
      }
    };

    this.lastReceivedControls = {
      clear: () => {
        if (this.isWorker) this._postCommand('clearReceivedControls', {});
        else this.fallbackServer?.lastReceivedControls?.clear();
      }
    };

    if (channel) {
      this.addClientChannel(channel);
    }
  }

  get channel() {
    return this.channels[0] || null;
  }

  set channel(ch) {
    if (ch && !this.channels.includes(ch)) {
      this.addClientChannel(ch);
    }
  }

  _bindChannel(channel, channelId) {
    if (!channel || channel.__boundWorkerClient === this) return;
    channel.__boundWorkerClient = this;

    const origSend = channel.sendClientInput.bind(channel);
    channel.sendClientInput = (packet, nowMs = performance.now()) => {
      const sent = origSend(packet, nowMs);
      if (sent && this.isWorker && this.worker) {
        this._postCommand('clientInput', { channelId, packet });
      }
      return sent;
    };

    const prevOnPacket = channel.onPacketReceived;
    channel.onPacketReceived = (packet) => {
      prevOnPacket?.(packet);
      if (this.isWorker && this.worker && packet) {
        this._postCommand('clientInput', { channelId, packet });
      }
    };
  }

  addClientChannel(channel) {
    if (channel && !this.channels.includes(channel)) {
      const channelId = this.nextChannelId++;
      this.channels.push(channel);
      this.channelMap.set(channel, channelId);

      this._bindChannel(channel, channelId);
      if (this.isWorker) {
        if (this.worker) {
          this._postCommand('registerChannel', { channelId });
        }
      } else if (this.fallbackServer) {
        this.fallbackServer.addClientChannel(channel);
      }
    }
  }

  removeClientChannel(channel) {
    const idx = this.channels.indexOf(channel);
    if (idx !== -1) {
      const channelId = this.channelMap.get(channel);
      this.channels.splice(idx, 1);
      this.channelMap.delete(channel);
      if (this.isWorker && this.worker) {
        this._postCommand('removeChannel', { channelId });
      } else if (this.fallbackServer) {
        this.fallbackServer.removeClientChannel(channel);
      }
    }
  }

  async init(config = {}) {
    if (this.isWorker) {
      try {
        this.worker = new Worker(
          new URL('./AuthoritativeServerWorker.js', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e) => this._handleWorkerMessage(e);
        this.worker.onerror = (err) => {
          console.error('[DedicatedServerWorkerClient] Worker error:', err);
        };

        const res = await this._sendRequest('init', {
          options: this.options,
          config
        });

        if (res.snapshot) {
          this.cachedSnapshot = new Float32Array(res.snapshot);
        }
        if (res.tickCount !== undefined) {
          this.lastServerTick = res.tickCount;
        }

        // Register any already-added channels with worker
        for (const [ch, id] of this.channelMap.entries()) {
          this._bindChannel(ch, id);
          this._postCommand('registerChannel', { channelId: id });
        }

        this.active = true;
        return this;
      } catch (workerErr) {
        console.warn('[DedicatedServerWorkerClient] Failed to spawn Worker, falling back to in-memory server:', workerErr);
        this.isWorker = false;
      }
    }

    // Fallback mode (Node.js tests or unsupported browsers)
    this.fallbackServer = new AuthoritativeServer(null, this.options);
    for (const ch of this.channels) {
      this.fallbackServer.addClientChannel(ch);
    }
    await this.fallbackServer.init(config);
    this.active = true;
    return this;
  }

  _postCommand(type, payload = {}) {
    if (!this.worker) return;
    this.worker.postMessage({ type, ...payload });
  }

  _sendRequest(type, payload = {}) {
    if (!this.worker) return Promise.reject(new Error('Worker not initialized'));
    const reqId = ++this.reqId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject });
      this.worker.postMessage({ type, reqId, ...payload });
    });
  }

  _handleWorkerMessage(event) {
    const data = event.data;
    if (!data) return;

    if (data.reqId && this.pendingRequests.has(data.reqId)) {
      const { resolve, reject } = this.pendingRequests.get(data.reqId);
      this.pendingRequests.delete(data.reqId);
      if (data.type === 'error') {
        reject(new Error(data.error));
      } else {
        resolve(data);
      }
      return;
    }

    if (data.type === 'serverState') {
      const { channelId, packet } = data;
      if (packet) {
        if (packet.stateSnapshot) {
          this.cachedSnapshot.set(packet.stateSnapshot);
        }
        if (packet.serverTick !== undefined) {
          this.lastServerTick = packet.serverTick;
        }

        const nowMs = performance.now();
        // Dispatch snapshot to target channel or all channels
        for (const ch of this.channels) {
          const chId = this.channelMap.get(ch);
          if (channelId === undefined || chId === channelId) {
            ch.sendServerState(packet, nowMs);
          }
        }
      }
    }
  }

  notifyPlayerJoined(carIndex, name = 'Player', role = 'player') {
    if (this.isWorker) {
      this.sim.numCars = Math.max(this.sim.numCars, carIndex + 1);
      this._postCommand('playerJoined', { carIndex, name, role });
    } else if (this.fallbackServer) {
      console.log("[AuthoritativeServer] Player joined: carIndex=" + carIndex + ", name=\"" + name + "\", role=\"" + role + "\"");
      this.fallbackServer.ensureCar(carIndex, carIndex === 0 ? 0 : 1);
    }
  }

  notifyPlayerLeft(carIndex, name = 'Player') {
    if (this.isWorker) {
      this._postCommand('playerLeft', { carIndex, name });
    } else if (this.fallbackServer) {
      console.log("[AuthoritativeServer] Player left: carIndex=" + carIndex + ", name=\"" + name + "\"");
    }
  }

  setSnapshotInterval(interval) {
    const val = Math.max(1, interval);
    if (this.isWorker) {
      this._postCommand('setSnapshotInterval', { interval: val });
    } else if (this.fallbackServer) {
      this.fallbackServer.snapshotInterval = val;
    }
  }

  ensureCar(carIndex, team = 1) {
    if (this.isWorker) {
      this.sim.numCars = Math.max(this.sim.numCars, carIndex + 1);
      this._postCommand('ensureCar', { carIndex, team });
    } else if (this.fallbackServer) {
      this.fallbackServer.ensureCar(carIndex, team);
    }
  }

  /**
   * Pacing update: When running in dedicated worker, physics stepping is autonomous.
   * Update is a non-blocking no-op in worker mode (immune to tab focus loss).
   * @param {number} [nowMs=performance.now()]
   */
  update(nowMs = performance.now()) {
    if (!this.active) return;
    if (this.isWorker && this.worker) {
      for (const [ch, channelId] of this.channelMap.entries()) {
        if (typeof ch.receiveServerPackets === 'function') {
          const packets = ch.receiveServerPackets(nowMs);
          if (Array.isArray(packets)) {
            for (const packet of packets) {
              this._postCommand('clientInput', { channelId, packet });
            }
          }
        }
      }
    } else if (this.fallbackServer) {
      this.fallbackServer.update(nowMs);
    }
  }

  destroy() {
    this.active = false;
    if (this.isWorker && this.worker) {
      this._postCommand('destroy', {});
      try { this.worker?.terminate?.(); } catch (_) {}
      this.worker = null;
    } else if (this.fallbackServer) {
      this.fallbackServer.destroy();
      this.fallbackServer = null;
    }
    this.channels = [];
    this.channelMap.clear();
    this.pendingRequests.clear();
  }
}

export default DedicatedServerWorkerClient;
