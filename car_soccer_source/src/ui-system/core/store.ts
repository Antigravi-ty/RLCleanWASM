import { create } from 'zustand';
import { DEFAULT_CAMERA_SETTINGS } from '../../config/cameraDefaults.js';
import { floatingStore } from '../tokens/floatingStore';

export type ActiveMenuRoute =
  | 'main-menu'
  | 'play'
  | 'bot-difficulty'
  | 'online-warmup'
  | 'room-host-control'
  | 'garage'
  | 'settings'
  | 'audio-eq'
  | 'trajectory'
  | 'camera'
  | 'training'
  | 'keybindings'
  | 'advanced-controller'
  | 'advanced-audio'
  | 'event-and-triggerer';

export const ROUTE_PARENT_MAP: Record<ActiveMenuRoute, ActiveMenuRoute | null> = {
  'main-menu': null,
  'play': 'main-menu',
  'bot-difficulty': 'play',
  'online-warmup': 'play',
  'room-host-control': 'main-menu',
  'garage': 'main-menu',
  'settings': 'main-menu',
  'audio-eq': 'settings',
  'trajectory': 'settings',
  'camera': 'settings',
  'training': 'settings',
  'keybindings': 'settings',
  'advanced-controller': 'keybindings',
  'advanced-audio': 'settings',
  'event-and-triggerer': 'settings',
};

export type ContainerTransitionMode = 'fluid-morph' | 'sequenced-step';

export interface ViewportMetrics {
  scaleFactor: number;
  renderWidth: number;
  renderHeight: number;
  isPortrait: boolean;
  isPillarboxed: boolean;
  pillarboxWidth: number;
  safeMarginPct: number;
}

export interface CameraConfig {
  cameraShake: boolean;
  fov: number;
  distance: number;
  height: number;
  angleDeg: number;
  stiffness: number;
  swivelSpeed: number;
  transitionSpeed: number;
  invertSwivel: boolean;
}

export type MenuPowerSaveOption = 'freeze' | '15' | '30' | 'match';

export interface GraphicsConfig {
  renderScale: number; // 25 to 100
  limitFps: boolean;
  maxFps: number; // 15 to 240
  showStadium: boolean;
  useRLViserStadium: boolean;
  pauseRenderingOnMenu: boolean;
  menuPowerSave: MenuPowerSaveOption;
}

export interface VisualMaterialsConfig {
  ballStyle: 'arcade' | 'realistic';
  carPaint: 'arcade' | 'realistic';
  stadiumScenery: 'arcade' | 'realistic';
  pitchTurf: 'arcade' | 'realistic';
  demolishedEffect: 'arcade' | 'realistic';
  boostVisual: 'arcade' | 'realistic';
  boostFlameLuminance: 'balanced' | 'dynamic';
  boostPlumeLuminance: 'min' | 'balanced' | 'dynamic' | 'hdr';
}

export const DEFAULT_MATERIALS_CONFIG: VisualMaterialsConfig = {
  ballStyle: 'arcade',
  carPaint: 'arcade',
  stadiumScenery: 'realistic',
  pitchTurf: 'realistic',
  demolishedEffect: 'arcade',
  boostVisual: 'realistic',
  boostFlameLuminance: 'balanced',
  boostPlumeLuminance: 'min',
};

export interface AudioConfig {
  masterVolume: number;
  engineVolume: number;
  boostVolume: number;
  continueAudioOnLostFocus?: boolean;
  bassGain: number;
  midGain: number;
  trebleGain: number;
  hrtfEnabled: boolean;
}

export interface GameplayConfig {
  goalRestart: boolean;
  unlimitedBoost: boolean;
  showCarHitbox: boolean;
  ballCamIndicator: boolean;
}

export interface TrajectoryConfig {
  enabled: boolean;
  predictionTicks: number; // 60 to 600 ticks (0.5s - 5.0s @ 120Hz)
  solidTicks: number; // 5 to 240 ticks
  transparentTicks: number; // 5 to 240 ticks
  thickness: number; // 1% to 75% of ball diameter
  opacity: number; // 0.05 to 1.0
  color: string;
  dynamicMode: boolean; // true: dynamic flow (ball pushes line), false: static path
  duration?: number;
}

export const DEFAULT_TRAJECTORY_CONFIG: TrajectoryConfig = {
  enabled: true,
  predictionTicks: 600,
  solidTicks: 50,
  transparentTicks: 20,
  thickness: 10,
  opacity: 0.5,
  color: '#000000',
  dynamicMode: true,
  duration: 5.0
};

