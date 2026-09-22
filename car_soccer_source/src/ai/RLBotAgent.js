/**
 * RLBotAgent.js
 * Reinforcement Learning Bot Agent & Neural Network Inference Subsystem.
 * 
 * Manages ONNX Runtime Web Worker communication for competitive RLBots:
 * - Nexto (GC-level transformer policy) with scripted kickoff routine
 * - Necto (Diamond-level policy)
 * - Seer v0 (Platinum-level LSTM policy)
 * - Integrated intelligent heuristic fallback AI for zero-crash resilience
 * - Controls encoding / decoding compatible with RocketSim C++ CarControls
 * - Backward compatibility with original obfuscated symbols (QM, JM, KM, ZM, Dc, pl, JA, dm, wA, Eg, ed, Am, WM, XM, lm).
 */

import {
  ArenaHeaderView,
  CarStateView,
  BallStateView,
  BoostPadStateView
} from '../physics/RocketSimConstants.js';
import { createLocalStorageStore, stringOrDefault } from '../utils/StorageHelper.js';

// Reusable zero-allocation views for agent observation pipelines
const sHeaderView = new ArenaHeaderView();
const sBallView = new BallStateView();
const sCarViews = [new CarStateView(), new CarStateView()];
const sPadView = new BoostPadStateView();

/**
 * Competitive Bot Profiles & ONNX Model Metadata
 */
export const BOT_POLICIES = Object.freeze([
  {
    id: "seer",
    name: "Seer v0",
    rank: "Platinum",
    description: "A Platinum-level challenger.",
    modelUrl: "/assets/bot/seer/policy.onnx",
    noticeUrl: "/assets/bot/seer/NOTICE.txt",
    credit: "Seer v0 by Neville Walo · MIT",
    tickSkip: 8,
    scriptedKickoff: false
  },
  {
    id: "necto",
    name: "Necto",
    rank: "Diamond",
    description: "A Diamond-level challenger.",
    modelUrl: "/assets/bot/necto/policy.onnx",
    noticeUrl: "/assets/bot/necto/NOTICE.txt",
    credit: "Necto by the Necto team · CC BY-NC-SA 4.0",
    tickSkip: 8,
    scriptedKickoff: false
  },
  {
    id: "nexto",
    name: "Nexto",
    rank: "GC",
    description: "A Grand Champion-level challenger.",
    modelUrl: "/assets/bot/policy.onnx",
    noticeUrl: "/assets/bot/NOTICE.txt",
    credit: "Nexto by the Necto team · CC BY-NC-SA 4.0",
    tickSkip: 8,
    scriptedKickoff: true
  }
]);

/**
 * Retrieves a bot policy metadata entry by its unique identifier.
 * @param {string} botId
 * @returns {Object|undefined}
 */
export function getBotPolicy(botId) {
  return BOT_POLICIES.find(p => p.id === botId);
}

/**
 * LocalStorage persistent settings store for selected AI bot
 */
export const botSettingsStore = createLocalStorageStore(
  "car-soccer.bot-settings.v1",
  () => ({ botId: "nexto" }),
  (target, source) => {
    target.botId = stringOrDefault(source.botId, BOT_POLICIES.map(p => p.id), target.botId);
  }
);

/**
 * Default neutral car controls schema.
 */
export const DEFAULT_CAR_CONTROLS = Object.freeze({
  throttle: 0,
  steer: 0,
  pitch: 0,
  yaw: 0,
  roll: 0,
  jump: false,
  boost: false,
  handbrake: false
});

/**
 * Encodes a controls object into an 8-float array for RocketSim CarControls.
 * [throttle, steer, pitch, yaw, roll, jump, boost, handbrake]
 * @param {Object} c
 * @returns {number[]}
 */
export function encodeCarControls(c) {
  return [c.throttle, c.steer, c.pitch, c.yaw, c.roll, +c.jump, +c.boost, +c.handbrake];
}

/**
 * Decodes an 8-float array into a semantic CarControls object.
 * @param {number[]|Float32Array|Float64Array} a
 * @returns {Object}
 */
export function decodeCarControls(a) {
  return {
    throttle: a[0],
    steer: a[1],
    pitch: a[2],
    yaw: a[3],
    roll: a[4],
    jump: a[5] > 0,
    boost: a[6] > 0,
    handbrake: a[7] > 0
  };
}

/**
 * Precomputed 90-action lookup table for Nexto discrete policy logits.
 */
