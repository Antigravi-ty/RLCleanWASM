import { create } from 'zustand';
import { floatingStore } from '../tokens/floatingStore';
import { OPACITY_MANAGER_PRESET } from '../tokens/floatingPresets';
import {
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig,
  type DriftwoodsTunerConfig,
} from './driftwoodsConfig';
import {
  UIState,
  ClockPacingMode,
  ROUTE_PARENT_MAP,
  safeStorage,
  DEFAULT_CAMERA_SETTINGS,
  getMaterialsConfig,
  setMaterialsConfig,
  DEFAULT_MATERIALS_CONFIG,
  DEFAULT_TRAJECTORY_CONFIG,
  DEFAULT_BOOST_PAD_TUNER_CONFIG,
  DEFAULT_TELEMETRY_CONFIG,
  getInitialCar,
  getInitialMargin,
  getInitialUiScale,
  getInitialSafeAreaHud,
  getInitialTheme,
  getInitialCamera,
  getInitialTrajectory,
  getInitialGraphics,
  getInitialMaterials,
  getInitialTelemetry,
  getInitialDeveloperMode,
  getInitialBoostPadTuner,
  getInitialDriftwoodsTuner,
  getInitialInputBufferTarget,
  getInitialInputBufferThreshold
} from './storeTypes';

// Re-export all type definitions and constants for single-source-of-truth compatibility
export * from './storeTypes';

export const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.classList.toggle('light', initialTheme === 'light');
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

let lastToggleMenuTime = 0;

