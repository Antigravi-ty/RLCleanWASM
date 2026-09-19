/**
 * RocketSimConstants.js
 * Comprehensive constants and memory offsets for RocketSim WebAssembly physics simulation.
 * Reference: https://github.com/zealanL/rocketsim (RLConst.h, CarConfig.h, CarControls.h, PhysState.h)
 */

/**
 * Global RocketSim arena shared-memory buffer offsets (ht)
 */
export const SIM_OFFSETS = Object.freeze({
  TICK: 0,        // uint32 current physics simulation tick
  GOAL: 1,        // Goal scored event flag (0: none, 1: blue goal, 2: orange goal)
  NUM_CARS: 2,    // Number of active cars in the arena (1 in freeplay, 2+ in match/multiplayer)
  NUM_PADS: 3,    // Number of boost pads (34 in standard stadium)
  BALL: 4,        // Ball state data start offset (18 Float32 values)
  CARS: 22        // First car state data start offset (each car has CAR_STATE_STRIDE floats)
});

/**
 * Per-car RocketSim physics state offsets within a 40-float block (ye)
 * Formula: carOffset = SIM_OFFSETS.CARS + carIndex * CAR_STATE_STRIDE
 */
export const CAR_STATE_OFFSETS = Object.freeze({
  POS: 0,                     // World position [x, y, z] (3 floats)
  FWD: 3,                     // Forward direction unit vector [x, y, z] (3 floats)
  RIGHT: 6,                   // Right direction unit vector [x, y, z] (3 floats)
  UP: 9,                      // Upward direction unit vector [x, y, z] (3 floats)
  VEL: 12,                    // Linear velocity [x, y, z] (3 floats, unreal units / sec)
  ANG_VEL: 15,                // Angular velocity [x, y, z] (3 floats, rad / sec)
  BOOST: 18,                  // Boost reserve (0.0 to 100.0)
  ON_GROUND: 19,              // Contact with ground / surface (1 if >= 3 wheels touching, else 0)
  SUPERSONIC: 20,             // In supersonic state (speed > 2200 uu/s) (1 or 0)
  DEMOED: 21,                 // Demolished state (1 or 0)
  HAS_FLIP_OR_JUMP: 22,       // Has jump or dodge available (1 or 0)
  IS_BOOSTING: 23,            // Currently expending boost (1 or 0)
  IS_FLIPPING: 24,            // Currently executing flip/dodge animation (1 or 0)
  WHEELS: 25,                 // 4 wheels suspension & contact data (12 floats: 4 * [susLength, steerAngle, hasContact])
  GROUND_NORMAL: 37           // Surface contact normal [x, y, z] (3 floats)
});

/**
 * RocketSim ball physics state offsets within an 18-float block
 * Reference: RocketSim PhysState (Vec pos, RotMat rotMat, Vec vel, Vec angVel)
 */
export const BALL_STATE_OFFSETS = Object.freeze({
  POS: 0,                     // World position [x, y, z] (3 floats)
  ROT_MAT: 3,                 // 3x3 Rotation matrix / basis vectors (9 floats: FWD, RIGHT, UP)
  FWD: 3,                     // Forward direction unit vector [x, y, z] (3 floats)
  RIGHT: 6,                   // Right direction unit vector [x, y, z] (3 floats)
  UP: 9,                      // Upward direction unit vector [x, y, z] (3 floats)
  VEL: 12,                    // Linear velocity [x, y, z] (3 floats, uu / sec)
  ANG_VEL: 15                 // Angular velocity [x, y, z] (3 floats, rad / sec)
});

/** Float stride per car in RocketSim state buffer */
export const CAR_STATE_STRIDE = 40;

/** Float stride per ball in RocketSim state buffer */
export const BALL_STATE_STRIDE = 18;

/** Float stride per car in controls view buffer */
export const CONTROLS_STRIDE = 8;

/** Maximum number of cars supported in memory layout */
export const MAX_CARS = 8;

