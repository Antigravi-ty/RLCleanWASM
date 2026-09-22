/**
 * src/network/AuthoritativeServerWorker.js
 * Dedicated Web Worker running the Authoritative Match Architecture.
 * 
 * Architecture Stack:
 * - RocketSimPhysicsEngine (Core WASM simulation)
 * - PhysicsEngineManager (10-tick input queue, clamping, masking)
 * - MatchSessionAdmin (Room state authority, symmetric rosters, signals)
 * - EstablishedSessionManager (17-byte client header packing & session registry)
 * - NetworkDataHandler (Ingress router, magic-byte fast path, egress dispatch)
 * - GlobalPayloadCodec (Binary bitmask physics, signals, RTT serialization)
 */

import { RocketSimPhysicsEngine } from '../physics/RocketSimPhysicsEngine.js';
import { PhysicsEngineManager } from './PhysicsEngineManager.js';
import { NetworkInputBuffer } from './NetworkInputBuffer.js';
import { EstablishedSessionManager } from './EstablishedSessionManager.js';
import { MatchSessionAdmin, MATCH_STATES } from './MatchSessionAdmin.js';
import { NetworkDataHandler } from './NetworkDataHandler.js';
import { GlobalPayloadCodec } from './GlobalPayloadCodec.js';

let sim = null;
let physicsManager = null;
let inputBuffer = null;
let sessionManager = null;
let matchManager = null;
let dataHandler = null;

let isRunning = false;
let loopTimer = null;
let lastTickTime = -1;
let accumulator = 0;
const fixedTimestep = 1.0 / 120.0;

