/**
 * driftwoodsConfig.ts
 * Schema definitions, config merging helpers, and preset accessors for the Driftwoods stadium.
 * Raw configuration data is externalized to driftwoods.default.json, driftwoods.presets.json, and groundQ1Manifest.json.
 */

import defaultConfigJson from './driftwoods.default.json' with { type: 'json' };
import presetsJson from './driftwoods.presets.json' with { type: 'json' };
import groundQ1ManifestJson from './groundQ1Manifest.json' with { type: 'json' };

export type DriftwoodsGroundTextureMode = 'original' | 'q1-7gray';

export type DriftwoodsQ1LayerId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export interface DriftwoodsQ1LayerColors {
  L0: string;
  L1: string;
  L2: string;
  L3: string;
  L4: string;
  L5: string;
  L6: string;
}

export interface DriftwoodsQ1LayerSpec {
  id: DriftwoodsQ1LayerId;
  name: string;
  centerGray: number;
  normalizedValue: number;
  grayRange: [number, number];
  normalizedRange: [number, number];
  defaultColor: string;
}

export interface DriftwoodsQ1Manifest {
  texture: string;
  url: string;
  resolution: {
    width: number;
    height: number;
  };
  spatialMapping: {
    quadrant: string;
    uvOriginTopLeft: { u: number; v: number; worldX: number; worldY: number };
    uvExtentBottomRight: { u: number; v: number; worldX: number; worldY: number };
    worldBoundsUu: {
      x: [number, number];
      y: [number, number];
      goalDepthRangeY: [number, number];
    };
    wrapMode: string;
    uvFormula: { u: string; v: string };
  };
  layers: DriftwoodsQ1LayerSpec[];
}

export const GROUND_Q1_MANIFEST: DriftwoodsQ1Manifest =
  groundQ1ManifestJson as unknown as DriftwoodsQ1Manifest;

export const DEFAULT_Q1_LAYER_COLORS: DriftwoodsQ1LayerColors = {
  L0: '#1b4a00',
  L1: '#ffffff',
  L2: '#ffffff',
  L3: '#ffffff',
  L4: '#454545',
  L5: '#ffffff',
  L6: '#f87171',
};

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
  textureMode?: DriftwoodsGroundTextureMode;
  groundColor: string;
  lineColor: string;
  q1Colors?: DriftwoodsQ1LayerColors;
  l4UseTeamColor?: boolean;
  l5UseTeamColor?: boolean;
  l6UseTeamColor?: boolean;
  q1ScaleX?: number;
  q1ScaleY?: number;
  q1OffsetX?: number;
  q1OffsetY?: number;
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
  originalLineThreshold?: number;
  originalLineSmoothness?: number;
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
    id: 'q1-7gray-tactical',
    name: 'Q1 7-Layer Tactical Mask',
    description: '4-quadrant mirrored Q1 grayscale mask (2048x3000) with independent L0-L6 semantic layer colors.',
    config: DEFAULT_DRIFTWOODS_CONFIG,
  },
  {
    id: 'classic-wood',
    name: 'Classic Driftwoods (Original)',
    description: 'Authentic Rocket League wooden ramps, golden trims, cyan glass, and lush green 2-color pitch.',
    config: {
      ...DEFAULT_DRIFTWOODS_CONFIG,
      ground: {
        ...DEFAULT_DRIFTWOODS_CONFIG.ground,
        textureMode: 'original',
        anisotropy: 16,
        originalLineThreshold: 0.0921,
        originalLineSmoothness: 0.0364,
      },
    },
  },
  ...(presetsJson as DriftwoodsPreset[]).map((preset) => ({
    ...preset,
    config: {
      ...preset.config,
      ground: {
        ...DEFAULT_DRIFTWOODS_CONFIG.ground,
        ...preset.config.ground,
        textureMode: preset.config.ground?.textureMode ?? 'original',
        q1Colors: {
          ...DEFAULT_Q1_LAYER_COLORS,
          ...(preset.config.ground?.q1Colors || {}),
        },
      },
    },
  })),
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
  const baseQ1Colors = {
    ...DEFAULT_Q1_LAYER_COLORS,
    ...(base.ground?.q1Colors || {}),
  };
  return {
    ...base,
    fastDiffuse: patch.fastDiffuse !== undefined ? Boolean(patch.fastDiffuse) : base.fastDiffuse,
    ground: patch.ground
      ? {
          ...base.ground,
          ...patch.ground,
          textureMode: patch.ground.textureMode ?? base.ground.textureMode ?? 'q1-7gray',
          q1Colors: {
            ...baseQ1Colors,
            ...(patch.ground.q1Colors || {}),
          },
          l4UseTeamColor: patch.ground.l4UseTeamColor ?? base.ground.l4UseTeamColor ?? true,
          l5UseTeamColor: patch.ground.l5UseTeamColor ?? base.ground.l5UseTeamColor ?? true,
          l6UseTeamColor: patch.ground.l6UseTeamColor ?? base.ground.l6UseTeamColor ?? true,
          q1ScaleX: patch.ground.q1ScaleX ?? base.ground.q1ScaleX ?? 1,
          q1ScaleY: patch.ground.q1ScaleY ?? base.ground.q1ScaleY ?? 1,
          q1OffsetX: patch.ground.q1OffsetX ?? base.ground.q1OffsetX ?? 0,
          q1OffsetY: patch.ground.q1OffsetY ?? base.ground.q1OffsetY ?? 0,
          originalLineThreshold:
            patch.ground.originalLineThreshold ?? base.ground.originalLineThreshold ?? 0.0921,
          originalLineSmoothness:
            patch.ground.originalLineSmoothness ?? base.ground.originalLineSmoothness ?? 0.0364,
        }
      : {
          ...base.ground,
          textureMode: base.ground.textureMode ?? 'q1-7gray',
          q1Colors: baseQ1Colors,
          l4UseTeamColor: base.ground.l4UseTeamColor ?? true,
          l5UseTeamColor: base.ground.l5UseTeamColor ?? true,
          l6UseTeamColor: base.ground.l6UseTeamColor ?? true,
          q1ScaleX: base.ground.q1ScaleX ?? 1,
          q1ScaleY: base.ground.q1ScaleY ?? 1,
          q1OffsetX: base.ground.q1OffsetX ?? 0,
          q1OffsetY: base.ground.q1OffsetY ?? 0,
          originalLineThreshold: base.ground.originalLineThreshold ?? 0.0921,
          originalLineSmoothness: base.ground.originalLineSmoothness ?? 0.0364,
        },
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
