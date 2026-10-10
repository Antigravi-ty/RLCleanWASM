export interface PresetConfig {
  id: string;
  title: string;
  category: string;
  width: number;
  height: number;
  resizable: boolean;
  singleton?: boolean;
}

export const DIAGNOSTICS_WINDOW_PRESET: PresetConfig = {
  id: 'diagnostics-telemetry',
  title: 'Live System Telemetry',
  category: 'Diagnostic',
  width: 460,
  height: 440,
  resizable: true,
  singleton: true,
};

export const EVENT_STREAM_OB_PRESET: PresetConfig = {
  id: 'event-stream-ob',
  title: 'Event Stream OB',
  category: 'Observer',
  width: 460,
  height: 420,
  resizable: true,
  singleton: true,
};

export const DETERMINISM_HARNESS_PRESET: PresetConfig = {
  id: 'determinism-harness',
  title: 'Dual-Arena Determinism Harness',
  category: 'Determinism',
  width: 440,
  height: 420,
  resizable: true,
  singleton: true,
};

export const NETWORK_DIAGNOSTICS_PRESET: PresetConfig = {
  id: 'network-diagnostics',
  title: 'Multiplayer Network Diagnostics',
  category: 'Network',
  width: 460,
  height: 440,
  resizable: true,
  singleton: true,
};

export const PRESET_WINDOWS: PresetConfig[] = [
  DIAGNOSTICS_WINDOW_PRESET,
  EVENT_STREAM_OB_PRESET,
  DETERMINISM_HARNESS_PRESET,
  NETWORK_DIAGNOSTICS_PRESET,
  {
    id: 'simd-short',
    title: '1',
    category: 'Kernel',
    width: 320,
    height: 220,
    resizable: false,
    singleton: true,
  },
  {
    id: 'pid-short-resizable',
    title: '1 (Resizable)',
    category: 'Diagnostic',
    width: 360,
    height: 240,
    resizable: true,
    singleton: false,
  },
  {
    id: 'telemetry-long',
    title: 'Diagnostic Telemetry & Real-Time Engine Spectrogram Stream',
    category: 'Hitbox',
    width: 480,
    height: 280,
    resizable: false,
    singleton: true,
  },
  {
    id: 'aero-long-resizable',
    title: 'Advanced Aerodynamic Downforce Vector Matrix Calibration (Resizable)',
    category: 'Diagnostic',
    width: 500,
    height: 320,
    resizable: true,
    singleton: false,
  },
];
