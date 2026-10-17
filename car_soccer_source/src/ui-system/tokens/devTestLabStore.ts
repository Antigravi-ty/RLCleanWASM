import { create } from 'zustand';

export type DevTestLabTab = 'probes' | 'dual-world' | 'state-replay' | 'incident-match';
export type ProbePlacementMode = 'inside' | 'outside';
export type IncidentOpponentMode = 'stationary' | 'nexto';
export type IncidentControlledCar = 0 | 1; // 0 = Blue Car 0, 1 = Orange Car 1
export type IncidentSpeedMultiplier = 100 | 200 | 300 | 400 | 500;
export type ReplayFlowPreset = '100' | '50' | '25' | '75' | 'custom';
export type StateReplayRecorderState = 'idle' | 'recording' | 'stopped' | 'rewinding' | 'forwarding' | 'paused-scrub';
export type TasFlowPreset = ReplayFlowPreset;
export type TasRecorderState = StateReplayRecorderState;

export function resolveTasRateFromPreset(preset: ReplayFlowPreset, customPct: number): number {
  switch (preset) {
    case '100':
      return 100;
    case '50':
      return 50;
    case '25':
      return 25;
    case '75':
      return 75;
    case 'custom':
    default:
      return Math.max(5, Math.min(200, Math.round(customPct)));
  }
}

export interface DevTestLabState {
  activeTab: DevTestLabTab;

  // Bench 1: Predictive & Non-Predictive Probes
  probesEnabled: boolean;
  probePlacement: ProbePlacementMode;
  probeBaseAltitudeZ: number;
  probePeakAltitudeZ: number;
  probeHoldTolerance: number;
  probeHoldDurationTicks: number;
  probeBoostZ: number;
  probeBoostVz: number;
  probeBoostPhase: string;
  probeBoostHoldTicks: number;
  probeRollDir: number;
  probeCameraTarget: 'player' | 'boost_probe' | 'qe_probe';

  // Bench 2: Dual-World Same-Map Ghost Sandbox
  dualWorldEnabled: boolean;
  activeWorldIndex: 0 | 1;
  ghostOpacity: number;
  syncOtherWorldBall: boolean;

  // Bench 3: State Replay Scrubbing & Recording Sandbox (O / P / [ / ])
  tasState: TasRecorderState;
  tasRecordedFrames: number;
  tasCursorFrame: number;
  tasMaxCapacityFrames: number;
  tasFlowPreset: TasFlowPreset;
  tasCustomFlowPct: number;
  tasEffectiveFlowPct: number;

  // Bench 4: 90s Incident & Overtime Match Sandbox
  incidentMatchActive: boolean;
  incidentOpponentMode: IncidentOpponentMode; // 'stationary' = Manual Control, 'nexto' = AI Bot Control
  incidentControlledCar: IncidentControlledCar; // 0 = Blue (Car 0), 1 = Orange (Car 1)
  incidentSpeedMultiplier: IncidentSpeedMultiplier; // 100 | 200 | 300 | 400 | 500
  incidentMatchDurationSec: number; // default 90
  incidentDisableGoalReplay: boolean; // default true
  incidentKickoffTimeoutSec: number; // default 5.0s
  incidentKickoffCountdownSec: number; // 3, 2, 1, 0 (0 = GO / playing)
  incidentClockStarted: boolean;
  incidentTicksSinceKickoff: number;
  incidentPhase: string;
  incidentBlueScore: number;
  incidentOrangeScore: number;
  incidentRemainingSec: number;
  incidentOvertime: boolean;
  incidentPossessionTeam: number;
  incidentPossessionBluePts: number;
  incidentPossessionOrangePts: number;

