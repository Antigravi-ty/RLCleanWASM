/**
 * AudioArchitecture.js - Facade Entrypoint
 * Decoupled, modular Web Audio Architecture for Rocket League Clean WASM.
 *
 * Implements Facade Preserving pattern (Rule 1):
 * All concrete subsystems are extracted into focused, SRP modules:
 * - audioConstants.js: Audio file paths, storage keys, and math utilities
 * - audioRegistry.js: Incident mappings and console log event catalog
 * - audioConfig.js: AudioConfigManager and gain/threshold setters/getters
 * - AudioMixer.js: Master bus gain node, volume ramping, and mute shielding
 * - AudioSlotPool.js: 10-voice Web Audio slot pool with priority stealing
 * - audioContext.js: AudioContext lifecycle, interaction unlock, and focus management
 * - BallAudioEmitter.js: Continuous 3D spatial ball rolling and airborne falling loops
 * - StateAudioEngine.js: State-driven boost, supersonic, and ball audio loops
 * - VehicleAudioEmitter.js: Positional 3D spatial emitter per car with boost/supersonic
 * - VehicleAudioManager.js: Multi-vehicle manager, spatial updates, and action events
 * - WorldImpactAudioHandler.js: Surface taxonomy collision and goalpost ping audio
 * - IncidentAudioEngine.js: Discrete physics incidents, cooldowns, and dispatching
 * - SignalAudioEngine.js: Match lifecycle signals (countdown, overtime, endgame)
 * - UIAudioEngine.js: UI clicks and interaction audio
 * - audioAssetManifest.js: Audio asset descriptors manifest
 * - audioAssetLoader.js: Concurrent audio preloader with loud fallback logging
 * - GameAudioEngineFacade.js: Unified audio engine coordinator
 * - audioDebug.js: Surface taxonomy geometry colorizer
 */

export { EMotorSynth } from './EMotorSynth.js';

export {
  SpatialAudioSource,
  updateAudioListener,
  calculateDistanceGain,
  calculateIncidentDistanceGain,
  toAudioCoordinates,
  listenerManager,
  INCIDENT_SPATIAL_CONFIG,
  UU_TO_METERS,
  updateSpatialConfig,
  SPATIAL_CONFIG
} from './SpatialAudioSource.js';

export {
  BALL_HIT_AUDIO_FILES,
  SIDEWALL_HIT_AUDIO_FILES,
  SFX_CAR_COLLISION_FILE,
  BOOST_COLLECT_FILE,
  GOAL_SCORED_FILE,
  BALL_ROLLING_FILE,
  BALL_FLYING_FILE,
  SUPERSONIC_STATE_FILE,
  ERROR_NO_BOOST_FILE,
  MATCH_30S_FILE,
  MATCH_COUNTDOWN_FILE,
  MATCH_10S_COUNTDOWN_FILE,
  MATCH_OVERTIME_FILE,
  MATCH_START_GO_FILE,
  ENDGAME_FILE,
  CROSSBAR_PING_AUDIO_FILES,
  CROSSBAR_PING_SMALL_AUDIO_FILES,
  JUMP_AUDIO_FILES,
  DOUBLE_JUMP_AUDIO_FILES,
  DODGE_AUDIO_FILES,
  RESET_AUDIO_FILE,
  GOALPOST_AUDIO_FILE,
  WHEEL_IMPACT_AUDIO_FILES,
  BALL_GROUND_HIT_AUDIO_FILES,
  VEHICLE_ACCENT_AUDIO_FILE,
  VEHICLE_DETAIL_AUDIO_FILES,
  SUPERSONIC_ENTER_AUDIO_FILES,
  SUPERSONIC_LOOP_AUDIO_FILE,
  BOOST_START_AUDIO_FILE,
  BOOST_LOOP_AUDIO_FILE,
  BOOST_RELEASE_AUDIO_FILE,
  clamp01,
  clampVolume,
  dbToLinear,
  AUDIO_SETTINGS_KEY,
  AUDIO_CONFIG_STORAGE_KEY,
  AUDIO_SETTINGS_CHANGED_EVENT,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS
} from './audioConstants.js';

export {
  INCIDENT_AUDIO_REGISTRY,
  CONSOLE_LOG_EVENT_CATALOG,
  createDefaultLogEventFilter
} from './audioRegistry.js';

export {
  AudioConfigManager,
  audioConfig,
  getAudioSettings,
  setMasterVolume,
  setEngineVolume,
  setBoostVolume,
  setVehicleSelfVolume,
  setJumpVolume,
  setDoubleJumpVolume,
  setDodgeVolume,
  setSupersonicVolume,
  setCarCarCollisionVolume,
  setBallCollisionVolume,
  setCarBallHitVolume,
  setBallWorldHitVolume,
  setGoalpostHitVolume,
  setBallRollingVolume,
  setBallFlyingVolume,
  setGoalScoredVolume,
  setFlipResetVolume,
  setBoostCollectVolume,
  setBallFloorHitVolume,
  setBallNetHitVolume,
  setBallRampHitVolume,
  setIncidentCooldownMs,
  setNetDualTriggerAngleDeg,
  setCarBallSoundMode,
  setCarCarSoundMode,
  setCarBallHitCooldownMs,
  setGoalpostHitCooldownMs,
  setCarBallHitImpulseThreshold,
  setGoalpostHitThreshold,
  setContinueAudioOnLostFocus,
  setLogAllEvents,
  setLogCarBallHitEvents,
  setLogEventFilter,
  setEventLogFilterItem,
  selectAllEventLogs,
  deselectAllEventLogs,
  isEventLogEnabled,
  resetAudioSettings,
  exportAudioSettingsJson,
  importAudioSettingsJson
} from './audioConfig.js';

export { AudioMixer } from './AudioMixer.js';

export { AudioSlotPool } from './AudioSlotPool.js';

export {
  subsystemState,
  getAudioContext,
  getMasterAudioInput,
  getAudioSlotPool,
  setAudioSlotPool,
  registerAudioEngine
} from './audioContext.js';

export { BALL_AUDIO_CONFIG, BallAudioEmitter } from './BallAudioEmitter.js';

export { StateAudioEngine } from './StateAudioEngine.js';

export { VehicleAudioEmitter } from './VehicleAudioEmitter.js';

export { VehicleAudioManager } from './VehicleAudioManager.js';

export { WorldImpactAudioHandler } from './WorldImpactAudioHandler.js';

export { IncidentAudioEngine } from './IncidentAudioEngine.js';

export { SignalAudioEngine } from './SignalAudioEngine.js';

export { UIAudioEngine } from './UIAudioEngine.js';

export {
  GameAudioEngineFacade,
  audioEngine,
  gameAudioEngine,
  gameAudio
} from './GameAudioEngineFacade.js';

export { applySurfaceTaxonomyColoring } from './audioDebug.js';