export const NEXTO_ACTION_TABLE = (() => {
  const actions = [];
  for (const throttle of [-1, 0, 1]) {
    for (const steer of [-1, 0, 1]) {
      for (const boost of [0, 1]) {
        for (const handbrake of [0, 1]) {
          if (boost === 1 && throttle !== 1) continue;
          actions.push(decodeCarControls([throttle || boost, steer, 0, steer, 0, 0, boost, handbrake]));
        }
      }
    }
  }
  for (const pitch of [-1, 0, 1]) {
    for (const yaw of [-1, 0, 1]) {
      for (const roll of [-1, 0, 1]) {
        for (const jump of [0, 1]) {
          for (const boost of [0, 1]) {
            if ((jump === 1 && yaw !== 0) || (pitch === 0 && roll === 0 && jump === 0)) continue;
            const handbrake = jump === 1 && (pitch !== 0 || yaw !== 0 || roll !== 0);
            actions.push(decodeCarControls([boost, yaw, pitch, yaw, roll, jump, boost, +handbrake]));
          }
        }
      }
    }
  }
  return actions.map(a => Object.freeze(a));
})();

/**
 * Builds the tensor observation for Nexto GC policy.
 */
export function buildNextoObservation(simState, boostPads, currentControls, botIndex, playerTeam) {
  sHeaderView.attach(simState);
  if (sHeaderView.numCars !== 2 || boostPads.length !== 34 || (botIndex !== 0 && botIndex !== 1)) {
    throw new Error("This policy requires two cars and the standard 34-pad arena.");
  }
  const entities = new Float64Array(37 * 24);

  // Cars (self, then opponent)
  [botIndex, 1 - botIndex].forEach((cIdx, i) => {
    const carView = (sCarViews[i] || new CarStateView()).attachCar(simState, cIdx);
    const eOff = i * 24;
    entities[eOff] = +(i === 0);
    entities[eOff + 1] = +(i === 0);
    entities[eOff + 2] = +(i !== 0);
    entities[eOff + 5] = carView.posX;
    entities[eOff + 6] = carView.posY;
    entities[eOff + 7] = carView.posZ;
    entities[eOff + 8] = carView.velX;
    entities[eOff + 9] = carView.velY;
    entities[eOff + 10] = carView.velZ;
    entities[eOff + 11] = carView.fwdX;
    entities[eOff + 12] = carView.fwdY;
    entities[eOff + 13] = carView.fwdZ;
    entities[eOff + 14] = carView.upX;
    entities[eOff + 15] = carView.upY;
    entities[eOff + 16] = carView.upZ;
    entities[eOff + 17] = carView.angVelX;
    entities[eOff + 18] = carView.angVelY;
    entities[eOff + 19] = carView.angVelZ;
    entities[eOff + 20] = carView.boost / 100;
    entities[eOff + 21] = carView.isDemoed ? 1 : 0;
    entities[eOff + 22] = carView.isOnGround ? 1 : 0;
    entities[eOff + 23] = carView.hasFlipOrJump ? 1 : 0;
  });

  // Ball
  sBallView.attach(simState);
  const bOff = 2 * 24;
  entities[bOff + 3] = 1;
  entities[bOff + 5] = sBallView.posX;
  entities[bOff + 6] = sBallView.posY;
  entities[bOff + 7] = sBallView.posZ;
  entities[bOff + 8] = sBallView.velX;
  entities[bOff + 9] = sBallView.velY;
  entities[bOff + 10] = sBallView.velZ;
  entities[bOff + 17] = sBallView.angVelX;
  entities[bOff + 18] = sBallView.angVelY;
  entities[bOff + 19] = sBallView.angVelZ;

  // Boost pads
  boostPads.forEach((pad, p) => {
    const pOff = (p + 3) * 24;
    sPadView.attach(simState, p);
    entities[pOff + 4] = 1;
    entities.set(pad.pos, pOff + 5);
    entities[pOff + 20] = pad.isBig ? 1 : 0.12;
    entities[pOff + 21] = sPadView.isActive ? 1 : 0;
  });

  // Normalization and team reflection
  for (let u = 0; u < 37; u++) {
    const p = u * 24;
    for (let v = 5; v < 20; v++) {
      if (playerTeam === 1 && (v - 5) % 3 !== 2) {
        entities[p + v] *= -1;
      }
      if (v < 11) {
        entities[p + v] /= 2300;
      }
      if (v >= 17) {
        entities[p + v] /= 5.5;
      }
    }
  }

  const query = new Float32Array(32);
  query.set(entities.subarray(0, 24));
  query.set(encodeCarControls(currentControls), 24);

  // Translate entities relative to car
  const yaw = Math.atan2(entities[11], entities[12]);
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const origin = entities.slice(5, 8);
  for (let u = 0; u < 37; u++) {
    const p = u * 24;
    for (let v = 0; v < 3; v++) {
      entities[p + 5 + v] -= origin[v];
    }
    for (let v = 5; v < 20; v += 3) {
      const g = entities[p + v];
      const m = entities[p + v + 1];
      entities[p + v] = cosY * g - sinY * m;
      entities[p + v + 1] = sinY * g + cosY * m;
    }
  }

  return {
    query,
    entities: new Float32Array(entities),
    mask: new Float32Array(37)
  };
}

