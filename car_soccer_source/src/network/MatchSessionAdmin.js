/**
 * src/network/MatchSessionAdmin.js
 * Exported as MatchSessionAdmin.
 * 
 * High-Level Match Orchestrator, Room Authority, and Network Signal Dispatcher.
 * Decoupled in the architectural style of CameraManager:
 * - Room ID & Session Lifecycle (Cloudflare Signaling bridge ready)
 * - Roster & Symmetric Kickoff Slot Assignment (Team 0 vs Team 1 point-symmetric balance)
 * - Timeline Synchronization:
 *   - Frame 0: MATCH_STARTED (resets physical tick ID to 0, begins replay recording)
 *   - Frame 1: KICKOFF_WILL_BEGIN with kickoffWillStartAt: 361 (3s countdown @ 120Hz)
 *   - Redundant Signal Broadcasting: Repeats active signals across all UDP packets until target frame
 *   - Input Masking: Suppresses inputs to neutral during countdown while frame ticks advance
 * - Decoupled 5-Minute Match Clock & 5-Second All-User RTT Interval
 */

import { MATCH_SIGNALS, PAYLOAD_FLAGS, GlobalPayloadCodec } from './GlobalPayloadCodec.js';
import { NEUTRAL_CONTROLS } from './PhysicsEngineManager.js';
import { CAR_STATE_OFFSETS, CAR_STATE_STRIDE } from '../physics/RocketSimConstants.js';

export const MATCH_STATES = Object.freeze({
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  KICKOFF: 'kickoff',
  PLAYING: 'playing',
  GOAL_SCORED: 'goal_scored',
  REPLAY: 'replay',
  PAUSED: 'paused',
  ENDED: 'ended'
});

// Standard Rocket League symmetric kickoff spawn presets (UU coordinates)
export const KICKOFF_SPAWN_PRESETS = Object.freeze([
  // Slot 0: Left Diagonal
  { team0: { x: -1950, y: -2460, z: 17, yaw: -0.7854 }, team1: { x: 1950, y: 2460, z: 17, yaw: 2.3562 } },
  // Slot 1: Right Diagonal
  { team0: { x: 1950, y: -2460, z: 17, yaw: -2.3562 }, team1: { x: -1950, y: 2460, z: 17, yaw: 0.7854 } },
  // Slot 2: Left Straight
  { team0: { x: -256, y: -3840, z: 17, yaw: 1.5708 }, team1: { x: 256, y: 3840, z: 17, yaw: -1.5708 } },
  // Slot 3: Right Straight
  { team0: { x: 256, y: -3840, z: 17, yaw: 1.5708 }, team1: { x: -256, y: 3840, z: 17, yaw: -1.5708 } },
  // Slot 4: Center Back
  { team0: { x: 0, y: -4608, z: 17, yaw: 1.5708 }, team1: { x: 0, y: 4608, z: 17, yaw: -1.5708 } }
]);

export class MatchSessionAdmin {
  /**
   * @param {object} options
   * @param {string} [options.roomId='']
   * @param {string} [options.password='']
   * @param {string} [options.gameMode='3v3'] '1v1' | '2v2' | '3v3'
   * @param {boolean} [options.isHost=true]
   * @param {import('./PhysicsEngineManager.js').PhysicsEngineManager} options.physicsManager
   * @param {import('./EstablishedSessionManager.js').EstablishedSessionManager} options.sessionManager
   * @param {import('./NetworkDataHandler.js').NetworkDataHandler} [options.dataHandler]
   */
  constructor(options = {}) {
    this.roomId = options.roomId || `room_${Math.random().toString(36).slice(2, 8)}`;
    this.password = options.password || '';
    this.gameMode = options.gameMode || '3v3';
    this.isHost = options.isHost ?? true;

    this.physicsManager = options.physicsManager;
    this.sessionManager = options.sessionManager;
    this.dataHandler = options.dataHandler || null;

    // Max players based on game mode
    this.maxPlayers = this.gameMode === '1v1' ? 2 : (this.gameMode === '2v2' ? 4 : 6);

    // State machine
    this.state = MATCH_STATES.LOBBY;
    this.matchTick = 0; // Authoritative match frame ID (resets to 0 on MATCH_STARTED)
    this.clockSecondsRemaining = 300; // 5 minutes default
    this.isOvertime = false;

    // Active players map: sessionId -> { entityId, team, name, role, spawnSlot }
    this.players = new Map();
    // Spectators map: sessionId -> { name, role: 'spectator' }
    this.spectators = new Map();

    // Active broadcast signals map: signalType -> signalObject
    this.activeSignals = new Map();

    // Replay log: recorded once per event
    this.replaySignalLog = [];

    // All-User RTT interval (5 seconds = 600 ticks at 120Hz)
    this.rttIntervalTicks = 600;
    this.lastRttBroadcastTick = -600;
    this.cachedAllUserRtt = null;

    // Kickoff target frame
    this.kickoffWillStartAt = -1;

    // Auto-start countdown tracking
    this.startCountdownTicks = -1;
  }

