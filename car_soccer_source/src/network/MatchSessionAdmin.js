import { MATCH_SIGNALS } from './GlobalPayloadCodec.js';
import { formatMatchTime } from '../utils/AssetResponseValidator.js';
import {
  MATCH_STATES, KICKOFF_SPAWN_PRESETS, assignSessionPlayerSlot, removeSessionPlayerSlot,
  updatePlayerLoadout, switchPlayerRoleOrTeam, collectSessionUserRtt, evaluateControlPacket,
  encodeVisualIdIndex, decodeVisualIdIndex, encodeHitboxIdIndex, decodeHitboxIdIndex,
  packLoadoutSignalParam2, unpackLoadoutSignalParam2, packLoadoutCommandParam1, unpackLoadoutCommandParam1
} from './MatchRosterCoordinator.js';
import {
  getExpectedAckPeerIds, dispatchMatchSignal, handleClientSignalAcks, handleClientCommands,
  handleClientCommand, checkSkipReplayVotes, checkRematchReady, initiateMatchPrepare, checkArenaLoadedBarrier
} from './MatchCommandCoordinator.js';
import {
  ReplayRingBuffer, REPLAY_BUFFER_MODES, COUNTUP_REPLAY_DURATION_SECONDS, COUNTUP_REPLAY_CAPACITY_TICKS,
  COUNTDOWN_REPLAY_DURATION_SECONDS, COUNTDOWN_REPLAY_CAPACITY_TICKS
} from '../replay/ReplayRingBuffer.js';
import {
  MATCH_TICK_RATE, DEFAULT_MATCH_DURATION_SECONDS, KICKOFF_COUNTDOWN_SECONDS, KICKOFF_TOTAL_TICKS,
  GOAL_CELEBRATION_TICKS, GOAL_REPLAY_DURATION_TICKS, PAUSE_RESUME_COUNTDOWN_TICKS, DEFAULT_MAX_OVERTIME_SECONDS,
  applyPendingHitboxSwaps, resolvePossessionWinner, beginMatchGoalReplay, finishMatchGoalReplay,
  stepMatchSessionFrame, encodeMatchFramePacket
} from './MatchLifecycleStepRunner.js';

import {
  MATCH_MODES, MATCH_PHASES, DEFAULT_MATCH_STATE, ClientMatchStateMirror
} from './ClientMatchStateMirror.js';

export {
  MATCH_STATES, KICKOFF_SPAWN_PRESETS, formatMatchTime, encodeVisualIdIndex, decodeVisualIdIndex,
  encodeHitboxIdIndex, decodeHitboxIdIndex, packLoadoutSignalParam2, unpackLoadoutSignalParam2,
  packLoadoutCommandParam1, unpackLoadoutCommandParam1, ReplayRingBuffer, REPLAY_BUFFER_MODES,
  COUNTUP_REPLAY_DURATION_SECONDS, COUNTUP_REPLAY_CAPACITY_TICKS, COUNTDOWN_REPLAY_DURATION_SECONDS,
  COUNTDOWN_REPLAY_CAPACITY_TICKS, MATCH_TICK_RATE, DEFAULT_MATCH_DURATION_SECONDS, KICKOFF_COUNTDOWN_SECONDS,
  KICKOFF_TOTAL_TICKS, GOAL_CELEBRATION_TICKS, GOAL_REPLAY_DURATION_TICKS, PAUSE_RESUME_COUNTDOWN_TICKS,
  DEFAULT_MAX_OVERTIME_SECONDS, MATCH_MODES, MATCH_PHASES, DEFAULT_MATCH_STATE, ClientMatchStateMirror
};