/** Standard 120Hz physics simulation tick rate */
export const PHYSICS_TICK_RATE = 120;

/** Standard fixed physics delta time (1 / 120s = 8.333ms) */
export const FIXED_TIMESTEP = 1 / PHYSICS_TICK_RATE;

/** Maximum physics substeps simulated per frame before dropping (12 ticks = 100ms) */
export const MAX_PHYSICS_SUBSTEPS = 12;

/**
 * Wheel suspension and contact layout
 */
export const WHEEL_COUNT = 4;
export const WHEEL_STATE_STRIDE = 3; // [contact (1/0), susLength, wheelSpeed]
export const WHEEL_OFFSETS = Object.freeze({
  CONTACT: 0,
  SUS_LENGTH: 1,
  WHEEL_SPEED: 2
});

/**
 * RocketSim WebAssembly shared state buffer wheel layout (stride 3)
 * Exact per-wheel memory offsets in CarSoccerEngine WASM:
 * [0: susLength, 1: steerAngle, 2: hasContact]
 */
export const WASM_WHEEL_OFFSETS = Object.freeze({
  SUS_LENGTH: 0,
  STEER_ANGLE: 1,
  HAS_CONTACT: 2
});

/**
 * RocketSim arena boost pad state layout
 * Starts immediately after all MAX_CARS state blocks: SIM_OFFSETS.CARS + MAX_CARS * CAR_STATE_STRIDE
 * Formula: padStateOffset = BOOST_PAD_STATES_OFFSET + padIndex * BOOST_PAD_STATE_STRIDE
 */
export const NUM_BOOST_PADS = 34;
export const BOOST_PAD_STATE_STRIDE = 2; // [isActive (1 or 0), cooldownTimer (sec)]
export const BOOST_PAD_STATES_OFFSET = SIM_OFFSETS.CARS + MAX_CARS * CAR_STATE_STRIDE; // 22 + 8 * 40 = 342
export const BOOST_PAD_TIMEOUT_BIG = 10.0;
export const BOOST_PAD_TIMEOUT_SMALL = 4.0;
export const BOOST_PAD_OFFSETS = Object.freeze({
  IS_ACTIVE: 0,
  COOLDOWN: 1
});

/**
 * Per-car input control offsets within an 8-float controls view block
 * Reference: RocketSim CarControls (throttle, steer, pitch, yaw, roll, jump, boost, handbrake)
 */
export const CONTROLS_OFFSETS = Object.freeze({
  THROTTLE: 0,
  STEER: 1,
  PITCH: 2,
  YAW: 3,
  ROLL: 4,
  JUMP: 5,
  BOOST: 6,
  HANDBRAKE: 7
});

/**
 * RocketSim & Rocket League physical environment constants (RLConst.h)
 */
export const GRAVITY_Z = -650;
export const BALL_COLLISION_RADIUS = 91.25;
export const BALL_MAX_SPEED = 4000;
export const CAR_MAX_SPEED = 2300;
export const SUPERSONIC_SPEED_THRESHOLD = 2200;

export const ARENA_EXTENTS = Object.freeze({
  X: 4096,
  Y: 5120,
  Z: 2048,
  WIDTH: 8192,
  LENGTH: 10240,
  HEIGHT: 2048
});

export const GOAL_EXTENTS = Object.freeze({
  WIDTH: 1785.51,
  DEPTH: 880,
  HEIGHT: 642.775
});

/**
 * Ball control actions supported by RocketSim WASM
 */
export const BALL_CONTROL_MODES = Object.freeze([
  'takePossession',
  'startDribble',
  'passBall',
  'launchBall'
]);

/**
 * Team IDs
 */
export const TEAMS = Object.freeze({
  BLUE: 0,
  ORANGE: 1
});

/**
 * Accurate hitbox dimensions and offsets directly aligned with zealanL/rocketsim (CarConfig.cpp)
 */