/**
 * Scripted kickoff behavior for Nexto (fast speed-flip kickoff).
 */
export function getNextoKickoffControls(simState, kickoffTick) {
  sBallView.attach(simState);
  if (kickoffTick < 0 || kickoffTick >= 168 || sBallView.posY !== 0) {
    return null;
  }
  const c = { ...DEFAULT_CAR_CONTROLS, throttle: 1 };
  if (kickoffTick < 44) {
    c.boost = true;
  } else if (kickoffTick < 60) {
    c.boost = true;
    c.steer = -1;
  } else if (kickoffTick < 68) {
    c.boost = true;
    c.jump = true;
  } else if (kickoffTick < 72) {
    c.boost = true;
  } else if (kickoffTick < 76) {
    c.boost = true;
    c.jump = true;
    c.yaw = 0.8;
    c.pitch = -0.7;
  } else if (kickoffTick < 128) {
    c.boost = true;
    c.pitch = 1;
  } else {
    c.roll = 1;
    c.pitch = 0.5;
  }
  return c;
}

/**
 * Wraps raw tensor arrays into ONNX Tensor shapes.
 */
export function wrapTensorInputs(i) {
  return {
    query: { data: i.query, dims: [1, 1, 32] },
    entities: { data: i.entities, dims: [1, 37, 24] },
    mask: { data: i.mask, dims: [1, 37] }
  };
}

/**
 * Nexto Model Adapter
 */
export class NextoAdapter {
  constructor() {
    this.outputNames = ["logits"];
  }

  initialInputs() {
    return wrapTensorInputs({
      query: new Float32Array(32),
      entities: new Float32Array(37 * 24),
      mask: new Float32Array(37)
    });
  }

  build(simState, boostPads, currentControls, botIndex, playerTeam) {
    return wrapTensorInputs(buildNextoObservation(simState, boostPads, currentControls, botIndex, playerTeam));
  }

  decode(outputs) {
    const logits = outputs.logits;
    if (!logits || logits.length !== NEXTO_ACTION_TABLE.length) {
      throw new Error("Nexto returned an invalid action layout.");
    }
    let bestIndex = 0;
    for (let i = 0; i < logits.length; i++) {
      if (!Number.isFinite(logits[i])) {
        throw new Error("Nexto produced an invalid action.");
      }
      if (logits[i] > logits[bestIndex]) {
        bestIndex = i;
      }
    }
    return { ...NEXTO_ACTION_TABLE[bestIndex] };
  }

  reset() {}
}

const NECTO_NUM_ENTITIES = 37;
const NECTO_ENTITY_DIMS = 24;
const NECTO_TICK_SKIP = 8;

/**
 * Necto Model Adapter
 */
export class NectoAdapter {
  constructor() {
    this.outputNames = ["throttle", "steer", "jump", "boost", "handbrake"];
    this.demoTimers = new Float64Array(2);
    this.boostTimers = new Float64Array(34);
  }

  initialInputs() {
    return {
      query: { data: new Float32Array(32), dims: [1, 1, 32] },
      entities: { data: new Float32Array(NECTO_NUM_ENTITIES * NECTO_ENTITY_DIMS), dims: [1, NECTO_NUM_ENTITIES, NECTO_ENTITY_DIMS] },
      mask: { data: new Float32Array(NECTO_NUM_ENTITIES), dims: [1, NECTO_NUM_ENTITIES] }
    };
  }

  reset() {
    this.demoTimers.fill(0);
    this.boostTimers.fill(0);
  }

