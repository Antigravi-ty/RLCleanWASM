/**
 * src/replay/container/RCReplayBinaryContainer.js
 * Native V2 Multi-Track Chunked Binary Container (.rcreplay / .rcreplay.gz)
 *
 * Container Architecture (4-Section Layout):
 * +-----------------------------------------------------------------------+
 * | 0. Container Header & Metadata (16-byte Binary Header + UTF-8 JSON)   |
 * |    - Bytes [0..7]  : Magic ASCII "RCREPLAY" (8 bytes)                 |
 * |    - Bytes [8..11] : Version uint32 LE = 2                            |
 * |    - Bytes [12..15]: Metadata JSON byteLength uint32 LE               |
 * |    - Bytes [16..M] : UTF-8 Metadata JSON (8-byte padded)              |
 * |      Contains matchInfo + tracks TOC (offset, byteLength, count,      |
 * |      stride, encoding)                                                |
 * +-----------------------------------------------------------------------+
 * | 1. Track A: State + User Input (Fixed-Stride Frame-Indexed Stream)    |
 * |    - Stride = 1856 bytes (1792B 448-float state + 64B 8-car controls) |
 * |    - Byte-transposed + XOR-delta filtered for maximum GZIP ratio      |
 * +-----------------------------------------------------------------------+
 * | 2. Track B: Incident Timeline (64-Byte PhysicsEvent Stream)           |
 * |    - Stride = 64 bytes (16 uint32/float32 words per incident)         |
 * |    - Word 0: type (0x01..0x3F), Word 1: tick, Word 15: frameIndex     |
 * +-----------------------------------------------------------------------+
 * | 3. Track C: Signal Timeline (64-Byte Authoritative Signal Stream)     |
 * |    - Stride = 64 bytes (16 uint32/float32 words per signal)           |
 * |    - Single-shot edge-triggered (recorded once per server emission)   |
 * |    - Word 0: type (0x80..0xBF), Word 1: tick, Word 15: frameIndex     |
 * +-----------------------------------------------------------------------+
 */

import {
  STATE_BUFFER_FLOATS,
  MAX_CARS,
  INCIDENT_EVENT_TYPES,
  PHYSICS_EVENT_FLAGS,
  SURFACE_SUBTYPES,
  MATCH_SIGNALS,
} from '../../physics/RocketSimConstants.js';
import { classifyBallHitSurface } from '../../physics/RocketSimStateViews.js';
import { resolveReplayAudioCueForSignal } from '../ReplayRingBuffer.js';
import {
  StateInputTimeline,
  IncidentTimeline,
  SignalTimeline,
  synthesizeFallbackSignalsFromIncidents,
} from './RCReplayTimelineParser.js';

export {
  StateInputTimeline,
  IncidentTimeline,
  SignalTimeline,
  synthesizeFallbackSignalsFromIncidents,
};

export const RC_REPLAY_MAGIC_V2 = 'RCREPLAY';
export const RC_REPLAY_VERSION_V2 = 2;
export const RC_REPLAY_STATE_BYTES = STATE_BUFFER_FLOATS * 4; // 1792 bytes
export const RC_REPLAY_CONTROLS_BYTES = 64; // 64 bytes (8 cars)
export const RC_REPLAY_STATE_INPUT_STRIDE = RC_REPLAY_STATE_BYTES + RC_REPLAY_CONTROLS_BYTES; // 1856 bytes
export const RC_REPLAY_EVENT_STRIDE = 64; // 16 words * 4 bytes

const MAGIC_BYTES = new Uint8Array([0x52, 0x43, 0x52, 0x45, 0x50, 0x4c, 0x41, 0x59]); // "RCREPLAY"

/**
 * Packs a single car's controls into 3-byte bitpack + 5-byte signed analog bytes.
 */
export function packCarControlsToTrack64(out64, carIndex, ctrl) {
  if (!ctrl || carIndex < 0 || carIndex >= MAX_CARS) return;
  const thr = Math.max(-31, Math.min(31, Math.round((ctrl.throttle || 0) * 31))) + 31;
  const str = Math.max(-31, Math.min(31, Math.round((ctrl.steer || 0) * 31))) + 31;
  const pit = Math.max(-3, Math.min(3, Math.round((ctrl.pitch || 0) * 3))) + 3;
  const yaw = Math.max(-3, Math.min(3, Math.round((ctrl.yaw || 0) * 3))) + 3;
  const rol = Math.max(-3, Math.min(3, Math.round((ctrl.roll || 0) * 3))) + 3;
  const jmp = ctrl.jump ? 1 : 0;
  const bst = ctrl.boost ? 1 : 0;
  const hnd = ctrl.handbrake ? 1 : 0;

  out64[carIndex * 3 + 0] = (thr & 0x3f) | ((str & 0x30) << 2);
  out64[carIndex * 3 + 1] = (str & 0x0f) | ((pit & 0x07) << 4) | ((yaw & 0x04) << 5);
  out64[carIndex * 3 + 2] = (yaw & 0x03) | ((rol & 0x07) << 2) | (jmp << 5) | (bst << 6) | (hnd << 7);

  const qOff = 24 + carIndex * 5;
  out64[qOff + 0] = Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, ctrl.throttle || 0)) * 127))) & 0xff;
  out64[qOff + 1] = Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, ctrl.steer || 0)) * 127))) & 0xff;
  out64[qOff + 2] = Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, ctrl.pitch || 0)) * 127))) & 0xff;
  out64[qOff + 3] = Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, ctrl.yaw || 0)) * 127))) & 0xff;
  out64[qOff + 4] = Math.max(-127, Math.min(127, Math.round(Math.max(-1, Math.min(1, ctrl.roll || 0)) * 127))) & 0xff;
}