  // Actions
  setActiveTab: (tab: DevTestLabTab) => void;
  setProbesEnabled: (enabled: boolean) => void;
  setProbePlacement: (placement: ProbePlacementMode) => void;
  setProbeAltitudes: (baseZ: number, peakZ: number) => void;
  setProbeCameraTarget: (target: 'player' | 'boost_probe' | 'qe_probe') => void;
  setDualWorldEnabled: (enabled: boolean) => void;
  switchActiveWorld: () => void;
  setActiveWorldIndex: (idx: 0 | 1) => void;
  setGhostOpacity: (opacity: number) => void;
  setTasFlowPreset: (preset: TasFlowPreset) => void;
  setTasCustomFlowPct: (pct: number) => void;
  setIncidentOpponentMode: (mode: IncidentOpponentMode) => void;
  setIncidentControlledCar: (carIdx: IncidentControlledCar) => void;
  switchIncidentControlledCar: () => void;
  setIncidentSpeedMultiplier: (mult: IncidentSpeedMultiplier) => void;
  setIncidentDisableGoalReplay: (disable: boolean) => void;
  updateLiveTelemetry: (patch: Partial<DevTestLabState>) => void;

  // Runtime handlers
  runtimeHandlers: {
    onTabChange?: (tab: DevTestLabTab) => void;
    onProbesConfigChange?: () => void;
    onProbeCameraChange?: (target: 'player' | 'boost_probe' | 'qe_probe') => void;
    onDualWorldConfigChange?: () => void;
    onSwitchWorld?: (idx: 0 | 1) => void;
    onTasStartRecording?: () => void;
    onTasStopRecording?: () => void;
    onTasPushBackwardStart?: () => void;
    onTasPushBackwardStop?: () => void;
    onTasPushForwardStart?: () => void;
    onTasPushForwardStop?: () => void;
    onTasResumeFromHere?: () => void;
    onTasCancelToFreeplay?: () => void;
    onStartIncidentMatch?: (opponentMode: IncidentOpponentMode) => void;
    onIncidentControlModeChange?: (opponentMode: IncidentOpponentMode) => void;
    onIncidentControlledCarChange?: (carIdx: IncidentControlledCar) => void;
    onIncidentSpeedMultiplierChange?: (mult: IncidentSpeedMultiplier) => void;
    onTriggerIncidentAction?: (action: 'score_blue' | 'score_orange' | 'force_overtime' | 'pause_5s' | 'add_possession_blue' | 'reset_kickoff') => void;
  };
  setRuntimeHandlers: (handlers: Partial<DevTestLabState['runtimeHandlers']>) => void;
}