export const HITBOX_PRESETS = Object.freeze({
  OCTANE: {
    name: 'Octane',
    size: [120.507, 86.6994, 38.6591],
    offset: [13.8757, 0, 20.755],
    frontWheels: { radius: 12.50, susRest: 38.755, offset: [51.25, 25.90, 20.755] },
    backWheels: { radius: 15.00, susRest: 37.055, offset: [-33.75, 29.50, 20.755] }
  },
  DOMINUS: {
    name: 'Dominus',
    size: [130.427, 85.7799, 33.8],
    offset: [9.0, 0, 15.75],
    frontWheels: { radius: 12.00, susRest: 33.95, offset: [50.30, 31.10, 15.75] },
    backWheels: { radius: 13.50, susRest: 33.85, offset: [-34.75, 33.00, 15.75] }
  },
  PLANK: {
    name: 'Plank',
    size: [131.32, 87.1704, 31.8944],
    offset: [9.00857, 0, 12.0942],
    frontWheels: { radius: 12.50, susRest: 31.9242, offset: [49.97, 27.80, 12.0942] },
    backWheels: { radius: 17.00, susRest: 27.9242, offset: [-35.43, 20.28, 12.0942] }
  },
  BREAKOUT: {
    name: 'Breakout',
    size: [133.992, 83.021, 32.8],
    offset: [12.5, 0, 11.75],
    frontWheels: { radius: 13.50, susRest: 29.7, offset: [51.50, 26.67, 11.75] },
    backWheels: { radius: 15.00, susRest: 29.666, offset: [-35.75, 35.00, 11.75] }
  },
  HYBRID: {
    name: 'Hybrid',
    size: [129.519, 84.6879, 36.6591],
    offset: [13.8757, 0, 20.755],
    frontWheels: { radius: 12.50, susRest: 38.755, offset: [51.25, 25.90, 20.755] },
    backWheels: { radius: 15.00, susRest: 37.055, offset: [-34.00, 29.50, 20.755] }
  },
  MERC: {
    name: 'Merc',
    size: [123.22, 79.2103, 44.1591],
    offset: [11.3757, 0, 21.505],
    frontWheels: { radius: 15.00, susRest: 39.505, offset: [51.25, 25.90, 21.505] },
    backWheels: { radius: 15.00, susRest: 39.105, offset: [-33.75, 29.50, 21.505] }
  }
});

/**
 * Native Physics Event Constants and Bitflags
 */
export const PHYSICS_EVENT_TYPES = Object.freeze({
  NONE: 0,
  CAR_BALL_HIT: 1,
  CAR_CAR_COLLISION: 2,
  BALL_WORLD_HIT: 3,
  BALL_GOALPOST_HIT: 4,
  CAR_ACTION: 5,
  CAR_SUPERSONIC_ENTER: 6,
  BOOST_PICKUP: 7,
  // Backward compatibility aliases
  CAR_DEMO: 2
});

export const CAR_ACTION_SUBTYPES = Object.freeze({
  NONE: 0,
  SINGLE_JUMP: 1,
  DOUBLE_JUMP: 2,
  DODGE: 3
});

export const PHYSICS_EVENT_FLAGS = Object.freeze({
  INITIAL_TOUCH: 1 << 0,
  SUPERSONIC: 1 << 1,
  FLIP: 1 << 2,
  ON_GROUND: 1 << 3
});

export const EVENT_BUFFER_CAPACITY = 64;
export const EVENT_SIZE_BYTES = 48;
export const EVENT_SIZE_WORDS = 12; // 48 / 4
export const EVENT_HEADER_BYTES = 16;
export const EVENT_HEADER_WORDS = 4; // 16 / 4
export const EVENT_TOTAL_BUFFER_BYTES = EVENT_HEADER_BYTES + EVENT_BUFFER_CAPACITY * EVENT_SIZE_BYTES; // 3120 bytes

/**
 * Zero-allocation, high-performance typed state view for Arena Header in RocketSim shared memory.
 */