  /**
   * Evaluates and assigns an entity ID (0..5) and team (0 or 1) with symmetric kickoff slots
   * @param {string} sessionId
   * @param {string} [playerName='Player']
   * @param {string} [role='player'] 'player' | 'spectator'
   * @param {number} [preferredTeam=null]
   * @returns {{ entityId: number, team: number, role: string, spawnSlot: number }}
   */
  assignPlayerSlot(sessionId, playerName = 'Player', role = 'player', preferredTeam = null) {
    // Idempotency: return existing slot if already assigned to this session
    if (this.players.has(sessionId)) {
      const existing = this.players.get(sessionId);
      if (playerName && playerName !== 'Player') {
        existing.name = playerName;
        const s = this.sessionManager?.getSession(sessionId);
        if (s) s.playerName = playerName;
      }
      return existing;
    }
    if (this.spectators.has(sessionId) && role === 'spectator') {
      const existing = this.spectators.get(sessionId);
      if (playerName && playerName !== 'Player') existing.name = playerName;
      return existing;
    }

    if (role === 'spectator' || this.players.size >= this.maxPlayers) {
      this.spectators.set(sessionId, { name: playerName, role: 'spectator' });
      this.sessionManager.registerSession(sessionId, { role: 'spectator', entityId: -1, playerName });
      this.dispatchSignal(MATCH_SIGNALS.PLAYER_JOINED, this.matchTick, -1);
      return { entityId: -1, team: -1, role: 'spectator', spawnSlot: -1 };
    }

    // Count current team members
    let team0Count = 0;
    let team1Count = 0;
    const occupiedSlotsTeam0 = new Set();
    const occupiedSlotsTeam1 = new Set();

    for (const p of this.players.values()) {
      if (p.team === 0) {
        team0Count++;
        occupiedSlotsTeam0.add(p.spawnSlot);
      } else {
        team1Count++;
        occupiedSlotsTeam1.add(p.spawnSlot);
      }
    }

    // Determine balanced team
    let assignedTeam = preferredTeam;
    if (assignedTeam !== 0 && assignedTeam !== 1) {
      assignedTeam = (team0Count <= team1Count) ? 0 : 1;
    }

    // Assign symmetric spawn slot index
    let spawnSlot = 0;
    const targetOccupied = (assignedTeam === 0) ? occupiedSlotsTeam0 : occupiedSlotsTeam1;
    while (targetOccupied.has(spawnSlot) && spawnSlot < KICKOFF_SPAWN_PRESETS.length) {
      spawnSlot++;
    }

    // Find first free car entity ID (0, 2, 4 for Team 0; 1, 3, 5 for Team 1)
    const teamEntityIds = (assignedTeam === 0) ? [0, 2, 4] : [1, 3, 5];
    let assignedEntityId = -1;
    const usedEntityIds = new Set(Array.from(this.players.values()).map(p => p.entityId));
    for (const id of teamEntityIds) {
      if (!usedEntityIds.has(id)) {
        assignedEntityId = id;
        break;
      }
    }
    if (assignedEntityId === -1) {
      // Fallback
      for (let i = 0; i < 6; i++) {
        if (!usedEntityIds.has(i)) {
          assignedEntityId = i;
          break;
        }
      }
    }

    const playerInfo = {
      entityId: assignedEntityId,
      team: assignedTeam,
      name: playerName,
      role: 'player',
      spawnSlot
    };

    this.players.set(sessionId, playerInfo);
    this.sessionManager.registerSession(sessionId, {
      role: 'player',
      entityId: assignedEntityId,
      playerName
    });

    if (this.physicsManager && assignedEntityId >= 0) {
      this.physicsManager.registerCarEntity(assignedEntityId, assignedTeam, 'octane');
      const preset = KICKOFF_SPAWN_PRESETS[spawnSlot] || KICKOFF_SPAWN_PRESETS[0];
      const presetCoord = (assignedTeam === 0) ? preset.team0 : preset.team1;
      if (presetCoord && typeof this.physicsManager.sim?.getCarState === 'function') {
        const cy = Math.cos(presetCoord.yaw);
        const sy = Math.sin(presetCoord.yaw);
        const carState = new Float32Array(CAR_STATE_STRIDE);
        carState[CAR_STATE_OFFSETS.POS] = presetCoord.x;
        carState[CAR_STATE_OFFSETS.POS + 1] = presetCoord.y;
        carState[CAR_STATE_OFFSETS.POS + 2] = presetCoord.z;
        carState[CAR_STATE_OFFSETS.FWD] = cy;
        carState[CAR_STATE_OFFSETS.FWD + 1] = sy;
        carState[CAR_STATE_OFFSETS.FWD + 2] = 0;
        carState[CAR_STATE_OFFSETS.RIGHT] = -sy;
        carState[CAR_STATE_OFFSETS.RIGHT + 1] = cy;
        carState[CAR_STATE_OFFSETS.RIGHT + 2] = 0;
        carState[CAR_STATE_OFFSETS.UP] = 0;
        carState[CAR_STATE_OFFSETS.UP + 1] = 0;
        carState[CAR_STATE_OFFSETS.UP + 2] = 1;
        carState[CAR_STATE_OFFSETS.BOOST] = 33.33;
        this.physicsManager.sim.setCarState(assignedEntityId, carState);
      }
    }

    this.dispatchSignal(MATCH_SIGNALS.PLAYER_JOINED, this.matchTick, assignedEntityId, assignedTeam);

    // Auto-start trigger if room is full
    if (this.players.size >= this.maxPlayers && this.state === MATCH_STATES.LOBBY) {
      this.triggerStartCountdown(3); // 3 seconds countdown
    }

    return playerInfo;
  }