export const useDevTestLabStore = create<DevTestLabState>((set, get) => ({
  activeTab: 'probes',

  probesEnabled: true,
  probePlacement: 'inside',
  probeBaseAltitudeZ: 500,
  probePeakAltitudeZ: 600,
  probeHoldTolerance: 10,
  probeHoldDurationTicks: 120,
  probeBoostZ: 500,
  probeBoostVz: 0,
  probeBoostPhase: 'CLIMB_TO_PEAK',
  probeBoostHoldTicks: 0,
  probeRollDir: 1,
  probeCameraTarget: 'player',

  dualWorldEnabled: false,
  activeWorldIndex: 0,
  ghostOpacity: 0.45,
  syncOtherWorldBall: true,

  tasState: 'idle',
  tasRecordedFrames: 0,
  tasCursorFrame: 0,
  tasMaxCapacityFrames: 18000,
  tasFlowPreset: '100',
  tasCustomFlowPct: 50,
  tasEffectiveFlowPct: 100,

  incidentMatchActive: false,
  incidentOpponentMode: 'stationary',
  incidentControlledCar: 0,
  incidentSpeedMultiplier: 100,
  incidentMatchDurationSec: 90,
  incidentDisableGoalReplay: true,
  incidentKickoffTimeoutSec: 5,
  incidentKickoffCountdownSec: 0,
  incidentClockStarted: false,
  incidentTicksSinceKickoff: 0,
  incidentPhase: 'playing',
  incidentBlueScore: 0,
  incidentOrangeScore: 0,
  incidentRemainingSec: 90,
  incidentOvertime: false,
  incidentPossessionTeam: 0,
  incidentPossessionBluePts: 0,
  incidentPossessionOrangePts: 0,

  runtimeHandlers: {},
  setRuntimeHandlers: (handlers) =>
    set((s) => ({ runtimeHandlers: { ...s.runtimeHandlers, ...handlers } })),

  setActiveTab: (activeTab) => {
    set({
      activeTab,
      probesEnabled: activeTab === 'probes',
      dualWorldEnabled: activeTab === 'dual-world',
      incidentMatchActive: activeTab === 'incident-match',
      probeCameraTarget: 'player',
      tasState: 'idle',
    });
    get().runtimeHandlers.onTabChange?.(activeTab);
  },

  setProbesEnabled: (probesEnabled) => {
    set({ probesEnabled });
    get().runtimeHandlers.onProbesConfigChange?.();
  },

  setProbePlacement: (probePlacement) => {
    set({ probePlacement });
    get().runtimeHandlers.onProbesConfigChange?.();
  },

  setProbeAltitudes: (probeBaseAltitudeZ, probePeakAltitudeZ) => {
    set({ probeBaseAltitudeZ, probePeakAltitudeZ });
    get().runtimeHandlers.onProbesConfigChange?.();
  },

  setProbeCameraTarget: (probeCameraTarget) => {
    set({ probeCameraTarget });
    get().runtimeHandlers.onProbeCameraChange?.(probeCameraTarget);
  },

  setDualWorldEnabled: (dualWorldEnabled) => {
    set({ dualWorldEnabled });
    get().runtimeHandlers.onDualWorldConfigChange?.();
  },

  switchActiveWorld: () => {
    const next: 0 | 1 = get().activeWorldIndex === 0 ? 1 : 0;
    set({ activeWorldIndex: next });
    get().runtimeHandlers.onSwitchWorld?.(next);
  },

  setActiveWorldIndex: (activeWorldIndex) => {
    set({ activeWorldIndex });
    get().runtimeHandlers.onSwitchWorld?.(activeWorldIndex);
  },

  setGhostOpacity: (ghostOpacity) => {
    const clamped = Math.max(0.1, Math.min(0.95, Number(ghostOpacity.toFixed(2))));
    set({ ghostOpacity: clamped });
    get().runtimeHandlers.onDualWorldConfigChange?.();
  },

  setTasFlowPreset: (tasFlowPreset) => {
    const eff = resolveTasRateFromPreset(tasFlowPreset, get().tasCustomFlowPct);
    set({ tasFlowPreset, tasEffectiveFlowPct: eff });
  },

  setTasCustomFlowPct: (pct) => {
    const clamped = Math.max(5, Math.min(200, Math.round(pct)));
    const eff = get().tasFlowPreset === 'custom' ? clamped : get().tasEffectiveFlowPct;
    set({ tasCustomFlowPct: clamped, tasEffectiveFlowPct: eff });
  },

  setIncidentOpponentMode: (incidentOpponentMode) => {
    set({ incidentOpponentMode });
    if (get().activeTab === 'incident-match') {
      const h = get().runtimeHandlers;
      if (h.onIncidentControlModeChange) {
        h.onIncidentControlModeChange(incidentOpponentMode);
      } else {
        h.onStartIncidentMatch?.(incidentOpponentMode);
      }
    }
  },

  setIncidentControlledCar: (incidentControlledCar) => {
    set({ incidentControlledCar });
    if (get().activeTab === 'incident-match') {
      get().runtimeHandlers.onIncidentControlledCarChange?.(incidentControlledCar);
    }
  },

  switchIncidentControlledCar: () => {
    const next: IncidentControlledCar = get().incidentControlledCar === 0 ? 1 : 0;
    set({ incidentControlledCar: next });
    if (get().activeTab === 'incident-match') {
      get().runtimeHandlers.onIncidentControlledCarChange?.(next);
    }
  },

  setIncidentSpeedMultiplier: (incidentSpeedMultiplier) => {
    set({ incidentSpeedMultiplier });
    if (get().activeTab === 'incident-match') {
      get().runtimeHandlers.onIncidentSpeedMultiplierChange?.(incidentSpeedMultiplier);
    }
  },

  setIncidentDisableGoalReplay: (incidentDisableGoalReplay) => {
    set({ incidentDisableGoalReplay });
  },

  updateLiveTelemetry: (patch) => set((s) => ({ ...s, ...patch })),
}));