export class ArenaHeaderView {
  constructor(buffer = null) {
    this.buffer = buffer;
  }

  attach(buffer) {
    this.buffer = buffer;
    return this;
  }

  get tickCount() { return this.buffer ? this.buffer[SIM_OFFSETS.TICK] : 0; }
  get goalScoredFlag() { return this.buffer ? this.buffer[SIM_OFFSETS.GOAL] : 0; }
  get numCars() { return this.buffer ? this.buffer[SIM_OFFSETS.NUM_CARS] : 0; }
  get numPads() { return this.buffer ? this.buffer[SIM_OFFSETS.NUM_PADS] : 0; }
}

/**
 * Zero-allocation, high-performance typed state view for a single car in RocketSim shared memory.
 * Decouples game/render logic from raw 51-float array indexing.
 */
export class CarStateView {
  constructor(buffer = null, baseOffset = 0) {
    this.buffer = buffer;
    this.baseOffset = baseOffset;
  }

  /**
   * Rebinds view to a given buffer and base offset or car index without allocating memory.
   * @param {ArrayLike<number>} buffer
   * @param {number} baseOffsetOrCarIndex
   * @returns {CarStateView}
   */
  attach(buffer, baseOffsetOrCarIndex = 0) {
    this.buffer = buffer;
    this.baseOffset = (baseOffsetOrCarIndex >= 0 && baseOffsetOrCarIndex < MAX_CARS)
      ? SIM_OFFSETS.CARS + baseOffsetOrCarIndex * CAR_STATE_STRIDE
      : baseOffsetOrCarIndex;
    return this;
  }

  /**
   * Directly attaches view by carIndex (0..7) without calculating memory offsets.
   * @param {ArrayLike<number>} buffer
   * @param {number} carIndex
   * @returns {CarStateView}
   */
  attachCar(buffer, carIndex = 0) {
    this.buffer = buffer;
    this.baseOffset = SIM_OFFSETS.CARS + carIndex * CAR_STATE_STRIDE;
    return this;
  }

  // Position
  get posX() { return this.buffer ? this.buffer[this.baseOffset + 0] : 0; }
  get posY() { return this.buffer ? this.buffer[this.baseOffset + 1] : 0; }
  get posZ() { return this.buffer ? this.buffer[this.baseOffset + 2] : 0; }

  // Forward unit vector
  get fwdX() { return this.buffer ? this.buffer[this.baseOffset + 3] : 0; }
  get fwdY() { return this.buffer ? this.buffer[this.baseOffset + 4] : 0; }
  get fwdZ() { return this.buffer ? this.buffer[this.baseOffset + 5] : 0; }

  // Right unit vector
  get rightX() { return this.buffer ? this.buffer[this.baseOffset + 6] : 0; }
  get rightY() { return this.buffer ? this.buffer[this.baseOffset + 7] : 0; }
  get rightZ() { return this.buffer ? this.buffer[this.baseOffset + 8] : 0; }

  // Up unit vector
  get upX() { return this.buffer ? this.buffer[this.baseOffset + 9] : 0; }
  get upY() { return this.buffer ? this.buffer[this.baseOffset + 10] : 0; }
  get upZ() { return this.buffer ? this.buffer[this.baseOffset + 11] : 0; }

  // Linear velocity
  get velX() { return this.buffer ? this.buffer[this.baseOffset + 12] : 0; }
  get velY() { return this.buffer ? this.buffer[this.baseOffset + 13] : 0; }
  get velZ() { return this.buffer ? this.buffer[this.baseOffset + 14] : 0; }

  // Angular velocity
  get angVelX() { return this.buffer ? this.buffer[this.baseOffset + 15] : 0; }
  get angVelY() { return this.buffer ? this.buffer[this.baseOffset + 16] : 0; }
  get angVelZ() { return this.buffer ? this.buffer[this.baseOffset + 17] : 0; }