export class MatchSessionAdmin {
  constructor(options = {}) {
    this.roomId = options.roomId || `room_${Math.random().toString(36).slice(2, 8)}`;
    this.password = options.password || '';
    this.gameMode = options.gameMode || '3v3';
    this.botFillMode = options.botFillMode || 'no_bots'; // 'no_bots' | 'auto_fill' | 'bots_vs_humans'
    this.isHost = options.isHost ?? true;

    this.physicsManager = options.physicsManager;
    this.sessionManager = options.sessionManager;
    this.dataHandler = options.dataHandler || null;

    this.lobbyMode = Boolean(options.lobbyMode);
    this.isTrainingMode = options.isTrainingMode ?? this.lobbyMode;

    this.maxPlayers = this.gameMode === '1v1' ? 2 : (this.gameMode === '2v2' ? 4 : 6);
    this.autoStartWhenFull = options.autoStartWhenFull ?? !this.lobbyMode;
    this.skipReplayByDefault = options.skipReplayByDefault !== undefined ? Boolean(options.skipReplayByDefault) : true;

    this.state = MATCH_STATES.LOBBY;
    this.matchTick = 0;
    this.clockDuration = options.matchDurationSeconds ?? options.durationSeconds ?? options.clockDuration ?? DEFAULT_MATCH_DURATION_SECONDS;
    this.clockSecondsRemaining = this.clockDuration;
    this.isOvertime = false;
    this.overtimeSeconds = 0;
    this.maxOvertimeSeconds = options.maxOvertimeSeconds ?? DEFAULT_MAX_OVERTIME_SECONDS;
    this.blueScore = 0;
    this.orangeScore = 0;
    this.winner = null;
    this.winReason = 0; // 0: score, 1: possession tie-break, 2: forfeit

    this.players = new Map();
    this.spectators = new Map();
    this.activeSignals = new Map();
    this.replaySignalLog = [];
    this._currentFrameSignals = [];
    this.replayBuffer = new ReplayRingBuffer({
      mode: options.isTrainingMode ? REPLAY_BUFFER_MODES.COUNTUP_FIFO : REPLAY_BUFFER_MODES.COUNTDOWN_MATCH,
      capacityTicks: options.replayCapacityTicks
    });
    this.nextSignalId = 0;
    this.matchSequence = 0;

    this.processedClientCommands = new Map(); // sessionId -> Set<number>
    this.skipReplayVotes = new Set();
    this.rematchVotes = new Set();
    this.forfeitVotes = new Set();

    this.rttIntervalTicks = 600;
    this.lastRttBroadcastTick = -600;
    this.cachedAllUserRtt = null;

    this.kickoffWillStartAt = -1;
    this.kickoffStartedAtTick = -1;
    this.clockStarted = false;
    this.requireTouchToStartClock = options.requireTouchToStartClock ?? true;
    this.goalBufferTicks = -1;
    this.replayTicksRemaining = -1;
    this.startCountdownTicks = -1;
    this.prepareTimeoutTicks = -1;
    this.willResumeUntilTick = -1;
  }

  get matchState() { return this.state; }
  set matchState(v) { this.state = v; }
  get hasFirstTouchOccurred() { return this.clockStarted; }
  set hasFirstTouchOccurred(v) { this.clockStarted = Boolean(v); }
  get overtimeSecondsElapsed() { return this.overtimeSeconds; }
  set overtimeSecondsElapsed(v) { this.overtimeSeconds = v; }

  assignPlayerSlot(sessionId, playerName = 'Player', role = 'player', preferredTeam = null, loadoutOptions = {}, colorSlot = null) {
    return assignSessionPlayerSlot(this, sessionId, playerName, role, preferredTeam, loadoutOptions, colorSlot);
  }

  removePlayerSession(sessionId) {
    removeSessionPlayerSlot(this, sessionId);
  }

  updatePlayerLoadout(sessionId, visualIdOrIndex, colorSlot = null, hitboxIdOrIndex = null) {
    return updatePlayerLoadout(this, sessionId, visualIdOrIndex, colorSlot, hitboxIdOrIndex);
  }

  switchPlayerRoleOrTeam(sessionId, role, team) {
    return switchPlayerRoleOrTeam(this, sessionId, role, team);
  }

