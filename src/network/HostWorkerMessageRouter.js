/**
 * src/network/HostWorkerMessageRouter.js
 * Standardized message envelope router bridging Main Thread (HostServerWorker)
 * and Authoritative Web Worker (AuthoritativeServerWorker / AuthoritativeHostWorker)
 * using the frozen HostWorkerProtocol contract.
 */

import { HOST_WORKER_MSG_TYPES, createWorkerEnvelope } from './HostWorkerProtocol.js';
import { MATCH_STATES, buildRosterSnapshot } from './MatchRosterCoordinator.js';
import {
  DEFAULT_DIAGNOSTIC_FLEET,
  ZERO_G_ANCHOR_MODES,
  configureZeroGVehiclePhysics,
  releaseZeroGVehiclePhysics
} from './DiagnosticsTestVehicles.js';

export { HOST_WORKER_MSG_TYPES, createWorkerEnvelope };

/**
 * Builds a structured cloneable room & match state summary for ROOM_STATE_SYNC.
 * @param {import('./MatchSessionAdmin.js').MatchSessionAdmin} matchManager
 * @param {import('./PhysicsEngineManager.js').PhysicsEngineManager} physicsManager
 */
export function buildWorkerRoomStateSummary(matchManager, physicsManager) {
  if (!matchManager) return null;
  const roster = buildRosterSnapshot(matchManager);
  return {
    roomId: matchManager.roomId,
    gameMode: matchManager.gameMode,
    botFillMode: matchManager.botFillMode,
    state: matchManager.state,
    matchTick: matchManager.matchTick,
    clockSecondsRemaining: matchManager.clockSecondsRemaining,
    isOvertime: matchManager.isOvertime,
    overtimeSeconds: matchManager.overtimeSeconds,
    blueScore: matchManager.blueScore,
    orangeScore: matchManager.orangeScore,
    winner: matchManager.winner,
    winReason: matchManager.winReason,
    lobbyPhysicsActive: Boolean(matchManager.lobbyPhysicsActive),
    ghostConfig: physicsManager?.lobbyGhostCoordinator?.getSnapshotConfig?.() || null,
    roster
  };
}

/**
 * Handles a standardized HOST_WORKER_MSG_TYPES message inside the Authoritative Worker
 * (or in-memory fallback instance).
 *
 * @param {object} workerCtx
 * @param {import('../physics/RocketSimPhysicsEngine.js').RocketSimPhysicsEngine} workerCtx.sim
 * @param {import('./PhysicsEngineManager.js').PhysicsEngineManager} workerCtx.physicsManager
 * @param {import('./EstablishedSessionManager.js').EstablishedSessionManager} workerCtx.sessionManager
 * @param {import('./MatchSessionAdmin.js').MatchSessionAdmin} workerCtx.matchManager
 * @param {import('./NetworkDataHandler.js').NetworkDataHandler} workerCtx.dataHandler
 * @param {(channelId: string) => void} [workerCtx.registerWorkerChannel]
 * @param {(channelId: string) => void} [workerCtx.unregisterWorkerChannel]
 * @param {(envelope: object, transfer?: ArrayBuffer[]) => void} [workerCtx.postEnvelope]
 * @param {object} msg - Incoming message or envelope
 * @returns {boolean} True if handled by the protocol router
 */
