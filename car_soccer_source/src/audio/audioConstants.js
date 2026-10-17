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

export {
  CONSOLE_LOG_EVENT_CATALOG,
  createDefaultLogEventFilter,
  clamp01,
  clampVolume,
  dbToLinear,
  AUDIO_SETTINGS_KEY,
  AUDIO_CONFIG_STORAGE_KEY,
  AUDIO_SETTINGS_CHANGED_EVENT,
  DEFAULT_AUDIO_CONFIG,
  DEFAULT_AUDIO_SETTINGS
} from '../ui-system/tokens/audioConfigStore.ts';