  setGameMode(gameMode, durationSeconds = null) {
    if (gameMode === '1v1' || gameMode === '2v2' || gameMode === '3v3') {
      this.gameMode = gameMode;
      this.maxPlayers = gameMode === '1v1' ? 2 : (this.gameMode === '2v2' ? 4 : 6);
    }
    if (typeof durationSeconds === 'number' && durationSeconds > 0) {
      this.clockDuration = durationSeconds;
      if (this.state === MATCH_STATES.LOBBY) {
        this.clockSecondsRemaining = durationSeconds;
      }
    }
  }

  setBotFillMode(botFillMode = 'no_bots') {
    const valid = ['no_bots', 'auto_fill', 'bots_vs_humans', 'custom'];
    if (valid.includes(botFillMode)) {
      this.botFillMode = botFillMode;
    }
    if (this.botFillMode === 'no_bots' && this.state === MATCH_STATES.LOBBY) {
      for (const [sid, p] of Array.from(this.players.entries())) {
        if (p.isBot && sid !== 'bot') {
          this.removePlayerSession(sid);
        }
      }
    }
  }

  addBotPlayer(preferredTeam = 1, botName = null, visualId = 'octane') {
    if (this.players.size >= 6) return null;
    let botIdx = 1;
    while (this.players.has(`bot_${botIdx}`)) {
      botIdx++;
    }
    const sid = `bot_${botIdx}`;
    const resolvedName = botName || `Bot ${botIdx}`;
    return this.assignPlayerSlot(sid, resolvedName, 'player', preferredTeam, visualId);
  }

  applyBotFillPolicy() {
    const maxPerTeam = Math.max(1, Math.floor(this.maxPlayers / 2));
    if (this.botFillMode === 'no_bots') {
      for (const [sid, p] of Array.from(this.players.entries())) {
        if (p.isBot && sid !== 'bot') {
          this.removePlayerSession(sid);
        }
      }
      return;
    }

    if (this.botFillMode === 'custom') {
      return;
    }

    // Remove previously auto-filled bots before recomputing team balance
    for (const [sid, p] of Array.from(this.players.entries())) {
      if (p.isBot && String(sid).startsWith('bot_fill_')) {
        this.removePlayerSession(sid);
      }
    }

    if (this.botFillMode === 'bots_vs_humans') {
      // Place all humans on Team 0 (Blue) up to maxPerTeam, and fill Team 1 (Orange) with Bots
      for (const [sid, p] of Array.from(this.players.entries())) {
        if (!p.isBot && p.team !== 0) {
          this.switchPlayerRoleOrTeam(sid, 'player', 0);
        }
      }
      let orangeCount = 0;
      for (const p of this.players.values()) {
        if (p.team === 1) orangeCount++;
      }
      let fillSeq = 1;
      while (orangeCount < maxPerTeam && this.players.size < this.maxPlayers) {
        const sid = `bot_fill_${fillSeq++}`;
        this.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 1, 'octane');
        orangeCount++;
      }
      return;
    }