  build(simState, boostPads, currentControls, botIndex, playerTeam) {
    sHeaderView.attach(simState);
    if (sHeaderView.numCars !== 2 || boostPads.length !== 34 || (botIndex !== 0 && botIndex !== 1)) {
      throw new Error("Necto requires two cars and the standard 34-pad arena.");
    }
    const entities = new Float64Array(NECTO_NUM_ENTITIES * NECTO_ENTITY_DIMS);
    entities[3] = 1;
    sBallView.attach(simState);
    entities[5] = sBallView.posX;
    entities[6] = sBallView.posY;
    entities[7] = sBallView.posZ;
    entities[8] = sBallView.velX;
    entities[9] = sBallView.velY;
    entities[10] = sBallView.velZ;
    entities[17] = sBallView.angVelX;
    entities[18] = sBallView.angVelY;
    entities[19] = sBallView.angVelZ;

    [botIndex, 1 - botIndex].forEach((cIdx, c) => {
      const carView = (sCarViews[c] || new CarStateView()).attachCar(simState, cIdx);
      const d = (c + 1) * NECTO_ENTITY_DIMS;
      entities[d] = +(c === 0);
      entities[d + 1] = +(c === 0);
      entities[d + 2] = +(c !== 0);
      entities[d + 5] = carView.posX;
      entities[d + 6] = carView.posY;
      entities[d + 7] = carView.posZ;
      entities[d + 8] = carView.velX;
      entities[d + 9] = carView.velY;
      entities[d + 10] = carView.velZ;
      entities[d + 11] = carView.fwdX;
      entities[d + 12] = carView.fwdY;
      entities[d + 13] = carView.fwdZ;
      entities[d + 14] = carView.upX;
      entities[d + 15] = carView.upY;
      entities[d + 16] = carView.upZ;
      entities[d + 17] = carView.angVelX;
      entities[d + 18] = carView.angVelY;
      entities[d + 19] = carView.angVelZ;
      entities[d + 20] = carView.boost / 100;
      this.demoTimers[cIdx] = this.demoTimers[cIdx] <= 0 ? 3 : Math.max(this.demoTimers[cIdx] - NECTO_TICK_SKIP / 120, 0);
      entities[d + 21] = this.demoTimers[cIdx] / 10;
      entities[d + 22] = carView.isOnGround ? 1 : 0;
      entities[d + 23] = carView.hasFlipOrJump ? 1 : 0;
    });

    boostPads.forEach((pad, c) => {
      const h = (c + 3) * NECTO_ENTITY_DIMS;
      sPadView.attach(simState, c);
      const d = sPadView.isActive ? 1 : 0;
      entities[h + 4] = 1;
      entities.set(pad.pos, h + 5);
      entities[h + 20] = 0.12 + 0.88 * +pad.isBig;
      if (d === 1 && this.boostTimers[c] === 0) {
        this.boostTimers[c] = 0.4 + 0.6 * +(pad.pos[2] > 72);
      }
      this.boostTimers[c] *= d;
      entities[h + 21] = this.boostTimers[c];
      this.boostTimers[c] = Math.max(this.boostTimers[c] - NECTO_TICK_SKIP / 1200, 0);
    });

    for (let l = 0; l < NECTO_NUM_ENTITIES; l++) {
      const c = l * NECTO_ENTITY_DIMS;
      for (let h = 5; h < 20; h++) {
        if (h < 11) entities[c + h] /= 2300;
        if (h >= 17) entities[c + h] /= 5.5;
        if (playerTeam === 1 && (h - 5) % 3 !== 2) entities[c + h] *= -1;
      }
    }

    const selfEntity = entities.slice(NECTO_ENTITY_DIMS, 2 * NECTO_ENTITY_DIMS);
    const query = new Float32Array(32);
    query.set(selfEntity);
    query.set(encodeCarControls(currentControls), NECTO_ENTITY_DIMS);

    for (let l = 0; l < NECTO_NUM_ENTITIES; l++) {
      for (let c = 5; c < 11; c++) {
        entities[l * NECTO_ENTITY_DIMS + c] -= selfEntity[c];
      }
    }

    return {
      query: { data: query, dims: [1, 1, 32] },
      entities: { data: new Float32Array(entities), dims: [1, NECTO_NUM_ENTITIES, NECTO_ENTITY_DIMS] },
      mask: { data: new Float32Array(NECTO_NUM_ENTITIES), dims: [1, NECTO_NUM_ENTITIES] }
    };
  }