  /**
   * Removes a player session and frees up their slot
   * @param {string} sessionId
   */
  removePlayerSession(sessionId) {
    const player = this.players.get(sessionId);
    if (player) {
      const entityId = player.entityId;
      this.players.delete(sessionId);
      this.sessionManager.unregisterSession(sessionId);
      if (this.physicsManager && entityId >= 0) {
        this.physicsManager.unregisterCarEntity(entityId);
      }
      this.dispatchSignal(MATCH_SIGNALS.PLAYER_LEFT, this.matchTick, entityId);
      return;
    }
    if (this.spectators.has(sessionId)) {
      this.spectators.delete(sessionId);
      this.sessionManager.unregisterSession(sessionId);
      this.dispatchSignal(MATCH_SIGNALS.PLAYER_LEFT, this.matchTick, -1);
    }
  }

  /**
   * Initiates the 3-second countdown before match start (callable manually by host or automatically)
   * @param {number} [countdownSeconds=3]
   */
  triggerStartCountdown(countdownSeconds = 3) {
    if (this.state !== MATCH_STATES.LOBBY) return;
    this.state = MATCH_STATES.COUNTDOWN;
    // 3 seconds @ 120Hz = 360 frames
    this.startCountdownTicks = Math.round(countdownSeconds * 120);
  }

  /**
   * Executes match start sequence:
   * - Frame 0: MATCH_STARTED (Physics tick resets to 0, replay recording starts)
   * - Frame 1: KICKOFF_WILL_BEGIN (announces kickoffWillStartAt: 361)
   */
  startMatch() {
    this.state = MATCH_STATES.KICKOFF;
    this.matchTick = 0;
    this.clockSecondsRemaining = 300;
    this.replaySignalLog = [];
    this.activeSignals.clear();

    // Reset physics arena kickoff positioning
    if (this.physicsManager) {
      this.physicsManager.resetKickoff(0);
    }

    // Dispatch Frame 0: MATCH_STARTED
    this.dispatchSignal(MATCH_SIGNALS.MATCH_STARTED, 0, 0, 0);

    // Prepare Frame 1: KICKOFF_WILL_BEGIN
    this.kickoffWillStartAt = 361; // 360 ticks countdown (~3.0 seconds) + 1
    this.dispatchSignal(MATCH_SIGNALS.KICKOFF_WILL_START, 1, this.kickoffWillStartAt, 0);

    // Apply input masking until frame 361
    if (this.physicsManager) {
      this.physicsManager.setInputMask(true, this.kickoffWillStartAt);
    }
  }