/**
 * Unpacks 8 cars' controls from a 64-byte control block.
 */
export function unpackTrack64ToCarControls(bytes64) {
  const result = new Array(MAX_CARS);
  if (!bytes64 || bytes64.byteLength < 24) {
    for (let c = 0; c < MAX_CARS; c++) {
      result[c] = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
    }
    return result;
  }
  const hasQuantized = bytes64.byteLength >= 64;
  const i8 = hasQuantized ? new Int8Array(bytes64.buffer, bytes64.byteOffset, bytes64.byteLength) : null;

  for (let c = 0; c < MAX_CARS; c++) {
    const b0 = bytes64[c * 3 + 0];
    const b1 = bytes64[c * 3 + 1];
    const b2 = bytes64[c * 3 + 2];
    if (b0 === 0 && b1 === 0 && b2 === 0 && (!i8 || (i8[24 + c * 5] === 0 && i8[24 + c * 5 + 1] === 0))) {
      result[c] = { throttle: 0, steer: 0, pitch: 0, yaw: 0, roll: 0, jump: false, boost: false, handbrake: false };
      continue;
    }
    const jump = Boolean(b2 & (1 << 5));
    const boost = Boolean(b2 & (1 << 6));
    const handbrake = Boolean(b2 & (1 << 7));

    let throttle = ((b0 & 0x3f) - 31) / 31.0;
    let steer = ((((b0 >> 2) & 0x30) | (b1 & 0x0f)) - 31) / 31.0;
    let pitch = (((b1 >> 4) & 0x07) - 3) / 3.0;
    let yaw = ((((b1 >> 5) & 0x04) | (b2 & 0x03)) - 3) / 3.0;
    let roll = (((b2 >> 2) & 0x07) - 3) / 3.0;

    if (i8) {
      const qOff = 24 + c * 5;
      if (i8[qOff] !== 0 || i8[qOff + 1] !== 0 || i8[qOff + 2] !== 0 || i8[qOff + 3] !== 0 || i8[qOff + 4] !== 0) {
        throttle = i8[qOff + 0] / 127.0;
        steer = i8[qOff + 1] / 127.0;
        pitch = i8[qOff + 2] / 127.0;
        yaw = i8[qOff + 3] / 127.0;
        roll = i8[qOff + 4] / 127.0;
      }
    }

    result[c] = { throttle, steer, pitch, yaw, roll, jump, boost, handbrake };
  }
  return result;
}

/**
 * Encodes a JS incident object into a 64-byte PhysicsEvent slot (16 words).
 */
export function encodeIncidentTo64Bytes(inc, targetU8, byteOffset = 0, fallbackFrameIndex = 0) {
  const u32 = new Uint32Array(targetU8.buffer, targetU8.byteOffset + byteOffset, 16);
  const f32 = new Float32Array(targetU8.buffer, targetU8.byteOffset + byteOffset, 16);
  u32.fill(0);

  if (!inc) return;
  const type = Number(inc.type ?? 0) & 0xff;
  u32[0] = type;
  u32[1] = (inc.tick ?? fallbackFrameIndex) >>> 0;
  f32[2] = Number(inc.x ?? inc.posX ?? inc.carPosX ?? 0);
  f32[3] = Number(inc.y ?? inc.posY ?? inc.carPosY ?? 0);
  f32[4] = Number(inc.z ?? inc.posZ ?? inc.carPosZ ?? 0);
  f32[5] = Number(inc.normalX ?? inc.normX ?? inc.ballPosX ?? 0);
  f32[6] = Number(inc.normalY ?? inc.normY ?? inc.ballPosY ?? 0);
  f32[7] = Number(inc.normalZ ?? inc.normZ ?? inc.ballPosZ ?? 0);
  f32[8] = Number(inc.normalRelVel ?? inc.relSpeed ?? 0);
  f32[9] = Number(inc.speed ?? inc.relSpeed ?? inc.intensity ?? 0);
  f32[10] = Number(inc.impulse ?? inc.intensity ?? 0);

  const primaryId = Number(inc.primaryId ?? inc.carIndex ?? inc.car1Index ?? 0) & 0xffff;
  const secondaryId = Number(inc.secondaryId ?? inc.padIndex ?? inc.car2Index ?? inc.team ?? 0) & 0xffff;
  u32[11] = (primaryId | (secondaryId << 16)) >>> 0;
  u32[12] = Number(inc.subType ?? inc.surfaceTag ?? inc.actionSubType ?? (inc.isBig ? 1 : 0)) >>> 0;

  let flags = Number(inc.flags ?? 0) >>> 0;
  if (inc.isInitialTouch) flags |= PHYSICS_EVENT_FLAGS.INITIAL_TOUCH;
  if (inc.isSupersonic) flags |= PHYSICS_EVENT_FLAGS.SUPERSONIC;
  if (inc.isFlipping) flags |= PHYSICS_EVENT_FLAGS.FLIP;
  if (inc.isOnGround) flags |= PHYSICS_EVENT_FLAGS.ON_GROUND;
  u32[13] = flags >>> 0;

  f32[14] = Number(inc.customFloat ?? inc.directionDotNormal ?? 0);
  u32[15] = Number(inc.frameIndex ?? inc.customInt ?? fallbackFrameIndex) >>> 0;
}

/**
 * Decodes a 64-byte PhysicsEvent slot into a rich JS incident object.
 */