  decode(outputs) {
    const indices = this.outputNames.map((name, l) => {
      const logits = outputs[name];
      if (!logits || logits.length !== (l < 2 ? 3 : 2) || !logits.every(Number.isFinite)) {
        throw new Error(`Necto returned invalid ${name} logits.`);
      }
      let best = 0;
      for (let d = 1; d < logits.length; d++) {
        if (logits[d] > logits[best]) best = d;
      }
      return best;
    });

    const [throttle, steer, jump, boost, handbrake] = indices;
    return decodeCarControls([
      throttle - 1,
      steer - 1,
      throttle - 1,
      (steer - 1) * (1 - handbrake) || 0,
      (steer - 1) * handbrake || 0,
      jump,
      boost,
      handbrake
    ]);
  }
}

// Seer observation mathematical utilities
const SEER_ACTION_DIMS = [3, 5, 5, 3, 2, 2, 2];
const fround = Math.fround;

function calcSeerRelativeVector(a, aOff, b, bOff) {
  const rx = fround(a[aOff] - b[bOff]);
  const ry = fround(a[aOff + 1] - b[bOff + 1]);
  const rz = fround(a[aOff + 2] - b[bOff + 2]);
  return [rx, ry, rz, calcSeerVectorNorm(rx, ry, rz)];
}

function calcSeerVectorNorm(x, y, z) {
  return fround(Math.sqrt(fround(fround(fround(x * x) + fround(y * y)) + fround(z * z))));
}

function encodeSeerControlsOneHot(c) {
  const e = [
    Math.round(c.throttle + 1),
    Math.round((c.steer + 1) * 2),
    Math.round((c.pitch + 1) * 2),
    Math.round(c.roll + 1),
    +c.jump,
    +c.boost,
    +c.handbrake
  ];
  return SEER_ACTION_DIMS.flatMap((dim, n) =>
    dim === 2 ? [e[n]] : Array.from({ length: dim }, (_, s) => +(e[n] === s))
  );
}

function extractSeerCarFeatures(simState, carIndex, demoTimer, inverted) {
  const carView = (sCarViews[carIndex] || new CarStateView()).attachCar(simState, carIndex);
  const pitch = fround(
    Math.atan2(carView.fwdZ, Math.hypot(carView.fwdX, carView.fwdY))
  );
  let yaw = fround(Math.atan2(carView.fwdY, carView.fwdX));
  const roll = fround(Math.atan2(-carView.rightZ, carView.upZ));
  if (inverted) {
    yaw += Math.PI;
    if (yaw > Math.PI) yaw -= 2 * Math.PI;
  }
  const sign = inverted ? -1 : 1;
  return new Float32Array([
    sign * carView.posX,
    sign * carView.posY,
    carView.posZ,
    pitch,
    yaw,
    roll,
    sign * carView.velX,
    sign * carView.velY,
    carView.velZ,
    sign * carView.angVelX,
    sign * carView.angVelY,
    carView.angVelZ,
    demoTimer,
    carView.boost,
    carView.isOnGround ? 1 : 0,
    carView.hasFlipOrJump ? 1 : 0
  ]);
}

/**
 * Seer v0 Model Adapter (LSTM Policy)
 */
export class SeerAdapter {
  constructor() {
    this.outputNames = ["logits", "hidden_out", "cell_out"];
    this.hidden = new Float32Array(512);
    this.cell = new Float32Array(512);
    this.demoTimers = [0, 0];
    this.lastTick = null;
  }

  initialInputs() {
    return {
      observation: { data: new Float32Array(159), dims: [1, 159] },
      hidden: { data: new Float32Array(512), dims: [1, 1, 512] },
      cell: { data: new Float32Array(512), dims: [1, 1, 512] }
    };
  }

