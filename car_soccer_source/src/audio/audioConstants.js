import staticAudioConfig from './audioConfig.json' with { type: 'json' };

// Audio Asset Definitions (100% Unified under /custom/assets/audio/)
export const BALL_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/impacts/vehicle-body-01.m4a",
  "/custom/assets/audio/impacts/vehicle-body-02.m4a",
  "/custom/assets/audio/impacts/vehicle-body-03.m4a",
  "/custom/assets/audio/impacts/vehicle-body-04.m4a"
]);

export const VEHICLE_ACCENT_AUDIO_FILE = "/custom/assets/audio/impacts/vehicle-accent-01.m4a";

export const VEHICLE_DETAIL_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/impacts/vehicle-detail-01.m4a",
  "/custom/assets/audio/impacts/vehicle-detail-02.m4a",
  "/custom/assets/audio/impacts/vehicle-detail-03.m4a",
  "/custom/assets/audio/impacts/vehicle-detail-04.m4a",
  "/custom/assets/audio/impacts/vehicle-detail-05.m4a",
  "/custom/assets/audio/impacts/vehicle-detail-06.m4a"
]);

export const VEHICLE_BODY_IMPACT_AUDIO_FILES = BALL_HIT_AUDIO_FILES;

export const SIDEWALL_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0200.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0216.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0259.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0378.m4a",
  "/custom/assets/audio/sidewallhit/SFX_Impacts_0627.m4a"
]);

export const SFX_CAR_COLLISION_FILE = "/custom/assets/audio/sfx_car_collision.m4a";
export const BOOST_COLLECT_FILE = "/custom/assets/audio/boost_collect.m4a";
export const GOAL_SCORED_FILE = "/custom/assets/audio/sfx_goal_poof.m4a";
export const BALL_ROLLING_FILE = "/custom/assets/audio/ballrolling.m4a";
export const BALL_FLYING_FILE = "/custom/assets/audio/ballflying.m4a";
export const SUPERSONIC_STATE_FILE = "/custom/assets/audio/sfx_state_supersonic.m4a";
export const ERROR_NO_BOOST_FILE = "/custom/assets/audio/sfx_error_no_boost.m4a";
export const MATCH_30S_FILE = "/custom/assets/audio/match_30_seconds_left.m4a";
export const MATCH_COUNTDOWN_FILE = "/custom/assets/audio/match_countdown_321.m4a";
export const MATCH_10S_COUNTDOWN_FILE = "/custom/assets/audio/match_countdown_10s.m4a";
export const MATCH_OVERTIME_FILE = "/custom/assets/audio/match_entering_overtime.m4a";
export const MATCH_START_GO_FILE = "/custom/assets/audio/match_start_go.m4a";
export const ENDGAME_FILE = "/custom/assets/audio/endgame.m4a";

export const CROSSBAR_PING_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/crossbar_ping/ping-01.m4a",
  "/custom/assets/audio/crossbar_ping/ping-02.m4a",
  "/custom/assets/audio/crossbar_ping/ping-03.m4a",
  "/custom/assets/audio/crossbar_ping/ping-04.m4a",
  "/custom/assets/audio/crossbar_ping/ping-05.m4a",
  "/custom/assets/audio/crossbar_ping/ping-06.m4a"
]);

export const CROSSBAR_PING_SMALL_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/crossbar_ping/ping-small-01.m4a",
  "/custom/assets/audio/crossbar_ping/ping-small-02.m4a",
  "/custom/assets/audio/crossbar_ping/ping-small-03.m4a",
  "/custom/assets/audio/crossbar_ping/ping-small-04.m4a",
  "/custom/assets/audio/crossbar_ping/ping-small-05.m4a",
  "/custom/assets/audio/crossbar_ping/ping-small-06.m4a"
]);