export function decodeIncidentFrom64Bytes(sourceU8, byteOffset = 0) {
  const u32 = new Uint32Array(sourceU8.buffer, sourceU8.byteOffset + byteOffset, 16);
  const f32 = new Float32Array(sourceU8.buffer, sourceU8.byteOffset + byteOffset, 16);

  let type = u32[0];
  const tick = u32[1];
  const x = f32[2];
  const y = f32[3];
  const z = f32[4];
  const normalX = f32[5];
  const normalY = f32[6];
  const normalZ = f32[7];
  const normalRelVel = f32[8];
  const speed = f32[9];
  const impulse = f32[10];
  const ids = u32[11];
  const primaryId = ids & 0xffff;
  const secondaryId = (ids >>> 16) & 0xffff;
  let subType = u32[12];
  const flags = u32[13];
  const customFloat = f32[14];
  const customInt = u32[15];

  const carIndex = primaryId === 65535 ? 0 : primaryId;
  let car1Index = carIndex;
  let car2Index = secondaryId;
  let team = secondaryId;
  if (type === INCIDENT_EVENT_TYPES.CAR_CAR_BUMP || type === INCIDENT_EVENT_TYPES.CAR_CAR_DEMO) {
    car2Index = secondaryId === 65535 ? 0 : secondaryId;
    team = 0;
  }

  if (subType === 0) {
    if (type === INCIDENT_EVENT_TYPES.BALL_WORLD_HIT) {
      subType = classifyBallHitSurface(x, y, z, normalX, normalY, normalZ, false);
    } else if (type === INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT) {
      subType = classifyBallHitSurface(x, y, z, normalX, normalY, normalZ, true);
    }
  }
  if (subType === SURFACE_SUBTYPES.CROSSBAR || subType === SURFACE_SUBTYPES.GOALPOST) {
    type = INCIDENT_EVENT_TYPES.BALL_GOALPOST_HIT;
  }

  const directionDotNormal =
    customFloat > 0 && customFloat <= 1.0
      ? customFloat
      : speed > 1e-4
      ? Math.max(0, Math.min(1, normalRelVel / speed))
      : 0;

  const ev = {
    type,
    tick,
    frameIndex: customInt,
    x,
    y,
    z,
    posX: x,
    posY: y,
    posZ: z,
    normalX,
    normalY,
    normalZ,
    normalRelVel,
    speed,
    relSpeed: speed,
    impulse,
    intensity: impulse || speed,
    primaryId,
    secondaryId,
    carIndex,
    car1Index,
    car2Index,
    team,
    subType,
    surfaceTag: subType,
    actionSubType: subType,
    isCrossbar: subType === SURFACE_SUBTYPES.CROSSBAR,
    padIndex: secondaryId,
    isBig: type === INCIDENT_EVENT_TYPES.BOOST_PICKUP && (subType === 1 || secondaryId < 6),
    flags,
    customFloat,
    customInt,
    directionDotNormal,
    dirDot: directionDotNormal,
    impactAngleDeg: Math.asin(Math.max(0, Math.min(1, directionDotNormal))) * (180 / Math.PI),
    isInitialTouch: (flags & PHYSICS_EVENT_FLAGS.INITIAL_TOUCH) !== 0,
    isSupersonic: (flags & PHYSICS_EVENT_FLAGS.SUPERSONIC) !== 0,
    isFlipping: (flags & PHYSICS_EVENT_FLAGS.FLIP) !== 0,
    isOnGround: (flags & PHYSICS_EVENT_FLAGS.ON_GROUND) !== 0,
    isDemo: type === INCIDENT_EVENT_TYPES.CAR_CAR_DEMO,
  };

  if (type === INCIDENT_EVENT_TYPES.FLIP_RESET_GAINED) {
    ev.carPosX = x;
    ev.carPosY = y;
    ev.carPosZ = z;
    ev.ballPosX = normalX;
    ev.ballPosY = normalY;
    ev.ballPosZ = normalZ;
    ev.carPos = { x, y, z };
    ev.ballPos = { x: normalX, y: normalY, z: normalZ };
  }
  return ev;
}

/**
 * Encodes a JS signal object into a 64-byte PhysicsEvent slot (16 words).
 */
export function encodeSignalTo64Bytes(sig, targetU8, byteOffset = 0, fallbackFrameIndex = 0) {
  const u32 = new Uint32Array(targetU8.buffer, targetU8.byteOffset + byteOffset, 16);
  const f32 = new Float32Array(targetU8.buffer, targetU8.byteOffset + byteOffset, 16);
  u32.fill(0);

  if (!sig) return;
  const signalType = Number(sig.signalType ?? sig.type ?? 0) & 0xff;
  const frameId = Number(sig.frameId ?? sig.tick ?? fallbackFrameIndex) >>> 0;
  const param1 = Number(sig.param1 ?? 0) >>> 0;
  const param2 = Number(sig.param2 ?? sig.subType ?? 0) >>> 0;
  const signalId = Number(sig.signalId ?? sig.flags ?? 0) >>> 0;
  const frameIndex = Number(sig.frameIndex ?? sig.customInt ?? fallbackFrameIndex) >>> 0;

  u32[0] = signalType;
  u32[1] = frameId;
  f32[2] = Number(sig.param1 ?? 0);
  f32[3] = Number(sig.param2 ?? 0);
  u32[11] = param1;
  u32[12] = param2;
  u32[13] = signalId;
  u32[15] = frameIndex;
}

/**
 * Decodes a 64-byte PhysicsEvent slot into a JS signal object.
 */
export function decodeSignalFrom64Bytes(sourceU8, byteOffset = 0) {
  const u32 = new Uint32Array(sourceU8.buffer, sourceU8.byteOffset + byteOffset, 16);
  const signalType = u32[0];
  const frameId = u32[1];
  const param1 = u32[11];
  const param2 = u32[12];
  const signalId = u32[13];
  const frameIndex = u32[15];

  return {
    signalId,
    signalType,
    type: signalType,
    frameId,
    tick: frameId,
    param1,
    param2,
    frameIndex,
  };
}