  build(simState, boostPads, currentControls, botIndex, playerTeam) {
    sHeaderView.attach(simState);
    if (sHeaderView.numCars !== 2 || boostPads.length !== 34 || (botIndex !== 0 && botIndex !== 1)) {
      throw new Error("Seer requires two cars and the standard 34-pad arena.");
    }
    const curTick = sHeaderView.tickCount;
    const dt = this.lastTick === null ? 0 : Math.max(0, curTick - this.lastTick) / 120;
    this.lastTick = curTick;

    for (let m = 0; m < 2; m++) {
      const carView = (sCarViews[m] || new CarStateView()).attachCar(simState, m);
      const isDemo = carView.isDemoed;
      this.demoTimers[m] = isDemo ? this.demoTimers[m] + dt : 0;
    }

    const inverted = playerTeam === 1;
    const sign = inverted ? -1 : 1;
    const selfCar = extractSeerCarFeatures(simState, botIndex, this.demoTimers[botIndex], inverted);
    const oppCar = extractSeerCarFeatures(simState, 1 - botIndex, this.demoTimers[1 - botIndex], inverted);

    sBallView.attach(simState);
    const ball = new Float32Array([
      sign * sBallView.posX,
      sign * sBallView.posY,
      sBallView.posZ,
      sign * sBallView.velX,
      sign * sBallView.velY,
      sBallView.velZ,
      sign * sBallView.angVelX,
      sign * sBallView.angVelY,
      sBallView.angVelZ
    ]);

    const pads = new Float32Array(34);
    boostPads.forEach((pad, y) => {
      const idx = inverted ? 33 - y : y;
      sPadView.attach(simState, y);
      const isPadActive = sPadView.isActive;
      pads[idx] = isPadActive ? 0 : Math.max(0, (pad.isBig ? 10 : 4) - sPadView.cooldown);
    });

    const selfSpeed = calcSeerVectorNorm(selfCar[6], selfCar[7], selfCar[8]);
    const oppSpeed = calcSeerVectorNorm(oppCar[6], oppCar[7], oppCar[8]);

    return {
      observation: {
        data: new Float32Array([
          ...selfCar,
          ...oppCar,
          ...pads,
          ...ball,
          ...calcSeerRelativeVector(selfCar, 0, oppCar, 0),
          ...calcSeerRelativeVector(selfCar, 6, oppCar, 6),
          ...calcSeerRelativeVector(selfCar, 0, ball, 0),
          ...calcSeerRelativeVector(selfCar, 6, ball, 3),
          ...calcSeerRelativeVector(oppCar, 0, ball, 0),
          ...calcSeerRelativeVector(oppCar, 6, ball, 3),
          ...Array.from(pads, m => +(m === 0)),
          +(selfCar[12] === 0),
          +(oppCar[12] === 0),
          selfSpeed,
          +(selfSpeed >= 2200),
          oppSpeed,
          +(oppSpeed >= 2200),
          calcSeerVectorNorm(ball[3], ball[4], ball[5]),
          ...encodeSeerControlsOneHot(currentControls)
        ]),
        dims: [1, 159]
      },
      hidden: { data: this.hidden.slice(), dims: [1, 1, 512] },
      cell: { data: this.cell.slice(), dims: [1, 1, 512] }
    };
  }

  decode(outputs) {
    const { logits, hidden_out, cell_out } = outputs;
    if (
      logits?.length !== 22 ||
      hidden_out?.length !== 512 ||
      cell_out?.length !== 512 ||
      ![logits, hidden_out, cell_out].every(arr => arr.every(Number.isFinite))
    ) {
      throw new Error("Seer returned invalid policy outputs.");
    }

    let offset = 0;
    const actions = SEER_ACTION_DIMS.map(dim => {
      let best = 0;
      for (let l = 1; l < dim; l++) {
        if (logits[offset + l] > logits[offset + best]) best = l;
      }
      offset += dim;
      return best;
    });

    this.hidden = new Float32Array(hidden_out);
    this.cell = new Float32Array(cell_out);

    return {
      throttle: actions[0] - 1,
      steer: actions[1] * 0.5 - 1,
      pitch: actions[2] * 0.5 - 1,
      yaw: actions[1] * 0.5 - 1,
      roll: actions[3] - 1,
      jump: actions[4] > 0,
      boost: actions[5] > 0,
      handbrake: actions[6] > 0
    };
  }

  reset() {
    this.hidden.fill(0);
    this.cell.fill(0);
    this.demoTimers = [0, 0];
    this.lastTick = null;
  }
}

/**
 * Creates the appropriate bot adapter for the given botId.
 * @param {string} botId
 * @returns {NextoAdapter|NectoAdapter|SeerAdapter}
 */
export function createBotAdapter(botId) {
  if (botId === "seer") return new SeerAdapter();
  if (botId === "necto") return new NectoAdapter();
  return new NextoAdapter();
}

/**
 * RLBotAgent
 * Main Controller for ONNX Worker dispatch and heuristic fallback.
 */
export class RLBotAgent {
  constructor(selectedId = "nexto") {
    this.worker = null;
    this.loading = new Map();
    this.ready = new Set();
    this.pending = new Map();
    this.sequence = 0;
    this.generation = 0;
    this.action = { ...DEFAULT_CAR_CONTROLS };
    this.selectedId = selectedId;
    this.adapter = createBotAdapter(selectedId);
    this.error = null;
    this.onError = null;
    this.fallbackMode = false;
    this.workerMissing = false;
  }

