/**
 * ArenaConstants.js
 * Geometric dimensions, physics buffer offsets, team palette definitions,
 * and asset path resolvers for the Car Soccer arena subsystem.
 */

import {
  SIM_OFFSETS,
  CAR_STATE_OFFSETS as ROCKETSIM_CAR_STATE_OFFSETS,
  CAR_STATE_STRIDE as ROCKETSIM_CAR_STATE_STRIDE,
  MAX_CARS
} from '../../physics/RocketSimConstants.js';

// Arena Dimensions & Coordinate Constants (Unreal Units)
export const ARENA_WIDTH = 8192;
export const ARENA_LENGTH = 10240;
export const ARENA_GOAL_DEPTH = 5120;

// Team Colors
export const TEAM_BLUE_HEX = 2844350;
export const TEAM_ORANGE_HEX = 16750126;
export const DEFAULT_TEAM_COLORS = [3111891, 13857839];

// Vehicle Boost Outlets & Hitbox Presets
export const OCTANE_BOOST_OUTLETS = [
  [-57, 10.25, 20.4278],
  [-57, 10.25, -20.4278]
];

export const FLAT_CAR_BOOST_OUTLETS = [
  [-57.16878128051758, 9.5, 5.489756107330322],
  [-57.16878128051758, 9.5, -5.489756107330322]
];

export const OCTANE_HITBOX_PRESET = {
  length: 120.507,
  width: 86.6994,
  height: 38.6591,
  forward: 13.8757,
  up: 20.755
};

// Physics Buffer Offsets & Strides (RocketSim Memory Layout)
export const BUFFER_OFFSETS = SIM_OFFSETS;
export const CAR_STATE_OFFSETS = ROCKETSIM_CAR_STATE_OFFSETS;
export const CAR_STATE_STRIDE = ROCKETSIM_CAR_STATE_STRIDE;
export const BOOST_PAD_OFFSET = SIM_OFFSETS.CARS + MAX_CARS * CAR_STATE_STRIDE;
export const WHEEL_STATE_STRIDE = 3;
export const BOT_CAR_INDEX = 1;

/**
 * Resolves an asset path against base URL or window configuration.
 */
export function resolveAssetPath(path) {
  if (!path) return "";
  if (/^(?:https?:|\/\/|blob:|data:)/.test(path)) return path;
  const base = (typeof window !== "undefined" && (window.__CAR_SOCCER_ASSET_BASE__ || window.__ASSET_BASE__)) || (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "";
  const cleanBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  return cleanBase + cleanPath;
}