export function unpackControls64ToCars(bytes64, byteOffset = 0) {
  if (!bytes64) return unpackTrack64ToCarControls(null);
  const slice =
    byteOffset > 0
      ? bytes64.subarray(byteOffset, byteOffset + RC_REPLAY_CONTROLS_BYTES)
      : bytes64;
  return unpackTrack64ToCarControls(slice);
}

export function unpackIncidentTrackToEvents(incidentTrackBytes) {
  if (!incidentTrackBytes || incidentTrackBytes.byteLength < RC_REPLAY_EVENT_STRIDE) return [];
  const count = Math.floor(incidentTrackBytes.byteLength / RC_REPLAY_EVENT_STRIDE);
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = decodeIncidentFrom64Bytes(incidentTrackBytes, i * RC_REPLAY_EVENT_STRIDE);
  }
  return result;
}

export function unpackSignalTrackToEvents(signalTrackBytes) {
  if (!signalTrackBytes || signalTrackBytes.byteLength < RC_REPLAY_EVENT_STRIDE) return [];
  const count = Math.floor(signalTrackBytes.byteLength / RC_REPLAY_EVENT_STRIDE);
  const result = new Array(count);
  for (let i = 0; i < count; i++) {
    result[i] = decodeSignalFrom64Bytes(signalTrackBytes, i * RC_REPLAY_EVENT_STRIDE);
  }
  return result;
}

/**
 * Applies XOR-delta + 4-byte column transposition on Track A (State + Input)
 * so GZIP achieves ultra-high compression ratios on floating-point state streams.
 */
export function filterAndTransposeStateInputTrack(rawTrackBytes, frameCount, stride = RC_REPLAY_STATE_INPUT_STRIDE) {
  if (!rawTrackBytes || frameCount <= 0 || rawTrackBytes.byteLength < frameCount * stride) {
    return new Uint8Array(0);
  }
  const totalBytes = frameCount * stride;
  const wordsPerFrame = stride >>> 2; // 464 words
  const srcU32 = new Uint32Array(rawTrackBytes.buffer, rawTrackBytes.byteOffset, frameCount * wordsPerFrame);

  // Step 1: XOR delta across consecutive frames per word column, then byte-plane transpose
  const outBytes = new Uint8Array(totalBytes);
  const planeSize = frameCount * wordsPerFrame;

  for (let w = 0; w < wordsPerFrame; w++) {
    let prevWord = 0;
    const colBase = w * frameCount;
    for (let f = 0; f < frameCount; f++) {
      const curWord = srcU32[f * wordsPerFrame + w];
      const xorWord = (curWord ^ prevWord) >>> 0;
      prevWord = curWord;

      const idx = colBase + f;
      outBytes[idx] = xorWord & 0xff;
      outBytes[planeSize + idx] = (xorWord >>> 8) & 0xff;
      outBytes[planeSize * 2 + idx] = (xorWord >>> 16) & 0xff;
      outBytes[planeSize * 3 + idx] = (xorWord >>> 24) & 0xff;
    }
  }
  return outBytes;
}

/**
 * Reverses the 4-byte column transposition + XOR-delta filter back into the contiguous Track A buffer.
 */
export function unfilterAndUntransposeStateInputTrack(filteredBytes, frameCount, stride = RC_REPLAY_STATE_INPUT_STRIDE) {
  if (!filteredBytes || frameCount <= 0 || filteredBytes.byteLength < frameCount * stride) {
    return new Uint8Array(0);
  }
  const totalBytes = frameCount * stride;
  const wordsPerFrame = stride >>> 2;
  const outBytes = new Uint8Array(totalBytes);
  const outU32 = new Uint32Array(outBytes.buffer, outBytes.byteOffset, frameCount * wordsPerFrame);
  const planeSize = frameCount * wordsPerFrame;

  for (let w = 0; w < wordsPerFrame; w++) {
    let prevWord = 0;
    const colBase = w * frameCount;
    for (let f = 0; f < frameCount; f++) {
      const idx = colBase + f;
      const b0 = filteredBytes[idx];
      const b1 = filteredBytes[planeSize + idx];
      const b2 = filteredBytes[planeSize * 2 + idx];
      const b3 = filteredBytes[planeSize * 3 + idx];
      const xorWord = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
      const curWord = (xorWord ^ prevWord) >>> 0;
      prevWord = curWord;
      outU32[f * wordsPerFrame + w] = curWord;
    }
  }
  return outBytes;
}

/**
 * Normalizes any replay source (WASM tracks, ReplayRingBuffer, or frames array)
 * into the 3 raw binary tracks + metadata.
 */
