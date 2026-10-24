/**
 * RuntimeOnlineSessionHelper.js
 * Host and Client session lifecycle helpers (enableNetworkPrediction, hostOnlineServer,
 * joinOnlineServer, stopOnlineServer, cleanupOnlineSession) for RuntimeNetworkManager.
 */

import { HostServerWorker } from '../../network/HostServerWorker.js';
import { PredictionReconciler } from '../../network/PredictionReconciler.js';
import { CLIENT_COMMAND_TYPES } from '../../network/GlobalPayloadCodec.js';
import { packLoadoutCommandParam1 } from '../../network/MatchRosterCoordinator.js';
import { useAppStore } from '../../stores/appStore';
import { networkDiagnosticsStore } from '../../stores/networkDiagnosticsStore';
import { resetRuntimeReconcilerSignalState } from './RuntimeReconcilerSignalHandler.js';
import {
  syncHostLobbyOngoingNotification,
  dismissHostLobbyOngoingNotification,
} from './RuntimeOnlineRosterSync.js';

export async function enableRuntimeNetworkPrediction(manager, showHUD = true, options = {}) {
  const r = manager.runtime;
  if (!r.networkReconciler) {
    const hostVisualId = r.selectedPreset || 'fennec';
    r.authoritativeServer = new HostServerWorker(null, {
      snapshotInterval: 1,
      hostVisualId,
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

    const pacingMode = useAppStore?.getState?.()?.clockPacingMode || 'legacy';
    const inputBufferTarget = useAppStore?.getState?.()?.inputBufferTarget ?? 3;
    const inputBufferThreshold = useAppStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
    r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
      localCarIndex: r.playerCarIndex,
      redundantHistoryCount: options.redundantHistoryCount ?? 10,
      enableRedundantInputs: options.enableRedundantInputs ?? true,
      useBitPacking: options.useBitPacking ?? false,
      interpolator: r.interpolator,
      clockPacingMode: pacingMode,
      inputBufferTarget: inputBufferTarget,
      catchupThresholdOffset: inputBufferThreshold[0],
      skipThresholdOffset: inputBufferThreshold[1],
    });
    r.networkReconciler.setCarVisualPreset(r.playerCarIndex, hostVisualId);
    manager._bindReconcilerSignals(r.networkReconciler);
    r.networkReconciler.syncTimeline(serverSnap, serverTick);
    r.onSessionReady?.(r.networkReconciler, r.networkChannel);
  }
  if (showHUD) {
    r.onShowNetworkHUD?.();
  }
  return r.networkReconciler;
}

export function cleanupRuntimeOnlineSession(manager) {
  const r = manager.runtime;
  r.isBotMatch = false;
  r.remotePeerCarMap?.clear?.();
  dismissHostLobbyOngoingNotification();
  resetRuntimeReconcilerSignalState(r);
  manager.setLobbyGhostMode(false);
  if (r.multiWorldGhostRenderer) {
    r.multiWorldGhostRenderer.setVisible(false);
  }
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
  if (r.arena) {
    r.arena.playerCarIndex = 0;
    r.arena.isLobbyMode = false;
    r.arena.isHostLobby = false;
  }
}

export async function stopRuntimeOnlineServer(manager) {
  const r = manager.runtime;
  manager.cleanupOnlineSession();
  if (r.arena?.cars) {
    if (r.arena.cars[0]) r.arena.cars[0].visible = true;
    for (let i = 1; i < r.arena.cars.length; i++) {
      if (r.arena.cars[i]) r.arena.cars[i].visible = false;
    }
  }
  if (r.physics && r.physics.numCars > 1) {
    r.physics.configureCars(r.selectedPreset || 'fennec', false, 0);
  }
  const unlimited = useAppStore?.getState?.()?.gameplay?.unlimitedBoost ?? (r.trainingOptions?.boostOption === 'unlimited');
  r.physics?.setUnlimitedBoost?.(unlimited);
  if (r.match?.state) {
    r.match.state.mode = 'freeplay';
    r.match.state.paused = false;
    r.match.state.phase = 'freeplay';
    r.match.state.overtime = false;
    r.match.state.winner = null;
    r.match.state.countdown = 0;
  }
  r.modeManager?.setMode?.('freeplay');
  r.resetKickoff();
  r.interpolator?.sync?.(performance.now());
  if (useAppStore && typeof useAppStore.getState === 'function') {
    useAppStore.getState().setMatchMode('freeplay');
    useAppStore.getState().setOnlineSession({
      isHosting: false,
      roomId: '',
      signalingConnected: false,
      connectedPeers: [],
      roomType: 'warmup',
      isReady: false,
    });
  }
}

