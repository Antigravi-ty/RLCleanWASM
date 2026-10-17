import React from 'react';
import {
  Activity,
  Cpu,
  Palette,
  PencilRuler,
  Router,
  Sliders,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  OPACITY_MANAGER_PRESET,
  BOOST_PAD_TUNER_PRESET,
  DRIFTWOODS_TUNER_PRESET,
  KICKOFF_TRAINING_PRESET,
  DEV_TEST_LAB_PRESET,
} from '../tokens/floatingPresets';

export interface FloatingWindowIconProps {
  category?: string;
  id?: string;
  className?: string;
}

/**
 * Canonical unified icon resolver for floating windows, ghost flights, and minimized stack tray items.
 * Ensures 100% visual consistency between window header, collapsing animation, and minimized tray icon.
 */
export const getFloatingWindowIcon = (category?: string, id?: string, extraClass: string = 'h-4 w-4 shrink-0') => {
  const normId = (id || '').toLowerCase();
  const normCat = (category || '').toLowerCase();

  if (normId === DEV_TEST_LAB_PRESET.id || normId.includes('dev-test-lab') || normCat === 'developerlab') {
    return <Cpu className={`${extraClass} text-amber-500 dark:text-amber-400`} />;
  }

  if (normId === KICKOFF_TRAINING_PRESET.id || normId.includes('kickoff') || normCat === 'training') {
    return <PencilRuler className={`${extraClass} text-sky-500 dark:text-sky-400`} />;
  }

  if (normId === OPACITY_MANAGER_PRESET.id || normId.includes('opacity')) {
    return <Sliders className={`${extraClass} text-amber-500 dark:text-amber-400`} />;
  }

  if (normId === BOOST_PAD_TUNER_PRESET.id || normId.includes('boost') || normId.includes('pad')) {
    return <Sparkles className={`${extraClass} text-amber-500 dark:text-amber-400`} />;
  }

  if (normId === DRIFTWOODS_TUNER_PRESET.id || normId.includes('driftwood') || normId.includes('stadium') || normCat === 'graphics') {
    return <Palette className={`${extraClass} text-emerald-500 dark:text-emerald-400`} />;
  }

  if (normCat === 'network' || normId.includes('network')) {
    return <Router className={`${extraClass} text-violet-500 dark:text-violet-400`} />;
  }

  if (normCat === 'determinism' || normId.includes('determinism')) {
    return <Target className={`${extraClass} text-emerald-500 dark:text-emerald-400`} />;
  }

  if (normCat === 'observer' || normId.includes('stream') || normId.includes('oscillo')) {
    return <Activity className={`${extraClass} text-sky-500 dark:text-sky-400`} />;
  }

  if (normCat === 'diagnostic' || normId.includes('telemetry')) {
    return <Activity className={`${extraClass} text-sky-500 dark:text-sky-400`} />;
  }

  if (normCat === 'kernel' || normId.includes('kernel') || normId.includes('simd')) {
    return <Cpu className={`${extraClass} text-amber-500 dark:text-amber-400`} />;
  }

  if (normCat === 'hitbox' || normId.includes('hitbox')) {
    return <Target className={`${extraClass} text-emerald-500 dark:text-emerald-400`} />;
  }

  if (normId.includes('eq') || normId.includes('dsp') || normId.includes('audio')) {
    return <Sliders className={`${extraClass} text-neutral-800 dark:text-neutral-200`} />;
  }

  return <Activity className={`${extraClass} text-sky-500 dark:text-sky-400`} />;
};

export const FloatingWindowIcon: React.FC<FloatingWindowIconProps> = ({ category, id, className }) => {
  return <>{getFloatingWindowIcon(category, id, className)}</>;
};