export function routeProtocolMessageInWorker(workerCtx, msg) {
  if (!msg || typeof msg.type !== 'string') return false;
  const type = msg.type;
  const payload = msg.payload !== undefined ? msg.payload : msg;
  const seq = msg.seq ?? payload.reqId ?? 0;
  const { sim, physicsManager, sessionManager, matchManager, dataHandler } = workerCtx;

  const reply = (replyType, replyPayload, transfer = []) => {
    if (typeof workerCtx.postEnvelope === 'function') {
      workerCtx.postEnvelope(createWorkerEnvelope(replyType, replyPayload, seq), transfer);
    }
  };

  switch (type) {
    case HOST_WORKER_MSG_TYPES.ROOM_CREATE: {
      if (matchManager) {
        if (payload.roomId) matchManager.roomId = payload.roomId;
        if (payload.botFillMode) matchManager.botFillMode = payload.botFillMode;
        if (payload.gameMode) {
          matchManager.setGameMode(payload.gameMode, payload.durationSeconds ?? null);
        }
        if (payload.startAsMatch) {
          matchManager.startMatch(payload.durationSeconds);
        } else if (payload.lobbyMode !== false) {
          matchManager.enterLobbyMode(payload);
        } else {
          matchManager.startTrainingMode();
        }
        reply(
          HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
          buildWorkerRoomStateSummary(matchManager, physicsManager)
        );
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.ROOM_JOIN: {
      const channelId = payload.channelId || payload.sessionId || `peer_${Date.now()}`;
      workerCtx.registerWorkerChannel?.(channelId);
      if (matchManager) {
        matchManager.assignPlayerSlot(
          channelId,
          payload.playerName || 'Player',
          payload.role || 'player',
          payload.preferredTeam ?? null,
          {
            visualId: payload.visualId || 'octane',
            hitboxId: payload.hitboxId || null,
            colorSlot: payload.colorSlot ?? null
          },
          payload.colorSlot ?? null
        );
        if (matchManager.state === MATCH_STATES.LOBBY && physicsManager?.lobbyGhostCoordinator?.lobbyModeActive) {
          physicsManager.syncLobbyGhostMasks();
        }
        reply(
          HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
          buildWorkerRoomStateSummary(matchManager, physicsManager)
        );
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.ROOM_LEAVE: {
      const channelId = payload.channelId || payload.sessionId;
      if (channelId) {
        workerCtx.unregisterWorkerChannel?.(channelId);
      }
      if (matchManager) {
        reply(
          HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
          buildWorkerRoomStateSummary(matchManager, physicsManager)
        );
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC: {
      if (matchManager) {
        reply(
          HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
          buildWorkerRoomStateSummary(matchManager, physicsManager)
        );
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.LOCAL_INPUT_FRAME: {
      const channelId = payload.channelId || 'host';
      if (payload.packet && dataHandler) {
        dataHandler.handleIncomingPacket(channelId, payload.packet, payload.timestamp || performance.now());
      } else if (payload.controls && physicsManager) {
        const carIdx = payload.carIndex ?? 0;
        if (typeof payload.targetTick === 'number') {
          physicsManager.pushInput(carIdx, payload.targetTick, payload.controls);
        } else {
          physicsManager.setDirectCarControls(carIdx, payload.controls);
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.RELIABLE_COMMAND: {
      const sessionId = payload.sessionId || payload.channelId || 'host';
      if (matchManager) {
        if (Array.isArray(payload.commands)) {
          matchManager.handleClientCommands(sessionId, payload.commands);
        } else if (payload.command) {
          matchManager.handleClientCommand(sessionId, payload.command);
        } else if (typeof payload.commandType === 'number') {
          matchManager.handleClientCommand(sessionId, payload);
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.SIGNAL_ACK: {
      const sessionId = payload.sessionId || payload.channelId || 'host';
      const acks = Array.isArray(payload.acks)
        ? payload.acks
        : (typeof payload.signalId === 'number' ? [{ signalId: payload.signalId, signalType: payload.signalType }] : []);
      if (acks.length > 0) {
        sessionManager?.recordClientSignalAcks?.(sessionId, acks);
        matchManager?.handleClientSignalAcks?.(sessionId, acks);
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.LOBBY_MODE_SET: {
      if (matchManager) {
        const enabled = payload.enabled !== undefined ? Boolean(payload.enabled) : true;
        if (enabled) {
          matchManager.enterLobbyMode(payload);
        } else if (physicsManager) {
          physicsManager.setLobbyGhostMode(false);
        }
        reply(
          HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
          buildWorkerRoomStateSummary(matchManager, physicsManager)
        );
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.GHOST_CAR_CONFIG: {
      if (physicsManager) {
        if (typeof payload.carIndex === 'number') {
          physicsManager.setCarCollisionMask(
            payload.carIndex,
            payload.interactWithBall ?? false,
            payload.interactWithCars ?? false,
            payload.opacity
          );
        } else {
          physicsManager.setLobbyGhostMode(payload.enabled ?? true, payload);
        }
        if (matchManager) {
          reply(
            HOST_WORKER_MSG_TYPES.ROOM_STATE_SYNC,
            buildWorkerRoomStateSummary(matchManager, physicsManager)
          );
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.MATCH_START_REQUEST: {
      if (workerCtx.diagnosticsController?.enabled && physicsManager) {
        workerCtx.diagnosticsController.enabled = false;
        workerCtx.diagnosticsController.releasePhysics(physicsManager);
      }
      if (matchManager) {
        if (payload.force) {
          matchManager.forceStartMatch(payload.durationSeconds);
        } else if (payload.prepareOnly) {
          matchManager.initiateMatchPrepare(payload.durationSeconds);
        } else {
          matchManager.startMatch(payload.durationSeconds);
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.PODIUM_ENTER: {
      if (matchManager) {
        matchManager.state = MATCH_STATES.PODIUM;
      }
      if (physicsManager && sim) {
        const winnerTeam = matchManager?.winner === 'blue' ? 0 : (matchManager?.winner === 'orange' ? 1 : -1);
        for (const cIdx of physicsManager.activeCarIndices) {
          let isWinner = winnerTeam < 0;
          if (!isWinner && matchManager?.players) {
            for (const p of matchManager.players.values()) {
              if (p.entityId === cIdx && p.team === winnerTeam) {
                isWinner = true;
                break;
              }
            }
          }
          if (isWinner) {
            sim.setCarLinearFactorAndGravity?.(cIdx, 1, 1, 1, 1);
          } else {
            sim.setCarLinearFactorAndGravity?.(cIdx, 0, 0, 1, 1);
          }
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.NET_DIAG_CONFIG: {
      if (physicsManager && sim) {
        const enableZeroG = payload.enabled !== false;
        const fleet = Array.isArray(payload.fleet) ? payload.fleet : DEFAULT_DIAGNOSTIC_FLEET;
        const anchorMode = payload.anchorMode || ZERO_G_ANCHOR_MODES.Z_HOVER;
        if (enableZeroG) {
          configureZeroGVehiclePhysics(physicsManager, fleet, anchorMode);
        } else {
          releaseZeroGVehiclePhysics(physicsManager, fleet);
        }
      }
      return true;
    }

    case HOST_WORKER_MSG_TYPES.NET_IMPAIRMENT_SET: {
      reply(HOST_WORKER_MSG_TYPES.NET_DIAG_METRICS, {
        extraLatencyMs: payload.extraLatencyMs ?? 0,
        jitterMs: payload.jitterMs ?? 0,
        packetLossRate: payload.packetLossRate ?? 0
      });
      return true;
    }

    case HOST_WORKER_MSG_TYPES.REPLAY_WINDOW_REQUEST: {
      const count = payload.count ?? 360;
      const frames = matchManager?.replayBuffer
        ? matchManager.replayBuffer.getRecentFrames(count)
        : [];
      const wasmFrameCount = sim?.getReplayFrameCount?.() ?? 0;
      reply(HOST_WORKER_MSG_TYPES.REPLAY_WINDOW_DATA, {
        reqId: payload.reqId ?? seq,
        frameCount: frames.length,
        wasmFrameCount,
        frames
      });
      return true;
    }

    case HOST_WORKER_MSG_TYPES.REPLAY_FULL_EXPORT_REQUEST: {
      const roster = matchManager ? buildRosterSnapshot(matchManager) : [];
      if (sim && typeof sim.extractWasmReplayTracks === 'function' && (sim.getReplayFrameCount?.() ?? 0) > 0) {
        const tracks = sim.extractWasmReplayTracks();
        const transfer = [];
        if (tracks.stateInputBytes?.buffer) transfer.push(tracks.stateInputBytes.buffer);
        if (tracks.incidentBytes?.buffer) transfer.push(tracks.incidentBytes.buffer);
        if (tracks.signalBytes?.buffer) transfer.push(tracks.signalBytes.buffer);
        reply(
          HOST_WORKER_MSG_TYPES.REPLAY_FULL_EXPORT_DATA,
          {
            reqId: payload.reqId ?? seq,
            frameCount: tracks.frameCount,
            stateStride: tracks.stateStride,
            incidentCount: tracks.incidentCount,
            signalCount: tracks.signalCount,
            stateInputBytes: tracks.stateInputBytes,
            incidentBytes: tracks.incidentBytes,
            signalBytes: tracks.signalBytes,
            blueScore: matchManager?.blueScore ?? 0,
            orangeScore: matchManager?.orangeScore ?? 0,
            winner: matchManager?.winner ?? 0,
            winReason: matchManager?.winReason ?? 0,
            gameMode: matchManager?.gameMode || '3v3',
            roster
          },
          transfer
        );
        return true;
      }

      const frames = matchManager?.replayBuffer ? matchManager.replayBuffer.getRecentFrames() : [];
      reply(HOST_WORKER_MSG_TYPES.REPLAY_FULL_EXPORT_DATA, {
        reqId: payload.reqId ?? seq,
        frameCount: frames.length,
        frames,
        signals: matchManager?.replaySignalLog ? matchManager.replaySignalLog.slice() : [],
        blueScore: matchManager?.blueScore ?? 0,
        orangeScore: matchManager?.orangeScore ?? 0,
        winner: matchManager?.winner ?? 0,
        winReason: matchManager?.winReason ?? 0,
        gameMode: matchManager?.gameMode || '3v3',
        roster
      });
      return true;
    }

    default:
      return false;
  }
}

export class HostWorkerMessageRouter {
  constructor(options = {}) {
    this.sim = options.sim || options.admin?.sim || options.physicsManager?.sim || null;
    this.matchManager = options.matchManager || options.admin || null;
    this.physicsManager = options.physicsManager || this.matchManager?.physicsManager || null;
    this.sessionManager = options.sessionManager || this.matchManager?.sessionManager || null;
    this.dataHandler = options.dataHandler || null;
    this.registerWorkerChannel = options.registerWorkerChannel || null;
    this.unregisterWorkerChannel = options.unregisterWorkerChannel || null;
    this.postEnvelope = options.postEnvelope || null;
  }

  handleEnvelope(envelope) {
    return routeProtocolMessageInWorker(this, envelope);
  }
}

export default HostWorkerMessageRouter;