export const useUIStore = create<UIState>((set, get) => ({
  isOpen: false,
  activeRoute: 'main-menu',
  transitionMode: 'fluid-morph',
  activeCar: getInitialCar(),
  theme: initialTheme,
  matchMode: 'freeplay',
  setMatchMode: (mode) => set({ matchMode: mode }),
  onlineSession: {
    isHosting: true,
    roomId: '',
    playerName: 'Host',
    signalingConnected: true,
    gameMode: '1v1',
    botFillMode: 'no_bots',
    matchDurationSeconds: 300,
    isReady: false,
    connectedPeers: [],
  },
  setOnlineSession: (session) =>
    set((s) => ({ onlineSession: { ...s.onlineSession, ...session } })),
  safeAreaMargin: getInitialMargin(),
  uiScale: getInitialUiScale(),
  setUiScale: (scale) => {
    const clamped = Math.min(200, Math.max(50, Math.round(scale)));
    safeStorage.set('car-soccer.ui-scale.v1', clamped);
    set({ uiScale: clamped });
  },
  renderScale: getInitialGraphics().renderScale ?? 50,
  setRenderScale: (scale) => get().updateGraphics({ renderScale: scale }),
  showSafeAreaHud: getInitialSafeAreaHud(),
  portraitDismissed: false,
  metrics: {
    scaleFactor: 1,
    renderWidth: 1920,
    renderHeight: 1080,
    isPortrait: false,
    isPillarboxed: false,
    pillarboxWidth: 0,
    safeMarginPct: 0
  },

  camera: getInitialCamera(),

  graphics: getInitialGraphics(),

  audio: {
    masterVolume: 80,
    engineVolume: 75,
    boostVolume: 85,
    bassGain: 0,
    midGain: 0,
    trebleGain: 0,
    hrtfEnabled: true
  },

  gameplay: {
    goalRestart: true,
    unlimitedBoost: true,
    showCarHitbox: true,
    ballCamIndicator: true,
  },

  trajectory: getInitialTrajectory(),
  materials: getInitialMaterials(),
  telemetry: getInitialTelemetry(),
  boostPadTuner: getInitialBoostPadTuner(),
  driftwoodsTuner: getInitialDriftwoodsTuner(),

  highlightSetting: null,
  settingsTargetTab: 'gameplay',

  isLivePreviewCollapsed: false,
  bridge: {},

  developerMode: getInitialDeveloperMode(),
  setDeveloperMode: (mode) => {
    set({ developerMode: mode });
    if (mode) {
      const existing = floatingStore.getSnapshot().windows.some((w) => w.id === OPACITY_MANAGER_PRESET.id);
      if (!existing) {
        floatingStore.spawnWindow({
          ...OPACITY_MANAGER_PRESET,
          startMinimized: true,
        });
      }
    }
  },
  clockPacingMode: 'legacy' as ClockPacingMode,
  setClockPacingMode: (mode: ClockPacingMode) => {
    safeStorage.set?.('car-soccer.clock-pacing.v1', mode);
    set({ clockPacingMode: mode });
    get().bridge.onClockPacingModeChange?.(mode);
  },
  inputBufferTarget: getInitialInputBufferTarget(),
  setInputBufferTarget: (target: number) => {
    const clamped = Math.max(1, Math.min(6, Math.round(target)));
    safeStorage.set?.('car-soccer.input-buffer-target.v1', clamped);
    const currentThreshold = get().inputBufferThreshold;
    const nextCatchup = Math.max(-clamped, Math.min(0, currentThreshold[0]));
    const nextSkip = Math.max(0, Math.min(clamped, currentThreshold[1]));
    const nextThreshold: [number, number] = [nextCatchup, nextSkip];
    safeStorage.set?.('car-soccer.input-buffer-threshold.v1', JSON.stringify(nextThreshold));
    set({ inputBufferTarget: clamped, inputBufferThreshold: nextThreshold });
    get().bridge.onInputBufferTargetChange?.(clamped);
    get().bridge.onInputBufferThresholdChange?.(nextThreshold);
  },
  inputBufferThreshold: getInitialInputBufferThreshold(),
  setInputBufferThreshold: (range: [number, number]) => {
    const alpha = get().inputBufferTarget;
    const catchup = Math.max(-alpha, Math.min(0, Math.round(range[0])));
    const skip = Math.max(0, Math.min(alpha, Math.round(range[1])));
    const clamped: [number, number] = [catchup, skip];
    safeStorage.set?.('car-soccer.input-buffer-threshold.v1', JSON.stringify(clamped));
    set({ inputBufferThreshold: clamped });
    get().bridge.onInputBufferThresholdChange?.(clamped);
  },
  resetGameplay: () => {
    const next = { goalRestart: true, unlimitedBoost: true, showCarHitbox: true, ballCamIndicator: true };
    get().bridge.onGameplayChange?.(next);
    set({ gameplay: next });
  },

  setHighlightSetting: (id) => set({ highlightSetting: id }),
  clearHighlightSetting: () => set({ highlightSetting: null }),
  setSettingsTargetTab: (tab) => set({ settingsTargetTab: tab }),

  setBridge: (bridge) => set((state) => ({ bridge: { ...state.bridge, ...bridge } })),

  openMenu: (route = 'main-menu') => {
    set({ isOpen: true, activeRoute: route, isLivePreviewCollapsed: false });
    get().bridge.onOverlayChange?.(true);
    floatingStore.triggerBatchMinimize();
  },

  closeMenu: () => {
    set({ isOpen: false, activeRoute: 'main-menu', isLivePreviewCollapsed: false });
    const b = get().bridge;
    b.onOverlayChange?.(false);
    b.onResume?.();
  },

  toggleMenu: () => {
    const now = Date.now();
    if (now - lastToggleMenuTime < 180) {
      return;
    }
    lastToggleMenuTime = now;
    const state = get();
    if (state.isOpen) {
      if (state.isLivePreviewCollapsed) {
        state.setLivePreviewCollapsed(false);
      } else {
        state.goBack();
      }
    } else {
      state.openMenu('main-menu');
    }
  },

  navigate: (route) => set({ activeRoute: route, isLivePreviewCollapsed: false }),

  goBack: () => {
    const current = get().activeRoute;
    const parent = ROUTE_PARENT_MAP[current];
    if (parent) {
      set({ activeRoute: parent, isLivePreviewCollapsed: false });
    } else {
      get().closeMenu();
    }
  },

  setTransitionMode: (mode) => set({ transitionMode: mode }),

  setActiveCar: (carId) => {
    set({ activeCar: carId });
    safeStorage.set('car-soccer.display-settings.v1', JSON.stringify({ vehiclePreset: carId, carVisual: carId }));
    get().bridge.onVehicleChange?.(carId);
  },

  setTheme: (theme) => {
    set({ theme });
    safeStorage.set('car-soccer.ui-theme.v1', theme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  },

  setSafeAreaMargin: (pct) => {
    const clamped = Math.min(10, Math.max(-5, Math.round(pct)));
    set({ safeAreaMargin: clamped });
    safeStorage.set('simpleui-safe-area-margin', clamped);
  },

  setShowSafeAreaHud: (show) => {
    set({ showSafeAreaHud: show });
    safeStorage.set('simpleui-safe-area-visible', show);
  },

  dismissPortraitGate: () => set({ portraitDismissed: true }),

  setMetrics: (metrics) => set({ metrics }),

  updateCamera: (patch) => {
    set((s) => {
      const nextCamera = { ...s.camera, ...patch };
      safeStorage.set('car-soccer.camera-settings.v1', JSON.stringify(nextCamera));
      get().bridge.onCameraChange?.(nextCamera);
      return { camera: nextCamera };
    });
  },

  resetCamera: () => {
    set(() => {
      const reset = { ...DEFAULT_CAMERA_SETTINGS };
      safeStorage.set('car-soccer.camera-settings.v1', JSON.stringify(reset));
      get().bridge.onCameraChange?.(reset);
      return { camera: reset };
    });
  },

  updateGraphics: (patch) => {
    set((s) => {
      const nextGraphics = { ...s.graphics, ...patch };
      safeStorage.set('car-soccer.graphics-settings.v2', JSON.stringify(nextGraphics));
      safeStorage.set('car-soccer.graphics-settings.v1', JSON.stringify(nextGraphics));
      get().bridge.onGraphicsChange?.(nextGraphics);
      return {
        graphics: nextGraphics,
        renderScale: patch.renderScale !== undefined ? patch.renderScale : s.renderScale,
      };
    });
  },

  updateAudio: (patch) => {
    set((s) => {
      const nextAudio = { ...s.audio, ...patch };
      safeStorage.set('car-soccer.audio-settings.v1', JSON.stringify(nextAudio));
      get().bridge.onAudioChange?.(nextAudio);
      return { audio: nextAudio };
    });
  },

  updateGameplay: (patch) => {
    set((s) => {
      const nextGameplay = { ...s.gameplay, ...patch };
      get().bridge.onGameplayChange?.(nextGameplay);
      return { gameplay: nextGameplay };
    });
  },

  updateTrajectory: (patch) => {
    set((s) => {
      const nextTrajectory = { ...s.trajectory, ...patch };
      safeStorage.set('car_soccer_ball_trajectory_config_v3', JSON.stringify(nextTrajectory));
      get().bridge.onTrajectoryChange?.(nextTrajectory);
      return { trajectory: nextTrajectory };
    });
  },

  updateMaterials: (patch) => {
    set((s) => {
      const nextMaterials = { ...s.materials, ...patch };
      setMaterialsConfig(nextMaterials);
      get().bridge.onMaterialsChange?.(nextMaterials);
      return { materials: nextMaterials };
    });
  },

  updateTelemetry: (patch) => {
    set((s) => {
      const nextTelemetry = { ...s.telemetry, ...patch };
      // If FPS is turned off, Screen Refresh Rate must also be turned off
      if (nextTelemetry.fpsMode === 'off') {
        nextTelemetry.refreshRateMode = 'off';
      }
      safeStorage.set('car-soccer.telemetry-settings.v1', JSON.stringify(nextTelemetry));
      return { telemetry: nextTelemetry };
    });
  },

  updateBoostPadTuner: (patch) => {
    set((s) => {
      const next = { ...s.boostPadTuner, ...patch };
      safeStorage.set('car-soccer.boost-pad-tuner.v1', JSON.stringify(next));
      get().bridge.onBoostPadTunerChange?.(next);
      return { boostPadTuner: next };
    });
  },

  resetBoostPadTuner: () => {
    set(() => {
      safeStorage.set('car-soccer.boost-pad-tuner.v1', JSON.stringify(DEFAULT_BOOST_PAD_TUNER_CONFIG));
      get().bridge.onBoostPadTunerChange?.(DEFAULT_BOOST_PAD_TUNER_CONFIG);
      return { boostPadTuner: { ...DEFAULT_BOOST_PAD_TUNER_CONFIG } };
    });
  },

  updateDriftwoodsTuner: (patch) => {
    set((s) => {
      const next: DriftwoodsTunerConfig = mergeDriftwoodsConfig(s.driftwoodsTuner, patch);
      safeStorage.set('car-soccer.driftwoods-tuner.v1', JSON.stringify(next));
      get().bridge.onDriftwoodsTunerChange?.(next);
      return { driftwoodsTuner: next };
    });
  },

  resetDriftwoodsTuner: () => {
    set(() => {
      const reset = cloneDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG);
      safeStorage.set('car-soccer.driftwoods-tuner.v1', JSON.stringify(reset));
      get().bridge.onDriftwoodsTunerChange?.(reset);
      return { driftwoodsTuner: reset };
    });
  },

  applyDriftwoodsPreset: (preset) => {
    set(() => {
      const cloned = cloneDriftwoodsConfig(preset.config);
      safeStorage.set('car-soccer.driftwoods-tuner.v1', JSON.stringify(cloned));
      get().bridge.onDriftwoodsTunerChange?.(cloned);
      return { driftwoodsTuner: cloned };
    });
  },

  isFreeCam: false,
  freeCamFov: 80,
  setFreeCam: (enabled: boolean) => {
    const shouldEnable = Boolean(enabled);
    set({ isFreeCam: shouldEnable });
    get().bridge.onFreeCamToggle?.(shouldEnable);
  },
  toggleFreeCam: () => {
    const next = !get().isFreeCam;
    set({ isFreeCam: next });
    get().bridge.onFreeCamToggle?.(next);
    return next;
  },
  setFreeCamFov: (fov: number) => {
    const safeFov = Math.max(10, Math.min(140, Number(fov) || 80));
    set({ freeCamFov: safeFov });
    get().bridge.onFreeCamFovChange?.(safeFov);
  },

  precisionStep: 0.001,
  setPrecisionStep: (step: number) => {
    set({ precisionStep: step });
  },

  setLivePreviewCollapsed: (collapsed) => {
    set({ isLivePreviewCollapsed: collapsed });
    const b = get().bridge;
    if (collapsed) {
      // Live preview collapsed: allow inputs to penetrate to Three.js canvas & unpause simulation
      b.onOverlayChange?.(false);
      b.onResume?.();
    } else {
      // Live preview restored: pause background game inputs and capture modal focus
      b.onOverlayChange?.(true);
    }
  }
}));