// Real device / production vehicle and impact audio assets
export const JUMP_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/vehicle/jump-01.m4a",
  "/custom/assets/audio/vehicle/jump-02.m4a",
  "/custom/assets/audio/vehicle/jump-03.m4a",
  "/custom/assets/audio/vehicle/jump-04.m4a"
]);

export const DOUBLE_JUMP_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/vehicle/double-jump-01.m4a",
  "/custom/assets/audio/vehicle/double-jump-02.m4a",
  "/custom/assets/audio/vehicle/double-jump-03.m4a",
  "/custom/assets/audio/vehicle/double-jump-04.m4a"
]);

export const DODGE_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/vehicle/dodge-01.m4a",
  "/custom/assets/audio/vehicle/dodge-02.m4a",
  "/custom/assets/audio/vehicle/dodge-03.m4a",
  "/custom/assets/audio/vehicle/dodge-04.m4a"
]);

export const RESET_AUDIO_FILE = "/custom/assets/audio/events/reset.m4a";
export const GOALPOST_AUDIO_FILE = CROSSBAR_PING_AUDIO_FILES[0];

export const WHEEL_IMPACT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/vehicle/wheel-impact-01.m4a",
  "/custom/assets/audio/vehicle/wheel-impact-02.m4a",
  "/custom/assets/audio/vehicle/wheel-impact-03.m4a",
  "/custom/assets/audio/vehicle/wheel-impact-04.m4a"
]);

export const BALL_GROUND_HIT_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/impacts/vehicle-body-01.m4a",
  "/custom/assets/audio/impacts/vehicle-body-02.m4a",
  "/custom/assets/audio/impacts/vehicle-body-03.m4a"
]);

export const SUPERSONIC_ENTER_AUDIO_FILES = Object.freeze([
  "/custom/assets/audio/vehicle/supersonic-enter-a.m4a",
  "/custom/assets/audio/vehicle/supersonic-enter-b.m4a",
  "/custom/assets/audio/vehicle/supersonic-enter-c.m4a"
]);

export const SUPERSONIC_LOOP_AUDIO_FILE = "/custom/assets/audio/vehicle/supersonic-loop.m4a";
export const BOOST_START_AUDIO_FILE = "/custom/assets/audio/boost/start.m4a";
export const BOOST_LOOP_AUDIO_FILE = "/custom/assets/audio/boost/loop.m4a";
export const BOOST_RELEASE_AUDIO_FILE = "/custom/assets/audio/boost/release.m4a";

