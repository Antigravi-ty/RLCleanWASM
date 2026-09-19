/**
 * PhysicsManager.js
 * Unified physics orchestrator for RocketSim WebAssembly.
 * Re-exports the deobfuscated RocketSimPhysicsEngine, PhysicsStateInterpolator,
 * and RocketSimConstants aligned with upstream zealanL/rocketsim.
 */

export {
  RocketSimPhysicsEngine,
  RocketSimPhysicsEngine as PhysicsManager,
  getTeamAssignment,
  PLAYER_CAR_INDEX,
  BOT_CAR_INDEX,
  loadRocketSimWasmModule
} from './RocketSimPhysicsEngine.js';

export {
  PhysicsStateInterpolator
} from './PhysicsStateInterpolator.js';

export {
  SIM_OFFSETS,
  ArenaHeaderView,
  CarStateView,
  BallStateView,
  BoostPadStateView,
  GameStateView,
  CAR_STATE_OFFSETS,
  BALL_STATE_OFFSETS,
  CAR_STATE_STRIDE,
  BALL_STATE_STRIDE,
  CONTROLS_STRIDE,
  MAX_CARS,
  PHYSICS_TICK_RATE,
  FIXED_TIMESTEP,
  MAX_PHYSICS_SUBSTEPS,
  WHEEL_COUNT,
  WHEEL_STATE_STRIDE,
  WHEEL_OFFSETS,
  WASM_WHEEL_OFFSETS,
  NUM_BOOST_PADS,
  BOOST_PAD_STATE_STRIDE,
  BOOST_PAD_STATES_OFFSET,
  BOOST_PAD_TIMEOUT_BIG,
  BOOST_PAD_TIMEOUT_SMALL,
  BOOST_PAD_OFFSETS,
  CONTROLS_OFFSETS,
  GRAVITY_Z,
  BALL_COLLISION_RADIUS,
  BALL_MAX_SPEED,
  CAR_MAX_SPEED,
  SUPERSONIC_SPEED_THRESHOLD,
  ARENA_EXTENTS,
  GOAL_EXTENTS,
  BALL_CONTROL_MODES,
  TEAMS,
  HITBOX_PRESETS
} from './RocketSimConstants.js';
