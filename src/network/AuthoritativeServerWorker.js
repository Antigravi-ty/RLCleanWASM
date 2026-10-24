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
import { NetworkInputBuffer, MAX_INPUT_BUFFER_TICKS } from './NetworkInputBuffer.js';
import { EstablishedSessionManager } from './EstablishedSessionManager.js';
import { MatchSessionAdmin } from './MatchSessionAdmin.js';
import { NetworkDataHandler } from './NetworkDataHandler.js';
import {
  HOST_WORKER_MSG_TYPES,
  createWorkerEnvelope,
  routeProtocolMessageInWorker,
  buildWorkerRoomStateSummary
} from './HostWorkerMessageRouter.js';
import {
  DiagnosticsTestVehicleController,
  DEFAULT_DIAGNOSTIC_FLEET,
  ZERO_G_ANCHOR_MODES
} from './DiagnosticsTestVehicles.js';

let sim = null;
let physicsManager = null;
let inputBuffer = null;
let sessionManager = null;
let matchManager = null;
let dataHandler = null;
let diagnosticsController = null;

let isRunning = false;
let loopTimer = null;
let lastTickTime = -1;
let accumulator = 0;
const fixedTimestep = 1.0 / 120.0;

function postWorkerMessage(msg, transfer = []) {
  if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
    if (transfer && transfer.length > 0) {
      self.postMessage(msg, transfer);
    } else {
      self.postMessage(msg);
    }
  }
}

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
      postWorkerMessage({ type: 'channel_packet', channelId, packet: copy }, [transferBuffer]);
    } else {
      postWorkerMessage({ type: 'channel_packet', channelId, packet: copy });
    }
  } catch (err) {
    console.warn('[AuthoritativeServerWorker] postMessage with transferBuffer failed, retrying without transferBuffer:', err);
    postWorkerMessage({ type: 'channel_packet', channelId, packet: copy });
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
  matchManager?.removePlayerSession(channelId);
}