    if (this.botFillMode === 'auto_fill') {
      let blueCount = 0;
      let orangeCount = 0;
      for (const p of this.players.values()) {
        if (p.team === 0) blueCount++;
        else if (p.team === 1) orangeCount++;
      }
      let fillSeq = 1;
      while (blueCount < maxPerTeam && this.players.size < this.maxPlayers) {
        const sid = `bot_fill_${fillSeq++}`;
        this.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 0, 'octane');
        blueCount++;
      }
      while (orangeCount < maxPerTeam && this.players.size < this.maxPlayers) {
        const sid = `bot_fill_${fillSeq++}`;
        this.assignPlayerSlot(sid, `Bot ${fillSeq - 1}`, 'player', 1, 'octane');
        orangeCount++;
      }
    }
  }

  initiateMatchPrepare(durationSeconds = null, timeoutTicks = 240) {
    this.lobbyPhysicsActive = false;
    this.applyBotFillPolicy();
    this.physicsManager?.sim?.setUnlimitedBoost?.(false);
    this.physicsManager?.restoreSolidCollisions?.();
    initiateMatchPrepare(this, durationSeconds, timeoutTicks);
  }

  checkArenaLoadedBarrier() {
    return checkArenaLoadedBarrier(this);
  }

  triggerStartCountdown(countdownSeconds = 3) {
    if (this.state !== MATCH_STATES.LOBBY) return;
    this.state = MATCH_STATES.COUNTDOWN;
    this.startCountdownTicks = Math.round(countdownSeconds * 120);
  }

  forceStartMatch(durationSeconds = null) {
    if (typeof durationSeconds === 'number' && durationSeconds > 0) {
      this.clockDuration = durationSeconds;
    }
    this.applyBotFillPolicy();
    let hasRemoteHuman = false;
    for (const [sid, p] of this.players.entries()) {
      if (!p.isBot && sid !== 'host') {
        hasRemoteHuman = true;
        break;
      }
    }
    if (hasRemoteHuman && this.state === MATCH_STATES.LOBBY) {
      this.initiateMatchPrepare(this.clockDuration, 120);
    } else {
      this.startMatch(this.clockDuration);
    }
  }

  startMatch(durationSeconds) {
    this.isTrainingMode = false;
    this.lobbyPhysicsActive = false;
    this.applyBotFillPolicy();
    this.state = MATCH_STATES.KICKOFF;
    this.matchTick = 0;
    this.clockDuration = durationSeconds ?? this.clockDuration ?? DEFAULT_MATCH_DURATION_SECONDS;
    this.clockSecondsRemaining = this.clockDuration;
    this.isOvertime = false;
    this.overtimeSeconds = 0;
    this.blueScore = 0;
    this.orangeScore = 0;
    this.winner = null;
    this.winReason = 0;
    this.replaySignalLog = [];
    this._currentFrameSignals = [];
    this.replayBuffer?.configureMode(REPLAY_BUFFER_MODES.COUNTDOWN_MATCH);
    this.activeSignals.clear();
    this.skipReplayVotes.clear();
    this.rematchVotes.clear();
    this.forfeitVotes.clear();

    if (this.physicsManager) {
      this.physicsManager.isPaused = false;
      this.physicsManager.sim?.setUnlimitedBoost?.(false);
      this.physicsManager.restoreSolidCollisions?.();
      this.physicsManager.resetKickoff(0);
      this.matchTick = this.physicsManager.currentTick;
    }

    this.dispatchSignal(MATCH_SIGNALS.MATCH_STARTED, this.matchTick, this.clockSecondsRemaining, 0);
    this.dispatchSignal(MATCH_SIGNALS.SCORE_UPDATED, this.matchTick, this.blueScore, this.orangeScore);

    this.startKickoffSequence(KICKOFF_TOTAL_TICKS);
  }

  enterLobbyMode(options = {}) {
    this.isTrainingMode = true;
    this.state = MATCH_STATES.LOBBY;
    this.lobbyPhysicsActive = options.lobbyPhysicsActive !== undefined ? Boolean(options.lobbyPhysicsActive) : true;
    this.replayBuffer?.configureMode(REPLAY_BUFFER_MODES.COUNTUP_FIFO);
    if (this.physicsManager) {
      this.physicsManager.setInputMask(false);
      this.physicsManager.isPaused = false;
      this.physicsManager.sim?.setUnlimitedBoost?.(true);
      this.physicsManager.setLobbyGhostMode(options.ghostCars !== false, {
        mode: options.mode || options.ghostMode || 'ghost_passthrough',
        hostCarIndex: options.hostCarIndex ?? 0,
        hostInteractsWithBall: options.hostInteractsWithBall ?? true,
        broadcastHostOnly: options.broadcastHostOnly ?? false,
        ghostOpacity: options.ghostOpacity ?? options.opacity ?? 0.70,
        ...options
      });
    }
    return this.state;
  }

  setGhostCarConfig(carIndex, interactWithBall = false, interactWithCars = false, opacity = undefined) {
    return this.physicsManager?.setCarCollisionMask?.(carIndex, interactWithBall, interactWithCars, opacity) || null;
  }

  getCarCollisionConfig(carIndex) {
    return this.physicsManager?.lobbyGhostCoordinator?.getCarGhostState?.(carIndex) || {
      carIndex,
      interactWithBall: true,
      interactWithCars: true,
      isGhost: false,
      opacity: 1.0
    };
  }

  _applyPendingHitboxSwaps() {
    applyPendingHitboxSwaps(this);
  }

  resetTrainingPlay() {
    this.state = MATCH_STATES.PLAYING;
    this.goalBufferTicks = -1;
    this.replayTicksRemaining = -1;
    this.kickoffWillStartAt = -1;

    if (this.physicsManager) {
      this._applyPendingHitboxSwaps();
      this.physicsManager.resetKickoff(0);
      this.physicsManager.setInputMask(false);
      this.matchTick = this.physicsManager.currentTick;
    }

    this.dispatchSignal(MATCH_SIGNALS.BALL_RESET, this.matchTick, 0, 0);
  }

  startKickoffSequence(countdownTicks = KICKOFF_TOTAL_TICKS) {
    this.state = MATCH_STATES.KICKOFF;
    this.goalBufferTicks = -1;
    this.replayTicksRemaining = -1;
    this.skipReplayVotes.clear();
    this.clockStarted = !this.requireTouchToStartClock;
    this.kickoffStartedAtTick = -1;

    if (this.physicsManager) {
      this._applyPendingHitboxSwaps();
      this.physicsManager.resetKickoff(0);
      this.matchTick = this.physicsManager.currentTick;
    }

    this.kickoffWillStartAt = this.matchTick + countdownTicks;
    this.dispatchSignal(MATCH_SIGNALS.KICKOFF_WILL_START, this.matchTick, this.kickoffWillStartAt, 0);

    if (this.physicsManager) {
      this.physicsManager.applySignal(MATCH_SIGNALS.KICKOFF_WILL_START, {
        kickoffWillStartAt: this.kickoffWillStartAt
      });
    }
  }

  getExpectedAckPeerIds() {
    return getExpectedAckPeerIds(this);
  }

  dispatchSignal(signalType, frameId, param1 = 0, param2 = 0) {
    return dispatchMatchSignal(this, signalType, frameId, param1, param2);
  }

  handleClientSignalAcks(sessionId, acks = []) {
    handleClientSignalAcks(this, sessionId, acks);
  }

  handleClientCommands(sessionId, commands = []) {
    handleClientCommands(this, sessionId, commands);
  }

  handleClientCommand(sessionId, cmd) {
    handleClientCommand(this, sessionId, cmd);
  }

  _checkSkipReplayVotes() {
    checkSkipReplayVotes(this);
  }

  _checkRematchReady() {
    checkRematchReady(this);
  }

  setPaused(pause) {
    if (this.state !== MATCH_STATES.PLAYING && this.state !== MATCH_STATES.PAUSED) return;
    this.state = pause ? MATCH_STATES.PAUSED : MATCH_STATES.PLAYING;
    this.willResumeUntilTick = -1;
    if (this.physicsManager) {
      this.physicsManager.applySignal(
        pause ? MATCH_SIGNALS.MATCH_PAUSED : MATCH_SIGNALS.MATCH_RESUMED,
        { paused: pause }
      );
    }
    this.dispatchSignal(
      pause ? MATCH_SIGNALS.MATCH_PAUSED : MATCH_SIGNALS.MATCH_RESUMED,
      this.matchTick
    );
  }

  requestResumeWithCountdown(countdownSeconds = 5) {
    if (this.state !== MATCH_STATES.PAUSED) return;
    const resumeTicks = Math.max(1, Math.round(countdownSeconds * 120));
    this.willResumeUntilTick = this.matchTick + resumeTicks;
    if (this.physicsManager) {
      this.physicsManager.applySignal(MATCH_SIGNALS.MATCH_WILL_RESUME, {
        targetResumeTick: this.willResumeUntilTick
      });
    }
    this.dispatchSignal(MATCH_SIGNALS.MATCH_WILL_RESUME, this.matchTick, this.willResumeUntilTick, countdownSeconds);
  }

  beginGoalReplay() {
    beginMatchGoalReplay(this, GOAL_REPLAY_DURATION_TICKS);
  }

  finishGoalReplay() {
    finishMatchGoalReplay(this, KICKOFF_TOTAL_TICKS);
  }

  resolvePossessionWinner() {
    return resolvePossessionWinner(this);
  }

  endMatch(forcedWinner = null, winReason = 0) {
    this.state = MATCH_STATES.PODIUM;
    let winner = forcedWinner;
    if (winner === null || winner === undefined) {
      winner = this.blueScore > this.orangeScore ? 0 : (this.orangeScore > this.blueScore ? 1 : 2);
    }
    this.winner = winner;
    this.winReason = winReason;
    if (this.physicsManager) {
      this.physicsManager.applySignal(MATCH_SIGNALS.PODIUM_START, { winner, winReason });
    }
    this.activeSignals.delete(MATCH_SIGNALS.KICKOFF_WILL_START);
    this.activeSignals.delete(MATCH_SIGNALS.SCORE_UPDATED);
    this.activeSignals.delete(MATCH_SIGNALS.GOAL_REPLAY_WILL_START);
    if (this.sessionManager?.signalBuffer?.retireByType) {
      this.sessionManager.signalBuffer.retireByType(MATCH_SIGNALS.KICKOFF_WILL_START);
      this.sessionManager.signalBuffer.retireByType(MATCH_SIGNALS.SCORE_UPDATED);
      this.sessionManager.signalBuffer.retireByType(MATCH_SIGNALS.GOAL_REPLAY_WILL_START);
    }
    this.dispatchSignal(MATCH_SIGNALS.MATCH_ENDED, this.matchTick, winner, winReason);
    this.dispatchSignal(MATCH_SIGNALS.PODIUM_START, this.matchTick, winner, winReason);
  }

  stepFrame() {
    return stepMatchSessionFrame(this, {
      GOAL_CELEBRATION_TICKS,
      KICKOFF_TOTAL_TICKS
    });
  }

  _encodeFramePacket(physicsSnapshot) {
    return encodeMatchFramePacket(this, physicsSnapshot);
  }

  collectAllUserRtt() {
    return collectSessionUserRtt(this.sessionManager);
  }

  startTrainingMode() {
    this.isTrainingMode = true;
    this.state = MATCH_STATES.PLAYING;
    this.matchTick = 0;
    this.trainingSeconds = 0;
    this.clockSecondsRemaining = 0;
    this.clockStarted = true;
    this.replaySignalLog = [];
    this._currentFrameSignals = [];
    this.replayBuffer?.configureMode(REPLAY_BUFFER_MODES.COUNTUP_FIFO);
    this.activeSignals.clear();

    if (this.physicsManager) {
      this.physicsManager.setInputMask(false);
      this.physicsManager.isPaused = false;
    }
  }

  evaluateUnknownPacket(channelId, packetType, packetData) {
    return evaluateControlPacket(this, channelId, packetType, packetData);
  }

  destroy() {
    this.dispatchSignal(MATCH_SIGNALS.MATCH_DESTROYED, this.matchTick, 0, 0);
    if (this.dataHandler && typeof this.dataHandler.dispatchFrameToSessions === 'function') {
      try {
        const finalBytes = this._encodeFramePacket(null);
        if (finalBytes && finalBytes.length > 0) {
          this.dataHandler.dispatchFrameToSessions(finalBytes);
        }
      } catch (err) {
        console.warn('[MatchSessionAdmin] Failed to flush MATCH_DESTROYED packet on destroy:', err);
      }
    }
    this.players.clear();
    this.spectators.clear();
    this.activeSignals.clear();
    this.processedClientCommands.clear();
    this.skipReplayVotes.clear();
    this.rematchVotes.clear();
    this.forfeitVotes.clear();
    this.replaySignalLog = [];
    this._currentFrameSignals = [];
    this.replayBuffer?.clear();
  }
}

