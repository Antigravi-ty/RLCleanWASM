/**
 * src/network/HostServerWorker.js
 * Client-Side Controller & Proxy for the Authoritative Match Web Worker.
 * 
 * Manages the Authoritative Server lifecycle:
 * - Spawns and manages AuthoritativeServerWorker running in a dedicated Web Worker thread (120Hz).
 * - Bridges Host client channel and remote peer channels (P2PWebRTCChannel / BroadcastChannel).
 * - Forwards incoming client packets and dispatches frame snapshots.
 * - Provides clean synchronous proxy methods matching RocketSimPhysicsEngine API for GameRuntime.
 * - Gracefully falls back to in-memory MatchSessionAdmin in headless Node.js environments.
 */

import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';
import { PhysicsEngineManager } from './PhysicsEngineManager.js';
import { NetworkInputBuffer } from './NetworkInputBuffer.js';
import { EstablishedSessionManager } from './EstablishedSessionManager.js';
import { MatchSessionAdmin, MATCH_STATES } from './MatchSessionAdmin.js';
import { NetworkDataHandler } from './NetworkDataHandler.js';
import { GlobalPayloadCodec } from './GlobalPayloadCodec.js';

export class HostServerWorker {
  /**
   * @param {object} [channel=null] Host's local channel
   * @param {object} [options={}]
   */
  constructor(channel = null, options = {}) {
    if (channel && typeof channel === "object" && !channel.send && !channel.sendClientInput && !channel.inboundQueue) {
      options = channel;
      channel = null;
    }
    this.options = { ...options };
    this.channels = [];
    this.channelMap = new Map(); // channel -> channelId
    this.channelIdToChannel = new Map(); // channelId -> channel
    this.nextChannelId = 1;

    this.isWorker = typeof Worker !== 'undefined' && !options.forceFallback;
    this.worker = null;
    this.fallbackManager = null;
    this.fallbackSim = null;
    this.fallbackPhysics = null;
    this.fallbackSession = null;
    this.fallbackDataHandler = null;

    this.active = false;
    this.cachedSnapshot = new Float32Array(4201);
    this.lastServerTick = 0;
    this.lastGoal = 0;

    this.pendingRequests = new Map();
    this.reqId = 0;

    // Direct proxy sim object matching RocketSimPhysicsEngine API for GameRuntime
    this.sim = {
      isUnlimitedBoost: false,
      numCars: 1,
      setUnlimitedBoost: (enabled) => {
        this.sim.isUnlimitedBoost = Boolean(enabled);
        if (this.isWorker && this.worker) {
          this._postCommand('setUnlimitedBoost', { enabled });
        } else if (this.fallbackSim) {
          this.fallbackSim.setUnlimitedBoost(enabled);
        }
      },
      restoreState: (state) => {
        if (state) {
          if (state instanceof Float32Array) {
            this.cachedSnapshot.set(state);
            const u32 = new Uint32Array(state.buffer, state.byteOffset, 1);
            if (u32[0] > 0 || !Number.isNaN(state[0])) {
              this.lastServerTick = u32[0];
            }
          } else {
            const arr = new Float32Array(state);
            this.cachedSnapshot.set(arr);
            const u32 = new Uint32Array(arr.buffer, arr.byteOffset, 1);
            if (u32[0] > 0 || !Number.isNaN(arr[0])) {
              this.lastServerTick = u32[0];
            }
          }
        }
        if (this.isWorker && this.worker) {
          return this._sendRequest('restoreState', {
            state: state instanceof Float32Array ? Array.from(state) : state
          }).then((res) => {
            if (res.snapshot) this.cachedSnapshot.set(res.snapshot);
            if (res.tickCount !== undefined) this.lastServerTick = res.tickCount;
            return this.cachedSnapshot;
          });
        } else if (this.fallbackSim) {
          const res = this.fallbackSim.restoreState(state);
          this.lastServerTick = Math.floor(this.fallbackSim.getHeaderView().tickCount);
          return res;
        }
      },
      saveState: (targetBuf) => {
        if (!this.isWorker && this.fallbackSim) {
          return this.fallbackSim.saveState(targetBuf);
        }
        if (targetBuf) {
          targetBuf.set(this.cachedSnapshot);
          return targetBuf;
        }
        return new Float32Array(this.cachedSnapshot);
      },
      getHeaderView: () => {
        if (!this.isWorker && this.fallbackSim) {
          return this.fallbackSim.getHeaderView();
        }
        return { tickCount: this.lastServerTick };
      },
      resetKickoff: (seed) => {
        if (this.isWorker && this.worker) {
          this._postCommand('resetKickoff', { seed });
        } else if (this.fallbackPhysics) {
          this.fallbackPhysics.resetKickoff(seed);
        }
      },
      pollGoal: () => {
        if (!this.isWorker && this.fallbackSim) {
          return this.fallbackSim.pollGoal();
        }
        const g = this.lastGoal;
        this.lastGoal = 0;
        return g;
      },
      getStateSnapshotSize: () => {
        if (!this.isWorker && this.fallbackSim) {
          return this.fallbackSim.getStateSnapshotSize();
        }
        return this.cachedSnapshot.length || 4201;
      }
    };

    // Host channel setup: dedicated 0ms loopback channel between host client and server
    this.hostChannel = channel || this._createDefaultHostChannel();
    this.channelMap.set(this.hostChannel, 'host');
    this.channelIdToChannel.set('host', this.hostChannel);
  }

