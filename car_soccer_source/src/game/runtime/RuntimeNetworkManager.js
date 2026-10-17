import { HostServerWorker } from '../../network/HostServerWorker.js';
import { PredictionReconciler } from '../../network/PredictionReconciler.js';
import { CLIENT_COMMAND_TYPES } from '../../network/GlobalPayloadCodec.js';
import { packLoadoutCommandParam1 } from '../../network/MatchRosterCoordinator.js';
import { LobbyGhostCarCoordinator, DEFAULT_GHOST_OPACITY } from '../../network/LobbyGhostCarCoordinator.js';
import { useUIStore, networkDiagnosticsStore } from '../../ui-system/index';
import { bindReconcilerSignals, resetRuntimeReconcilerSignalState } from './RuntimeReconcilerSignalHandler.js';
import {
  applyRuntimeRosterSnapshot,
  onRuntimeRemotePlayerConnected,
  removeRuntimeRemotePlayer
} from './RuntimeOnlineRosterSync.js';
import {
  getRuntimePhysicsRate,
  adjustRuntimePhysicsRate,
  setRuntimePhysicsRate,
  setRuntimePhysicsTickScale,
  resetRuntimePhysicsRate,
  dropRuntimePacketBurst,
  dumpRuntimeNextNetworkPacket,
  dumpRuntimeLatestNetworkPacket,
  adjustRuntimeSimulatedLatency,
  adjustRuntimeNetworkLatency,
  spawnRuntimeHeadlessCarEntity,
  enableRuntimeDeterminismHarness,
  spawnRuntimeDiagnosticTestFleet,
  despawnRuntimeDiagnosticTestFleet,
  toggleRuntimeDiagnosticTestFleet,
  setRuntimeDiagnosticObservationTarget,
  configureRuntimeLobbyGhostMode,
  applyRuntimeCarGhostCollision
} from './RuntimeNetworkDiagnosticsHelper.js';