function sendToMain(channelId, packet) {
  let transferBuffer = null;
  let copy = packet;

  if (packet instanceof Uint8Array) {
    copy = new Uint8Array(packet);
    transferBuffer = copy.buffer;
  } else if (packet instanceof ArrayBuffer) {
    copy = new Uint8Array(packet);
    transferBuffer = copy.buffer;
  }

  try {
    if (transferBuffer) {
      self.postMessage({
        type: 'channel_packet',
        channelId,
        packet: copy
      }, [transferBuffer]);
    } else {
      self.postMessage({
        type: 'channel_packet',
        channelId,
        packet: copy
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'channel_packet',
      channelId,
      packet: copy
    });
  }
}

function registerWorkerChannel(channelId) {
  if (!dataHandler) return;
  dataHandler.registerChannel(channelId, {
    send: (packet) => sendToMain(channelId, packet),
    postMessage: (packet) => sendToMain(channelId, packet)
  });
}

function unregisterWorkerChannel(channelId) {
  if (!dataHandler) return;
  dataHandler.unregisterChannel(channelId);
  if (matchManager) {
    matchManager.removePlayerSession(channelId);
  }
}

function tick() {
  if (!isRunning || !matchManager) return;
  const globalPayloadBytes = matchManager.stepFrame();
  if (globalPayloadBytes && globalPayloadBytes.length > 0 && dataHandler) {
    dataHandler.dispatchFrameToSessions(globalPayloadBytes);
  }
}

function startLoop() {
  if (isRunning) return;
  isRunning = true;
  lastTickTime = performance.now();
  accumulator = 0;

  const loop = () => {
    if (!isRunning) return;
    const now = performance.now();
    const dt = Math.min((now - lastTickTime) / 1000.0, 0.25);
    lastTickTime = now;
    accumulator += dt;

    while (accumulator >= fixedTimestep) {
      accumulator -= fixedTimestep;
      tick();
    }

    loopTimer = setTimeout(loop, 2);
  };

  loopTimer = setTimeout(loop, 0);
}

function stopLoop() {
  isRunning = false;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

self.onmessage = async (event) => {
  const { type, ...data } = event.data || {};

  switch (type) {
    case 'init': {
      try {
        sim = new RocketSimPhysicsEngine();
        await sim.init();

        inputBuffer = new NetworkInputBuffer(10);
        physicsManager = new PhysicsEngineManager({ sim, inputBuffer });
        sessionManager = new EstablishedSessionManager(physicsManager);
        matchManager = new MatchSessionAdmin({
          physicsManager,
          sessionManager,
          isHost: true,
          roomId: data.roomId || 'local_room',
          gameMode: data.gameMode || '3v3'
        });
        dataHandler = new NetworkDataHandler({
          matchManager,
          sessionManager,
          physicsManager
        });
        matchManager.dataHandler = dataHandler;

        // Register default host car (car 0, team 0)
        physicsManager.registerCarEntity(0, 0, 'octane');
        matchManager.assignPlayerSlot('host', data.hostPlayerName || 'Host', 'player', 0);
        registerWorkerChannel('host');

        // Start in training mode by default so simulation and driving run immediately
        matchManager.startTrainingMode();

        if (data.initialState) {
          sim.restoreState(data.initialState);
        }

        startLoop();

        const snap = sim.saveState();
        const tickCount = Math.floor(sim.getHeaderView().tickCount);

        self.postMessage({
          type: 'initialized',
          result: { snapshot: snap, tickCount }
        });
      } catch (err) {
        console.error('[AuthoritativeServerWorker] Init failed:', err);
        self.postMessage({ type: 'error', error: err.message });
      }
      break;
    }

    case 'registerChannel': {
      const { channelId, playerName, role, preferredTeam } = data;
      registerWorkerChannel(channelId);
      if (playerName && matchManager) {
        matchManager.assignPlayerSlot(channelId, playerName, role || 'player', preferredTeam);
      }
      break;
    }

    case 'removeChannel': {
      const { channelId } = data;
      unregisterWorkerChannel(channelId);
      break;
    }

    case 'channel_packet':
    case 'clientInput': {
      const { channelId, packet, timestamp } = data;
      if (dataHandler) {
        dataHandler.handleIncomingPacket(channelId, packet, timestamp || performance.now());
      }
      break;
    }

    case 'notifyPlayerJoined': {
      const { entityId, name, role, channelId } = data;
      const chId = channelId || (entityId === 0 ? 'host' : `peer_${entityId}`);
      if (matchManager) {
        matchManager.assignPlayerSlot(chId, name || `Player ${entityId}`, role || 'player', entityId % 2);
      }
      break;
    }

    case 'ensureCar': {
      const { carIndex, team } = data;
      if (physicsManager) {
        physicsManager.registerCarEntity(carIndex, team ?? (carIndex % 2), 'octane');
      }
      break;
    }

    case 'removeCar': {
      const { carIndex } = data;
      if (physicsManager) {
        physicsManager.unregisterCarEntity(carIndex);
      }
      break;
    }

    case 'startTrainingMode': {
      if (matchManager) {
        matchManager.startTrainingMode();
      }
      break;
    }

    case 'startMatch': {
      if (matchManager) {
        matchManager.startMatch();
      }
      break;
    }

    case 'setUnlimitedBoost': {
      if (sim) {
        sim.setUnlimitedBoost(Boolean(data.enabled));
      }
      break;
    }

    case 'resetKickoff': {
      const { seed } = data;
      if (physicsManager) {
        physicsManager.resetKickoff(seed || 0);
      }
      break;
    }

    case 'restoreState': {
      const { state, reqId } = data;
      if (sim && state) {
        sim.restoreState(state);
      }
      const snap = sim ? sim.saveState() : null;
      const tickCount = sim ? Math.floor(sim.getHeaderView().tickCount) : 0;
      self.postMessage({
        type: 'requestResponse',
        reqId,
        result: { snapshot: snap, tickCount }
      });
      break;
    }

    case 'saveState': {
      const { reqId } = data;
      const snap = sim ? sim.saveState() : null;
      const tickCount = sim ? Math.floor(sim.getHeaderView().tickCount) : 0;
      self.postMessage({
        type: 'requestResponse',
        reqId,
        result: { snapshot: snap, tickCount }
      });
      break;
    }

    case 'destroy': {
      stopLoop();
      if (matchManager) matchManager.destroy();
      if (sessionManager) sessionManager.destroy();
      if (dataHandler) dataHandler.destroy();
      sim = null;
      physicsManager = null;
      inputBuffer = null;
      sessionManager = null;
      matchManager = null;
      dataHandler = null;
      break;
    }

    default:
      break;
  }
};