  _createDefaultHostChannel() {
    const ch = {
      inboundQueue: [],
      extraLatencyMs: 0,
      measuredRttMs: 0,
      get rttMs() {
        if (ch.measuredRttMs > 0) {
          return Math.round(ch.measuredRttMs);
        }
        return Math.round(ch.extraLatencyMs * 2);
      },
      set rttMs(val) {
        ch.measuredRttMs = Math.max(0, Number(val) || 0);
      },
      setExtraLatency: (latencyMs) => {
        ch.extraLatencyMs = Math.max(0, Number(latencyMs) || 0);
      },
      setLatency: (latencyMs) => {
        ch.setExtraLatency(latencyMs);
      },
      setRtt: (rttMs) => {
        ch.setExtraLatency(Math.round((Number(rttMs) || 0) * 0.5));
      },
      onPacketReceived: null,
      onMessage: null,
      send: (packet, nowMs = performance.now()) => {
        const doSend = () => {
          if (this.isWorker && this.worker) {
            this._postCommand('clientInput', { channelId: 'host', packet, timestamp: nowMs });
          } else if (this.fallbackDataHandler) {
            this.fallbackDataHandler.handleIncomingPacket('host', packet, nowMs);
          }
        };
        if (ch.extraLatencyMs > 0) {
          setTimeout(doSend, ch.extraLatencyMs);
        } else {
          doSend();
        }
        return true;
      },
      sendClientInput: (packet, nowMs = performance.now()) => {
        return ch.send(packet, nowMs);
      },
      receiveClientPackets: (nowMs = performance.now()) => {
        const ready = [];
        const remaining = [];
        for (const item of ch.inboundQueue) {
          const deliverAt = item?.deliverAt ?? 0;
          if (deliverAt <= nowMs) {
            ready.push(item?.payload ?? item);
          } else {
            remaining.push(item);
          }
        }
        ch.inboundQueue = remaining;
        return ready;
      },
      destroy: () => {
        ch.inboundQueue = [];
      }
    };
    return ch;
  }

  get channel() {
    return this.hostChannel;
  }

  set channel(ch) {
    if (ch && ch !== this.hostChannel) {
      this.hostChannel = ch;
      this.addClientChannel(ch, 'host');
    }
  }

  async init() {
    if (this.isWorker) {
      return new Promise((resolve, reject) => {
        try {
          const workerUrl = new URL('./AuthoritativeServerWorker.js', import.meta.url);
          this.worker = new Worker(workerUrl, { type: 'module' });

          this.worker.onmessage = (event) => {
            this._handleWorkerMessage(event.data);
          };

          this.worker.onerror = (err) => {
            console.error('[HostServerWorker] Worker error:', err);
            reject(err);
          };

          const initListener = (event) => {
            if (event.data?.type === 'initialized') {
              this.active = true;
              if (event.data.result?.snapshot) {
                this.cachedSnapshot.set(event.data.result.snapshot);
              }
              if (event.data.result?.tickCount !== undefined) {
                this.lastServerTick = event.data.result.tickCount;
              }
              this.worker.removeEventListener('message', initListener);
              resolve(this);
            } else if (event.data?.type === 'error') {
              reject(new Error(event.data.error));
            }
          };

          this.worker.addEventListener('message', initListener);

          this._postCommand('init', {
            roomId: this.options.roomId || 'local_room',
            gameMode: this.options.gameMode || '3v3',
            initialState: this.options.initialState,
            hostPlayerName: this.options.hostPlayerName || 'Host'
          });
        } catch (err) {
          console.warn('[HostServerWorker] Worker initialization failed, falling back to in-memory:', err);
          this.isWorker = false;
          this._initFallback().then(resolve).catch(reject);
        }
      });
    } else {
      return this._initFallback();
    }
  }