  enableFallbackMode(reason = "") {
    this.fallbackMode = true;
    this.workerMissing = true;
    for (const p of BOT_POLICIES) {
      this.ready.add(p.id);
    }
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (reason) {
      console.warn(`[Bot] Fallback mode active: ${reason}`);
    }
  }

  get id() {
    return this.selectedId;
  }

  get option() {
    return getBotPolicy(this.selectedId);
  }

  get isReady() {
    return this.fallbackMode || this.ready.has(this.selectedId);
  }

  get controls() {
    return { ...this.action };
  }

  select(botId) {
    if (botId !== this.selectedId) {
      this.reset();
      this.selectedId = botId;
      this.adapter = createBotAdapter(botId);
    }
  }

  getKickoffControls(simState, kickoffTick) {
    return this.option?.scriptedKickoff ? getNextoKickoffControls(simState, kickoffTick) : null;
  }

  async preloadAll(onProgress = null) {
    let completed = 0;
    const total = BOT_POLICIES.length;
    await Promise.all(
      BOT_POLICIES.map(async policy => {
        try {
          await this.loadPolicy(policy.id, 3500);
        } catch (err) {
          console.warn(`[Bot] Preload policy ${policy.id} deferred:`, err);
        } finally {
          completed++;
          if (typeof onProgress === "function") {
            onProgress(completed, total, policy.id);
          }
        }
      })
    );
  }

  load() {
    return this.loadPolicy(this.selectedId);
  }

  async loadPolicy(botId, timeoutMs = 3500) {
    if (this.fallbackMode || this.workerMissing) {
      this.ready.add(botId);
      return;
    }
    if (this.ready.has(botId)) return;
    const pendingPromise = this.loading.get(botId);
    if (pendingPromise) return pendingPromise;

    this.error = null;
    let w = this.worker;
    if (!w) {
      try {
        w = this.createWorker();
      } catch (err) {
        console.warn(`[Bot] Bot worker spawn deferred for ${botId}:`, err);
        this.fallbackMode = true;
        this.ready.add(botId);
        return;
      }
    }

    const adapter = createBotAdapter(botId);
    const policy = getBotPolicy(botId);
    const modelUrl = typeof location !== "undefined"
      ? new URL(policy.modelUrl, location.href).href
      : policy.modelUrl;

    const promise = this.send(
      {
        kind: "load",
        botId,
        url: modelUrl,
        inputs: adapter.initialInputs(),
        outputNames: adapter.outputNames
      },
      timeoutMs
    )
      .then(() => {
        if (this.worker === w) this.ready.add(botId);
      })
      .catch(err => {
        console.warn(`[Bot] ONNX worker policy load failed for ${botId}, falling back to intelligent heuristic bot:`, err);
        this.fallbackMode = true;
        this.ready.add(botId);
      })
      .finally(() => {
        if (this.loading.get(botId) === promise) this.loading.delete(botId);
      });

    this.loading.set(botId, promise);
    return promise;
  }

  createWorker() {
    let w;
    try {
      if (typeof Worker === "undefined") {
        this.fallbackMode = true;
        this.workerMissing = true;
        return null;
      }
      w = new Worker(/* @vite-ignore */ "/assets/ai-opponent-worker.js", {
        type: "module"
      });
    } catch (err) {
      console.warn("[Bot] Worker constructor threw:", err);
      this.fallbackMode = true;
      this.workerMissing = true;
      return null;
    }

    this.worker = w;
    w.onmessage = ({ data }) => {
      const req = this.pending.get(data.id);
      if (req) {
        if (typeof clearTimeout !== "undefined") clearTimeout(req.timer);
        this.pending.delete(data.id);
        if (data.kind === "error") {
          req.reject(new Error(data.error));
        } else {
          req.resolve(data);
        }
      }
    };

    w.onerror = err => {
      console.warn("[Bot Worker Error]:", (err && err.message) || err);
      this.fallbackMode = true;
      this.workerMissing = true;
      for (const p of BOT_POLICIES) this.ready.add(p.id);
      for (const req of this.pending.values()) {
        if (typeof clearTimeout !== "undefined") clearTimeout(req.timer);
        req.reject(new Error((err && err.message) || "The bot worker stopped unexpectedly."));
      }
      this.pending.clear();
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    };

    w.onmessageerror = () => {
      console.warn("[Bot Worker MessageError]");
      this.fallbackMode = true;
      this.workerMissing = true;
      for (const p of BOT_POLICIES) this.ready.add(p.id);
      for (const req of this.pending.values()) {
        if (typeof clearTimeout !== "undefined") clearTimeout(req.timer);
        req.reject(new Error("The bot worker returned an unreadable response."));
      }
      this.pending.clear();
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }
    };