export async function hostRuntimeOnlineServer(manager, options = {}) {
  const r = manager.runtime;
  if (r.authoritativeServer) {
    console.warn('[GameRuntime] Authoritative server already running. Disposing prior instance before hosting.');
    await manager.stopOnlineServer();
  }
  r.isBotMatch = false;
  r.remotePeerCarMap = new Map();
  const playerName = options.playerName || 'Host';
  const hostVisualId = options.visualId || r.selectedPreset || 'fennec';
  const hostColorSlot = options.colorSlot ?? (r.selectedColorSlot || 0);
  const uiOnline = useAppStore?.getState?.()?.onlineSession;
  const roomType = options.roomType || uiOnline?.roomType || 'match';
  const isMatchLobby = options.lobbyMode !== undefined ? Boolean(options.lobbyMode) : true;
  const gameMode = options.gameMode || uiOnline?.gameMode || '3v3';
  const botFillMode = options.botFillMode || uiOnline?.botFillMode || 'no_bots';
  const durationSeconds = options.durationSeconds ?? uiOnline?.matchDurationSeconds ?? 300;

  r.testCarAudioEnabled = false;
  networkDiagnosticsStore?.setTestCarAudioEnabled?.(false);

  if (r.arena?.cars?.[1]) {
    r.arena.cars[1].visible = false;
  }
  if (r.physics && r.physics.numCars > 1) {
    r.physics.configureCars('default', false, 0);
    r.physics.resetKickoff();
  }

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
    skipReplayByDefault: options.skipReplayByDefault !== undefined ? Boolean(options.skipReplayByDefault) : false,
    roomId: options.roomId || 'local_room',
  });
  await r.authoritativeServer.init();

  r.authoritativeServer.sim.setUnlimitedBoost(true);
  await Promise.resolve(r.authoritativeServer.sim.restoreState(initialSnapshot));
  if (r.arena) {
    r.arena.isLobbyMode = isMatchLobby;
    r.arena.isHostLobby = isMatchLobby;
  }
  if (isMatchLobby) {
    manager.setLobbyGhostMode(true, { hostInteractsWithBall: true });
  } else {
    manager.setLobbyGhostMode(false);
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

  const pacingMode = useAppStore?.getState?.()?.clockPacingMode || 'legacy';
  const inputBufferTarget = useAppStore?.getState?.()?.inputBufferTarget ?? 3;
  const inputBufferThreshold = useAppStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
  r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
    localCarIndex: 0,
    redundantHistoryCount: 10,
    enableRedundantInputs: true,
    useBitPacking: false,
    interpolator: r.interpolator,
    clockPacingMode: pacingMode,
    inputBufferTarget: inputBufferTarget,
    catchupThresholdOffset: inputBufferThreshold[0],
    skipThresholdOffset: inputBufferThreshold[1],
  });
  r.networkReconciler.setCarVisualPreset(0, hostVisualId);
  manager._bindReconcilerSignals(r.networkReconciler);
  r.networkReconciler.onHardResync = () => {
    if (r.interpolator) {
      r.interpolator.sync(performance.now());
    }
  };
  r.networkReconciler.onRosterUpdate = async (msg) => {
    if (msg?.roster) {
      await manager._applyRosterSnapshot(msg.roster);
    }
  };

  if (isMatchLobby) {
    await manager.spawnDiagnosticTestFleet();
    networkDiagnosticsStore?.syncZeroGFleetState?.(true);
  }

  const serverSnap = r.authoritativeServer.sim.saveCompactState();
  const serverTick = Math.floor(r.authoritativeServer.sim.getHeaderView().tickCount);
  r.networkReconciler.syncTimeline(serverSnap, serverTick);

  r.onSessionReady?.(r.networkReconciler, r.networkChannel);

  if (useAppStore && typeof useAppStore.getState === 'function') {
    useAppStore.getState().setMatchMode('online-warmup');
    useAppStore.getState().setOnlineSession({
      isHosting: true,
      roomId: options.roomId || 'local_room',
      playerName: playerName,
      signalingConnected: true,
      roomType,
      gameMode,
      botFillMode,
      matchDurationSeconds: durationSeconds,
    });
  }
  syncHostLobbyOngoingNotification(r);

  return r.authoritativeServer;
}