  async _initFallback() {
    this.fallbackSim = new RocketSimPhysicsEngine();
    await this.fallbackSim.init();

    this.fallbackInputBuffer = new NetworkInputBuffer(10);
    this.fallbackPhysics = new PhysicsEngineManager({ sim: this.fallbackSim, inputBuffer: this.fallbackInputBuffer });
    this.fallbackSession = new EstablishedSessionManager(this.fallbackPhysics);
    this.fallbackManager = new MatchSessionAdmin({
      physicsManager: this.fallbackPhysics,
      sessionManager: this.fallbackSession,
      isHost: true,
      roomId: this.options.roomId || 'local_room'
    });
    this.fallbackDataHandler = new NetworkDataHandler({
      matchManager: this.fallbackManager,
      sessionManager: this.fallbackSession,
      physicsManager: this.fallbackPhysics
    });
    this.fallbackManager.dataHandler = this.fallbackDataHandler;

    this.fallbackPhysics.registerCarEntity(0, 0, 'octane');
    this.fallbackManager.assignPlayerSlot('host', this.options.hostPlayerName || 'Host', 'player', 0);
    this.fallbackDataHandler.registerChannel('host', {
      send: (packet) => {
        const delay = this.hostChannel?.extraLatencyMs ?? 0;
        const deliverAt = delay > 0 ? performance.now() + delay : 0;
        if (this.hostChannel?.inboundQueue) {
          if (deliverAt === 0) {
            this.hostChannel.inboundQueue.push(packet);
          } else {
            this.hostChannel.inboundQueue.push({ payload: packet, deliverAt });
          }
        }
        if (deliverAt === 0) {
          this.hostChannel?.onPacketReceived?.(packet);
          this.hostChannel?.onMessage?.(packet);
        } else {
          setTimeout(() => {
            this.hostChannel?.onPacketReceived?.(packet);
            this.hostChannel?.onMessage?.(packet);
          }, delay);
        }
      }
    });

    this.fallbackManager.startTrainingMode();

    if (this.options.initialState) {
      this.fallbackSim.restoreState(this.options.initialState);
    }

    this.active = true;
    this.cachedSnapshot.set(this.fallbackSim.saveState());
    this.lastServerTick = Math.floor(this.fallbackSim.getHeaderView().tickCount);
    return this;
  }

  _handleWorkerMessage(data) {
    if (!data) return;

    switch (data.type) {
      case 'channel_packet': {
        const { channelId, packet } = data;
        if (channelId === 'host') {
          const delay = this.hostChannel?.extraLatencyMs ?? 0;
          const deliverAt = delay > 0 ? performance.now() + delay : 0;
          if (this.hostChannel?.inboundQueue) {
            if (deliverAt === 0) {
              this.hostChannel.inboundQueue.push(packet);
            } else {
              this.hostChannel.inboundQueue.push({ payload: packet, deliverAt });
            }
          }
          if (deliverAt === 0) {
            if (typeof this.hostChannel?.onPacketReceived === 'function') {
              this.hostChannel.onPacketReceived(packet);
            }
            if (typeof this.hostChannel?.onMessage === 'function') {
              this.hostChannel.onMessage(packet);
            }
          } else {
            setTimeout(() => {
              if (typeof this.hostChannel?.onPacketReceived === 'function') {
                this.hostChannel.onPacketReceived(packet);
              }
              if (typeof this.hostChannel?.onMessage === 'function') {
                this.hostChannel.onMessage(packet);
              }
            }, delay);
          }
          if (packet instanceof Uint8Array || packet instanceof ArrayBuffer) {
            try {
              const clientHeader = EstablishedSessionManager.parseClientPacket(packet);
              if (clientHeader?.globalPayloadSlice) {
                const globalPayload = GlobalPayloadCodec.decode(clientHeader.globalPayloadSlice);
                if (globalPayload?.hasPhysics && globalPayload.physics?.stateSnapshot) {
                  this.cachedSnapshot.set(globalPayload.physics.stateSnapshot);
                  this.lastServerTick = globalPayload.physics.tick;
                }
              }
            } catch (_) {}
          }
        } else {
          const ch = this.channelIdToChannel.get(channelId);
          if (ch) {
            if (typeof ch.send === 'function') {
              ch.send(packet);
            } else if (typeof ch.sendServerState === 'function') {
              ch.sendServerState(packet);
            }
          }
        }
        break;
      }

      case 'requestResponse': {
        const { reqId, result } = data;
        const req = this.pendingRequests.get(reqId);
        if (req) {
          this.pendingRequests.delete(reqId);
          req.resolve(result);
        }
        break;
      }

      default:
        break;
    }
  }

  _postCommand(type, data = {}, transfer = []) {
    if (this.isWorker && this.worker) {
      this.worker.postMessage({ type, ...data }, transfer);
    }
  }

  _sendRequest(type, data = {}) {
    return new Promise((resolve) => {
      const reqId = ++this.reqId;
      this.pendingRequests.set(reqId, { resolve });
      this._postCommand(type, { reqId, ...data });
    });
  }

