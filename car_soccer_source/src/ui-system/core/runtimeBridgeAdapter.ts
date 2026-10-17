import { useUIStore } from './store';
import { perfTelemetryStore } from '../tokens/perfTelemetryStore';
import { hudStore } from '../hud/hudStore';
import { floatingStore } from '../tokens/floatingStore';
import { DEV_TEST_LAB_PRESET } from '../tokens/floatingPresets';
import { loadInputBindings } from '../tokens/inputBindingsStore';
import { getPreferredColorHex } from './configStorageHydrators';
import { createOnlineBridgeHandlers } from './runtimeOnlineBridgeHandlers';
import { determinismStore } from '../tokens/determinismStore';
import { networkDiagnosticsStore } from '../tokens/networkDiagnosticsStore';

export function syncMaterialsToGame(gameRuntime: any, materialsConfig?: any) {
  if (!gameRuntime) return;
  const config = materialsConfig || useUIStore.getState().materials;
  const ball = gameRuntime.ball || gameRuntime.arena?.ball;
  if (ball) {
    const isArcade = config.ballStyle === 'arcade';
    ball.traverse((child: any) => {
      if (child.name === 'Classic soccer ball') {
        child.visible = isArcade;
      } else if (child.name === 'Realistic ball') {
        child.visible = !isArcade;
      }
    });
    if (ball.children) {
      for (const c of ball.children) {
        if (c.children && c.children.length >= 2) {
          c.children[0].visible = isArcade;
          c.children[1].visible = !isArcade;
        }
      }
    }
  }
  gameRuntime.applyVisualMaterialsConfig?.(config);
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
    const state = useUIStore.getState();
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
    useUIStore.getState().activeCar;

  if (currentCar) {
    useUIStore.setState({ activeCar: currentCar });
  }

  if (gameRuntime.match?.state?.mode) {
    useUIStore.setState({ matchMode: gameRuntime.match.state.mode });
  }

  try {
    const targetHex = getPreferredColorHex();
    if (targetHex && typeof gameRuntime.setCarColor === 'function') {
      gameRuntime.setCarColor(0, targetHex);
    }
  } catch (err) {
    console.warn('[mountGameUI] Failed to sync initial car color:', err);
  }

  const initialGraphics = useUIStore.getState().graphics;
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
    gameRuntime.arena.updateBoostPadTuner(useUIStore.getState().boostPadTuner);
  }
  if (gameRuntime.arena?.updateDriftwoodsTuner) {
    gameRuntime.arena.updateDriftwoodsTuner(useUIStore.getState().driftwoodsTuner);
  }

  useUIStore.getState().setBridge({
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
      useUIStore.getState().openMenu('garage');
    },
    onOpenSettings: () => {
      useUIStore.getState().openMenu('settings');
    },
    onOpenPlay: () => {
      useUIStore.getState().openMenu('play');
    },
    onStartMatch: async (botId: string, durationSeconds = 300) => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
      if (typeof gameRuntime.startBotMatch === 'function') {
        await gameRuntime.startBotMatch(botId, durationSeconds);
      } else if (gameRuntime.bot) {
        gameRuntime.resetBotState?.();
        gameRuntime.bot.select?.(botId);
        await Promise.all([gameRuntime.bot?.load?.(), gameRuntime.arena?.ensureOpponent?.()]);
        gameRuntime.physics?.configureCars?.(gameRuntime.selectedPreset === 'flat-car' ? 'flat' : 'default', true);
        gameRuntime.physics?.setUnlimitedBoost?.(false);
        gameRuntime.isBotPaused = false;
        gameRuntime.match?.start?.();
        gameRuntime.resetKickoff?.();
      }
      useUIStore.setState({ matchMode: 'match' });
    },
    onStartKickoffTraining: () => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
      if (typeof gameRuntime.startKickoffTraining === 'function') {
        gameRuntime.startKickoffTraining();
      } else if (gameRuntime.match?.state) {
        gameRuntime.match.state.mode = 'kickoff-training';
        gameRuntime.modeManager?.setMode?.('kickoff-training');
      }
      useUIStore.setState({ matchMode: 'kickoff-training' });
    },
    onStartDevTestLab: () => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
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
      useUIStore.setState({ matchMode: 'dev-test-lab' });
    },
    onRestartMatch: async () => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
      if (typeof gameRuntime.startBotMatch === 'function') {
        const duration = gameRuntime.matchDurationSeconds || 300;
        await gameRuntime.startBotMatch(undefined, duration);
      } else if (gameRuntime.match) {
        gameRuntime.resetBotState?.();
        gameRuntime.match.start?.();
        gameRuntime.physics?.setUnlimitedBoost?.(false);
        gameRuntime.resetKickoff?.();
      }
      useUIStore.setState({ matchMode: 'match' });
    },
    onReturnToFreeplay: () => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
      floatingStore.closeWindow(DEV_TEST_LAB_PRESET.id);
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
        const unlimited = useUIStore.getState().gameplay.unlimitedBoost;
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
      useUIStore.setState({ matchMode: 'freeplay' });
      useUIStore.getState().setOnlineSession({
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
    }
  });

  const initialCamera = useUIStore.getState().camera;
  if (gameRuntime.camera && gameRuntime.camera.settings) {
    Object.assign(gameRuntime.camera.settings, initialCamera);
    if (gameRuntime.camera._sharedCamera) {
      gameRuntime.camera._sharedCamera.fov = initialCamera.fov;
      if (typeof gameRuntime.camera._sharedCamera.updateProjectionMatrix === 'function') {
        gameRuntime.camera._sharedCamera.updateProjectionMatrix();
      }
    }
  }

  const initialTrajectory = useUIStore.getState().trajectory;
  if (gameRuntime.ballTrajectoryPredictor?.updateSettings) {
    gameRuntime.ballTrajectoryPredictor.updateSettings(initialTrajectory);
  } else if (gameRuntime.ballTrajectoryPredictor?.settings) {
    Object.assign(gameRuntime.ballTrajectoryPredictor.settings, initialTrajectory);
  }

  const initialMaterials = useUIStore.getState().materials;
  syncMaterialsToGame(gameRuntime, initialMaterials);

  const initialBindings = loadInputBindings();
  hudStore.getState().syncBindings(initialBindings);

  const initialGameplay = useUIStore.getState().gameplay;
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
}
