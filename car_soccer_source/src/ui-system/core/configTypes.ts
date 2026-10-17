export type ActiveMenuRoute =
  | 'main-menu'
  | 'play'
  | 'bot-difficulty'
  | 'custom-training'
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
  'custom-training': 'play',
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

export function calculateSettingsSafeScale(windowWidth: number, windowHeight: number, safeAreaMargin: number): number {
  const marginW = windowWidth * (safeAreaMargin / 100);
  const marginH = windowHeight * (safeAreaMargin / 100);
  const Wsafe = Math.max(100, windowWidth - marginW * 2);
  const Hsafe = Math.max(100, windowHeight - marginH * 2);
  const maxAllowedW = Math.max(100, Wsafe - 32);
  const maxAllowedH = Math.max(100, Hsafe - 32);
  return Math.max(50, Math.floor(Math.min(maxAllowedW / 680, maxAllowedH / 540) * 100));
}

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
  pauseRenderingOnMenu: boolean;
  menuPowerSave: MenuPowerSaveOption;
}

export interface VisualMaterialsConfig {
  ballStyle: 'arcade' | 'realistic';
  carPaint: 'arcade' | 'realistic';
  stadiumScenery: 'arcade' | 'realistic';
  demolishedEffect: 'arcade' | 'realistic';
  boostVisual: 'arcade' | 'realistic';
  boostFlameLuminance: 'balanced' | 'dynamic';
  boostPlumeLuminance: 'min' | 'balanced' | 'dynamic' | 'hdr';
}

export const DEFAULT_MATERIALS_CONFIG: VisualMaterialsConfig = {
  ballStyle: 'arcade',
  carPaint: 'arcade',
  stadiumScenery: 'realistic',
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

export interface BoostPadTunerConfig {
  // 1. Upward gradient glow shader
  bottomOpacity: number;
  topOpacity: number;
  midpoint: number;
  topCutoff?: number;
  power: number;
  glowIntensity: number;
  glowColor: string;
  coreColor: string;
  glowHeightOffsetBig?: number;
  glowHeightOffsetSmall?: number;

  // 2. Big pad floating orb
  orbRadius: number;
  orbHeightOffset: number;
  orbEmissiveIntensity: number;
  orbColor: string;

  // 3. Materials coloring & PBR physics
  topColor: string;
  topInactiveColor?: string;
  sideColor: string;
  sideFollowsBase: boolean;
  baseColor: string;
  baseRoughness?: number;
  baseMetalness?: number;
  sideRoughness?: number;
  sideMetalness?: number;
  topRoughness?: number;
  topMetalness?: number;
  padHeightOffset?: number;

  // 4. Big Pad Black Silhouette / Out Glow (Camera relative)
  shadowEnabled: boolean;
  shadowRadius: number;
  shadowIntensity: number;
  shadowDistanceScale: number;

  // 5. Refilling Countdown Shrinking Glow
  refillEnabled: boolean;
  bigRefillThreshold: number;
  smallRefillThreshold: number;
  refillGlowColor?: string;
  refillGlowIntensity?: number;

  // 6. Upward Glow Dissolve Animation
  collectDuration: number;
  bezierP1X: number;
  bezierP1Y: number;
  bezierP2X: number;
  bezierP2Y: number;
  ballSquashFactor?: number;
  flashEnabled?: boolean;
  flashColor?: string;
  flashDuration?: number;
  flashMode?: 'on_demand' | 'consistent';

  // 7. Big Pad Orb Collect Animation
  orbCollectDuration: number;
  orbDropDistance: number;
  orbBezierP1X: number;
  orbBezierP1Y: number;
  orbBezierP2X: number;
  orbBezierP2Y: number;

  // 8. Pad Rotations (11 Symmetric Group Sliders in Degrees)
  rotBigMid: number;
  rotBigCorner: number;
  rotSmallAxisY0: number;
  rotSmallAxisY1: number;
  rotSmallAxisY2: number;
  rotSmallAxisX0: number;
  rotSmallQuadA: number;
  rotSmallQuadB: number;
  rotSmallQuadC: number;
  rotSmallQuadD: number;
  rotSmallQuadE: number;
}

export const DEFAULT_BOOST_PAD_TUNER_CONFIG: BoostPadTunerConfig = {
  // Upward glow shader
  bottomOpacity: 0.08,
  topOpacity: 0,
  midpoint: 0.35,
  topCutoff: 0.35,
  power: 1,
  glowIntensity: 5,
  glowColor: '#d97e00',
  coreColor: '#ffe750',
  glowHeightOffsetBig: -0.01,
  glowHeightOffsetSmall: -0.05,

  // Big orb
  orbRadius: 15,
  orbHeightOffset: 70,
  orbEmissiveIntensity: 5,
  orbColor: '#ffaa00',

  // Materials coloring & PBR
  topColor: '#d2bb18',
  topInactiveColor: '#1c2026',
  sideColor: '#000000',
  sideFollowsBase: true,
  baseColor: '#888888',
  baseRoughness: 1,
  baseMetalness: 1,
  sideRoughness: 1,
  sideMetalness: 1,
  topRoughness: 1,
  topMetalness: 0,
  padHeightOffset: 7.5,

  // Big Pad Black Silhouette Out Glow
  shadowEnabled: true,
  shadowRadius: 10,
  shadowIntensity: 1,
  shadowDistanceScale: 0.012,

  // Refilling
  refillEnabled: true,
  bigRefillThreshold: 3,
  smallRefillThreshold: 1,

  // Upward Glow Collect Animation
  collectDuration: 300,
  bezierP1X: 0,
  bezierP1Y: -3,
  bezierP2X: 0,
  bezierP2Y: 1,

  // Big Pad Orb Collect Animation
  orbCollectDuration: 200,
  orbDropDistance: 175,
  orbBezierP1X: 0,
  orbBezierP1Y: -1.15,
  orbBezierP2X: 0,
  orbBezierP2Y: 1,

  // 11 Symmetric Rotations
  rotBigMid: -30,
  rotBigCorner: 15,
  rotSmallAxisY0: 0,
  rotSmallAxisY1: 0,
  rotSmallAxisY2: 60,
  rotSmallAxisX0: 30,
  rotSmallQuadA: 30,
  rotSmallQuadB: 30,
  rotSmallQuadC: -30,
  rotSmallQuadD: 30,
  rotSmallQuadE: 30,
};

export type TelemetryDisplayMode = 'off' | 'on_demand' | 'always';
export type ClockPacingMode = 'csts' | 'legacy';

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