  // Gameplay status
  get boost() { return this.buffer ? this.buffer[this.baseOffset + 18] : 0; }
  get isOnGround() { return this.buffer ? this.buffer[this.baseOffset + 19] === 1 : false; }
  get isSupersonic() { return this.buffer ? this.buffer[this.baseOffset + 20] === 1 : false; }
  get isDemoed() { return this.buffer ? this.buffer[this.baseOffset + 21] === 1 : false; }
  get hasFlipOrJump() { return this.buffer ? this.buffer[this.baseOffset + 22] === 1 : false; }
  get isBoosting() { return this.buffer ? this.buffer[this.baseOffset + 23] === 1 : false; }
  get isFlipping() { return this.buffer ? this.buffer[this.baseOffset + 24] === 1 : false; }
  // Wheels
  getWheelSusLength(wheelIndex) {
    return this.buffer ? this.buffer[this.baseOffset + 25 + wheelIndex * 3 + 0] : 0;
  }
  getWheelSteerAngle(wheelIndex) {
    return this.buffer ? this.buffer[this.baseOffset + 25 + wheelIndex * 3 + 1] : 0;
  }
  getWheelContact(wheelIndex) {
    return this.buffer ? this.buffer[this.baseOffset + 25 + wheelIndex * 3 + 2] === 1 : false;
  }

  // Ground Normal
  get groundNormalX() { return this.buffer ? this.buffer[this.baseOffset + 37] : 0; }
  get groundNormalY() { return this.buffer ? this.buffer[this.baseOffset + 38] : 0; }
  get groundNormalZ() { return this.buffer ? this.buffer[this.baseOffset + 39] : 0; }

  // Derived physics
  get forwardSpeed() {
    return this.velX * this.fwdX + this.velY * this.fwdY + this.velZ * this.fwdZ;
  }
}

/**
 * Zero-allocation, high-performance typed state view for the ball in RocketSim shared memory.
 */
export class BallStateView {
  constructor(buffer = null, baseOffset = SIM_OFFSETS.BALL) {
    this.buffer = buffer;
    this.baseOffset = baseOffset;
  }

  /**
   * Rebinds view to a given buffer and base offset without allocating memory.
   * @param {ArrayLike<number>} buffer
   * @param {number} baseOffset
   * @returns {BallStateView}
   */
  attach(buffer, baseOffset = SIM_OFFSETS.BALL) {
    this.buffer = buffer;
    this.baseOffset = baseOffset;
    return this;
  }

  // Position
  get posX() { return this.buffer ? this.buffer[this.baseOffset + 0] : 0; }
  get posY() { return this.buffer ? this.buffer[this.baseOffset + 1] : 0; }
  get posZ() { return this.buffer ? this.buffer[this.baseOffset + 2] : 0; }

  // Forward unit vector
  get fwdX() { return this.buffer ? this.buffer[this.baseOffset + 3] : 0; }
  get fwdY() { return this.buffer ? this.buffer[this.baseOffset + 4] : 0; }
  get fwdZ() { return this.buffer ? this.buffer[this.baseOffset + 5] : 0; }

  // Right unit vector
  get rightX() { return this.buffer ? this.buffer[this.baseOffset + 6] : 0; }
  get rightY() { return this.buffer ? this.buffer[this.baseOffset + 7] : 0; }
  get rightZ() { return this.buffer ? this.buffer[this.baseOffset + 8] : 0; }

  // Up unit vector
  get upX() { return this.buffer ? this.buffer[this.baseOffset + 9] : 0; }
  get upY() { return this.buffer ? this.buffer[this.baseOffset + 10] : 0; }
  get upZ() { return this.buffer ? this.buffer[this.baseOffset + 11] : 0; }

  // Linear velocity
  get velX() { return this.buffer ? this.buffer[this.baseOffset + 12] : 0; }
  get velY() { return this.buffer ? this.buffer[this.baseOffset + 13] : 0; }
  get velZ() { return this.buffer ? this.buffer[this.baseOffset + 14] : 0; }