export type TelemetryDisplayMode = 'off' | 'on_demand' | 'always';

export interface TelemetryConfig {
  alwaysShow: boolean;
  fpsMode: TelemetryDisplayMode;
  refreshRateMode: TelemetryDisplayMode;
  renderScaleMode: TelemetryDisplayMode;
  physicsRateMode: TelemetryDisplayMode;
  latencyMode: TelemetryDisplayMode;
}

export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  alwaysShow: true,
  fpsMode: 'always',
  refreshRateMode: 'always',
  renderScaleMode: 'always',
  physicsRateMode: 'always',
  latencyMode: 'always',
};

const safeStorage = {
  get: (k: string, fallback: string | null = null): string | null => {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(k) ?? fallback : fallback;
    } catch {
      return fallback;
    }
  },
  set: (k: string, v: unknown): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(k, String(v));
    } catch {
      // ignore
    }
  }
};

const getInitialCar = (): string => {
  const raw = safeStorage.get('car-soccer.display-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.vehiclePreset) return parsed.vehiclePreset;
      if (parsed?.carVisual) return parsed.carVisual;
    } catch {
      // ignore
    }
  }
  return 'game-car';
};

const getInitialMargin = (): number => {
  const val = safeStorage.get('simpleui-safe-area-margin');
  if (val !== null) {
    const num = parseInt(val, 10);
    if (!Number.isNaN(num)) return Math.min(10, Math.max(-5, num));
  }
  return 0;
};

const getInitialSafeAreaHud = (): boolean => {
  return safeStorage.get('simpleui-safe-area-visible') === 'true';
};

const getInitialTheme = (): 'dark' | 'light' => {
  const saved = safeStorage.get('car-soccer.ui-theme.v1');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'light';
};

const getInitialCamera = (): CameraConfig => {
  const raw = safeStorage.get('car-soccer.camera-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CAMERA_SETTINGS, ...parsed };
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_CAMERA_SETTINGS };
};

const getInitialTrajectory = (): TrajectoryConfig => {
  const raw = safeStorage.get('car_soccer_ball_trajectory_config_v3') ||
              safeStorage.get('car_soccer_ball_trajectory_config_v2');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TRAJECTORY_CONFIG,
        ...parsed,
        duration: parsed.predictionTicks ? Number((parsed.predictionTicks / 120).toFixed(1)) : DEFAULT_TRAJECTORY_CONFIG.duration
      };
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_TRAJECTORY_CONFIG };
};

const getInitialGraphics = (): GraphicsConfig => {
  const raw = safeStorage.get('car-soccer.graphics-settings.v2') ||
              safeStorage.get('car-soccer.graphics-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        renderScale: parsed.renderScale ?? 50,
        limitFps: parsed.limitFps ?? true,
        maxFps: Math.max(15, Math.min(240, parsed.maxFps ?? 120)),
        showStadium: parsed.showStadium ?? true,
        useRLViserStadium: parsed.useRLViserStadium ?? false,
        pauseRenderingOnMenu: parsed.pauseRenderingOnMenu ?? true,
        menuPowerSave: parsed.menuPowerSave ?? (parsed.pauseRenderingOnMenu ? 'freeze' : '30'),
      };
    } catch {
      // ignore
    }
  }
  return {
    renderScale: 50,
    limitFps: true,
    maxFps: 120,
    showStadium: true,
    useRLViserStadium: false,
    pauseRenderingOnMenu: true,
    menuPowerSave: '30',
  };
};

const getInitialMaterials = (): VisualMaterialsConfig => {
  const raw = safeStorage.get('car-soccer.visual-materials.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_MATERIALS_CONFIG, ...parsed };
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_MATERIALS_CONFIG };
};

const getInitialTelemetry = (): TelemetryConfig => {
  const raw = safeStorage.get('car-soccer.telemetry-settings.v1');
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TELEMETRY_CONFIG, ...parsed };
    } catch {
      // ignore
    }
  }
  return { ...DEFAULT_TELEMETRY_CONFIG };
};

const getInitialDeveloperMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('dev') === '1';
  } catch {
    return false;
  }
};

export interface UIState {
  isOpen: boolean;
  activeRoute: ActiveMenuRoute;
  transitionMode: ContainerTransitionMode;
  activeCar: string;
  theme: 'dark' | 'light';
  safeAreaMargin: number; // -5 to +10
  showSafeAreaHud: boolean;
  portraitDismissed: boolean;
  metrics: ViewportMetrics;

