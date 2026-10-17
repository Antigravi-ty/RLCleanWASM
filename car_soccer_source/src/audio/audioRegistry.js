import { INCIDENT_EVENT_TYPES } from '../physics/RocketSimConstants.js';
import {
  BALL_HIT_AUDIO_FILES,
  SIDEWALL_HIT_AUDIO_FILES,
  SFX_CAR_COLLISION_FILE,
  BOOST_COLLECT_FILE,
  GOAL_SCORED_FILE,
  SUPERSONIC_STATE_FILE,
  JUMP_AUDIO_FILES,
  DOUBLE_JUMP_AUDIO_FILES,
  DODGE_AUDIO_FILES,
  RESET_AUDIO_FILE,
  GOALPOST_AUDIO_FILE,
  BALL_GROUND_HIT_AUDIO_FILES,
  SUPERSONIC_ENTER_AUDIO_FILES,
  SUPERSONIC_LOOP_AUDIO_FILE,
  BOOST_START_AUDIO_FILE,
  BOOST_RELEASE_AUDIO_FILE,
  VEHICLE_BODY_IMPACT_AUDIO_FILES,
  VEHICLE_ACCENT_AUDIO_FILE,
  VEHICLE_DETAIL_AUDIO_FILES,
  CROSSBAR_PING_AUDIO_FILES,
  CROSSBAR_PING_SMALL_AUDIO_FILES,
  CONSOLE_LOG_EVENT_CATALOG,
  createDefaultLogEventFilter
} from './audioConstants.js';

export { CONSOLE_LOG_EVENT_CATALOG, createDefaultLogEventFilter };

/**
 * Authoritative incident-to-audio mapping and lifecycle metadata registry.
 */
export const INCIDENT_AUDIO_REGISTRY = Object.freeze({
  [INCIDENT_EVENT_TYPES.CAR_BALL_HIT]: Object.freeze({
    id: "CAR_BALL_HIT",
    name: "Car-Ball Hit",
    category: "Incident",
    primary: VEHICLE_BODY_IMPACT_AUDIO_FILES,
    accent: Object.freeze([VEHICLE_ACCENT_AUDIO_FILE]),
    fallback: BALL_HIT_AUDIO_FILES,
    cooldownKey: "carBallHitCooldownMs",
    volumeKey: "carBallHitVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.CAR_CAR_BUMP]: Object.freeze({
    id: "CAR_CAR_BUMP",
    name: "Car-Car Bump",
    category: "Incident",
    primary: Object.freeze([SFX_CAR_COLLISION_FILE]),
    detail: VEHICLE_DETAIL_AUDIO_FILES,
    fallback: Object.freeze([SFX_CAR_COLLISION_FILE]),
    volumeKey: "carCarCollisionVolume",
    defaultPriority: 6
  }),
  [INCIDENT_EVENT_TYPES.CAR_CAR_DEMO]: Object.freeze({
    id: "CAR_CAR_DEMO",
    name: "Car Demolition",
    category: "Incident",
    primary: Object.freeze([GOAL_SCORED_FILE, SFX_CAR_COLLISION_FILE]),
    volumeKey: "carCarCollisionVolume",
    defaultPriority: 9
  }),
  [INCIDENT_EVENT_TYPES.BALL_WORLD_HIT]: Object.freeze({
    id: "BALL_WORLD_HIT",
    name: "Ball-World Collision",
    category: "Incident",
    surfaces: Object.freeze({
      floor: BALL_GROUND_HIT_AUDIO_FILES,
      net: SIDEWALL_HIT_AUDIO_FILES
    }),
    fallback: BALL_HIT_AUDIO_FILES,
    cooldownKey: "incidentCooldownMs",
    volumeKey: "ballWorldHitVolume",
    defaultPriority: 4
  }),
  [INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT]: Object.freeze({
    id: "BALL_GOALPOST_HIT",
    name: "Ball-Goalpost Collision",
    category: "Incident",
    primary: CROSSBAR_PING_AUDIO_FILES,
    fallback: CROSSBAR_PING_SMALL_AUDIO_FILES,
    cooldownKey: "goalpostHitCooldownMs",
    volumeKey: "goalpostHitVolume",
    defaultPriority: 8
  }),
  [INCIDENT_EVENT_TYPES.CAR_JUMP]: Object.freeze({
    id: "CAR_JUMP",
    name: "Single Jump",
    category: "Incident",
    primary: JUMP_AUDIO_FILES,
    volumeKey: "jumpVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_DOUBLE_JUMP]: Object.freeze({
    id: "CAR_DOUBLE_JUMP",
    name: "Double Jump",
    category: "Incident",
    primary: DOUBLE_JUMP_AUDIO_FILES,
    volumeKey: "doubleJumpVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_DODGE]: Object.freeze({
    id: "CAR_DODGE",
    name: "Dodge / Flip",
    category: "Incident",
    primary: DODGE_AUDIO_FILES,
    volumeKey: "dodgeVolume",
    defaultPriority: 3
  }),
  [INCIDENT_EVENT_TYPES.CAR_SUPERSONIC_ENTER]: Object.freeze({
    id: "CAR_SUPERSONIC_ENTER",
    name: "Supersonic Entry",
    category: "Incident",
    primary: SUPERSONIC_ENTER_AUDIO_FILES,
    loop: SUPERSONIC_LOOP_AUDIO_FILE,
    fallback: Object.freeze([SUPERSONIC_STATE_FILE]),
    volumeKey: "supersonicVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.BOOST_PICKUP]: Object.freeze({
    id: "BOOST_PICKUP",
    name: "Boost Pad Pickup",
    category: "Incident",
    primary: Object.freeze([BOOST_COLLECT_FILE]),
    volumeKey: "boostCollectVolume",
    defaultPriority: 4
  }),
  [INCIDENT_EVENT_TYPES.CAR_BOOST_START]: Object.freeze({
    id: "CAR_BOOST_START",
    name: "Car Boost Start",
    category: "Incident",
    primary: Object.freeze([BOOST_START_AUDIO_FILE]),
    volumeKey: "boostVolume",
    defaultPriority: 6
  }),
  [INCIDENT_EVENT_TYPES.CAR_BOOST_STOP]: Object.freeze({
    id: "CAR_BOOST_STOP",
    name: "Car Boost Stop",
    category: "Incident",
    primary: Object.freeze([BOOST_RELEASE_AUDIO_FILE]),
    volumeKey: "boostVolume",
    defaultPriority: 5
  }),
  [INCIDENT_EVENT_TYPES.GOAL_SCORED]: Object.freeze({
    id: "GOAL_SCORED",
    name: "Goal Scored",
    category: "Incident",
    primary: Object.freeze([GOAL_SCORED_FILE]),
    volumeKey: "goalScoredVolume",
    defaultPriority: 10
  }),
  [INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED]: Object.freeze({
    id: "FLIP_RESET_GAINED",
    name: "Flip Reset Gained",
    category: "Incident",
    primary: Object.freeze([RESET_AUDIO_FILE]),
    fallback: Object.freeze([BOOST_COLLECT_FILE]),
    volumeKey: "flipResetVolume",
    defaultPriority: 7
  })
});