// Console Log Physics Event Catalog
export const CONSOLE_LOG_EVENT_CATALOG = Object.freeze([
  { type: 0x01, hex: '0x01', id: 'CAR_BALL_HIT', name: 'Car-Ball Hit', category: 'Incident' },
  { type: 0x02, hex: '0x02', id: 'CAR_CAR_BUMP', name: 'Car-Car Bump', category: 'Incident' },
  { type: 0x03, hex: '0x03', id: 'CAR_CAR_DEMO', name: 'Car Demolition', category: 'Incident' },
  { type: 0x04, hex: '0x04', id: 'BALL_WORLD_HIT', name: 'Ball-World Collision', category: 'Incident' },
  { type: 0x05, hex: '0x05', id: 'BALL_GOALPOST_HIT', name: 'Ball-Goalpost Collision', category: 'Incident' },
  { type: 0x06, hex: '0x06', id: 'CAR_JUMP', name: 'Single Jump', category: 'Incident' },
  { type: 0x07, hex: '0x07', id: 'CAR_DOUBLE_JUMP', name: 'Double Jump', category: 'Incident' },
  { type: 0x08, hex: '0x08', id: 'CAR_DODGE', name: 'Dodge / Flip', category: 'Incident' },
  { type: 0x09, hex: '0x09', id: 'CAR_SUPERSONIC_ENTER', name: 'Supersonic Entry', category: 'Incident' },
  { type: 0x0A, hex: '0x0a', id: 'BOOST_PICKUP', name: 'Boost Pad Pickup', category: 'Incident' },
  { type: 0x0B, hex: '0x0b', id: 'BOOST_SPAWN', name: 'Boost Pad Respawn', category: 'Incident' },
  { type: 0x0C, hex: '0x0c', id: 'CAR_BOOST_START', name: 'Car Boost Start', category: 'Incident' },
  { type: 0x0D, hex: '0x0d', id: 'CAR_BOOST_STOP', name: 'Car Boost Stop', category: 'Incident' },
  { type: 0x0E, hex: '0x0e', id: 'GOAL_SCORED', name: 'Goal Scored', category: 'Incident' },
  { type: 0x0F, hex: '0x0f', id: 'FLIP_RESET_GAINED', name: 'Flip Reset Gained', category: 'Incident' },
  { type: 0x10, hex: '0x10', id: 'BALL_STATE_CHANGE', name: 'Ball State Change', category: 'Incident' },
  { type: 0x11, hex: '0x11', id: 'POSSESSION_CHANGE', name: 'Possession Change', category: 'Incident' },

  { type: 0x80, hex: '0x80', id: 'MATCH_START', name: 'Match Start', category: 'Signal' },
  { type: 0x81, hex: '0x81', id: 'KICKOFF_PREPARE', name: 'Kickoff Prepare', category: 'Signal' },
  { type: 0x82, hex: '0x82', id: 'KICKOFF_GO', name: 'Kickoff Go', category: 'Signal' },
  { type: 0x83, hex: '0x83', id: 'COUNTDOWN_TICK', name: 'Countdown Tick', category: 'Signal' },
  { type: 0x84, hex: '0x84', id: 'MATCH_PAUSE', name: 'Match Pause', category: 'Signal' },
  { type: 0x85, hex: '0x85', id: 'MATCH_RESUME', name: 'Match Resume', category: 'Signal' },
  { type: 0x86, hex: '0x86', id: 'OVERTIME_START', name: 'Overtime Start', category: 'Signal' },
  { type: 0x87, hex: '0x87', id: 'MATCH_END', name: 'Match End', category: 'Signal' },
  { type: 0x88, hex: '0x88', id: 'REPLAY_START', name: 'Replay Start', category: 'Signal' },
  { type: 0x89, hex: '0x89', id: 'REPLAY_END', name: 'Replay End', category: 'Signal' }
]);

export function createDefaultLogEventFilter() {
  const filter = {};
  for (const item of CONSOLE_LOG_EVENT_CATALOG) {
    filter[item.hex.toLowerCase()] = false;
  }
  return filter;
}

// Math & Coordinate Utilities
export function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

export function clampVolume(v) {
  return Math.max(0, Math.min(5.0, Number(v) || 0));
}

export function dbToLinear(dB) {
  return Math.pow(10, dB / 20);
}

export const AUDIO_SETTINGS_KEY = "car-soccer.audio-architecture.v1";
export const AUDIO_CONFIG_STORAGE_KEY = AUDIO_SETTINGS_KEY;
export const AUDIO_SETTINGS_CHANGED_EVENT = "car-soccer:audio-settings-changed";

export const DEFAULT_AUDIO_CONFIG = Object.freeze({
  ...staticAudioConfig,
  carBallSoundMode: 'vehicle_body',
  carCarSoundMode: 'vehicle_detail',
  boostCollectVolume: 2.0,
  endgameVolume: 2.0,
  countdown10sVolume: 1.0,
  spatialPanningModel: 'equalpower',
  distanceModel: 'smoothstep',
  distanceUnitScale: 0.01,
  rolloffMinDistance: 400.0,
  rolloffMaxDistance: 13000.0,
  minAudibleGainFloor: 0.15,
  airAbsorptionDamping: 0.0,
  logEventFilter: createDefaultLogEventFilter()
});

export const DEFAULT_AUDIO_SETTINGS = DEFAULT_AUDIO_CONFIG;