    return w;
  }

  reset() {
    this.generation++;
    this.action = { ...DEFAULT_CAR_CONTROLS };
    this.adapter.reset();
  }

  overrideControls(c) {
    this.action = { ...c };
  }

  /**
   * High-accuracy, robust heuristic AI bot when ONNX model or Worker is offline.
   */
  heuristicDecide(simState, boostPads, botIndex, playerTeam) {
    sHeaderView.attach(simState);
    if (!simState || sHeaderView.numCars < 2) {
      return { ...DEFAULT_CAR_CONTROLS };
    }
    const bIdx = typeof botIndex === "number" ? botIndex : 1;
    const carView = (sCarViews[bIdx] || new CarStateView()).attachCar(simState, bIdx);
    sBallView.attach(simState);

    const cx = carView.posX;
    const cy = carView.posY;
    const cz = carView.posZ;

    const fx = carView.fwdX;
    const fy = carView.fwdY;

    const bx = sBallView.posX;
    const by = sBallView.posY;
    const bz = sBallView.posZ;

    const dx = bx - cx;
    const dy = by - cy;
    const dist = Math.hypot(dx, dy);

    const targetAngle = Math.atan2(dy, dx);
    const carAngle = Math.atan2(fy, fx);

    let angleDiff = targetAngle - carAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const steer = Math.max(-1, Math.min(1, angleDiff * 2.5));
    const throttle = Math.abs(angleDiff) > 1.2 ? 0.3 : 1.0;
    const boost = Math.abs(angleDiff) < 0.3 && dist > 500 && carView.boost > 10;
    const jump = dist < 280 && bz < 250 && carView.isOnGround && Math.abs(angleDiff) < 0.4;
    const handbrake = Math.abs(angleDiff) > 1.6;

    return {
      throttle,
      steer,
      pitch: 0,
      yaw: steer,
      roll: 0,
      jump,
      boost,
      handbrake
    };
  }

  async decide(simState, boostPads, botIndex, playerTeam) {
    if (this.fallbackMode) {
      this.action = this.heuristicDecide(simState, boostPads, botIndex, playerTeam);
      return this.controls;
    }
    if (!this.isReady) {
      throw new Error(this.error || "Bot is not ready.");
    }
    const gen = this.generation;
    try {
      const inputs = this.adapter.build(simState, boostPads, this.action, botIndex, playerTeam);
      const res = await this.send(
        {
          kind: "decide",
          botId: this.selectedId,
          inputs,
          outputNames: this.adapter.outputNames
        },
        15000
      );
      if (gen !== this.generation) return this.controls;
      this.action = this.adapter.decode(res.outputs);
      return this.controls;
    } catch (err) {
      if (gen !== this.generation) return this.controls;
      console.warn(`[Bot] Decision failure for ${this.selectedId}, switching to heuristic AI:`, err);
      this.fallbackMode = true;
      this.action = this.heuristicDecide(simState, boostPads, botIndex, playerTeam);
      return this.controls;
    }
  }

  dispose() {
    this.reset();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready.clear();
    this.loading.clear();
    for (const req of this.pending.values()) {
      if (typeof clearTimeout !== "undefined") clearTimeout(req.timer);
      req.reject(new Error("Bot session closed."));
    }
    this.pending.clear();
    this.action = { ...DEFAULT_CAR_CONTROLS };
  }

  send(msg, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error("Bot worker is unavailable."));
        return;
      }
      const seq = ++this.sequence;
      const timer = typeof setTimeout !== "undefined"
        ? setTimeout(() => {
            this.pending.delete(seq);
            reject(new Error("The bot took too long to respond. Please try starting the match again."));
          }, timeoutMs)
        : null;

      this.pending.set(seq, { resolve, reject, timer });
      this.worker.postMessage({ ...msg, id: seq });
    });
  }

  fail(err) {
    if (this.fallbackMode) return;
    this.error = err.message;
    for (const req of this.pending.values()) {
      if (typeof clearTimeout !== "undefined") clearTimeout(req.timer);
      req.reject(err);
    }
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.onError) {
      this.onError(err.message);
    }
  }
}
