import { floatingStore, type PresetConfig } from './floatingStore';

export type { PresetConfig };

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

export const BOOST_PAD_TUNER_PRESET: PresetConfig = {
  id: 'boost-pad-tuner',
  title: 'Boost Pad Visual Tuner',
  category: 'Graphics',
  width: 460,
  height: 540,
  resizable: true,
  singleton: true,
};

export const DRIFTWOODS_TUNER_PRESET: PresetConfig = {
  id: 'driftwoods-tuner',
  title: 'Driftwoods Stadium Tuner',
  category: 'Graphics',
  width: 480,
  height: 560,
  resizable: true,
  singleton: true,
};

export const OPACITY_MANAGER_PRESET: PresetConfig = {
  id: 'opacity-manager',
  title: 'Floating Window Opacity',
  category: 'System',
  width: 320,
  height: 100,
  resizable: false,
  singleton: true,
  defaultCenter: true,
};

export const KICKOFF_TRAINING_PRESET: PresetConfig = {
  id: 'kickoff-training-config',
  title: 'Kickoff Training (PPO)',
  category: 'Training',
  width: 460,
  height: 595,
  resizable: true,
  singleton: true,
};

export const DEV_TEST_LAB_PRESET: PresetConfig = {
  id: 'dev-test-lab-controller',
  title: 'Developer Test Lab Controller',
  category: 'DeveloperLab',
  width: 470,
  height: 560,
  resizable: true,
  singleton: true,
};

export const PRESET_WINDOWS: PresetConfig[] = [
  DEV_TEST_LAB_PRESET,
  KICKOFF_TRAINING_PRESET,
  DIAGNOSTICS_WINDOW_PRESET,
  EVENT_STREAM_OB_PRESET,
  DETERMINISM_HARNESS_PRESET,
  NETWORK_DIAGNOSTICS_PRESET,
  BOOST_PAD_TUNER_PRESET,
  DRIFTWOODS_TUNER_PRESET,
  OPACITY_MANAGER_PRESET,
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

export function toggleFloatingPreset(preset: PresetConfig) {
  const existing = floatingStore.getSnapshot().windows.find((w) => w.id === preset.id);
  if (existing) {
    if (existing.isMinimized) {
      floatingStore.restoreWindow(preset.id);
    } else {
      floatingStore.closeWindow(preset.id);
    }
  } else {
    floatingStore.spawnWindow({
      ...preset,
      startMinimized: false
    });
  }
}