  /**
   * Dispatches a match signal:
   * - Records once into replaySignalLog
   * - Sets into activeSignals for redundant UDP transmission
   * @param {number} signalType MATCH_SIGNALS constant
   * @param {number} frameId
   * @param {number} [param1=0]
   * @param {number} [param2=0]
   */
  dispatchSignal(signalType, frameId, param1 = 0, param2 = 0) {
    const signalObj = { signalType, frameId, param1, param2 };
    // Replay log receives the signal once
    this.replaySignalLog.push({ ...signalObj, recordedAt: Date.now() });
    // Active signals map holds signal for redundant UDP broadcast
    this.activeSignals.set(signalType, signalObj);
  }

  /**
   * Toggles match pause
   * @param {boolean} pause
   */
  setPaused(pause) {
    if (this.state !== MATCH_STATES.PLAYING && this.state !== MATCH_STATES.PAUSED) return;
    this.state = pause ? MATCH_STATES.PAUSED : MATCH_STATES.PLAYING;
    if (this.physicsManager) {
      this.physicsManager.isPaused = pause;
    }
    this.dispatchSignal(
      pause ? MATCH_SIGNALS.MATCH_PAUSED : MATCH_SIGNALS.MATCH_UNPAUSED,
      this.matchTick
    );
  }

  /**
   * Step the match frame (120Hz tick).
   * Orchestrates physics step, input masking, signal lifecycle, and RTT interval aggregation.
   * @returns {Uint8Array} Pre-encoded GlobalPayload Uint8Array
   */
  stepFrame() {
    // Check countdown before match start
    if (this.state === MATCH_STATES.COUNTDOWN) {
      this.startCountdownTicks--;
      if (this.startCountdownTicks <= 0) {
        this.startMatch();
      }
      return new Uint8Array(0);
    }

    if (this.state === MATCH_STATES.LOBBY) {
      return new Uint8Array(0);
    }

    // Step physics engine manager
    let physicsSnapshot = null;
    if (this.physicsManager) {
      physicsSnapshot = this.physicsManager.stepAuthoritativeTick();
      this.matchTick = physicsSnapshot.tick;
      if (physicsSnapshot.goalScored) {
        this.dispatchSignal(MATCH_SIGNALS.BALL_RESET, this.matchTick, physicsSnapshot.goalTeam ?? physicsSnapshot.scoringTeam ?? 0, 0);
      }
    } else {
      this.matchTick++;
    }

    // Kickoff arrival check
    if (this.state === MATCH_STATES.KICKOFF) {
      if (this.matchTick >= this.kickoffWillStartAt && this.kickoffWillStartAt > 0) {
        this.state = MATCH_STATES.PLAYING;
        // Kickoff countdown finished: remove redundant KICKOFF_WILL_START signal
        this.activeSignals.delete(MATCH_SIGNALS.KICKOFF_WILL_START);
        this.dispatchSignal(MATCH_SIGNALS.KICKOFF_START, this.matchTick);
        this.kickoffWillStartAt = -1;
      }
    }

    // Decoupled Match Clock: update seconds remaining every 120 ticks
    if (this.state === MATCH_STATES.PLAYING && (this.matchTick % 120 === 0) && this.clockSecondsRemaining > 0) {
      this.clockSecondsRemaining--;
      this.dispatchSignal(
        MATCH_SIGNALS.CLOCK_UPDATED_SECONDS,
        this.matchTick,
        this.clockSecondsRemaining
      );
    }

    // 5-Second All-User RTT Interval Evaluation (every 600 ticks)
    let allUserRttData = null;
    if (this.matchTick - this.lastRttBroadcastTick >= this.rttIntervalTicks) {
      this.lastRttBroadcastTick = this.matchTick;
      allUserRttData = this.collectAllUserRtt();
    }

    // Active signals array for redundant packing
    const signalsList = Array.from(this.activeSignals.values());

    // Build GlobalPayload
    const globalPayloadBytes = GlobalPayloadCodec.encode({
      physics: physicsSnapshot ? {
        tick: this.matchTick,
        stateSnapshot: physicsSnapshot.stateSnapshot,
        acknowledgedControls: physicsSnapshot.acknowledgedControls
      } : null,
      signals: signalsList,
      allUserRtt: allUserRttData
    });

    // Clean up one-shot signals (keep persistent signals like KICKOFF_WILL_START during countdown)
    for (const [sType, sObj] of this.activeSignals.entries()) {
      if (sType !== MATCH_SIGNALS.KICKOFF_WILL_START) {
        this.activeSignals.delete(sType);
      }
    }

    return globalPayloadBytes;
  }

