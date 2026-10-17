import {
  ActiveMenuRoute,
  ROUTE_PARENT_MAP,
  ContainerTransitionMode,
  calculateSettingsSafeScale,
  ViewportMetrics,
  CameraConfig,
  MenuPowerSaveOption,
  GraphicsConfig,
  VisualMaterialsConfig,
  DEFAULT_MATERIALS_CONFIG,
  AudioConfig,
  GameplayConfig,
  TrajectoryConfig,
  DEFAULT_TRAJECTORY_CONFIG,
  BoostPadTunerConfig,
  DEFAULT_BOOST_PAD_TUNER_CONFIG,
  TelemetryDisplayMode,
  ClockPacingMode,
  TelemetryConfig,
  DEFAULT_TELEMETRY_CONFIG
} from './configTypes';

export * from './configTypes';
export * from './configStorageHydrators';
import {
  type DriftwoodsTunerConfig,
  type DriftwoodsPreset
} from './driftwoodsConfig';

export interface UIState {
  isOpen: boolean;
  activeRoute: ActiveMenuRoute;
  transitionMode: ContainerTransitionMode;
  activeCar: string;
  theme: 'dark' | 'light';
  safeAreaMargin: number; // -5 to +10
  uiScale: number; // 50 to 200 (%)
  setUiScale: (scale: number) => void;
  renderScale: number; // 25 to 100
  setRenderScale: (scale: number) => void;
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
  boostPadTuner: BoostPadTunerConfig;
  driftwoodsTuner: DriftwoodsTunerConfig;

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
  clockPacingMode: ClockPacingMode;
  setClockPacingMode: (mode: ClockPacingMode) => void;
  inputBufferTarget: number;
  setInputBufferTarget: (target: number) => void;
  inputBufferThreshold: [number, number]; // [catchupOffset, skipOffset], e.g. [-2, 2]
  setInputBufferThreshold: (range: [number, number]) => void;
  resetGameplay: () => void;
  updateCamera: (patch: Partial<CameraConfig>) => void;
  resetCamera: () => void;
  updateGraphics: (patch: Partial<GraphicsConfig>) => void;
  updateAudio: (patch: Partial<AudioConfig>) => void;
  updateGameplay: (patch: Partial<GameplayConfig>) => void;
  updateTrajectory: (patch: Partial<TrajectoryConfig>) => void;
  updateMaterials: (patch: Partial<VisualMaterialsConfig>) => void;
  updateTelemetry: (patch: Partial<TelemetryConfig>) => void;
  updateBoostPadTuner: (patch: Partial<BoostPadTunerConfig>) => void;
  resetBoostPadTuner: () => void;
  updateDriftwoodsTuner: (patch: Partial<DriftwoodsTunerConfig>) => void;
  resetDriftwoodsTuner: () => void;
  applyDriftwoodsPreset: (preset: DriftwoodsPreset) => void;

  // Free Camera developer fly-cam
  isFreeCam: boolean;
  freeCamFov: number;
  setFreeCam: (enabled: boolean) => void;
  toggleFreeCam: () => boolean;
  setFreeCamFov: (fov: number) => void;

  // Segmented control precision step: 1, 0.1, 0.01, 0.001, 0.0001
  precisionStep: number;
  setPrecisionStep: (step: number) => void;

  setLivePreviewCollapsed: (collapsed: boolean) => void;
  setHighlightSetting: (id: string | null) => void;
  clearHighlightSetting: () => void;
  setSettingsTargetTab: (tab: string) => void;

  // Match mode tracking
  matchMode: 'freeplay' | 'match' | 'online-warmup' | 'kickoff-training' | 'dev-test-lab';
  setMatchMode: (mode: 'freeplay' | 'match' | 'online-warmup' | 'kickoff-training' | 'dev-test-lab') => void;

  // Online warmup / multiplayer match session tracking
  onlineSession: {
    isHosting: boolean;
    roomId: string;
    playerName: string;
    signalingConnected: boolean;
    roomType?: 'warmup' | 'match';
    gameMode?: '1v1' | '2v2' | '3v3';
    botFillMode?: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom';
    matchDurationSeconds?: number;
    isReady?: boolean;
    connectedPeers: { id: string; name: string; pingMs: number; carIndex?: number; isBot?: boolean; team?: number }[];
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
    onStartMatch?: (botId: string, durationSeconds?: number) => void;
    onStartKickoffTraining?: () => void;
    onStartDevTestLab?: () => void;
    onRestartMatch?: () => void;
    onReturnToFreeplay?: () => void;
    onHostOnlineWarmup?: (opts: {
      roomId: string;
      playerName: string;
      roomType?: 'warmup' | 'match';
      gameMode?: '1v1' | '2v2' | '3v3';
      botFillMode?: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom';
      durationSeconds?: number;
      lobbyMode?: boolean;
    }) => Promise<boolean>;
    onJoinOnlineWarmup?: (opts: { roomId: string; playerName: string }) => Promise<boolean>;
    onLeaveOnlineServer?: () => Promise<void>;
    onRemovePlayer?: (carIndex: number) => Promise<void>;
    onReconnectSignaling?: () => Promise<void>;
    onForceStartOnlineMatch?: (durationSeconds?: number) => void;
    onSetOnlineGameMode?: (gameMode: '1v1' | '2v2' | '3v3') => void;
    onSetOnlineBotFillMode?: (botFillMode: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom') => void;
    onAddOnlineBot?: (team?: number) => void;
    onSetClientReady?: (ready: boolean) => void;
    onVoteSkipReplay?: () => void;
    onVoteRematch?: (ready: boolean) => void;
    onSwitchOnlineRoleTeam?: (role: 'player' | 'spectator', team: number) => void;
    onResetBall?: () => void;
    onCameraChange?: (config: CameraConfig) => void;
    onGraphicsChange?: (config: GraphicsConfig) => void;
    onAudioChange?: (config: AudioConfig) => void;
    onGameplayChange?: (config: GameplayConfig) => void;
    onTrajectoryChange?: (config: TrajectoryConfig) => void;
    onMaterialsChange?: (config: VisualMaterialsConfig) => void;
    onBoostPadTunerChange?: (config: BoostPadTunerConfig) => void;
    onDriftwoodsTunerChange?: (config: DriftwoodsTunerConfig) => void;
    onFreeCamToggle?: (enabled: boolean) => void;
    onFreeCamFovChange?: (fov: number) => void;
    onResetFreeCam?: () => void;
    onBindingsChange?: (bindings: any) => void;
    onClockPacingModeChange?: (mode: ClockPacingMode) => void;
    onInputBufferTargetChange?: (target: number) => void;
    onInputBufferThresholdChange?: (range: [number, number]) => void;
    onEnsureDeterminism?: () => void;
    onEnsureNetworkDiagnostics?: () => void;
    onSimulateBoostPadCollect?: (padIndex: number | 'all') => void;
    onSimulateBoostPadRefill?: (padIndex: number | 'all', duration?: number) => void;
  };
  setBridge: (bridge: Partial<UIState['bridge']>) => void;
}