  // Angular velocity
  get angVelX() { return this.buffer ? this.buffer[this.baseOffset + 15] : 0; }
  get angVelY() { return this.buffer ? this.buffer[this.baseOffset + 16] : 0; }
  get angVelZ() { return this.buffer ? this.buffer[this.baseOffset + 17] : 0; }
}

/**
 * Zero-allocation, high-performance typed state view for boost pads in RocketSim shared memory.
 * Eliminates raw offset arithmetic when reading boost pad status and cooldown.
 */
export class BoostPadStateView {
  constructor(buffer = null, padIndex = 0) {
    this.buffer = buffer;
    this.baseOffset = BOOST_PAD_STATES_OFFSET + padIndex * BOOST_PAD_STATE_STRIDE;
  }

  /**
   * Rebinds view to a given buffer and padIndex without allocating memory.
   * @param {ArrayLike<number>} buffer
   * @param {number} padIndex
   * @returns {BoostPadStateView}
   */
  attach(buffer, padIndex = 0) {
    this.buffer = buffer;
    this.baseOffset = BOOST_PAD_STATES_OFFSET + padIndex * BOOST_PAD_STATE_STRIDE;
    return this;
  }

  get isActive() { return this.buffer ? this.buffer[this.baseOffset] > 0.5 : false; }
  get cooldown() { return this.buffer ? this.buffer[this.baseOffset + 1] : 0; }
}

/**
 * High-level zero-allocation composite view wrapping the entire GameStateBufferPod.
 * Fully mirrors C++ GameStateBufferPod layout with semantic child accessors.
 */
export class GameStateView {
  constructor(buffer = null) {
    this.buffer = buffer;
    this.header = new ArenaHeaderView(buffer);
    this.ball = new BallStateView(buffer);
    this.cars = Array.from({ length: MAX_CARS }, (_, i) => new CarStateView(buffer, SIM_OFFSETS.CARS + i * CAR_STATE_STRIDE));
    this.pads = Array.from({ length: NUM_BOOST_PADS }, (_, i) => new BoostPadStateView(buffer, i));
  }

  attach(buffer) {
    this.buffer = buffer;
    this.header.attach(buffer);
    this.ball.attach(buffer);
    for (let i = 0; i < MAX_CARS; i++) {
      this.cars[i].attachCar(buffer, i);
    }
    for (let i = 0; i < NUM_BOOST_PADS; i++) {
      this.pads[i].attach(buffer, i);
    }
    return this;
  }

  getCar(index = 0) {
    return this.cars[index];
  }

  getPad(index = 0) {
    return this.pads[index];
  }
}

/**
 * Zero-allocation, high-performance consumer for RocketSim WebAssembly Physics Events Ring Buffer.
 * Decodes 48-byte events emitted by the C++ kernel with zero allocations in the hot path.
 */
export class PhysicsEventReader {
  constructor(buffer = null, byteOffset = 0) {
    this.buffer = null;
    this.byteOffset = 0;
    this.u32View = null;
    this.f32View = null;
    this.lastReadSeq = 0;

    // Single reusable event object to completely avoid GC allocations
    this.currentEvent = {
      type: PHYSICS_EVENT_TYPES.NONE,
      tick: 0,
      x: 0,
      y: 0,
      z: 0,
      carIndex: 0,
      team: 0,
      relSpeed: 0,
      speed: 0,
      normalX: 0,
      normalY: 0,
      normalZ: 0,
      impulse: 0,
      isDemo: false,
      car1Index: 0,
      car2Index: 0,
      car1Team: 0,
      car2Team: 0,
      surfaceTag: 0,
      isCrossbar: false,
      actionSubType: 0,
      subType: 0,
      padIndex: 0,
      isBig: false,
      flags: 0,
      isInitialTouch: false,
      isSupersonic: false,
      isFlipping: false,
      isOnGround: false
    };

    if (buffer) {
      this.attach(buffer, byteOffset);
    }
  }