  // Subsystem configs
  camera: CameraConfig;
  graphics: GraphicsConfig;
  audio: AudioConfig;
  gameplay: GameplayConfig;
  trajectory: TrajectoryConfig;
  materials: VisualMaterialsConfig;
  telemetry: TelemetryConfig;

  // Settings navigation & highlight pulse
  highlightSetting: string | null;
  settingsTargetTab: string;

  // Live Preview dock state
  isLivePreviewCollapsed: boolean;

  // Actions
  openMenu: (route?: ActiveMenuRoute) => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  navigate: (route: ActiveMenuRoute) => void;
  goBack: () => void;
  setTransitionMode: (mode: ContainerTransitionMode) => void;
  setActiveCar: (carId: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSafeAreaMargin: (margin: number) => void;
  setShowSafeAreaHud: (show: boolean) => void;
  dismissPortraitGate: () => void;
  setMetrics: (metrics: ViewportMetrics) => void;

  // Subsystem setters
  developerMode: boolean;
  setDeveloperMode: (mode: boolean) => void;
  resetGameplay: () => void;
  updateCamera: (patch: Partial<CameraConfig>) => void;
  resetCamera: () => void;
  updateGraphics: (patch: Partial<GraphicsConfig>) => void;
  updateAudio: (patch: Partial<AudioConfig>) => void;
  updateGameplay: (patch: Partial<GameplayConfig>) => void;
  updateTrajectory: (patch: Partial<TrajectoryConfig>) => void;
  updateMaterials: (patch: Partial<VisualMaterialsConfig>) => void;
  updateTelemetry: (patch: Partial<TelemetryConfig>) => void;
  setLivePreviewCollapsed: (collapsed: boolean) => void;
  setHighlightSetting: (id: string | null) => void;
  clearHighlightSetting: () => void;
  setSettingsTargetTab: (tab: string) => void;

  // Match mode tracking
  matchMode: 'freeplay' | 'match' | 'online-warmup';
  setMatchMode: (mode: 'freeplay' | 'match' | 'online-warmup') => void;

  // Online warmup session tracking
  onlineSession: {
    isHosting: boolean;
    roomId: string;
    playerName: string;
    signalingConnected: boolean;
    connectedPeers: { id: string; name: string; pingMs: number }[];
  };
  setOnlineSession: (session: Partial<UIState['onlineSession']>) => void;

  // Runtime Bridge callbacks
  bridge: {
    onVehicleChange?: (carId: string) => void;
    onColorChange?: (hex: string, slotId?: number) => void;
    onResume?: () => void;
    onOverlayChange?: (isOpen: boolean) => void;
    onOpenGarage?: () => void;
    onOpenSettings?: (tab?: string) => void;
    onOpenPlay?: () => void;
    onStartMatch?: (botId: string) => void;
    onRestartMatch?: () => void;
    onReturnToFreeplay?: () => void;
    onHostOnlineWarmup?: (opts: { roomId: string; playerName: string }) => Promise<boolean>;
    onJoinOnlineWarmup?: (opts: { roomId: string; playerName: string }) => Promise<boolean>;
    onLeaveOnlineServer?: () => Promise<void>;
    onResetBall?: () => void;
    onCameraChange?: (config: CameraConfig) => void;
    onGraphicsChange?: (config: GraphicsConfig) => void;
    onAudioChange?: (config: AudioConfig) => void;
    onGameplayChange?: (config: GameplayConfig) => void;
    onTrajectoryChange?: (config: TrajectoryConfig) => void;
    onMaterialsChange?: (config: VisualMaterialsConfig) => void;
    onBindingsChange?: (bindings: any) => void;
  };
  setBridge: (bridge: Partial<UIState['bridge']>) => void;
}

const initialTheme = getInitialTheme();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.classList.toggle('light', initialTheme === 'light');
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

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
    connectedPeers: [],
  },
  setOnlineSession: (session) =>
    set((s) => ({ onlineSession: { ...s.onlineSession, ...session } })),
  safeAreaMargin: getInitialMargin(),
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

  highlightSetting: null,
  settingsTargetTab: 'gameplay',

  isLivePreviewCollapsed: false,
  bridge: {},

  developerMode: getInitialDeveloperMode(),
  setDeveloperMode: (mode) => set({ developerMode: mode }),
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
    const isCurrentlyOpen = get().isOpen;
    if (isCurrentlyOpen) {
      get().closeMenu();
    } else {
      get().openMenu('main-menu');
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
      return { graphics: nextGraphics };
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
      safeStorage.set('car-soccer.visual-materials.v1', JSON.stringify(nextMaterials));
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