export function normalizeReplayTracksPayload(replayObj = {}) {
  const stride = RC_REPLAY_STATE_INPUT_STRIDE;

  // Case 1: Already has raw binary tracks (e.g., extracted directly from WASM or V2 container)
  if (
    replayObj.stateInputBytes instanceof Uint8Array &&
    replayObj.stateInputBytes.byteLength >= stride
  ) {
    const frameCount = Math.floor(replayObj.stateInputBytes.byteLength / stride);
    const incidentBytes =
      replayObj.incidentBytes instanceof Uint8Array ? replayObj.incidentBytes : new Uint8Array(0);
    const signalBytes =
      replayObj.signalBytes instanceof Uint8Array ? replayObj.signalBytes : new Uint8Array(0);
    return {
      frameCount,
      stateStride: stride,
      incidentCount: Math.floor(incidentBytes.byteLength / RC_REPLAY_EVENT_STRIDE),
      signalCount: Math.floor(signalBytes.byteLength / RC_REPLAY_EVENT_STRIDE),
      stateInputBytes: replayObj.stateInputBytes.subarray(0, frameCount * stride),
      incidentBytes,
      signalBytes,
    };
  }

  // Case 2: Normalize from slots/frames + incidents/signals arrays
  const rawSlots = Array.isArray(replayObj.slots) && replayObj.slots.length > 0
    ? replayObj.slots
    : Array.isArray(replayObj.frames)
    ? replayObj.frames
    : [];

  const frameCount = rawSlots.length;
  const stateInputBytes = new Uint8Array(frameCount * stride);
  const collectedIncidents = [];
  const collectedSignals = [];
  const seenSignalKeys = new Set();

  for (let i = 0; i < frameCount; i++) {
    const item = rawSlots[i];
    const snap =
      item instanceof Float32Array
        ? item
        : item?.snapshot instanceof Float32Array
        ? item.snapshot
        : item?.compactSnap instanceof Float32Array
        ? item.compactSnap
        : item?.state instanceof Float32Array
        ? item.state
        : item?.renderState instanceof Float32Array
        ? item.renderState
        : null;

    const frameByteOff = i * stride;
    if (snap) {
      const dstF32 = new Float32Array(
        stateInputBytes.buffer,
        stateInputBytes.byteOffset + frameByteOff,
        STATE_BUFFER_FLOATS
      );
      dstF32.set(snap.subarray(0, Math.min(snap.length, STATE_BUFFER_FLOATS)));
    }

    const ctrlSlice = stateInputBytes.subarray(frameByteOff + RC_REPLAY_STATE_BYTES, frameByteOff + stride);
    if (item?.controlsBytes instanceof Uint8Array && item.controlsBytes.byteLength >= 24) {
      ctrlSlice.set(item.controlsBytes.subarray(0, Math.min(64, item.controlsBytes.byteLength)));
    } else if (Array.isArray(item?.acknowledgedControls)) {
      for (let c = 0; c < item.acknowledgedControls.length; c++) {
        const entry = item.acknowledgedControls[c];
        if (!entry) continue;
        if (typeof entry.carIndex === 'number' && entry.controls) {
          packCarControlsToTrack64(ctrlSlice, entry.carIndex, entry.controls);
        } else if (c < MAX_CARS && typeof entry === 'object') {
          packCarControlsToTrack64(ctrlSlice, c, entry);
        }
      }
    } else if (Array.isArray(item?.controls)) {
      for (let c = 0; c < Math.min(MAX_CARS, item.controls.length); c++) {
        if (item.controls[c]) {
          packCarControlsToTrack64(ctrlSlice, c, item.controls[c]);
        }
      }
    } else if (item?.controls && typeof item.controls === 'object') {
      packCarControlsToTrack64(ctrlSlice, 0, item.controls);
    }

    const tick = item?.tick ?? (snap ? Math.floor(snap[0] || i) : i);

    if (Array.isArray(item?.incidents)) {
      for (let j = 0; j < item.incidents.length; j++) {
        const inc = item.incidents[j];
        if (inc) {
          collectedIncidents.push({ ...inc, tick: inc.tick ?? tick, frameIndex: i });
        }
      }
    }

    if (Array.isArray(item?.signals)) {
      for (let j = 0; j < item.signals.length; j++) {
        const sig = item.signals[j];
        if (!sig) continue;
        // Deduplicate signals by signalId or (signalType + frameId) so each signal is recorded strictly once
        const dedupKey =
          sig.signalId && sig.signalId > 0
            ? `id_${sig.signalId}`
            : `t_${sig.signalType}_${sig.frameId ?? tick}_${sig.param1 ?? 0}_${sig.param2 ?? 0}`;
        if (seenSignalKeys.has(dedupKey)) continue;
        seenSignalKeys.add(dedupKey);
        collectedSignals.push({
          ...sig,
          frameId: sig.frameId ?? tick,
          frameIndex: i,
        });
      }
    }
  }

  // Also merge top-level incidents / signals if provided separately
  if (Array.isArray(replayObj.incidents) && collectedIncidents.length === 0) {
    for (let i = 0; i < replayObj.incidents.length; i++) {
      if (replayObj.incidents[i]) collectedIncidents.push(replayObj.incidents[i]);
    }
  }
  if (Array.isArray(replayObj.signals) && collectedSignals.length === 0) {
    for (let i = 0; i < replayObj.signals.length; i++) {
      const sig = replayObj.signals[i];
      if (!sig) continue;
      const dedupKey =
        sig.signalId && sig.signalId > 0
          ? `id_${sig.signalId}`
          : `t_${sig.signalType}_${sig.frameId ?? 0}_${sig.param1 ?? 0}_${sig.param2 ?? 0}`;
      if (seenSignalKeys.has(dedupKey)) continue;
      seenSignalKeys.add(dedupKey);
      collectedSignals.push(sig);
    }
  }

  // If no explicit signals were recorded, synthesize Track C signals from GOAL_SCORED incidents / match boundaries
  if (collectedSignals.length === 0 && frameCount > 0 && collectedIncidents.length > 0) {
    const synthSlots = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      const item = rawSlots[i];
      const snap = item instanceof Float32Array ? item : item?.snapshot || item?.compactSnap;
      synthSlots[i] = { tick: item?.tick ?? (snap ? Math.floor(snap[0] || i) : i) };
    }
    const synthSignals = synthesizeFallbackSignalsFromIncidents(collectedIncidents, synthSlots, {
      mode: replayObj.mode || replayObj.gameMode || 'match',
      winner: replayObj.winner || 'blue',
      winReason: replayObj.winReason ?? 0,
    });
    for (let s = 0; s < synthSignals.length; s++) {
      collectedSignals.push(synthSignals[s]);
    }
  }

  const incidentBytes = new Uint8Array(collectedIncidents.length * RC_REPLAY_EVENT_STRIDE);
  for (let i = 0; i < collectedIncidents.length; i++) {
    encodeIncidentTo64Bytes(
      collectedIncidents[i],
      incidentBytes,
      i * RC_REPLAY_EVENT_STRIDE,
      collectedIncidents[i].frameIndex ?? 0
    );
  }

  const signalBytes = new Uint8Array(collectedSignals.length * RC_REPLAY_EVENT_STRIDE);
  for (let i = 0; i < collectedSignals.length; i++) {
    encodeSignalTo64Bytes(
      collectedSignals[i],
      signalBytes,
      i * RC_REPLAY_EVENT_STRIDE,
      collectedSignals[i].frameIndex ?? 0
    );
  }

  return {
    frameCount,
    stateStride: stride,
    incidentCount: collectedIncidents.length,
    signalCount: collectedSignals.length,
    stateInputBytes,
    incidentBytes,
    signalBytes,
  };
}