  /**
   * Attaches reader to the given ArrayBuffer or WASM HEAP and byte offset
   * @param {ArrayBuffer | ArrayBufferView} arrayBufferOrHeap
   * @param {number} byteOffset
   * @returns {PhysicsEventReader}
   */
  attach(arrayBufferOrHeap, byteOffset = 0) {
    const rawBuffer = arrayBufferOrHeap?.buffer || arrayBufferOrHeap;
    if (!rawBuffer) {
      this.buffer = null;
      this.u32View = null;
      this.f32View = null;
      return this;
    }
    this.buffer = rawBuffer;
    this.byteOffset = byteOffset;
    const totalWords = EVENT_HEADER_WORDS + EVENT_BUFFER_CAPACITY * EVENT_SIZE_WORDS;
    this.u32View = new Uint32Array(rawBuffer, byteOffset, totalWords);
    this.f32View = new Float32Array(rawBuffer, byteOffset, totalWords);
    return this;
  }

  get writeSeq() {
    return this.u32View ? this.u32View[0] : 0;
  }

  get capacity() {
    return this.u32View ? this.u32View[1] : EVENT_BUFFER_CAPACITY;
  }

  get eventSize() {
    return this.u32View ? this.u32View[2] : EVENT_SIZE_BYTES;
  }

  /**
   * Resets read sequence pointer to match writeSeq (discards pending historical events)
   */
  reset() {
    this.lastReadSeq = this.writeSeq;
  }