export class RuntimeNetworkManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.lobbyGhostCoordinator = new LobbyGhostCarCoordinator();
  }

  _bindReconcilerSignals(reconciler) {
    bindReconcilerSignals(this.runtime, reconciler);
  }

  setLobbyGhostMode(enabled = true, optionsOrInteractWithBall = {}) {
    return configureRuntimeLobbyGhostMode(this.runtime, this.lobbyGhostCoordinator, enabled, optionsOrInteractWithBall);
  }

  setCarGhostCollision(carIndex, interactWithBall = false, interactWithCars = false, opacity = DEFAULT_GHOST_OPACITY) {
    return applyRuntimeCarGhostCollision(this.runtime, this.lobbyGhostCoordinator, carIndex, interactWithBall, interactWithCars, opacity);
  }

  async enableNetworkPrediction(showHUD = true, options = {}) {
    const r = this.runtime;
    if (!r.networkReconciler) {
      const hostVisualId = r.selectedPreset || 'octane';
      r.authoritativeServer = new HostServerWorker(null, {
        snapshotInterval: 1,
        hostVisualId
      });
      await r.authoritativeServer.init();
      r.networkChannel = r.authoritativeServer.channel;
      const initialExtraLatency = networkDiagnosticsStore?.getSnapshot?.()?.metrics?.extraLatencyMs ?? 0;
      if (initialExtraLatency > 0 && r.networkChannel) {
        if (typeof r.networkChannel.setExtraLatency === 'function') {
          r.networkChannel.setExtraLatency(initialExtraLatency);
        } else {
          r.networkChannel.extraLatencyMs = initialExtraLatency;
        }
      }

      r.authoritativeServer.sim.setUnlimitedBoost(r.physics.isUnlimitedBoost);
      r.authoritativeServer.sim.restoreState(r.physics.saveCompactState());

      const serverSnap = r.authoritativeServer.sim.saveCompactState();
      const serverTick = Math.floor(r.authoritativeServer.sim.getHeaderView().tickCount);

      const pacingMode = useUIStore?.getState?.()?.clockPacingMode || 'legacy';
      const inputBufferTarget = useUIStore?.getState?.()?.inputBufferTarget ?? 3;
      const inputBufferThreshold = useUIStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
      r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
        localCarIndex: r.playerCarIndex,
        redundantHistoryCount: options.redundantHistoryCount ?? 10,
        enableRedundantInputs: options.enableRedundantInputs ?? true,
        useBitPacking: options.useBitPacking ?? false,
        interpolator: r.interpolator,
        clockPacingMode: pacingMode,
        inputBufferTarget: inputBufferTarget,
        catchupThresholdOffset: inputBufferThreshold[0],
        skipThresholdOffset: inputBufferThreshold[1]
      });
      r.networkReconciler.setCarVisualPreset(r.playerCarIndex, hostVisualId);
      this._bindReconcilerSignals(r.networkReconciler);
      r.networkReconciler.syncTimeline(serverSnap, serverTick);
      r.onSessionReady?.(r.networkReconciler, r.networkChannel);
    }
    if (showHUD) {
      r.onShowNetworkHUD?.();
    }
    return r.networkReconciler;
  }

  cleanupOnlineSession() {
    const r = this.runtime;
    r.isBotMatch = false;
    r.remotePeerCarMap?.clear?.();
    resetRuntimeReconcilerSignalState(r);
    this.setLobbyGhostMode(false);
    if (r.authoritativeServer) {
      try {
        r.authoritativeServer.destroy?.();
      } catch (err) {
        console.warn('[GameRuntime] Error destroying authoritative server:', err);
      }
      r.authoritativeServer = null;
    }
    if (r.networkChannel) {
      try {
        r.networkChannel.destroy?.();
      } catch (err) {
        console.warn('[GameRuntime] Error destroying network channel:', err);
      }
      r.networkChannel = null;
    }
    if (r.networkReconciler) {
      r.networkReconciler = null;
    }
    r.playerCarIndex = 0;
  }

  async stopOnlineServer() {
    const r = this.runtime;
    this.cleanupOnlineSession();
    if (r.arena?.cars) {
      for (let i = 1; i < r.arena.cars.length; i++) {
        if (r.arena.cars[i]) r.arena.cars[i].visible = false;
      }
    }
    if (r.physics && r.physics.numCars > 1) {
      r.physics.configureCars(r.selectedPreset || 'octane', false, 0);
    }
    r.resetKickoff();
    if (useUIStore && typeof useUIStore.getState === 'function') {
      useUIStore.getState().setMatchMode('freeplay');
      useUIStore.getState().setOnlineSession({
        isHosting: false,
        roomId: '',
        signalingConnected: false,
        connectedPeers: []
      });
    }
  }

  async hostOnlineServer(options = {}) {
    const r = this.runtime;
    if (r.authoritativeServer) {
      console.warn('[GameRuntime] Authoritative server already running. Disposing prior instance before hosting.');
      await this.stopOnlineServer();
    }
    r.isBotMatch = false;
    r.remotePeerCarMap = new Map();
    const playerName = options.playerName || 'Host';
    const hostVisualId = options.visualId || r.selectedPreset || 'game-car';
    const hostColorSlot = options.colorSlot ?? (r.selectedColorSlot || 0);
    const uiOnline = useUIStore?.getState?.()?.onlineSession;
    const roomType = options.roomType || uiOnline?.roomType || 'warmup';
    const isMatchLobby = Boolean(options.lobbyMode ?? (roomType === 'match'));
    const gameMode = options.gameMode || uiOnline?.gameMode || (isMatchLobby ? '1v1' : '3v3');
    const botFillMode = options.botFillMode || uiOnline?.botFillMode || 'no_bots';
    const durationSeconds = options.durationSeconds || uiOnline?.matchDurationSeconds || 300;

    if (r.arena?.cars?.[1]) {
      r.arena.cars[1].visible = false;
    }
    if (r.physics && r.physics.numCars > 1) {
      r.physics.configureCars(r.selectedPreset === 'flat-car' ? 'flat' : 'default', false, 0);
      r.physics.resetKickoff();
    }

    // Lobby and Warmup both use unlimited boost until the competitive match starts
    r.physics.setUnlimitedBoost(true);

    const initialSnapshot = r.physics.saveCompactState();
    r.authoritativeServer = new HostServerWorker(null, {
      snapshotInterval: 1,
      initialState: Array.from(initialSnapshot),
      hostPlayerName: playerName,
      hostVisualId,
      hostColorSlot,
      gameMode,
      botFillMode,
      durationSeconds,
      lobbyMode: isMatchLobby,
      roomId: options.roomId || 'local_room'
    });
    await r.authoritativeServer.init();

    r.authoritativeServer.sim.setUnlimitedBoost(true);
    await Promise.resolve(r.authoritativeServer.sim.restoreState(initialSnapshot));
    if (r.arena) {
      r.arena.isLobbyMode = isMatchLobby;
    }
    if (isMatchLobby) {
      this.setLobbyGhostMode(true, { hostInteractsWithBall: true });
    } else {
      this.setLobbyGhostMode(false);
    }

    const initialExtraLatency = networkDiagnosticsStore?.getSnapshot?.()?.metrics?.extraLatencyMs ?? 0;
    r.networkChannel = r.authoritativeServer.channel;
    if (initialExtraLatency > 0 && r.networkChannel) {
      if (typeof r.networkChannel.setExtraLatency === 'function') {
        r.networkChannel.setExtraLatency(initialExtraLatency);
      } else {
        r.networkChannel.extraLatencyMs = initialExtraLatency;
      }
    }
    r.playerCarIndex = 0;

    const serverSnap = r.authoritativeServer.sim.saveCompactState();
    const serverTick = Math.floor(r.authoritativeServer.sim.getHeaderView().tickCount);

    const pacingMode = useUIStore?.getState?.()?.clockPacingMode || 'legacy';
    const inputBufferTarget = useUIStore?.getState?.()?.inputBufferTarget ?? 3;
    const inputBufferThreshold = useUIStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
    r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
      localCarIndex: 0,
      redundantHistoryCount: 10,
      enableRedundantInputs: true,
      useBitPacking: false,
      interpolator: r.interpolator,
      clockPacingMode: pacingMode,
      inputBufferTarget: inputBufferTarget,
      catchupThresholdOffset: inputBufferThreshold[0],
      skipThresholdOffset: inputBufferThreshold[1]
    });
    r.networkReconciler.setCarVisualPreset(0, hostVisualId);
    this._bindReconcilerSignals(r.networkReconciler);
    r.networkReconciler.onHardResync = () => {
      if (r.interpolator) {
        r.interpolator.sync(performance.now());
      }
    };
    r.networkReconciler.syncTimeline(serverSnap, serverTick);

    r.onSessionReady?.(r.networkReconciler, r.networkChannel);

    if (useUIStore && typeof useUIStore.getState === 'function') {
      useUIStore.getState().setMatchMode('online-warmup');
      useUIStore.getState().setOnlineSession({
        isHosting: true,
        roomId: options.roomId || 'local_room',
        playerName: playerName,
        signalingConnected: true,
        roomType,
        gameMode,
        botFillMode,
        matchDurationSeconds: durationSeconds
      });
    }

    return r.authoritativeServer;
  }

  async _applyRosterSnapshot(roster) {
    await applyRuntimeRosterSnapshot(this.runtime, roster);
  }

  async joinOnlineServer(options = {}) {
    const r = this.runtime;
    const { channel, playerName = 'Player 2' } = options;
    const localVisualId = options.visualId || r.selectedPreset || 'octane';
    const localColorSlot = options.colorSlot ?? (r.selectedColorSlot || 0);

    r.isBotMatch = false;
    r.playerCarIndex = 1;
    r.networkChannel = channel;
    r.physics?.setUnlimitedBoost?.(true);

    await r.arena.ensureOpponent();
    if (r.arena.cars[1]) {
      r.arena.cars[1].visible = true;
    }
    if (r.physics.numCars < 2) {
      r.physics.addCar(1, localVisualId);
    } else {
      r.physics.setCarHitbox(1, localVisualId);
    }

    if (r.arena.cars[1]) {
      r.getFlipResetVisual?.(1);
      r.camera.update(r.arena.cars[1], r.arena.ball, 0, r.cameraDynamics);
    }

    if (r.interpolator) {
      r.interpolator.sync(performance.now());
    }

    const clientPacingMode = useUIStore?.getState?.()?.clockPacingMode || 'legacy';
    const inputBufferTarget = useUIStore?.getState?.()?.inputBufferTarget ?? 3;
    const inputBufferThreshold = useUIStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
    r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
      localCarIndex: 1,
      redundantHistoryCount: 10,
      enableRedundantInputs: true,
      useBitPacking: false,
      interpolator: r.interpolator,
      clockPacingMode: clientPacingMode,
      inputBufferTarget: inputBufferTarget,
      catchupThresholdOffset: inputBufferThreshold[0],
      skipThresholdOffset: inputBufferThreshold[1]
    });
    r.networkReconciler.setCarVisualPreset(1, localVisualId);
    this._bindReconcilerSignals(r.networkReconciler);
    r.networkReconciler.onHardResync = () => {
      if (r.interpolator) {
        r.interpolator.sync(performance.now());
      }
    };

    r.networkReconciler.onHandshakeResponse = async (msg) => {
      if (typeof msg.entityId === 'number' && msg.entityId >= 0) {
        r.playerCarIndex = msg.entityId;
        r.networkReconciler.localCarIndex = msg.entityId;
      }
      if (msg.state === 'lobby') {
        r.physics?.setUnlimitedBoost?.(true);
      } else if (msg.state === 'kickoff' || msg.state === 'playing' || msg.state === 'prepare') {
        r.physics?.setUnlimitedBoost?.(false);
      }
      if (msg.roster) {
        await this._applyRosterSnapshot(msg.roster);
      }
      const targetCar = r.arena?.cars?.[r.playerCarIndex];
      if (targetCar) {
        targetCar.visible = true;
        r.getFlipResetVisual?.(r.playerCarIndex);
        r.camera?.update?.(targetCar, r.arena.ball, 0, r.cameraDynamics);
      }
      r.networkReconciler.queueClientCommand(
        CLIENT_COMMAND_TYPES.CMD_SET_LOADOUT,
        packLoadoutCommandParam1(r.selectedPreset || localVisualId, r.selectedHitbox || null),
        r.selectedColorSlot || localColorSlot
      );
    };

    r.onSessionReady?.(r.networkReconciler, r.networkChannel);

    if (r.networkChannel) {
      r.networkChannel.onColorChange = (msg) => {
        const cIdx = msg.carIndex ?? (r.playerCarIndex === 0 ? 1 : 0);
        r.setCarColor(cIdx, msg.hex, false);
      };

      if (typeof r.networkChannel.send === 'function') {
        r.networkChannel.send(JSON.stringify({
          type: 'join',
          playerName: playerName,
          role: 'player',
          preferredTeam: 1,
          visualId: localVisualId,
          colorSlot: localColorSlot
        }));
      }
    }

    if (useUIStore && typeof useUIStore.getState === 'function') {
      useUIStore.getState().setMatchMode('online-warmup');
      useUIStore.getState().setOnlineSession({
        isHosting: false,
        playerName: playerName,
        signalingConnected: true
      });
    }

    return r.networkChannel;
  }

  async onRemotePlayerConnected(channel, remotePlayerName = 'Player 2', assignedCarIndex = null) {
    return onRuntimeRemotePlayerConnected(this.runtime, channel, remotePlayerName, assignedCarIndex);
  }

  forceStartOnlineMatch(durationSeconds = 300) {
    const r = this.runtime;
    if (r.authoritativeServer) {
      r.authoritativeServer.forceStartMatch(durationSeconds);
    } else if (r.networkReconciler) {
      r.networkReconciler.queueClientCommand(CLIENT_COMMAND_TYPES.CMD_READY_ACK, 1, durationSeconds);
    }
  }

  setOnlineGameMode(gameMode = '3v3') {
    const r = this.runtime;
    if (r.authoritativeServer) {
      r.authoritativeServer.setGameMode(gameMode);
    }
    if (useUIStore && typeof useUIStore.getState === 'function') {
      useUIStore.getState().setOnlineSession({ gameMode });
    }
  }

  setOnlineBotFillMode(botFillMode = 'no_bots') {
    const r = this.runtime;
    if (r.authoritativeServer) {
      r.authoritativeServer.setBotFillMode?.(botFillMode);
    }
    if (useUIStore && typeof useUIStore.getState === 'function') {
      useUIStore.getState().setOnlineSession({ botFillMode });
    }
  }

  addOnlineBot(team = 1, botName = null) {
    const r = this.runtime;
    if (r.authoritativeServer) {
      r.authoritativeServer.addBotPlayer?.(team, botName);
    }
  }

  setClientReady(ready = true) {
    const r = this.runtime;
    if (r.networkReconciler) {
      r.networkReconciler.queueClientCommand(CLIENT_COMMAND_TYPES.CMD_READY_ACK, ready ? 1 : 0, 0);
    }
  }

  voteSkipReplay() {
    const r = this.runtime;
    if (r.networkReconciler) {
      r.networkReconciler.queueClientCommand(CLIENT_COMMAND_TYPES.CMD_VOTE_SKIP_REPLAY, 1, 0);
    }
  }

  voteRematch(ready = true) {
    const r = this.runtime;
    if (r.networkReconciler) {
      r.networkReconciler.queueClientCommand(CLIENT_COMMAND_TYPES.CMD_VOTE_REMATCH, ready ? 1 : 0, 0);
    }
  }

  switchOnlineRoleOrTeam(role = 'player', team = 0) {
    const r = this.runtime;
    const roleCode = role === 'spectator' ? 2 : 0;
    if (r.authoritativeServer) {
      r.authoritativeServer.switchRoleTeam('host', role, team);
    } else if (r.networkReconciler) {
      r.networkReconciler.queueClientCommand(CLIENT_COMMAND_TYPES.CMD_SWITCH_ROLE_TEAM, roleCode, team);
    }
  }

  async removeRemotePlayer(carIndex) { await removeRuntimeRemotePlayer(this.runtime, carIndex); }
  getPhysicsRate() { return getRuntimePhysicsRate(this.runtime); }
  adjustPhysicsRate(delta, options) { return adjustRuntimePhysicsRate(this.runtime, delta, options); }
  setPhysicsRate(rate, options) { return setRuntimePhysicsRate(this.runtime, rate, options); }
  setPhysicsTickScale(scale, options) { return setRuntimePhysicsTickScale(this.runtime, scale, options); }
  resetPhysicsRate() { return resetRuntimePhysicsRate(this.runtime); }
  dropPacketBurst(count = null) { dropRuntimePacketBurst(this.runtime, count); }
  dropSinglePacket() { this.dropPacketBurst(1); }
  dumpNextNetworkPacket() { return dumpRuntimeNextNetworkPacket(this.runtime); }
  dumpLatestNetworkPacket(packet = null) { return dumpRuntimeLatestNetworkPacket(this.runtime, packet); }
  adjustSimulatedLatency(direction, stepMs) { adjustRuntimeSimulatedLatency(this.runtime, direction, stepMs); }
  adjustNetworkLatency(deltaLatencyMs) { adjustRuntimeNetworkLatency(this.runtime, deltaLatencyMs); }
  adjustNetworkRtt(deltaMs) { this.adjustNetworkLatency(Math.round(deltaMs * 0.5)); }

  async spawnHeadlessCarEntity() {
    await spawnRuntimeHeadlessCarEntity(this.runtime);
  }

  async spawnDiagnosticTestFleet(options = {}) {
    return spawnRuntimeDiagnosticTestFleet(this.runtime, options);
  }

  despawnDiagnosticTestFleet() {
    return despawnRuntimeDiagnosticTestFleet(this.runtime);
  }

  async toggleDiagnosticTestFleet(forceEnabled = null, anchorMode = null) {
    return toggleRuntimeDiagnosticTestFleet(this.runtime, forceEnabled, anchorMode);
  }

  setDiagnosticObservationTarget(targetCarIndex = 0) {
    return setRuntimeDiagnosticObservationTarget(this.runtime, targetCarIndex);
  }

  sampleDiagnosticFleetTelemetry() {
    if (!this.runtime?.physics) return [];
    const serverStateBuf = this.runtime.authoritativeServer?.fallbackSim?.state || null;
    return sampleDiagnosticFleetTelemetry(this.runtime.physics, serverStateBuf, DEFAULT_DIAGNOSTIC_FLEET);
  }

  async enableDeterminismHarness(showHUD = true) {
    return enableRuntimeDeterminismHarness(this.runtime, showHUD);
  }
}