  addClientChannel(channel, overrideId = null) {
    if (!channel) return;
    if (this.channelMap.has(channel)) return;

    const channelId = overrideId || `peer_${this.nextChannelId++}`;
    this.channels.push(channel);
    this.channelMap.set(channel, channelId);
    this.channelIdToChannel.set(channelId, channel);

    // Bind packet forwarding from channel to worker (single binding to prevent duplicate packets)
    const origPacketReceived = channel.onPacketReceived;
    channel.onPacketReceived = (packet) => {
      origPacketReceived?.(packet);
      if (this.isWorker && this.worker) {
        this._postCommand('channel_packet', { channelId, packet });
      } else if (this.fallbackDataHandler) {
        this.fallbackDataHandler.handleIncomingPacket(channelId, packet, performance.now());
      }
    };

    if (this.isWorker && this.worker) {
      this._postCommand('registerChannel', {
        channelId,
        playerName: channel.peerName || 'Player'
      });
    } else if (this.fallbackDataHandler) {
      this.fallbackDataHandler.registerChannel(channelId, {
        send: (pkt) => {
          if (typeof channel.send === 'function') channel.send(pkt);
        }
      });
    }
  }

  removeClientChannel(channel) {
    const channelId = this.channelMap.get(channel);
    if (!channelId) return;

    const idx = this.channels.indexOf(channel);
    if (idx !== -1) this.channels.splice(idx, 1);
    this.channelMap.delete(channel);
    this.channelIdToChannel.delete(channelId);

    if (this.isWorker && this.worker) {
      this._postCommand('removeChannel', { channelId });
    } else if (this.fallbackDataHandler) {
      this.fallbackDataHandler.unregisterChannel(channelId);
      this.fallbackManager?.removePlayerSession(channelId);
    }
  }

  ensureCar(carIndex, team = 1) {
    if (this.isWorker && this.worker) {
      this._postCommand('ensureCar', { carIndex, team });
    } else if (this.fallbackPhysics) {
      this.fallbackPhysics.registerCarEntity(carIndex, team, 'octane');
    }
  }

  removeCar(carIndex) {
    if (this.isWorker && this.worker) {
      this._postCommand('removeCar', { carIndex });
    } else if (this.fallbackPhysics) {
      this.fallbackPhysics.unregisterCarEntity(carIndex);
    }
  }

  notifyPlayerJoined(entityId, name, role = 'player', channelId = null) {
    const chId = channelId || (entityId === 0 ? 'host' : `peer_${entityId}`);
    if (this.isWorker && this.worker) {
      this._postCommand('notifyPlayerJoined', { entityId, name, role, channelId: chId });
    } else if (this.fallbackManager) {
      this.fallbackManager.assignPlayerSlot(chId, name, role, entityId % 2);
    }
  }

  startMatch() {
    if (this.isWorker && this.worker) {
      this._postCommand('startMatch', {});
    } else if (this.fallbackManager) {
      this.fallbackManager.startMatch();
    }
  }

  startTrainingMode() {
    if (this.isWorker && this.worker) {
      this._postCommand('startTrainingMode', {});
    } else if (this.fallbackManager) {
      this.fallbackManager.startTrainingMode();
    }
  }

  update(nowMs = performance.now()) {
    // In worker mode, worker loop runs autonomously at 120Hz.
    // In fallback mode, step frame synchronously here.
    if (!this.isWorker && this.fallbackManager && this.fallbackDataHandler) {
      const globalPayloadBytes = this.fallbackManager.stepFrame();
      if (globalPayloadBytes && globalPayloadBytes.length > 0) {
        this.fallbackDataHandler.dispatchFrameToSessions(globalPayloadBytes);
      }
      if (this.fallbackSim) {
        this.cachedSnapshot.set(this.fallbackSim.saveState());
        this.lastServerTick = Math.floor(this.fallbackSim.getHeaderView().tickCount);
      }
    }
  }

  destroy() {
    this.active = false;
    if (this.isWorker && this.worker) {
      this._postCommand('destroy', {});
      try { this.worker.terminate(); } catch (_) {}
      this.worker = null;
    }
    if (this.fallbackManager) {
      this.fallbackManager.destroy();
      this.fallbackSession?.destroy();
      this.fallbackDataHandler?.destroy();
      this.fallbackPhysics = null;
      this.fallbackInputBuffer = null;
      this.fallbackSession = null;
      this.fallbackManager = null;
      this.fallbackDataHandler = null;
      this.fallbackSim = null;
    }
    this.channels = [];
    this.channelMap.clear();
    this.channelIdToChannel.clear();
    this.pendingRequests.clear();
  }
}

export default HostServerWorker;