/**
 * Packs a normalized replay payload into the 4-section binary container (Uint8Array).
 */
export function serializeRCReplayBinaryContainer(replayObj = {}, options = {}) {
  const tracks = normalizeReplayTracksPayload(replayObj);
  const useDeltaTranspose = options.deltaTranspose !== false;

  const encodedTrackA = useDeltaTranspose
    ? filterAndTransposeStateInputTrack(tracks.stateInputBytes, tracks.frameCount, tracks.stateStride)
    : tracks.stateInputBytes;
  const encodedTrackB = tracks.incidentBytes;
  const encodedTrackC = tracks.signalBytes;

  // Build Metadata JSON with placeholder offsets, then compute exact 8-byte aligned offsets
  const buildMetaJson = (trackAOffset, trackBOffset, trackCOffset) => ({
    magic: RC_REPLAY_MAGIC_V2,
    version: RC_REPLAY_VERSION_V2,
    format: 'multi-track-binary-v2',
    matchInfo: {
      mode: replayObj.mode || replayObj.gameMode || 'match',
      arenaPreset: replayObj.arenaPreset ?? 0,
      tickRate: replayObj.tickRate || 120,
      frameCount: tracks.frameCount,
      durationSec: Number((tracks.frameCount / (replayObj.tickRate || 120)).toFixed(2)),
      winner: replayObj.winner || 'blue',
      blueScore: replayObj.blueScore ?? 0,
      orangeScore: replayObj.orangeScore ?? 0,
      winReason: replayObj.winReason ?? 0,
      createdAtIso: replayObj.createdAtIso || new Date().toISOString(),
      roster: Array.isArray(replayObj.roster) ? replayObj.roster : [],
    },
    tracks: {
      stateInput: {
        offset: trackAOffset,
        byteLength: encodedTrackA.byteLength,
        count: tracks.frameCount,
        stride: tracks.stateStride,
        stateFloats: STATE_BUFFER_FLOATS,
        controlsBytes: RC_REPLAY_CONTROLS_BYTES,
        encoding: useDeltaTranspose ? 'xor-delta-bytetran-v1' : 'raw',
      },
      incidents: {
        offset: trackBOffset,
        byteLength: encodedTrackB.byteLength,
        count: tracks.incidentCount,
        stride: RC_REPLAY_EVENT_STRIDE,
        encoding: 'physics-event-64b',
      },
      signals: {
        offset: trackCOffset,
        byteLength: encodedTrackC.byteLength,
        count: tracks.signalCount,
        stride: RC_REPLAY_EVENT_STRIDE,
        encoding: 'signal-event-64b-dedup',
      },
    },
  });

  // Two-pass header sizing so JSON offset numbers have exact byte length
  const encoder = new TextEncoder();
  let draftMetaBytes = encoder.encode(JSON.stringify(buildMetaJson(0, 0, 0)));
  let headerAndMetaAligned = (16 + draftMetaBytes.byteLength + 7) & ~7;
  let trackAOffset = headerAndMetaAligned;
  let trackBOffset = (trackAOffset + encodedTrackA.byteLength + 7) & ~7;
  let trackCOffset = (trackBOffset + encodedTrackB.byteLength + 7) & ~7;

  let finalMetaBytes = encoder.encode(JSON.stringify(buildMetaJson(trackAOffset, trackBOffset, trackCOffset)));
  headerAndMetaAligned = (16 + finalMetaBytes.byteLength + 7) & ~7;
  if (headerAndMetaAligned !== trackAOffset) {
    trackAOffset = headerAndMetaAligned;
    trackBOffset = (trackAOffset + encodedTrackA.byteLength + 7) & ~7;
    trackCOffset = (trackBOffset + encodedTrackB.byteLength + 7) & ~7;
    finalMetaBytes = encoder.encode(JSON.stringify(buildMetaJson(trackAOffset, trackBOffset, trackCOffset)));
  }

  const totalContainerBytes = (trackCOffset + encodedTrackC.byteLength + 7) & ~7;
  const container = new Uint8Array(totalContainerBytes);
  const dv = new DataView(container.buffer, container.byteOffset, container.byteLength);

  // 0. 16-Byte Fixed Header + Metadata JSON (padded with spaces 0x20 to 8-byte boundary)
  container.set(MAGIC_BYTES, 0);
  dv.setUint32(8, RC_REPLAY_VERSION_V2, true);
  dv.setUint32(12, finalMetaBytes.byteLength, true);
  container.fill(0x20, 16, trackAOffset);
  container.set(finalMetaBytes, 16);

  // 1. Track A: State + User Input
  if (encodedTrackA.byteLength > 0) {
    container.set(encodedTrackA, trackAOffset);
  }

  // 2. Track B: Incidents
  if (encodedTrackB.byteLength > 0) {
    container.set(encodedTrackB, trackBOffset);
  }

  // 3. Track C: Signals
  if (encodedTrackC.byteLength > 0) {
    container.set(encodedTrackC, trackCOffset);
  }

  return container;
}