  /**
   * Collects RTT data for all 6 player slots and spectators from EstablishedSessionManager
   * @returns {{ players: number[], spectators: Array<{ id: number, rtt: number }> }}
   */
  collectAllUserRtt() {
    const playersRtt = [null, null, null, null, null, null];
    const spectatorsRtt = [];

    if (!this.sessionManager) {
      return { players: playersRtt, spectators: spectatorsRtt };
    }

    const sessions = this.sessionManager.getAllSessions();
    for (const session of sessions) {
      if (session.role === 'player' && session.entityId >= 0 && session.entityId < 6) {
        playersRtt[session.entityId] = Math.round(session.rttMs || 0);
      } else if (session.role === 'spectator') {
        spectatorsRtt.push({
          id: spectatorsRtt.length,
          rtt: Math.round(session.rttMs || 0)
        });
      }
    }

    return {
      players: playersRtt,
      spectators: spectatorsRtt
    };
  }

  /**
   * Starts multiplayer training mode directly:
   * Sets match state to PLAYING, tick to 0, and unmasks inputs so players can immediately drive and interact.
   */
  startTrainingMode() {
    this.state = MATCH_STATES.PLAYING;
    this.matchTick = 0;
    this.clockSecondsRemaining = 300;
    this.replaySignalLog = [];
    this.activeSignals.clear();

    if (this.physicsManager) {
      this.physicsManager.setInputMask(false);
      this.physicsManager.isPaused = false;
    }
  }

  /**
   * Evaluates unknown or control packets received by NetworkDataHandler
   * @param {string} channelId
   * @param {string} packetType
   * @param {any} packetData
   * @returns {any}
   */
  evaluateUnknownPacket(channelId, packetType, packetData) {
    if (!packetData) return null;
    const type = packetData.type || packetType;

    if (type === "join" || type === "join_training" || type === "token" || type === "handshake_request") {
      const playerName = packetData.playerName || packetData.clientName || "Player";
      const role = packetData.role || "player";
      const preferredTeam = packetData.preferredTeam ?? null;
      const playerInfo = this.assignPlayerSlot(channelId, playerName, role, preferredTeam);

      // Reply with handshake confirmation including initial snapshot and serverFrame
      if (this.dataHandler) {
        const initialSnap = this.physicsManager?.sim?.saveState ? Array.from(this.physicsManager.sim.saveState()) : null;
        this.dataHandler.sendPacket(channelId, JSON.stringify({
          type: "handshake_response",
          entityId: playerInfo.entityId,
          team: playerInfo.team,
          spawnSlot: playerInfo.spawnSlot,
          roomId: this.roomId,
          matchTick: this.matchTick,
          serverFrame: this.matchTick,
          initialSnapshot: initialSnap,
          state: this.state,
          isHost: false
        }));
      }
      return playerInfo;
    }

    if (type === "color_change") {
      if (this.dataHandler) {
        this.dataHandler.broadcast(JSON.stringify(packetData), (id) => id !== channelId);
      }
      return null;
    }

    if (type === "ping") {
      if (typeof packetData.rtt === 'number') {
        const session = this.sessionManager?.getSession(channelId);
        if (session) {
          session.updateRtt(packetData.rtt);
        }
      }
      if (this.dataHandler) {
        this.dataHandler.sendPacket(channelId, JSON.stringify({
          type: "pong",
          sendTime: packetData.sendTime || Date.now(),
          serverTime: Date.now()
        }));
      }
      return null;
    }

    if (type === "leave") {
      this.removePlayerSession(channelId);
      return null;
    }

    return null;
  }

  destroy() {
    this.players.clear();
    this.spectators.clear();
    this.activeSignals.clear();
    this.replaySignalLog = [];
  }
}

// Architectural Aliases to avoid any naming ambiguity