export async function joinRuntimeOnlineServer(manager, options = {}) {
  const r = manager.runtime;
  const { channel, playerName = 'Player 2' } = options;
  const localVisualId = options.visualId || r.selectedPreset || 'fennec';
  const localColorSlot = options.colorSlot ?? (r.selectedColorSlot || 0);

  r.isBotMatch = false;
  r.playerCarIndex = 1;
  r.networkChannel = channel;
  r.physics?.setUnlimitedBoost?.(true);

  r.testCarAudioEnabled = true;
  networkDiagnosticsStore?.setTestCarAudioEnabled?.(true);

  await r.arena.ensureOpponent();
  if (r.arena) {
    r.arena.playerCarIndex = 1;
    r.arena.isLobbyMode = true;
    r.arena.isHostLobby = false;
    if (r.arena.cars[0]) {
      r.arena.cars[0].visible = false;
    }
    if (r.arena.cars[1]) {
      r.arena.cars[1].visible = true;
    }
  }
  if (r.physics.numCars < 2) {
    r.physics.addCar(1, localVisualId);
  } else {
    r.physics.setCarHitbox(1, localVisualId);
  }
  r.physics.setCarTeam?.(0, 0);
  r.physics.setCarTeam?.(1, 1);

  r.physics.setCarCollisionMask?.(0, false, false);
  r.physics.setCarLinearFactorAndGravity?.(0, 0, 0, 0, 0);
  r.physics.setCarState?.(0, {
    pos: [-5500, 0, -500],
    vel: [0, 0, 0],
    angVel: [0, 0, 0],
    boost: 0,
  });
  r.physics.setCarCollisionMask?.(1, true, false);
  r.physics.setCarLinearFactorAndGravity?.(1, 1, 1, 1, 1);

  if (r.arena.cars[1]) {
    r.getFlipResetVisual?.(1);
    r.camera.update(r.arena.cars[1], r.arena.ball, 0, r.cameraDynamics);
  }

  if (r.interpolator) {
    r.interpolator.sync(performance.now());
  }

  const clientPacingMode = useAppStore?.getState?.()?.clockPacingMode || 'legacy';
  const inputBufferTarget = useAppStore?.getState?.()?.inputBufferTarget ?? 3;
  const inputBufferThreshold = useAppStore?.getState?.()?.inputBufferThreshold ?? [-2, 2];
  r.networkReconciler = new PredictionReconciler(r.physics, r.networkChannel, {
    localCarIndex: 1,
    redundantHistoryCount: 10,
    enableRedundantInputs: true,
    useBitPacking: false,
    interpolator: r.interpolator,
    clockPacingMode: clientPacingMode,
    inputBufferTarget: inputBufferTarget,
    catchupThresholdOffset: inputBufferThreshold[0],
    skipThresholdOffset: inputBufferThreshold[1],
  });
  r.networkReconciler.setCarVisualPreset(1, localVisualId);
  r.networkReconciler.setLobbyDualWorldMode?.(true);
  const initialGhostRenderer = manager.ensureMultiWorldGhostRenderer();
  if (initialGhostRenderer) {
    initialGhostRenderer.ensureWorld('lobby-remote', {
      paletteIndex: 0,
      opacity: 0.55,
      showCar: true,
      showBall: true,
    });
    initialGhostRenderer.setVisible(true);
  }

  manager._bindReconcilerSignals(r.networkReconciler);
  r.networkReconciler.onHardResync = () => {
    if (r.interpolator) {
      r.interpolator.sync(performance.now());
    }
  };
  r.networkReconciler.onRosterUpdate = async (msg) => {
    if (msg?.roster) {
      await manager._applyRosterSnapshot(msg.roster);
    }
  };

  r.networkReconciler.onHandshakeResponse = async (msg) => {
    if (typeof msg.entityId === 'number' && msg.entityId >= 0) {
      r.playerCarIndex = msg.entityId;
      r.networkReconciler.localCarIndex = msg.entityId;
      if (r.arena) {
        r.arena.playerCarIndex = msg.entityId;
      }
    }
    if (msg.state === 'lobby' || msg.state === 'freeplay' || !msg.state) {
      r.physics?.setUnlimitedBoost?.(true);
      if (r.arena) {
        r.arena.isLobbyMode = true;
        r.arena.isHostLobby = false;
      }
      r.networkReconciler.setLobbyDualWorldMode?.(true);
      const ghostRenderer = manager.ensureMultiWorldGhostRenderer();
      if (ghostRenderer) {
        ghostRenderer.ensureWorld('lobby-remote', {
          paletteIndex: 0,
          opacity: 0.55,
          showCar: true,
          showBall: true,
        });
        ghostRenderer.setVisible(true);
      }
      while (r.physics && r.physics.numCars <= r.playerCarIndex) {
        r.physics.addCar(r.physics.numCars % 2, localVisualId);
      }
      const numCars = Math.min(r.physics?.numCars || 2, 8);
      for (let c = 0; c < numCars; c++) {
        const isLocal = c === r.playerCarIndex;
        r.physics?.setCarCollisionMask?.(c, isLocal, false);
        if (!isLocal) {
          r.physics?.setCarLinearFactorAndGravity?.(c, 0, 0, 0, 0);
          r.physics?.setCarState?.(c, {
            pos: [-5500, c * 300, -500],
            vel: [0, 0, 0],
            angVel: [0, 0, 0],
            boost: 0,
          });
          if (r.arena?.cars?.[c]) {
            r.arena.cars[c].visible = false;
          }
        } else {
          r.physics?.setCarLinearFactorAndGravity?.(c, 1, 1, 1, 1);
        }
      }
    } else if (msg.state === 'kickoff' || msg.state === 'playing' || msg.state === 'prepare') {
      r.physics?.setUnlimitedBoost?.(false);
      if (r.arena) {
        r.arena.isLobbyMode = false;
        r.arena.isHostLobby = false;
      }
      r.networkReconciler.setLobbyDualWorldMode?.(false);
      manager.setLobbyGhostMode(false);
    }
    if (msg.roster) {
      await manager._applyRosterSnapshot(msg.roster);
    }
    if (useAppStore && typeof useAppStore.getState === 'function') {
      useAppStore.getState().setOnlineSession({
        roomId: msg.roomId || useAppStore.getState().onlineSession?.roomId || 'online_room',
        gameMode: msg.gameMode || useAppStore.getState().onlineSession?.gameMode || '1v1',
        roomType: msg.state === 'lobby' || msg.state === 'prepare' || msg.state === 'kickoff' || msg.state === 'playing' ? 'match' : 'warmup',
      });
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
        colorSlot: localColorSlot,
      }));
    }
  }

  if (useAppStore && typeof useAppStore.getState === 'function') {
    useAppStore.getState().setMatchMode('online-warmup');
    useAppStore.getState().setOnlineSession({
      isHosting: false,
      playerName: playerName,
      signalingConnected: true,
    });
  }

  return r.networkChannel;
}
