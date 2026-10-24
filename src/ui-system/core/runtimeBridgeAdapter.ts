import { useAppStore } from '../../stores/appStore';
import { perfTelemetryStore } from '../../stores/perfTelemetryStore';
import { hudStore } from '../../stores/hudStore';
import { floatingStore } from '../../stores/floatingStore';
import { DEV_TEST_LAB_PRESET, EXPERIMENTAL_MULTI_BOTS_PRESET } from '../../stores/floatingPresets';
import { useExpMultiBotsStore } from '../../stores/expMultiBotsStore';
import { loadInputBindings } from '../../config/InputBindings.js';
import { getPreferredColorHex } from '../../config/uiConfig';
import { getMaterialsConfig } from '../../config/materialsConfig.js';
import { createOnlineBridgeHandlers } from './runtimeOnlineBridgeHandlers';
import { determinismStore } from '../../stores/determinismStore';
import { networkDiagnosticsStore } from '../../stores/networkDiagnosticsStore';
import { useGoalBarrierStore } from '../../stores/goalBarrierStore';
import { buildGoalBarrierCmfChunks } from '../../config/goalBarrierConfig';

let goalBarrierUnsubscribe: (() => void) | null = null;
let lastSyncedBarrierMeshKey = '';

export function syncGoalBarrierToGame(gameRuntime: any) {
  if (!gameRuntime) return;
  const gbState = useGoalBarrierStore.getState();
  const { enabled, targetGoal, opacity, decomposition } = gbState;

  gameRuntime.arena?.updateGoalBarrier?.(decomposition, targetGoal, enabled, opacity);

  const rectsKey = enabled
    ? `${targetGoal}:${decomposition.mergedRects
        .map((r) => `${r.u0},${r.v0},${r.u1},${r.v1}`)
        .join(';')}`
    : 'disabled';

  if (rectsKey !== lastSyncedBarrierMeshKey && gameRuntime.physics?.setGoalBarrierChunks) {
    lastSyncedBarrierMeshKey = rectsKey;
    const chunks = buildGoalBarrierCmfChunks(decomposition, targetGoal, enabled);
    gameRuntime.physics.setGoalBarrierChunks(chunks, {
      enabled: enabled && decomposition.mergedRects.length > 0,
      targetGoal,
      rects: decomposition.mergedRects,
    });
    gameRuntime.interpolator?.sync?.();
  }
}

export function syncMaterialsToGame(gameRuntime: any, materialsConfig?: any) {
  if (!gameRuntime) return;
  const config = materialsConfig || getMaterialsConfig();
  gameRuntime.applyVisualMaterialsConfig?.(config);
  gameRuntime.arena?.refreshCustomVehicle?.();
  if (gameRuntime.arena?.markRenderTreeChanged) {
    gameRuntime.arena.markRenderTreeChanged();
  }
}

