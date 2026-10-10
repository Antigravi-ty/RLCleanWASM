import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { GameUIRoot } from './GameUIRoot';
import { useUIStore, type ActiveMenuRoute } from './core/store';
import { perfTelemetryStore } from './tokens/perfTelemetryStore';
import { hudStore } from './hud/hudStore';
import { loadInputBindings } from '../input/InputBindings.js';
import { applyVisualMaterialsConfig } from '../effects/ThemeMaterialPipeline.js';
import '../styles/ui-next.css';

export interface GameUIRuntimeHandle {
  openMenu: (route?: ActiveMenuRoute) => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  destroy: () => void;
}

export function mountGameUI(
  container: HTMLElement,
  gameRuntime?: any
): GameUIRuntimeHandle {
  let rootEl = container.querySelector<HTMLElement>('#game-ui-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'game-ui-root';
    rootEl.style.position = 'absolute';
    rootEl.style.inset = '0';
    rootEl.style.pointerEvents = 'none';
    rootEl.style.zIndex = '500';
    container.appendChild(rootEl);
  }

  const root: Root = createRoot(rootEl);
  root.render(<GameUIRoot portalContainer={rootEl} />);

  // Attach runtime bridge callbacks if gameRuntime is provided
  if (gameRuntime) {
    // 0. Connect decoupled performance telemetry sampler with dynamic getters
    perfTelemetryStore.setSampler({
      getProfiler: () => gameRuntime.profiler,
      getRenderer: () => gameRuntime.renderer,
      getInterpolator: () => gameRuntime.interpolator,
      getPhysicsRate: () => gameRuntime.physicsRate || 120,
      getNetworkLatencyInfo: () => {
        const ch = gameRuntime.networkChannel || gameRuntime.networkHUD?.channel;
        if (!ch) return { baseLatency: 0, extraLatency: 0 };
        const extra = ch.extraLatencyMs ?? 0;
        const measuredRtt = ch.measuredRttMs ?? 0;
        const baseLatency = Math.round(measuredRtt * 0.5);
        return { baseLatency, extraLatency: extra };
      },
    });

    // 1. Sync initial vehicle preset
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

    // Sync initial vehicle color preference
    try {
      if (typeof localStorage !== 'undefined') {
        const rawColor = localStorage.getItem('car-soccer.color-preferences.v1');
        const hexMap: Record<number, string> = {
          0: '#ff7043', 1: '#66bb6a', 2: '#ffc107', 3: '#42a5f5', 4: '#fd6e9d', 5: '#ba68c8'
        };
        let targetHex: string | null = null;
        if (rawColor) {
          const parsed = JSON.parse(rawColor);
          const slot = parsed.primaryTeam === 'orange' ? parsed.orangeOrder?.[0] : parsed.blueOrder?.[0];
          if (slot !== undefined && hexMap[slot]) {
            targetHex = hexMap[slot];
          }
        } else {
          const legacySlot = localStorage.getItem('car-soccer:preferred-color');
          if (legacySlot !== null && hexMap[Number(legacySlot)]) {
            targetHex = hexMap[Number(legacySlot)];
          }
        }
        if (!targetHex) {
          targetHex = '#ffc107'; // Sunburst Yellow default
        }
        if (targetHex && typeof gameRuntime.setCarColor === 'function') {
          gameRuntime.setCarColor(0, targetHex);
        }
      }
    } catch (_) {}

    // Sync initial graphics configuration
    const initialGraphics = useUIStore.getState().graphics;
    gameRuntime.activeGraphicsSettings = initialGraphics;
    if (typeof gameRuntime.updateViewport === 'function') {
      gameRuntime.updateViewport(initialGraphics);
    }
    if (gameRuntime.arena) {
      gameRuntime.arena.setStadiumVisible?.(initialGraphics.showStadium);
      gameRuntime.arena.setRLViserStadiumVisible?.(initialGraphics.useRLViserStadium);
    }
    if (gameRuntime.clockScheduler) {
      gameRuntime.clockScheduler.setFpsLimit(initialGraphics.limitFps ? initialGraphics.maxFps : null);
    }

    // 2. Wire comprehensive reactive bridge
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
      onStartMatch: async (botId: string) => {
        if (!gameRuntime) return;
        useUIStore.getState().closeMenu();
        if (typeof gameRuntime.startBotMatch === 'function') {
          await gameRuntime.startBotMatch(botId);
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
      onRestartMatch: async () => {
        if (!gameRuntime) return;
        useUIStore.getState().closeMenu();
        if (typeof gameRuntime.startBotMatch === 'function') {
          await gameRuntime.startBotMatch();
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
        useUIStore.setState({ matchMode: 'freeplay' });
      },
      onHostOnlineWarmup: async (opts) => {
        if (!gameRuntime) return false;
        try {
          if (gameRuntime.onlineDialog) {
            gameRuntime.onlineDialog.playerName = opts.playerName;
            await gameRuntime.onlineDialog._startHosting(opts.roomId);
            return true;
          }
          if (typeof gameRuntime.hostOnlineServer === 'function') {
            await gameRuntime.hostOnlineServer({
              roomId: opts.roomId,
              playerName: opts.playerName,
            });
            return true;
          }
          return false;
        } catch (e) {
          console.error('[mountGameUI] Error hosting online warmup', e);
          return false;
        }
      },
      onJoinOnlineWarmup: async (opts) => {
        if (!gameRuntime) return false;
        try {
          if (gameRuntime.onlineDialog) {
            gameRuntime.onlineDialog.playerName = opts.playerName;
            return await new Promise<boolean>((resolve) => {
              let timer: any = null;
              let resolved = false;

              const finish = (ok: boolean) => {
                if (resolved) return;
                resolved = true;
                if (timer) clearTimeout(timer);
                resolve(ok);
              };

              // Extend timeout to 25s for WebRTC ICE gathering and NAT traversal
              timer = setTimeout(() => {
                const ch = gameRuntime.onlineDialog?.clientP2PChannel;
                if (ch && ch.connected) {
                  finish(true);
                } else {
                  console.warn('[mountGameUI] Join room timeout after 25s');
                  finish(false);
                }
              }, 25000);

              const checkChannel = () => {
                const ch = gameRuntime.onlineDialog?.clientP2PChannel;
                if (ch) {
                  if (ch.connected) {
                    finish(true);
                    return;
                  }
                  const origConnected = ch.onConnected;
                  ch.onConnected = async () => {
                    try {
                      if (origConnected) await origConnected();
                    } finally {
                      finish(true);
                    }
                  };
                  const origDisconnected = ch.onDisconnected;
                  ch.onDisconnected = () => {
                    if (origDisconnected) origDisconnected();
                    if (!ch.connected) finish(false);
                  };
                }
              };

              gameRuntime.onlineDialog._joinWithRoomId(opts.roomId)
                .then(() => {
                  checkChannel();
                })
                .catch((e: any) => {
                  console.warn('[mountGameUI] Join room failed:', e);
                  finish(false);
                });

              checkChannel();
            });
          }
          if (typeof gameRuntime.joinOnlineServer === 'function') {
            await gameRuntime.joinOnlineServer({
              roomId: opts.roomId,
              playerName: opts.playerName,
            });
            return true;
          }
          return false;
        } catch (e) {
          console.error('[mountGameUI] Error joining online warmup', e);
          return false;
        }
      },
      onLeaveOnlineServer: async () => {
        if (!gameRuntime) return;
        try {
          if (gameRuntime.onlineDialog) {
            await gameRuntime.onlineDialog.stopHosting?.();
          } else if (typeof gameRuntime.stopOnlineServer === 'function') {
            await gameRuntime.stopOnlineServer();
          }
          useUIStore.getState().setMatchMode('freeplay');
          useUIStore.getState().setOnlineSession({
            isHosting: false,
            roomId: '',
            signalingConnected: false,
            connectedPeers: [],
          });
        } catch (e) {
          console.error('[mountGameUI] Error stopping online server', e);
        }
      },
      onRemovePlayer: async (carIndex: number) => {
        if (!gameRuntime) return;
        if (typeof gameRuntime.removeRemotePlayer === 'function') {
          await gameRuntime.removeRemotePlayer(carIndex);
        }
      },
      onReconnectSignaling: async () => {
        if (!gameRuntime) return;
        try {
          if (gameRuntime.onlineDialog) {
            if (gameRuntime.onlineDialog.isHosting) {
              gameRuntime.onlineDialog._initHostSignaling();
            } else if (gameRuntime.onlineDialog.joinRoomId) {
              await gameRuntime.onlineDialog._joinWithRoomId(gameRuntime.onlineDialog.joinRoomId, gameRuntime.onlineDialog.joinPassword);
            }
          }
          useUIStore.getState().setOnlineSession({ signalingConnected: true });
        } catch (e) {
          console.error('[mountGameUI] Error reconnecting signaling', e);
        }
      },
      onResetBall: () => {
        if (!gameRuntime) return;
        gameRuntime.resetKickoff?.();
      },
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
          gameRuntime.arena.setRLViserStadiumVisible?.(graphicsConfig.useRLViserStadium);
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
      }
    });

    // Initial camera synchronization on startup
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

    // Initial ball trajectory synchronization on startup
    const initialTrajectory = useUIStore.getState().trajectory;
    if (gameRuntime.ballTrajectoryPredictor?.updateSettings) {
      gameRuntime.ballTrajectoryPredictor.updateSettings(initialTrajectory);
    } else if (gameRuntime.ballTrajectoryPredictor?.settings) {
      Object.assign(gameRuntime.ballTrajectoryPredictor.settings, initialTrajectory);
    }

    // Initial visual materials synchronization on startup
    const initialMaterials = useUIStore.getState().materials;
    syncMaterialsToGame(gameRuntime, initialMaterials);

    // Initial keybindings shortcut synchronization on startup
    const initialBindings = loadInputBindings();
    hudStore.getState().syncBindings(initialBindings);

    // Initial training boost rule & hitbox synchronization on startup
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

  return {
    openMenu: (route = 'main-menu') => useUIStore.getState().openMenu(route),
    closeMenu: () => useUIStore.getState().closeMenu(),
    toggleMenu: () => useUIStore.getState().toggleMenu(),
    syncVisualMaterials: () => syncMaterialsToGame(gameRuntime),
    destroy: () => {
      perfTelemetryStore.setSampler(null);
      root.unmount();
      rootEl?.remove();
    }
  };
}

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
  applyVisualMaterialsConfig(config);
  if (gameRuntime.arena?.markRenderTreeChanged) {
    gameRuntime.arena.markRenderTreeChanged();
  }
}

export { useUIStore } from './core/store';
export { GameUIRoot } from './GameUIRoot';
export * from './tokens';
export * from './primitives';
export * from './layout';
export * from './navigation';
export * from './recipes';
export * from './panels/DiagnosticsFloatingWindow';
export * from './core/UIInspector';
export * from './hud';
