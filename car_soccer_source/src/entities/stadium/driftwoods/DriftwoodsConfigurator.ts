/**
 * DriftwoodsConfigurator.ts
 * Schema definitions, config merging helpers, and preset accessors for the Driftwoods stadium.
 * Raw configuration data is externalized to driftwoods.default.json and driftwoods.presets.json.
 */

import defaultConfigJson from './driftwoods.default.json';
import presetsJson from './driftwoods.presets.json';

export interface DriftwoodsLayerConfig {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  visible: boolean;
  wireframe: boolean;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface DriftwoodsGroundConfig {
  groundColor: string;
  lineColor: string;
  roughness: number;
  metalness: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  linkScale: boolean;
  visible: boolean;
  wireframe: boolean;
  magFilter?: 'linear' | 'nearest';
  anisotropy?: number;
  lineThreshold?: number;
  lineSmoothness?: number;
}

export interface DriftwoodsTunerConfig {
  fastDiffuse: boolean;
  ground: DriftwoodsGroundConfig;
  ramps: DriftwoodsLayerConfig;
  rampsTrim: DriftwoodsLayerConfig;
  wallPosts: DriftwoodsLayerConfig;
  goalFrame: DriftwoodsLayerConfig;
  goalPosts: DriftwoodsLayerConfig;
  walls: DriftwoodsLayerConfig;
  goalNet: DriftwoodsLayerConfig;
  hexes: DriftwoodsLayerConfig;
}

export interface DriftwoodsPreset {
  id: string;
  name: string;
  description: string;
  config: DriftwoodsTunerConfig;
}

export const DEFAULT_DRIFTWOODS_CONFIG: DriftwoodsTunerConfig =
  defaultConfigJson as DriftwoodsTunerConfig;

export const DRIFTWOODS_PRESETS: DriftwoodsPreset[] = [
  {
    id: 'classic-wood',
    name: 'Classic Driftwoods',
    description: 'Authentic Rocket League wooden ramps, golden trims, cyan glass, and lush green pitch.',
    config: DEFAULT_DRIFTWOODS_CONFIG,
  },
  ...(presetsJson as DriftwoodsPreset[]),
];

export function cloneDriftwoodsConfig(
  config: DriftwoodsTunerConfig = DEFAULT_DRIFTWOODS_CONFIG
): DriftwoodsTunerConfig {
  return JSON.parse(JSON.stringify(config));
}

export function mergeDriftwoodsConfig(
  base: DriftwoodsTunerConfig,
  patch?: Partial<DriftwoodsTunerConfig> | null
): DriftwoodsTunerConfig {
  if (!patch) return cloneDriftwoodsConfig(base);
  return {
    ...base,
    fastDiffuse: patch.fastDiffuse !== undefined ? Boolean(patch.fastDiffuse) : base.fastDiffuse,
    ground: patch.ground ? { ...base.ground, ...patch.ground } : { ...base.ground },
    ramps: patch.ramps ? { ...base.ramps, ...patch.ramps } : { ...base.ramps },
    rampsTrim: patch.rampsTrim ? { ...base.rampsTrim, ...patch.rampsTrim } : { ...base.rampsTrim },
    wallPosts: patch.wallPosts ? { ...base.wallPosts, ...patch.wallPosts } : { ...base.wallPosts },
    goalFrame: patch.goalFrame ? { ...base.goalFrame, ...patch.goalFrame } : { ...base.goalFrame },
    goalPosts: patch.goalPosts ? { ...base.goalPosts, ...patch.goalPosts } : { ...base.goalPosts },
    walls: patch.walls ? { ...base.walls, ...patch.walls } : { ...base.walls },
    goalNet: patch.goalNet ? { ...base.goalNet, ...patch.goalNet } : { ...base.goalNet },
    hexes: patch.hexes ? { ...base.hexes, ...patch.hexes } : { ...base.hexes },
  };
}
