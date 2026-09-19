/**
 * src/network/AuthoritativeServerWorker.js
 * Dedicated Web Worker for AuthoritativeServer Physics Simulation.
 * 
 * Runs a standalone, decoupled 120Hz physics arena in a dedicated background thread:
 * - Immune to main-thread tab throttling, lost focus, backgrounding, and tab switching.
 * - Drives an autonomous 120Hz fixed-timestep accumulator loop.
 * - Manages multi-client input buffering, anti-cheat gap locking, and authoritative stepping.
 * - Dispatches authoritative state snapshots at configured intervals (e.g. 60Hz).
 */

import { AuthoritativeServer } from './AuthoritativeServer.js';
import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';

let server = null;
let isRunning = false;
let loopTimer = null;
let lastTickTime = -1;
let accumulator = 0;
const fixedTimestep = 1.0 / 120.0;

// Channel adapter bridging worker postMessage with AuthoritativeServer channel interface
class WorkerChannelAdapter {
  constructor(channelId) {
    this.channelId = channelId;
    this.incomingQueue = [];
  }

  enqueueInput(packet) {
    this.incomingQueue.push(packet);
  }

  receiveServerPackets(nowMs) {
    const pkts = this.incomingQueue;
    this.incomingQueue = [];
    return pkts;
  }

  sendServerState(packet, nowMs) {
    // Copy snapshot buffer to avoid race condition with pool
    const snapCopy = packet.stateSnapshot ? new Float32Array(packet.stateSnapshot) : null;
    self.postMessage({
      type: 'serverState',
      channelId: this.channelId,
      packet: {
        serverTick: packet.serverTick,
        stateSnapshot: snapCopy,
        acknowledgedControls: packet.acknowledgedControls,
        timestamp: packet.timestamp,
        lastReceivedClientTimestamp: packet.lastReceivedClientTimestamp,
        globalInputBufferStatus: packet.globalInputBufferStatus
      }
    });
  }
}

const clientChannels = new Map();

function getOrCreateChannel(channelId = 0) {
  if (!clientChannels.has(channelId)) {
    const ch = new WorkerChannelAdapter(channelId);
    clientChannels.set(channelId, ch);
    if (server) {
      server.addClientChannel(ch);
    }
  }
  return clientChannels.get(channelId);
}

function startAutonomousLoop() {
  if (isRunning) return;
  isRunning = true;
  lastTickTime = performance.now();
  accumulator = 0;

  // High-frequency polling (4ms) to ensure smooth 120Hz (8.333ms) fixed stepping
  loopTimer = setInterval(() => {
    if (!isRunning || !server || !server.active) return;
    const now = performance.now();
    if (lastTickTime < 0) {
      lastTickTime = now;
      return;
    }
    const dt = Math.min((now - lastTickTime) / 1000.0, 0.25);
    lastTickTime = now;
    accumulator += dt;

    while (accumulator >= fixedTimestep) {
      accumulator -= fixedTimestep;
      server.tick(now);
    }
  }, 4);
}

function stopAutonomousLoop() {
  isRunning = false;
  if (loopTimer !== null) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
  lastTickTime = -1;
  accumulator = 0;
}

self.onmessage = async (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  const { type, reqId } = data;

  try {
    switch (type) {
      case 'init': {
        const options = data.options || {};
        if (options.collisionData && Array.isArray(options.collisionData)) {
          RocketSimPhysicsEngine.cachedCollisionData = options.collisionData.map(
            (c) => (c instanceof Uint8Array ? c : new Uint8Array(c))
          );
        }

        const defaultChannel = getOrCreateChannel(0);
        server = new AuthoritativeServer(defaultChannel, options);
        await server.init(options.config || {});

        // Attach any pre-registered channels
        for (const ch of clientChannels.values()) {
          if (ch !== defaultChannel) {
            server.addClientChannel(ch);
          }
        }

        startAutonomousLoop();

        const snap = server.sim.saveState();
        const tick = Math.floor(server.sim.getHeaderView().tickCount);

        self.postMessage({
          type: 'init_done',
          reqId,
          snapshot: new Float32Array(snap),
          tickCount: tick,
          snapshotSize: server.sim.getStateSnapshotSize()
        });
        break;
      }

      case 'clientInput': {
        const channelId = data.channelId ?? 0;
        const ch = getOrCreateChannel(channelId);
        if (data.packet) {
          ch.enqueueInput(data.packet);
        }
        break;
      }

      case 'registerChannel': {
        const channelId = data.channelId;
        getOrCreateChannel(channelId);
        self.postMessage({ type: 'registerChannel_done', reqId, channelId });
        break;
      }

      case 'removeChannel': {
        const channelId = data.channelId;
        if (clientChannels.has(channelId)) {
          const ch = clientChannels.get(channelId);
          server?.removeClientChannel(ch);
          clientChannels.delete(channelId);
        }
        break;
      }

      case 'ensureCar': {
        const carIndex = data.carIndex ?? 0;
        const team = data.team ?? 1;
        server?.ensureCar(carIndex, team);
        break;
      }

      case 'setUnlimitedBoost': {
        const enabled = !!data.enabled;
        server?.sim?.setUnlimitedBoost(enabled);
        break;
      }

      case 'restoreState': {
        if (server?.sim && data.state) {
          const arr = data.state instanceof Float32Array ? data.state : new Float32Array(data.state);
          server.sim.restoreState(arr);
          const snap = server.sim.saveState();
          const tick = Math.floor(server.sim.getHeaderView().tickCount);
          self.postMessage({
            type: 'restoreState_done',
            reqId,
            snapshot: new Float32Array(snap),
            tickCount: tick
          });
        }
        break;
      }

      case 'saveState': {
        if (server?.sim) {
          const snap = server.sim.saveState();
          const tick = Math.floor(server.sim.getHeaderView().tickCount);
          self.postMessage({
            type: 'saveState_done',
            reqId,
            snapshot: new Float32Array(snap),
            tickCount: tick
          });
        }
        break;
      }

      case 'resetKickoff': {
        if (server?.sim) {
          server.sim.resetKickoff(data.seed);
          server.sim.pollGoal();
          server.clientInputBuffer.clear();
          server.lastReceivedControls.clear();
          for (let c = 0; c < 6; c++) {
            server.lastReceivedControls.set(c, { ...server.neutralControls });
          }
          server.clientLastTimestamps.clear();
          server.furthestReceivedTick.clear();
          server.lockedGaps.clear();
          const snap = server.sim.saveState();
          const tick = Math.floor(server.sim.getHeaderView().tickCount);
          self.postMessage({
            type: 'resetKickoff_done',
            reqId,
            snapshot: new Float32Array(snap),
            tickCount: tick
          });
        }
        break;
      }

      case 'clearInputBuffer': {
        server?.clientInputBuffer?.clear();
        break;
      }

      case 'clearReceivedControls': {
        server?.lastReceivedControls?.clear();
        break;
      }

      case 'destroy': {
        stopAutonomousLoop();
        server?.destroy();
        server = null;
        clientChannels.clear();
        self.postMessage({ type: 'destroy_done', reqId });
        break;
      }

      default:
        console.warn(`[AuthoritativeServerWorker] Unknown message type: ${type}`);
        break;
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      reqId,
      error: err?.message || String(err)
    });
  }
};