/**
 * Checks whether a decompressed Uint8Array / ArrayBuffer begins with the V2 "RCREPLAY" magic header.
 */
export function isBinaryRCReplayContainer(bytesOrBuffer) {
  const u8 =
    bytesOrBuffer instanceof Uint8Array
      ? bytesOrBuffer
      : bytesOrBuffer instanceof ArrayBuffer
      ? new Uint8Array(bytesOrBuffer)
      : null;
  if (!u8 || u8.byteLength < 16) return false;
  for (let i = 0; i < 8; i++) {
    if (u8[i] !== MAGIC_BYTES[i]) return false;
  }
  return true;
}

/**
 * Parses a decompressed V2 Binary Container into 3 parallel timelines
 * (stateInputTimeline, incidentTimeline, signalTimeline) + per-frame composite slots.
 */
export function deserializeRCReplayBinaryContainer(bytesOrBuffer) {
  const u8 =
    bytesOrBuffer instanceof Uint8Array
      ? bytesOrBuffer
      : new Uint8Array(bytesOrBuffer);

  if (!isBinaryRCReplayContainer(u8)) {
    throw new Error('Invalid RCREPLAY V2 binary header.');
  }

  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const version = dv.getUint32(8, true);
  const metaLength = dv.getUint32(12, true);
  if (16 + metaLength > u8.byteLength) {
    throw new Error('Corrupt RCREPLAY metadata header length.');
  }

  const metaJsonText = new TextDecoder().decode(u8.subarray(16, 16 + metaLength));
  const headerObj = JSON.parse(metaJsonText);
  const matchInfo = headerObj.matchInfo || {};
  const tracksToc = headerObj.tracks || {};

  // 1. Parse Track A (State + Input Timeline)
  const stateToc = tracksToc.stateInput || {};
  const frameCount = Number(stateToc.count ?? matchInfo.frameCount ?? 0);
  const stateStride = Number(stateToc.stride || RC_REPLAY_STATE_INPUT_STRIDE);
  const rawTrackASlice =
    frameCount > 0 && stateToc.byteLength > 0
      ? u8.subarray(stateToc.offset, stateToc.offset + stateToc.byteLength)
      : new Uint8Array(0);

  const stateInputBytes =
    stateToc.encoding === 'xor-delta-bytetran-v1'
      ? unfilterAndUntransposeStateInputTrack(rawTrackASlice, frameCount, stateStride)
      : new Uint8Array(rawTrackASlice);

  // 2. Parse Track B (Incident Timeline)
  const incToc = tracksToc.incidents || {};
  const incidentCount = Number(incToc.count ?? 0);
  const incidentStride = Number(incToc.stride || RC_REPLAY_EVENT_STRIDE);
  const incidentBytes =
    incidentCount > 0 && incToc.byteLength > 0
      ? u8.slice(incToc.offset, incToc.offset + incToc.byteLength)
      : new Uint8Array(0);

  const incidents = new Array(incidentCount);
  const incidentsByFrame = new Map();
  for (let i = 0; i < incidentCount; i++) {
    const inc = decodeIncidentFrom64Bytes(incidentBytes, i * incidentStride);
    incidents[i] = inc;
    const fIdx = Math.max(0, Math.min(Math.max(0, frameCount - 1), inc.frameIndex ?? 0));
    let list = incidentsByFrame.get(fIdx);
    if (!list) {
      list = [];
      incidentsByFrame.set(fIdx, list);
    }
    list.push(inc);
  }

  // 3. Parse Track C (Signal Timeline)
  const sigToc = tracksToc.signals || {};
  const signalCount = Number(sigToc.count ?? 0);
  const signalStride = Number(sigToc.stride || RC_REPLAY_EVENT_STRIDE);
  const signalBytes =
    signalCount > 0 && sigToc.byteLength > 0
      ? u8.slice(sigToc.offset, sigToc.offset + sigToc.byteLength)
      : new Uint8Array(0);

  const recordedSignals = new Array(signalCount);
  const signalsByFrame = new Map();
  for (let i = 0; i < signalCount; i++) {
    const sig = decodeSignalFrom64Bytes(signalBytes, i * signalStride);
    recordedSignals[i] = sig;
    const fIdx = Math.max(0, Math.min(Math.max(0, frameCount - 1), sig.frameIndex ?? 0));
    let list = signalsByFrame.get(fIdx);
    if (!list) {
      list = [];
      signalsByFrame.set(fIdx, list);
    }
    list.push(sig);
  }

  // Build zero-copy Float32Array(448) views per frame + rich frameSlots with controls, incidents, signals, audioEvents
  const frames = new Array(frameCount);
  const frameSlots = new Array(frameCount);
  const isCountUp = matchInfo.mode === 'freeplay' || matchInfo.mode === 'training';

  for (let i = 0; i < frameCount; i++) {
    const byteOff = i * stateStride;
    const snap = new Float32Array(
      stateInputBytes.buffer,
      stateInputBytes.byteOffset + byteOff,
      STATE_BUFFER_FLOATS
    );
    const controlsBytes = stateInputBytes.subarray(
      byteOff + RC_REPLAY_STATE_BYTES,
      byteOff + stateStride
    );
    const controls = unpackTrack64ToCarControls(controlsBytes);
    const frameIncidents = incidentsByFrame.get(i) || [];
    const frameSignals = signalsByFrame.get(i) || [];
    const audioEvents = [];

    for (let s = 0; s < frameSignals.length; s++) {
      const cue = resolveReplayAudioCueForSignal(frameSignals[s], isCountUp);
      if (cue) audioEvents.push(cue);
    }

    // Attach metadata properties directly onto the Float32Array snapshot as well for backward-compatible callers
    snap.controls = controls;
    snap.controlsBytes = controlsBytes;
    snap.incidents = frameIncidents;
    snap.signals = frameSignals;
    snap.audioEvents = audioEvents;
    frames[i] = snap;

    frameSlots[i] = {
      frameIndex: i,
      tick: Math.floor(snap[0] || i),
      snapshot: snap,
      controls,
      acknowledgedControls: controls,
      controlsBytes,
      incidents: frameIncidents,
      signals: frameSignals,
      audioEvents,
    };
  }

  // Fallback for tick-matched events if frameIndex was 0 on all events
  if (frameCount > 0 && (incidentCount > 0 || signalCount > 0)) {
    const tickToFrameMap = new Map();
    for (let i = 0; i < frameCount; i++) {
      tickToFrameMap.set(frameSlots[i].tick, i);
    }
    for (let i = 0; i < incidentCount; i++) {
      const inc = incidents[i];
      if (inc.frameIndex === 0 && inc.tick > 0 && tickToFrameMap.has(inc.tick)) {
        const trueIdx = tickToFrameMap.get(inc.tick);
        if (trueIdx > 0) {
          const idxInZero = frameSlots[0].incidents.indexOf(inc);
          if (idxInZero !== -1) frameSlots[0].incidents.splice(idxInZero, 1);
          inc.frameIndex = trueIdx;
          frameSlots[trueIdx].incidents.push(inc);
          incidentsByFrame.set(trueIdx, frameSlots[trueIdx].incidents);
        }
      }
    }
    for (let i = 0; i < signalCount; i++) {
      const sig = recordedSignals[i];
      if (sig.frameIndex === 0 && sig.tick > 0 && tickToFrameMap.has(sig.tick)) {
        const trueIdx = tickToFrameMap.get(sig.tick);
        if (trueIdx > 0) {
          const idxInZero = frameSlots[0].signals.indexOf(sig);
          if (idxInZero !== -1) frameSlots[0].signals.splice(idxInZero, 1);
          sig.frameIndex = trueIdx;
          frameSlots[trueIdx].signals.push(sig);
          signalsByFrame.set(trueIdx, frameSlots[trueIdx].signals);
          const cue = resolveReplayAudioCueForSignal(sig, isCountUp);
          if (cue) frameSlots[trueIdx].audioEvents.push(cue);
        }
      }
    }
  }

  // If Track C has 0 recorded signals, synthesize fallback signals from Track B GOAL_SCORED incidents
  let synthesizedSignals = [];
  if (signalCount === 0 && frameCount > 0) {
    synthesizedSignals = synthesizeFallbackSignalsFromIncidents(incidents, frameSlots, matchInfo);
    for (let s = 0; s < synthesizedSignals.length; s++) {
      const sig = synthesizedSignals[s];
      const fIdx = Math.max(0, Math.min(frameCount - 1, sig.frameIndex ?? 0));
      let list = signalsByFrame.get(fIdx);
      if (!list) {
        list = frameSlots[fIdx].signals;
        signalsByFrame.set(fIdx, list);
      }
      list.push(sig);
      const cue = resolveReplayAudioCueForSignal(sig, isCountUp);
      if (cue) {
        frameSlots[fIdx].audioEvents.push(cue);
      }
    }
  }

  const effectiveSignals = signalCount > 0 ? recordedSignals : synthesizedSignals;

  // Instantiate the 3 independent timelines
  const stateInputTimeline = new StateInputTimeline({
    bytes: stateInputBytes,
    frameCount,
    stride: stateStride,
    stateBytes: RC_REPLAY_STATE_BYTES,
    tickRate: matchInfo.tickRate || 120,
    frames,
    frameSlots,
  });

  const incidentTimeline = new IncidentTimeline({
    bytes: incidentBytes,
    events: incidents,
    byFrameMap: incidentsByFrame,
    frameCount,
  });

  const signalTimeline = new SignalTimeline({
    bytes: signalBytes,
    recordedEvents: recordedSignals,
    synthesizedEvents: synthesizedSignals,
    byFrameMap: signalsByFrame,
    frameCount,
    isCountUp,
  });

  return {
    version,
    metadata: {
      mode: matchInfo.mode || 'match',
      arenaPreset: matchInfo.arenaPreset ?? 0,
      tickRate: matchInfo.tickRate || 120,
      frameCount,
      durationSec: matchInfo.durationSec ?? Number((frameCount / 120).toFixed(2)),
      winner: matchInfo.winner || 'blue',
      blueScore: matchInfo.blueScore ?? 0,
      orangeScore: matchInfo.orangeScore ?? 0,
      winReason: matchInfo.winReason ?? 0,
      createdAtIso: matchInfo.createdAtIso || '',
      roster: matchInfo.roster || [],
      tracks: tracksToc,
    },
    frames,
    frameSlots,
    timelines: {
      stateInput: stateInputTimeline,
      incidents: incidentTimeline.events,
      signals: effectiveSignals,
      recordedSignals,
      synthesizedSignals,
      stateInputTimeline,
      incidentTimeline,
      signalTimeline,
      stateInputBytes,
      incidentBytes,
      signalBytes,
      incidentsByFrame,
      signalsByFrame,
    },
  };
}