export function attachGameRuntimeBridge(gameRuntime: any) {
  if (!gameRuntime) return;

  perfTelemetryStore.setSampler({
    getProfiler: () => gameRuntime.profiler,
    getRenderer: () => gameRuntime.renderer,
    getInterpolator: () => gameRuntime.interpolator,
    getPhysicsRate: () => gameRuntime.interpolator?.physicsRate ?? gameRuntime.physicsRate ?? 120,
    getNetworkLatencyInfo: () => {
      const ch = gameRuntime.networkChannel;
      if (!ch) return { baseLatency: 0, extraLatency: 0 };
      const rawExtra = ch.extraLatencyMs;
      const extra = typeof rawExtra === 'number' && Number.isFinite(rawExtra) ? Math.max(0, rawExtra) : 0;

      let measuredRtt = 0;
      if (ch.isLoopback) {
        measuredRtt = 0;
      } else if (typeof ch.measuredRttMs === 'number' && Number.isFinite(ch.measuredRttMs) && ch.measuredRttMs > 0) {
        measuredRtt = ch.measuredRttMs;
      } else if (typeof ch.rttMs === 'number' && Number.isFinite(ch.rttMs)) {
        measuredRtt = Math.max(0, ch.rttMs - extra * 2);
      }
      const baseLatency = Math.round(measuredRtt * 0.5);
      return { baseLatency, extraLatency: Math.round(extra) };
    },
  });

  if (gameRuntime.networkReconciler) {
    const state = useAppStore.getState();
    gameRuntime.networkReconciler.setClockPacingMode?.(state.clockPacingMode);
    gameRuntime.networkReconciler.setInputBufferTarget?.(state.inputBufferTarget);
    if (Array.isArray(state.inputBufferThreshold)) {
      gameRuntime.networkReconciler.setInputBufferThresholds?.(
        state.inputBufferThreshold[0],
        state.inputBufferThreshold[1]
      );
    }
  }

  const currentCar =
    gameRuntime.garageSettingsStore?.get()?.vehiclePreset ||
    gameRuntime.display?.vehiclePreset ||
    useAppStore.getState().activeCar;

  if (currentCar) {
    useAppStore.setState({ activeCar: currentCar });
  }

  if (gameRuntime.match?.state?.mode) {
    useAppStore.setState({ matchMode: gameRuntime.match.state.mode });
  }

  try {
    const targetHex = getPreferredColorHex();
    if (targetHex && typeof gameRuntime.setCarColor === 'function') {
      gameRuntime.setCarColor(0, targetHex);
    }
  } catch (err) {
    console.warn('[mountGameUI] Failed to sync initial car color:', err);
  }

  const initialGraphics = useAppStore.getState().graphics;
  gameRuntime.activeGraphicsSettings = initialGraphics;
  if (typeof gameRuntime.updateViewport === 'function') {
    gameRuntime.updateViewport(initialGraphics);
  }
  if (gameRuntime.arena) {
    gameRuntime.arena.setStadiumVisible?.(initialGraphics.showStadium);
  }
  if (gameRuntime.clockScheduler) {
    gameRuntime.clockScheduler.setFpsLimit(initialGraphics.limitFps ? initialGraphics.maxFps : null);
  }
  if (gameRuntime.arena?.updateBoostPadTuner) {
    gameRuntime.arena.updateBoostPadTuner(useAppStore.getState().boostPadTuner);
  }
  if (gameRuntime.arena?.updateDriftwoodsTuner) {
    gameRuntime.arena.updateDriftwoodsTuner(useAppStore.getState().driftwoodsTuner);
  }

  useAppStore.getState().setBridge({
    onVehicleChange: (carId: string) => {
      if (typeof gameRuntime.changePlayerVehicle === 'function') {
        gameRuntime.changePlayerVehicle(carId);
      }
    },
    onColorChange: (hex: string) => {
      if (typeof gameRuntime.setCarColor === 'function') {
        gameRuntime.setCarColor(0, hex);
      }
    },
    onResume: () => {
      if (gameRuntime) {
        gameRuntime.syncPausedAndInputState?.();
      }
    },
    onOverlayChange: (isOpen: boolean) => {
      if (gameRuntime.handleOverlayChange) {
        gameRuntime.handleOverlayChange('esc-menu', isOpen);
      }
    },
    onOpenGarage: () => {
      useAppStore.getState().openMenu('garage');
    },
    onOpenSettings: () => {
      useAppStore.getState().openMenu('settings');
    },
    onOpenPlay: () => {
      useAppStore.getState().openMenu('play');
    },
    onStartMatch: async (botId: string, durationSeconds = 300, teamSize?: 'standard' | 'double' | 'solo') => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      const resolvedBot = botId === 'nexto' ? 'nexto' : 'necto';
      const resolvedTeamSize = teamSize || useExpMultiBotsStore.getState().exhibitionTeamSize || 'solo';
      useExpMultiBotsStore.getState().configureExhibitionMatch(resolvedBot, durationSeconds, resolvedTeamSize);
      if (typeof gameRuntime.startExpMultiBots === 'function') {
        gameRuntime.startExpMultiBots();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'exp-multi-bots';
        gameRuntime.modeManager?.setMode?.('exp-multi-bots');
      }
      useAppStore.setState({ matchMode: 'exp-multi-bots' });
    },
    onStartKickoffTraining: () => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      if (typeof gameRuntime.startKickoffTraining === 'function') {
        gameRuntime.startKickoffTraining();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'kickoff-training';
        gameRuntime.modeManager?.setMode?.('kickoff-training');
      }
      useAppStore.setState({ matchMode: 'kickoff-training' });
    },
    onStartStaticTrainingPack: () => {
      if (!gameRuntime) return;
      if (typeof gameRuntime.startStaticTrainingPack === 'function') {
        gameRuntime.startStaticTrainingPack();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'static-training-pack';
        gameRuntime.modeManager?.setMode?.('static-training-pack');
      }
      useAppStore.setState({ matchMode: 'static-training-pack' });
    },
    onStartDevTestLab: () => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      floatingStore.setOpacity(70);
      const exists = floatingStore.getSnapshot().windows.some((w) => w.id === DEV_TEST_LAB_PRESET.id);
      if (!exists) {
        floatingStore.spawnWindow({
          ...DEV_TEST_LAB_PRESET,
          startMinimized: false,
        });
      } else {
        floatingStore.restoreWindow(DEV_TEST_LAB_PRESET.id);
      }
      if (typeof gameRuntime.startDevTestLab === 'function') {
        gameRuntime.startDevTestLab();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'dev-test-lab';
        gameRuntime.modeManager?.setMode?.('dev-test-lab');
      }
      useAppStore.setState({ matchMode: 'dev-test-lab' });
    },
    onStartExpMultiBots: () => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      useExpMultiBotsStore.getState().setIsExhibitionMode(false);
      if (typeof gameRuntime.startExpMultiBots === 'function') {
        gameRuntime.startExpMultiBots();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'exp-multi-bots';
        gameRuntime.modeManager?.setMode?.('exp-multi-bots');
      }
      useAppStore.setState({ matchMode: 'exp-multi-bots' });
    },
    onRestartMatch: async () => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      const currentMode = gameRuntime.match?.state?.mode || useAppStore.getState().matchMode;
      if (currentMode === 'exp-multi-bots') {
        const activeMode = gameRuntime.modeManager?.getActiveMode?.();
        if (activeMode && typeof activeMode.applyRosterAndStartMatch === 'function') {
          await activeMode.applyRosterAndStartMatch();
        } else if (typeof gameRuntime.startExpMultiBots === 'function') {
          gameRuntime.startExpMultiBots();
        }
        useAppStore.setState({ matchMode: 'exp-multi-bots' });
        return;
      }
      if (typeof gameRuntime.startBotMatch === 'function') {
        const duration = gameRuntime.matchDurationSeconds || 300;
        await gameRuntime.startBotMatch(undefined, duration);
      } else if (gameRuntime.match) {
        gameRuntime.resetBotState?.();
        gameRuntime.match.start?.();
        gameRuntime.physics?.setUnlimitedBoost?.(false);
        gameRuntime.resetKickoff?.();
      }
      useAppStore.setState({ matchMode: 'match' });
    },
    onReturnToFreeplay: () => {
      if (!gameRuntime) return;
      useAppStore.getState().closeMenu();
      floatingStore.closeWindow(DEV_TEST_LAB_PRESET.id);
      floatingStore.closeWindow(EXPERIMENTAL_MULTI_BOTS_PRESET.id);
      const session = gameRuntime.multiplayerSession;
      if (session) {
        if (session.isHosting) {
          session.stopHosting?.();
        } else if (session.clientController || session.signalingHandler) {
          session.leaveSession?.();
        }
      }
      if (typeof gameRuntime.stopOnlineServer === 'function' && (gameRuntime.authoritativeServer || gameRuntime.networkChannel)) {
        gameRuntime.stopOnlineServer();
      }
      if (typeof gameRuntime.leaveBotMatch === 'function') {
        gameRuntime.leaveBotMatch();
      } else if (gameRuntime.match) {
        gameRuntime.resetBotState?.();
        gameRuntime.match.leave?.();
        const unlimited = useAppStore.getState().gameplay.unlimitedBoost;
        gameRuntime.physics?.setUnlimitedBoost?.(unlimited);
        if (gameRuntime.trainingOptions) {
          gameRuntime.trainingOptions.boostOption = unlimited ? 'unlimited' : 'standard';
        }
        gameRuntime.resetKickoff?.();
      }
      if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'freeplay';
      }
      gameRuntime.modeManager?.setMode?.('freeplay');
      useAppStore.setState({ matchMode: 'freeplay' });
      useAppStore.getState().setOnlineSession({
        isHosting: false,
        roomId: '',
        signalingConnected: false,
        connectedPeers: [],
        roomType: 'warmup',
        isReady: false,
      });
    },
    ...createOnlineBridgeHandlers(gameRuntime),
    onCameraChange: (cameraConfig) => {
      if (gameRuntime.camera && gameRuntime.camera.settings) {
        Object.assign(gameRuntime.camera.settings, cameraConfig);
        if (gameRuntime.camera._sharedCamera) {
          gameRuntime.camera._sharedCamera.fov = cameraConfig.fov;
          if (typeof gameRuntime.camera._sharedCamera.updateProjectionMatrix === 'function') {
            gameRuntime.camera._sharedCamera.updateProjectionMatrix();
          }
        }
        if (typeof gameRuntime.camera.updateProjectionMatrix === 'function') {
          gameRuntime.camera.updateProjectionMatrix();
        }
      }
      if (gameRuntime.settingsSheet && gameRuntime.settingsSheet.target) {
        Object.assign(gameRuntime.settingsSheet.target, cameraConfig);
      }
    },
    onGraphicsChange: (graphicsConfig) => {
      gameRuntime.activeGraphicsSettings = graphicsConfig;
      if (typeof gameRuntime.updateViewport === 'function') {
        gameRuntime.updateViewport(graphicsConfig);
      }
      if (gameRuntime.arena) {
        gameRuntime.arena.setStadiumVisible?.(graphicsConfig.showStadium);
      }
      if (gameRuntime.clockScheduler) {
        gameRuntime.clockScheduler.setFpsLimit(graphicsConfig.limitFps ? graphicsConfig.maxFps : null);
      }
    },
    onGameplayChange: (gameplayConfig) => {
      if (gameRuntime.trainingOptions) {
        gameRuntime.trainingOptions.boostOption = gameplayConfig.unlimitedBoost ? 'unlimited' : 'standard';
        gameRuntime.trainingOptions.disableGoalReset = !gameplayConfig.goalRestart;
        gameRuntime.trainingOptions.showCarHitbox = gameplayConfig.showCarHitbox;
      }
      if (gameRuntime.physics) {
        gameRuntime.physics.setUnlimitedBoost?.(gameplayConfig.unlimitedBoost);
      }
      if (gameRuntime.arena) {
        gameRuntime.arena.setCarHitboxesVisible?.(gameplayConfig.showCarHitbox);
      }
    },
    onTrajectoryChange: (trajectoryConfig) => {
      if (gameRuntime.ballTrajectoryPredictor?.updateSettings) {
        gameRuntime.ballTrajectoryPredictor.updateSettings(trajectoryConfig);
      } else if (gameRuntime.ballTrajectoryPredictor?.settings) {
        Object.assign(gameRuntime.ballTrajectoryPredictor.settings, trajectoryConfig);
      }
    },
    onMaterialsChange: (materialsConfig) => {
      syncMaterialsToGame(gameRuntime, materialsConfig);
    },
    onBoostPadTunerChange: (boostPadConfig) => {
      if (gameRuntime.arena?.updateBoostPadTuner) {
        gameRuntime.arena.updateBoostPadTuner(boostPadConfig);
      } else if (gameRuntime.arena?.boostPadSystem?.updateVisualTuningParams) {
        gameRuntime.arena.boostPadSystem.updateVisualTuningParams(boostPadConfig);
      }
    },
    onDriftwoodsTunerChange: (driftwoodsConfig) => {
      if (gameRuntime.arena?.updateDriftwoodsTuner) {
        gameRuntime.arena.updateDriftwoodsTuner(driftwoodsConfig);
      }
    },
    onFreeCamToggle: (enabled) => {
      if (gameRuntime.camera && typeof gameRuntime.camera.setFreeCam === 'function') {
        gameRuntime.camera.setFreeCam(enabled);
      }
    },
    onFreeCamFovChange: (fov) => {
      if (gameRuntime.camera && typeof gameRuntime.camera.setFreeCamFov === 'function') {
        gameRuntime.camera.setFreeCamFov(fov);
      }
    },
    onResetFreeCam: () => {
      if (gameRuntime.camera && typeof gameRuntime.camera.resetFreeCamOverview === 'function') {
        gameRuntime.camera.resetFreeCamOverview();
      }
    },
    onBindingsChange: (bindings: any) => {
      if (gameRuntime.keyboard && typeof gameRuntime.keyboard.setBindings === 'function') {
        gameRuntime.keyboard.setBindings(bindings);
      }
      if (gameRuntime.gamepad && typeof gameRuntime.gamepad.setBindings === 'function') {
        gameRuntime.gamepad.setBindings(bindings);
      }
      if (typeof gameRuntime.updateCursorHint === 'function') {
        gameRuntime.updateCursorHint();
      }
      if (gameRuntime.settingsSheet) {
        gameRuntime.settingsSheet.bindings = bindings;
      }
      hudStore.getState().syncBindings(bindings);
    },
    onEnsureDeterminism: async () => {
      if (!gameRuntime.determinismHarness && typeof gameRuntime.enableDeterminismHarness === 'function') {
        await gameRuntime.enableDeterminismHarness(false);
      }
      if (gameRuntime.determinismHarness) {
        determinismStore.setHarness(gameRuntime.determinismHarness);
      }
    },
    onEnsureNetworkDiagnostics: async () => {
      if (!gameRuntime.networkReconciler && typeof gameRuntime.enableNetworkPrediction === 'function') {
        await gameRuntime.enableNetworkPrediction(false);
      }
      networkDiagnosticsStore.setSession(gameRuntime.networkReconciler, gameRuntime.networkChannel, gameRuntime);
    },
    onSimulateBoostPadCollect: (padIndex) => {
      const sys = gameRuntime.arena?.boostPadSystem;
      if (!sys) return;
      if (padIndex === 'all') {
        sys.simulateCollectAll?.();
      } else if (typeof padIndex === 'number') {
        sys.simulateCollect?.(padIndex);
      }
    },
    onSimulateBoostPadRefill: (padIndex, duration) => {
      const sys = gameRuntime.arena?.boostPadSystem;
      if (!sys) return;
      if (padIndex === 'all') {
        sys.simulateRefillAll?.(duration);
      } else if (typeof padIndex === 'number') {
        sys.simulateRefill?.(padIndex, duration);
      }
    },
    onExperimentalWallConfigChange: (wallConfig) => {
      gameRuntime.arena?.updateExperimentalWallConfig?.(wallConfig);
    },
    onShadowConfigChange: (shadowConfig) => {
      gameRuntime.arena?.updateShadowConfig?.(shadowConfig, gameRuntime.renderer);
    },
    onAnodizedPaintChange: () => {
      if (gameRuntime.arena?.markRenderTreeChanged) {
        gameRuntime.arena.markRenderTreeChanged();
      }
    },
    onBoostParticleConfigChange: (particleConfig) => {
      if (particleConfig && typeof particleConfig.bloomEnabled === 'boolean') {
        gameRuntime.bloomEnabled = particleConfig.bloomEnabled;
      }
    },
    onSkyboxConfigChange: (skyboxConfig) => {
      gameRuntime.arena?.updateSkyboxConfig?.(skyboxConfig);
    },
    onBallVisualConfigChange: (ballConfig) => {
      gameRuntime.arena?.updateBallVisualConfig?.(ballConfig);
    },
    onCustomVehicleTunerChange: (vehicleId, hitboxPreset) => {
      gameRuntime.arena?.refreshCustomVehicle?.(vehicleId);
      if (hitboxPreset && gameRuntime.selectedPreset === vehicleId) {
        gameRuntime.selectedHitbox = hitboxPreset;
        gameRuntime.physics?.setCarHitbox?.(gameRuntime.playerCarIndex ?? 0, hitboxPreset);
      }
      if (gameRuntime.arena?.markRenderTreeChanged) {
        gameRuntime.arena.markRenderTreeChanged();
      }
    },
    onUnderDevelopmentChange: async (config, patch) => {
      const playerIdx = gameRuntime.playerCarIndex ?? 0;

      if (patch.stadiumPreset !== undefined) {
        const isThrowback = config.stadiumPreset === 'throwback';
        const manifestUrl = isThrowback
          ? '/arenamesh/throwback_stadium/manifest.json'
          : '/arenamesh/manifest.json';
        const presetId = isThrowback ? 1 : 0;

        if (gameRuntime.physics) {
          const prevCars = Math.max(1, gameRuntime.physics.numCars || 1);
          const hitbox = gameRuntime.selectedHitbox || 'octane';
          await gameRuntime.physics.reloadMeshes?.(manifestUrl);
          gameRuntime.physics.setArenaPreset?.(presetId);
          gameRuntime.physics.configureCars?.(hitbox, prevCars > 1, Math.max(0, prevCars - 2));
          gameRuntime.physics.setUnlimitedBoost?.(useAppStore.getState().gameplay.unlimitedBoost);
          if (config.threeWheelsEnabled) {
            gameRuntime.physics.setCarThreeWheels?.(playerIdx, true);
          }
          if (typeof gameRuntime.resetKickoff === 'function') {
            gameRuntime.resetKickoff();
          } else {
            gameRuntime.physics.resetKickoff?.();
          }
          if (gameRuntime.arena && typeof gameRuntime.physics.getPads === 'function') {
            gameRuntime.arena.addPads(gameRuntime.physics.getPads());
          }
        }

        if (gameRuntime.arena) {
          await gameRuntime.arena.setThrowbackStadiumActive?.(
            isThrowback,
            Boolean(config.showThrowbackCollisionOverlay)
          );
        }
      }

      if (patch.threeWheelsEnabled !== undefined) {
        const enabled = Boolean(config.threeWheelsEnabled);
        gameRuntime.physics?.setCarThreeWheels?.(playerIdx, enabled);
        if (gameRuntime.arena?.carWheels?.[playerIdx]) {
          gameRuntime.arena.carWheels[playerIdx].threeWheels = enabled;
        }
      }

      if (patch.showThrowbackCollisionOverlay !== undefined && patch.stadiumPreset === undefined) {
        await gameRuntime.arena?.setThrowbackCollisionVisible?.(
          Boolean(config.showThrowbackCollisionOverlay)
        );
      }
    }
  });

  const initialCamera = useAppStore.getState().camera;
  if (gameRuntime.camera && gameRuntime.camera.settings) {
    Object.assign(gameRuntime.camera.settings, initialCamera);
    if (gameRuntime.camera._sharedCamera) {
      gameRuntime.camera._sharedCamera.fov = initialCamera.fov;
      if (typeof gameRuntime.camera._sharedCamera.updateProjectionMatrix === 'function') {
        gameRuntime.camera._sharedCamera.updateProjectionMatrix();
      }
    }
  }

  const initialTrajectory = useAppStore.getState().trajectory;
  if (gameRuntime.ballTrajectoryPredictor?.updateSettings) {
    gameRuntime.ballTrajectoryPredictor.updateSettings(initialTrajectory);
  } else if (gameRuntime.ballTrajectoryPredictor?.settings) {
    Object.assign(gameRuntime.ballTrajectoryPredictor.settings, initialTrajectory);
  }

  const initialMaterials = useAppStore.getState().materials;
  syncMaterialsToGame(gameRuntime, initialMaterials);

  const initialBindings = loadInputBindings();
  hudStore.getState().syncBindings(initialBindings);

  const initialGameplay = useAppStore.getState().gameplay;
  if (gameRuntime.trainingOptions) {
    gameRuntime.trainingOptions.boostOption = initialGameplay.unlimitedBoost ? 'unlimited' : 'standard';
    gameRuntime.trainingOptions.disableGoalReset = !initialGameplay.goalRestart;
    gameRuntime.trainingOptions.showCarHitbox = initialGameplay.showCarHitbox;
  }
  if (gameRuntime.physics) {
    gameRuntime.physics.setUnlimitedBoost?.(initialGameplay.unlimitedBoost);
  }
  if (gameRuntime.arena) {
    gameRuntime.arena.setCarHitboxesVisible?.(initialGameplay.showCarHitbox);
  }

  lastSyncedBarrierMeshKey = '';
  syncGoalBarrierToGame(gameRuntime);
  if (goalBarrierUnsubscribe) {
    goalBarrierUnsubscribe();
  }
  goalBarrierUnsubscribe = useGoalBarrierStore.subscribe(() => {
    syncGoalBarrierToGame(gameRuntime);
  });
}