function tick() {
  if (!isRunning || !matchManager) return;
  if (diagnosticsController?.enabled && physicsManager && sim) {
    const sTick = Math.floor(sim.getHeaderView().tickCount);
    diagnosticsController.applyToAuthority(physicsManager, sTick);
  }
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

export function getAuthoritativeWorkerState() {
  return { sim, physicsManager, inputBuffer, sessionManager, matchManager, dataHandler, isRunning };
}

export async function handleAuthoritativeWorkerMessage(eventOrData, customPostMessage = null) {
  const raw = eventOrData?.data !== undefined ? eventOrData.data : (eventOrData || {});
  const { type, ...rest } = raw;
  const data = (raw.payload && typeof raw.payload === 'object' && ! (raw.payload instanceof Uint8Array))
    ? { ...rest, ...raw.payload }
    : rest;
  const emit = customPostMessage || postWorkerMessage;

  const workerCtx = {
    sim,
    physicsManager,
    sessionManager,
    matchManager,
    dataHandler,
    diagnosticsController,
    registerWorkerChannel,
    unregisterWorkerChannel,
    postEnvelope: (envelope, transfer = []) => emit(envelope, transfer)
  };

  if (
    type !== 'init' &&
    type !== HOST_WORKER_MSG_TYPES.WORKER_INIT &&
    type !== 'destroy' &&
    type !== HOST_WORKER_MSG_TYPES.WORKER_DESTROY &&
    type !== HOST_WORKER_MSG_TYPES.NET_DIAG_CONFIG &&
    routeProtocolMessageInWorker(workerCtx, raw)
  ) {
    return;
  }

  switch (type) {
    case 'init':
    case HOST_WORKER_MSG_TYPES.WORKER_INIT: {
      try {
        const hostVisualId = data.hostVisualId || 'octane';
        const hostColorSlot = data.hostColorSlot ?? 0;
        sim = new RocketSimPhysicsEngine();
        await sim.init(data.wasmInitOptions || {});

        inputBuffer = new NetworkInputBuffer(MAX_INPUT_BUFFER_TICKS);
        physicsManager = new PhysicsEngineManager({ sim, inputBuffer });
        sessionManager = new EstablishedSessionManager(physicsManager);
        matchManager = new MatchSessionAdmin({
          physicsManager,
          sessionManager,
          isHost: true,
          roomId: data.roomId || 'local_room',
          gameMode: data.gameMode || '3v3',
          botFillMode: data.botFillMode || 'no_bots',
          matchDurationSeconds: data.durationSeconds ?? 300,
          maxOvertimeSeconds: data.maxOvertimeSeconds || 360,
          lobbyMode: Boolean(data.lobbyMode),
          skipReplayByDefault: data.skipReplayByDefault !== undefined ? Boolean(data.skipReplayByDefault) : true
        });
        dataHandler = new NetworkDataHandler({
          matchManager,
          sessionManager,
          physicsManager
        });
        matchManager.dataHandler = dataHandler;

        physicsManager.registerCarEntity(0, 0, hostVisualId);
        matchManager.assignPlayerSlot('host', data.hostPlayerName || 'Host', 'player', 0, hostVisualId, hostColorSlot);
        registerWorkerChannel('host');

        if (data.isBotMatch || data.numCars >= 2) {
          const botVisualId = data.botVisualId || 'octane';
          physicsManager.registerCarEntity(1, 1, botVisualId);
          if (data.isBotMatch) {
            physicsManager.setDirectCarControls(1, {
              throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false
            });
          }
          matchManager.assignPlayerSlot('bot', data.botPlayerName || 'AI Bot', 'player', 1, botVisualId, 0);
        }

        if (data.initialState) {
          sim.restoreState(data.initialState);
        }

        if (data.startAsMatch) {
          matchManager.startMatch(data.durationSeconds);
        } else if (data.lobbyMode) {
          matchManager.enterLobbyMode(data.lobbyOptions || data);
        } else {
          matchManager.startTrainingMode();
        }

        if (data.autoStartLoop !== false) {
          startLoop();
        }

        const snap = sim.saveCompactState ? sim.saveCompactState() : sim.saveState();
        const tickCount = Math.floor(sim.getHeaderView().tickCount);
        const roomSummary = buildWorkerRoomStateSummary(matchManager, physicsManager);

        emit({ type: 'initialized', result: { snapshot: snap, tickCount, roomState: roomSummary } });
        emit(createWorkerEnvelope(HOST_WORKER_MSG_TYPES.WORKER_READY, {
          snapshot: snap, tickCount, roomState: roomSummary
        }, raw.seq || 0));
      } catch (err) {
        console.error('[AuthoritativeServerWorker] Init failed:', err);
        emit({ type: 'error', error: err.message });
      }
      break;
    }

    case 'registerChannel': {
      const { channelId, playerName, role, preferredTeam, visualId, colorSlot } = data;
      registerWorkerChannel(channelId);
      if (playerName && matchManager) {
        matchManager.assignPlayerSlot(channelId, playerName, role || 'player', preferredTeam, visualId || 'octane', colorSlot ?? 0);
      }
      break;
    }

    case 'removeChannel': {
      unregisterWorkerChannel(data.channelId);
      break;
    }

    case 'channel_packet':
    case 'clientInput': {
      if (dataHandler) {
        dataHandler.handleIncomingPacket(data.channelId, data.packet, data.timestamp || performance.now());
      }
      break;
    }

    case 'notifyPlayerJoined': {
      const { entityId, name, role, channelId, visualId, colorSlot } = data;
      const chId = channelId || (entityId === 0 ? 'host' : `peer_${entityId}`);
      matchManager?.assignPlayerSlot(chId, name || `Player ${entityId}`, role || 'player', entityId % 2, visualId || 'octane', colorSlot ?? 0);
      break;
    }

    case 'ensureCar': {
      if (matchManager?.lobbyPhysicsActive && data.carIndex >= 1 && data.carIndex < 6) {
        break;
      }
      physicsManager?.registerCarEntity(data.carIndex, data.team ?? (data.carIndex % 2), data.visualId || 'octane');
      break;
    }

    case 'removeCar': {
      const targetCarIdx = data.carIndex;
      if (matchManager && typeof targetCarIdx === 'number') {
        for (const [sid, p] of Array.from(matchManager.players.entries())) {
          if (p.entityId === targetCarIdx && sid !== 'host') {
            matchManager.removePlayerSession(sid);
          }
        }
      }
      physicsManager?.unregisterCarEntity(targetCarIdx);
      break;
    }

    case 'setCarControls': {
      physicsManager?.setDirectCarControls(data.carIndex, data.controls);
      break;
    }

    case 'setCarState': {
      sim?.setCarState?.(data.carIndex, data.state || data.stateObj);
      break;
    }

    case 'setCarCollisionMask':
    case 'setGhostCarConfig': {
      physicsManager?.setCarCollisionMask(
        data.carIndex,
        Boolean(data.interactWithBall),
        Boolean(data.interactWithCars),
        data.opacity
      );
      break;
    }

    case 'setLobbyMode': {
      if (matchManager) {
        if (data.enabled !== false) {
          matchManager.enterLobbyMode(data);
        } else {
          physicsManager?.setLobbyGhostMode(false);
        }
      }
      break;
    }

    case 'setCarLinearFactorAndGravity': {
      sim?.setCarLinearFactorAndGravity?.(
        data.carIndex,
        data.fx ?? 1,
        data.fy ?? 1,
        data.fz ?? 1,
        data.gravityScale ?? 1
      );
      break;
    }

    case 'setArenaMutators': {
      sim?.setArenaMutators?.(data.mutators || data);
      break;
    }

    case 'resetGoalLatch': {
      physicsManager?.resetGoalLatch();
      break;
    }

    case 'pauseMatch': {
      matchManager?.setPaused(Boolean(data.paused));
      break;
    }

    case 'startTrainingMode': {
      matchManager?.startTrainingMode();
      break;
    }

    case 'startMatch': {
      if (diagnosticsController?.enabled && physicsManager) {
        diagnosticsController.enabled = false;
        diagnosticsController.releasePhysics(physicsManager);
      }
      matchManager?.startMatch(data?.durationSeconds);
      break;
    }

    case 'forceStartMatch': {
      if (diagnosticsController?.enabled && physicsManager) {
        diagnosticsController.enabled = false;
        diagnosticsController.releasePhysics(physicsManager);
      }
      matchManager?.forceStartMatch(data?.durationSeconds);
      break;
    }

    case 'initiateMatchPrepare': {
      if (diagnosticsController?.enabled && physicsManager) {
        diagnosticsController.enabled = false;
        diagnosticsController.releasePhysics(physicsManager);
      }
      matchManager?.initiateMatchPrepare(data?.durationSeconds);
      break;
    }

    case 'setGameMode': {
      if (data?.gameMode) matchManager?.setGameMode(data.gameMode, data.durationSeconds);
      break;
    }

    case 'setBotFillMode': {
      if (data?.botFillMode) matchManager?.setBotFillMode(data.botFillMode);
      break;
    }

    case 'addBotPlayer': {
      matchManager?.addBotPlayer(data?.team ?? 1, data?.botName ?? null, data?.visualId || 'octane');
      break;
    }

    case 'setLoadout': {
      matchManager?.updatePlayerLoadout(
        data.sessionId || 'host',
        data.visualId || 'octane',
        data.colorSlot ?? 0,
        data.hitboxId ?? null
      );
      break;
    }

    case 'switchRoleTeam': {
      matchManager?.switchPlayerRoleOrTeam(data.sessionId || 'host', data.role || 'player', data.team ?? 0);
      break;
    }

    case 'setSkipReplayByDefault': {
      if (matchManager) matchManager.skipReplayByDefault = Boolean(data.enabled);
      break;
    }

    case 'setUnlimitedBoost': {
      sim?.setUnlimitedBoost(Boolean(data.enabled));
      break;
    }

    case HOST_WORKER_MSG_TYPES.NET_DIAG_CONFIG:
    case 'configureDiagnosticFleet': {
      const payload = data.payload || data;
      const enabled = Boolean(payload.enabled);
      const anchorMode = payload.anchorMode || ZERO_G_ANCHOR_MODES.Z_HOVER;
      if (!diagnosticsController) {
        diagnosticsController = new DiagnosticsTestVehicleController(DEFAULT_DIAGNOSTIC_FLEET, { anchorMode });
      }
      diagnosticsController.anchorMode = anchorMode;
      diagnosticsController.enabled = enabled;
      if (physicsManager) {
        if (enabled) {
          diagnosticsController.configurePhysics(physicsManager, anchorMode);
        } else {
          diagnosticsController.releasePhysics(physicsManager);
        }
      }
      break;
    }

    case 'resetKickoff': {
      physicsManager?.resetKickoff(data.seed || 0);
      break;
    }

    case 'restoreState': {
      const { state, reqId } = data;
      if (sim && state) sim.restoreState(state);
      const snap = sim ? (sim.saveCompactState ? sim.saveCompactState() : sim.saveState()) : null;
      const tickCount = sim ? Math.floor(sim.getHeaderView().tickCount) : 0;
      emit({ type: 'requestResponse', reqId, result: { snapshot: snap, tickCount } });
      break;
    }

    case 'saveState': {
      const { reqId } = data;
      const snap = sim ? (sim.saveCompactState ? sim.saveCompactState() : sim.saveState()) : null;
      const tickCount = sim ? Math.floor(sim.getHeaderView().tickCount) : 0;
      emit({ type: 'requestResponse', reqId, result: { snapshot: snap, tickCount } });
      break;
    }

    case 'destroy':
    case HOST_WORKER_MSG_TYPES.WORKER_DESTROY: {
      stopLoop();
      matchManager?.destroy();
      sessionManager?.destroy();
      dataHandler?.destroy();
      sim = null;
      physicsManager = null;
      inputBuffer = null;
      sessionManager = null;
      matchManager = null;
      dataHandler = null;
      diagnosticsController = null;
      break;
    }

    default:
      break;
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = (event) => handleAuthoritativeWorkerMessage(event);
}

