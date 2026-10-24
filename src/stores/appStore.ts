import { create } from 'zustand';
import { floatingStore } from './floatingStore';
import { OPACITY_MANAGER_PRESET } from './floatingPresets';
import {
  DEFAULT_DRIFTWOODS_CONFIG,
  cloneDriftwoodsConfig,
  mergeDriftwoodsConfig,
  type DriftwoodsTunerConfig,
} from '../config/driftwoodsConfig';
import { STORAGE_KEYS } from '../config/storageHelpers';
import {
  AppState,
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
} from './appStoreTypes';

// Re-export all type definitions and constants for single-source-of-truth compatibility
export * from './appStoreTypes';

export const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.classList.toggle('light', initialTheme === 'light');
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

let lastToggleMenuTime = 0;
let lastExpMultiBotsParentRoute: 'main-menu' | 'settings' = 'settings';

export const useAppStore = create<AppState>((set, get) => ({
  isOpen: false,
  activeRoute: 'main-menu',
  transitionMode: 'fluid-morph',
  activeCar: getInitialCar(),
  theme: initialTheme,
  matchMode: 'freeplay',
  setMatchMode: (mode) => set({ matchMode: mode }),
  onlineSession: {
    isHosting: false,
    roomId: '',
    playerName: 'Host',
    signalingConnected: false,
    gameMode: '1v1',
    botFillMode: 'no_bots',
    matchDurationSeconds: 300,
    isReady: false,
    connectedPeers: [],
  },
  setOnlineSession: (session) =>
    set((s) => ({ onlineSession: { ...s.onlineSession, ...session } })),
  renderScale: getInitialGraphics().renderScale ?? 50,
  setRenderScale: (scale) => get().updateGraphics({ renderScale: scale }),

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
  underDevelopment: {
    threeWheelsEnabled: false,
    stadiumPreset: 'standard',
    showThrowbackCollisionOverlay: false,
  },

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
    safeStorage.set?.(STORAGE_KEYS.CLOCK_PACING, mode);
    set({ clockPacingMode: mode });
    get().bridge.onClockPacingModeChange?.(mode);
  },
  inputBufferTarget: getInitialInputBufferTarget(),
  setInputBufferTarget: (target: number) => {
    const clamped = Math.max(1, Math.min(6, Math.round(target)));
    safeStorage.set?.(STORAGE_KEYS.INPUT_BUFFER_TARGET, clamped);
    const currentThreshold = get().inputBufferThreshold;
    const nextCatchup = Math.max(-clamped, Math.min(0, currentThreshold[0]));
    const nextSkip = Math.max(0, Math.min(clamped, currentThreshold[1]));
    const nextThreshold: [number, number] = [nextCatchup, nextSkip];
    safeStorage.set?.(STORAGE_KEYS.INPUT_BUFFER_THRESHOLD, JSON.stringify(nextThreshold));
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
    safeStorage.set?.(STORAGE_KEYS.INPUT_BUFFER_THRESHOLD, JSON.stringify(clamped));
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

  navigate: (route) => {
    const current = get().activeRoute;
    if (route === 'exp-multi-bots-config') {
      lastExpMultiBotsParentRoute = current === 'main-menu' ? 'main-menu' : 'settings';
    }
    set({ activeRoute: route, isLivePreviewCollapsed: false });
  },

  goBack: () => {
    const current = get().activeRoute;
    if (current === 'exp-multi-bots-config') {
      set({ activeRoute: lastExpMultiBotsParentRoute, isLivePreviewCollapsed: false });
      return;
    }
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
    safeStorage.set(STORAGE_KEYS.DISPLAY_SETTINGS, JSON.stringify({ vehiclePreset: carId, carVisual: carId }));
    get().bridge.onVehicleChange?.(carId);
  },

  setTheme: (theme) => {
    set({ theme });
    safeStorage.set(STORAGE_KEYS.UI_THEME, theme);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  },

  updateCamera: (patch) => {
    set((s) => {
      const nextCamera = { ...s.camera, ...patch };
      safeStorage.set(STORAGE_KEYS.CAMERA_SETTINGS, JSON.stringify(nextCamera));
      get().bridge.onCameraChange?.(nextCamera);
      return { camera: nextCamera };
    });
  },

  resetCamera: () => {
    set(() => {
      const reset = { ...DEFAULT_CAMERA_SETTINGS };
      safeStorage.set(STORAGE_KEYS.CAMERA_SETTINGS, JSON.stringify(reset));
      get().bridge.onCameraChange?.(reset);
      return { camera: reset };
    });
  },

  updateGraphics: (patch) => {
    set((s) => {
      const nextGraphics = { ...s.graphics, ...patch };
      safeStorage.set(STORAGE_KEYS.GRAPHICS_SETTINGS, JSON.stringify(nextGraphics));
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
      safeStorage.set(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(nextAudio));
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
      safeStorage.set(STORAGE_KEYS.TRAJECTORY, JSON.stringify(nextTrajectory));
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
      safeStorage.set(STORAGE_KEYS.TELEMETRY_SETTINGS, JSON.stringify(nextTelemetry));
      return { telemetry: nextTelemetry };
    });
  },

  updateBoostPadTuner: (patch) => {
    set((s) => {
      const next = { ...s.boostPadTuner, ...patch };
      safeStorage.set(STORAGE_KEYS.BOOST_PAD_TUNER, JSON.stringify(next));
      get().bridge.onBoostPadTunerChange?.(next);
      return { boostPadTuner: next };
    });
  },

  resetBoostPadTuner: () => {
    set(() => {
      safeStorage.set(STORAGE_KEYS.BOOST_PAD_TUNER, JSON.stringify(DEFAULT_BOOST_PAD_TUNER_CONFIG));
      get().bridge.onBoostPadTunerChange?.(DEFAULT_BOOST_PAD_TUNER_CONFIG);
      return { boostPadTuner: { ...DEFAULT_BOOST_PAD_TUNER_CONFIG } };
    });
  },

  updateDriftwoodsTuner: (patch) => {
    set((s) => {
      const next: DriftwoodsTunerConfig = mergeDriftwoodsConfig(s.driftwoodsTuner, patch);
      safeStorage.set(STORAGE_KEYS.DRIFTWOODS_TUNER, JSON.stringify(next));
      get().bridge.onDriftwoodsTunerChange?.(next);
      return { driftwoodsTuner: next };
    });
  },

  resetDriftwoodsTuner: () => {
    set(() => {
      const reset = cloneDriftwoodsConfig(DEFAULT_DRIFTWOODS_CONFIG);
      safeStorage.set(STORAGE_KEYS.DRIFTWOODS_TUNER, JSON.stringify(reset));
      get().bridge.onDriftwoodsTunerChange?.(reset);
      return { driftwoodsTuner: reset };
    });
  },

  applyDriftwoodsPreset: (preset) => {
    set(() => {
      const cloned = cloneDriftwoodsConfig(preset.config);
      safeStorage.set(STORAGE_KEYS.DRIFTWOODS_TUNER, JSON.stringify(cloned));
      get().bridge.onDriftwoodsTunerChange?.(cloned);
      return { driftwoodsTuner: cloned };
    });
  },

  updateUnderDevelopment: async (patch) => {
    const next = { ...get().underDevelopment, ...patch };
    set({ underDevelopment: next });
    await get().bridge.onUnderDevelopmentChange?.(next, patch);
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