  /**
   * Decodes a slot from the ring buffer into the pooled currentEvent object
   * @param {number} wordOffset
   * @returns {Object} currentEvent
   */
  decodeSlot(wordOffset) {
    const u32 = this.u32View;
    const f32 = this.f32View;
    const ev = this.currentEvent;

    const type = u32[wordOffset + 0];
    ev.type = type;
    ev.tick = u32[wordOffset + 1];
    ev.x = f32[wordOffset + 2];
    ev.y = f32[wordOffset + 3];
    ev.z = f32[wordOffset + 4];

    // Reset reusable fields
    ev.carIndex = 0;
    ev.team = 0;
    ev.relSpeed = 0;
    ev.speed = 0;
    ev.normalX = 0;
    ev.normalY = 0;
    ev.normalZ = 0;
    ev.impulse = 0;
    ev.isDemo = false;
    ev.car1Index = 0;
    ev.car2Index = 0;
    ev.car1Team = 0;
    ev.car2Team = 0;
    ev.surfaceTag = 0;
    ev.isCrossbar = false;
    ev.actionSubType = 0;
    ev.subType = 0;
    ev.padIndex = 0;
    ev.isBig = false;

    if (type === PHYSICS_EVENT_TYPES.CAR_BALL_HIT) {
      const carAndTeam = u32[wordOffset + 5];
      ev.carIndex = carAndTeam & 0xFFFF;
      ev.team = (carAndTeam >>> 16) & 0xFFFF;
      ev.relSpeed = f32[wordOffset + 6];
      ev.speed = ev.relSpeed;
      ev.normalX = f32[wordOffset + 7];
      ev.normalY = f32[wordOffset + 8];
      ev.normalZ = f32[wordOffset + 9];
      ev.impulse = f32[wordOffset + 10];
    } else if (type === PHYSICS_EVENT_TYPES.CAR_CAR_COLLISION) {
      const cars = u32[wordOffset + 5];
      const teams = u32[wordOffset + 6];
      ev.car1Index = cars & 0xFFFF;
      ev.car2Index = (cars >>> 16) & 0xFFFF;
      ev.carIndex = ev.car1Index;
      ev.car1Team = teams & 0xFFFF;
      ev.car2Team = (teams >>> 16) & 0xFFFF;
      ev.team = ev.car1Team;
      ev.relSpeed = f32[wordOffset + 7];
      ev.speed = ev.relSpeed;
      ev.impulse = f32[wordOffset + 8];
      ev.isDemo = u32[wordOffset + 9] !== 0;
    } else if (type === PHYSICS_EVENT_TYPES.BALL_WORLD_HIT) {
      ev.speed = f32[wordOffset + 5];
      ev.relSpeed = ev.speed;
      ev.normalX = f32[wordOffset + 6];
      ev.normalY = f32[wordOffset + 7];
      ev.normalZ = f32[wordOffset + 8];
      ev.surfaceTag = u32[wordOffset + 9];
    } else if (type === PHYSICS_EVENT_TYPES.BALL_GOALPOST_HIT) {
      ev.speed = f32[wordOffset + 5];
      ev.relSpeed = ev.speed;
      ev.normalX = f32[wordOffset + 6];
      ev.normalY = f32[wordOffset + 7];
      ev.normalZ = f32[wordOffset + 8];
      ev.isCrossbar = u32[wordOffset + 9] !== 0;
    } else if (type === PHYSICS_EVENT_TYPES.CAR_ACTION) {
      const carAndTeam = u32[wordOffset + 5];
      ev.carIndex = carAndTeam & 0xFFFF;
      ev.team = (carAndTeam >>> 16) & 0xFFFF;
      ev.actionSubType = u32[wordOffset + 6];
      ev.subType = ev.actionSubType;
    } else if (type === PHYSICS_EVENT_TYPES.CAR_SUPERSONIC_ENTER) {
      const carAndTeam = u32[wordOffset + 5];
      ev.carIndex = carAndTeam & 0xFFFF;
      ev.team = (carAndTeam >>> 16) & 0xFFFF;
      ev.speed = f32[wordOffset + 6];
      ev.relSpeed = ev.speed;
    } else if (type === PHYSICS_EVENT_TYPES.BOOST_PICKUP) {
      const carAndTeam = u32[wordOffset + 5];
      ev.carIndex = carAndTeam & 0xFFFF;
      ev.team = (carAndTeam >>> 16) & 0xFFFF;
      ev.padIndex = u32[wordOffset + 6];
      ev.isBig = u32[wordOffset + 7] !== 0;
    }

    const flags = u32[wordOffset + 11];
    ev.flags = flags;
    ev.isInitialTouch = (flags & PHYSICS_EVENT_FLAGS.INITIAL_TOUCH) !== 0;
    ev.isSupersonic = (flags & PHYSICS_EVENT_FLAGS.SUPERSONIC) !== 0;
    ev.isFlipping = (flags & PHYSICS_EVENT_FLAGS.FLIP) !== 0;
    ev.isOnGround = (flags & PHYSICS_EVENT_FLAGS.ON_GROUND) !== 0;

    return ev;
  }

  /**
   * Reads all unread events and calls callback(event) for each.
   * If frame drops cause available > 64, automatically clamps lastReadSeq to discard expired slots.
   * @param {Function} callback
   * @returns {number} number of events dispatched
   */
  readEvents(callback) {
    if (!this.u32View || !this.f32View) return 0;

    const currentWriteSeq = this.u32View[0];
    const available = currentWriteSeq - this.lastReadSeq;
    if (available <= 0) return 0;

    if (available > EVENT_BUFFER_CAPACITY) {
      this.lastReadSeq = currentWriteSeq - EVENT_BUFFER_CAPACITY;
    }

    let processedCount = 0;
    while (this.lastReadSeq < currentWriteSeq) {
      const seq = this.lastReadSeq;
      const slot = seq % EVENT_BUFFER_CAPACITY;
      const wordOffset = EVENT_HEADER_WORDS + slot * EVENT_SIZE_WORDS;

      const ev = this.decodeSlot(wordOffset);
      this.lastReadSeq++;
      processedCount++;

      if (callback) {
        callback(ev);
      }
    }

    return processedCount;
  }
}
