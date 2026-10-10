/**
 * src/network/GlobalPayloadCodec.js
 * Ultra-fast Binary Serialization & Deserialization for Shared Global Payloads.
 * 
 * Wire Protocol Specification:
 * [0] Flag Byte (8-bit bitmask):
 *     - Bit 0 (0x01): FLAG_PHYSICS   - Physics state snapshot & acknowledged user inputs.
 *     - Bit 1 (0x02): FLAG_SIGNAL    - Active match control signals (kickoff, clock, pause, etc.).
 *     - Bit 2 (0x04): FLAG_ALL_RTT   - 5-second interval all-user RTT telemetry table.
 *     - Bits 3..7:    Reserved for future extensible packet types.
 * 
 * [1..] Section 1: Physics State (if FLAG_PHYSICS):
 *     - tick (uint32 BE, 4 bytes)
 *     - ackCount (uint8, 1 byte, 0..6)
 *     - ackCount * 4 bytes: [carIndex (uint8), packedControls (3 bytes)]
 *     - snapFloatsCount (uint16 BE, 2 bytes)
 *     - snapFloatsCount * 4 bytes (IEEE 754 float32 array)
 * 
 * [...] Section 2: Match Signals (if FLAG_SIGNAL):
 *     - signalCount (uint8, 1 byte)
 *     - signalCount * 13 bytes:
 *       - signalType (uint8, 1 byte)
 *       - frameId (uint32 BE, 4 bytes)
 *       - param1 (uint32 BE, 4 bytes) (e.g. kickoffWillStartAt frame, secondsRemaining)
 *       - param2 (uint32 BE, 4 bytes)
 * 
 * [...] Section 3: All-User RTT Table (if FLAG_ALL_RTT):
 *     - Fixed 6-player slots (12 bytes = 6 * uint16 BE):
 *       RTT in milliseconds for car indices 0..5 (0xFFFF if slot unoccupied).
 *     - spectatorCount (uint8, 1 byte)
 *     - spectatorCount * 3 bytes: [spectatorId (uint8), rttMs (uint16 BE)]
 */

import { InputPacketCodec } from './InputPacketCodec.js';

export const PAYLOAD_FLAGS = Object.freeze({
  PHYSICS: 1 << 0,   // 0x01
  SIGNAL: 1 << 1,    // 0x02
  ALL_RTT: 1 << 2,   // 0x04
  RESERVED_3: 1 << 3,
  RESERVED_4: 1 << 4,
  RESERVED_5: 1 << 5,
  RESERVED_6: 1 << 6,
  RESERVED_7: 1 << 7
});

export const MATCH_SIGNALS = Object.freeze({
  CLOCK_UPDATED_SECONDS: 1,
  GOAL_REPLAY_WILL_START: 2,
  GOAL_REPLAY_START: 3,
  GOAL_REPLAY_WILL_END: 4,
  GOAL_REPLAY_END: 5,
  KICKOFF_WILL_START: 6,
  KICKOFF_START: 7,
  ROUND_STARTED: 8,
  MATCH_CREATED: 9,
  MATCH_DESTROYED: 10,
  MATCH_INITIALIZED: 11,
  MATCH_ENDED: 12,
  MATCH_PAUSED: 13,
  MATCH_UNPAUSED: 14,
  PLAYER_JOINED: 15,
  PLAYER_LEFT: 16,
  PODIUM_START: 17,
  MATCH_STARTED: 18,
  BALL_RESET: 19
});

export const SIGNAL_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(MATCH_SIGNALS).map(([k, v]) => [v, k]))
);

export class GlobalPayloadCodec {
  /**
   * Encodes a global payload object into a compact binary Uint8Array
   * @param {object} payload
   * @param {object} [payload.physics]
   * @param {number} [payload.physics.tick=0]
   * @param {Float32Array} [payload.physics.stateSnapshot]
   * @param {Array<object>} [payload.physics.acknowledgedControls]
   * @param {Array<object>} [payload.signals] Array of { signalType, frameId, param1, param2 }
   * @param {object} [payload.allUserRtt] { players: number[6], spectators: Array<{ id, rtt }> }
   * @returns {Uint8Array}
   */
  static encode(payload = {}) {
    let flagByte = 0;
    const hasPhysics = Boolean(payload.physics && payload.physics.stateSnapshot);
    const signals = payload.signals || [];
    const hasSignals = signals.length > 0;
    const hasAllUserRtt = Boolean(payload.allUserRtt);

    if (hasPhysics) flagByte |= PAYLOAD_FLAGS.PHYSICS;
    if (hasSignals) flagByte |= PAYLOAD_FLAGS.SIGNAL;
    if (hasAllUserRtt) flagByte |= PAYLOAD_FLAGS.ALL_RTT;

    // Calculate required byte size
    let totalSize = 1; // Flag byte

    // 1. Physics size
    let physicsByteSize = 0;
    let snapFloats = 0;
    let ackCount = 0;
    if (hasPhysics) {
      snapFloats = payload.physics.stateSnapshot.length;
      ackCount = Math.min(6, (payload.physics.acknowledgedControls || []).length);
      physicsByteSize = 4 + 1 + (ackCount * 4) + 2 + (snapFloats * 4);
      totalSize += physicsByteSize;
    }

    // 2. Signals size
    let signalsByteSize = 0;
    if (hasSignals) {
      signalsByteSize = 1 + (signals.length * 13);
      totalSize += signalsByteSize;
    }

    // 3. All-User RTT size
    let rttByteSize = 0;
    const spectators = payload.allUserRtt?.spectators || [];
    if (hasAllUserRtt) {
      rttByteSize = 12 + 1 + (spectators.length * 3);
      totalSize += rttByteSize;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // [0] Flag byte
    view.setUint8(0, flagByte);
    let offset = 1;

    // Encode Section 1: Physics
    if (hasPhysics) {
      view.setUint32(offset, payload.physics.tick || 0, false);
      offset += 4;
      view.setUint8(offset, ackCount);
      offset += 1;

      const ackList = payload.physics.acknowledgedControls || [];
      for (let i = 0; i < ackCount; i++) {
        const item = ackList[i] || {};
        const carIndex = item.carIndex ?? i;
        const ctrl = item.controls || {};
        const [b0, b1, b2] = InputPacketCodec.packTickControls(ctrl);
        view.setUint8(offset, carIndex);
        view.setUint8(offset + 1, b0);
        view.setUint8(offset + 2, b1);
        view.setUint8(offset + 3, b2);
        offset += 4;
      }

      view.setUint16(offset, snapFloats, false);
      offset += 2;

      const snap = payload.physics.stateSnapshot;
      for (let i = 0; i < snapFloats; i++) {
        view.setFloat32(offset, snap[i], false);
        offset += 4;
      }
    }

    // Encode Section 2: Signals
    if (hasSignals) {
      view.setUint8(offset, signals.length);
      offset += 1;
      for (let i = 0; i < signals.length; i++) {
        const s = signals[i];
        view.setUint8(offset, s.signalType);
        view.setUint32(offset + 1, s.frameId || 0, false);
        view.setUint32(offset + 5, s.param1 || 0, false);
        view.setUint32(offset + 9, s.param2 || 0, false);
        offset += 13;
      }
    }

    // Encode Section 3: All-User RTT
    if (hasAllUserRtt) {
      const players = payload.allUserRtt.players || [];
      for (let i = 0; i < 6; i++) {
        const rtt = players[i];
        const val = (typeof rtt === 'number' && rtt >= 0) ? Math.min(65534, Math.round(rtt)) : 0xFFFF;
        view.setUint16(offset, val, false);
        offset += 2;
      }

      view.setUint8(offset, spectators.length);
      offset += 1;

      for (let i = 0; i < spectators.length; i++) {
        const sp = spectators[i];
        view.setUint8(offset, sp.id ?? i);
        view.setUint16(offset + 1, Math.min(65534, Math.max(0, Math.round(sp.rtt ?? 0))), false);
        offset += 3;
      }
    }

    return uint8;
  }

  /**
   * Decodes a global payload from Uint8Array or DataView slice
   * @param {Uint8Array|ArrayBuffer|DataView} bufferInput
   * @param {number} [byteOffset=0]
   * @returns {object} Decoded global payload
   */
  static decode(bufferInput, byteOffset = 0) {
    if (!bufferInput) return null;

    let view;
    if (bufferInput instanceof DataView) {
      view = bufferInput;
    } else if (bufferInput instanceof Uint8Array) {
      view = new DataView(bufferInput.buffer, bufferInput.byteOffset, bufferInput.byteLength);
    } else if (bufferInput instanceof ArrayBuffer) {
      view = new DataView(bufferInput);
    } else {
      return null;
    }

    if (view.byteLength < byteOffset + 1) return null;

    let offset = byteOffset;
    const flagByte = view.getUint8(offset);
    offset += 1;

    const result = {
      flagByte,
      hasPhysics: Boolean(flagByte & PAYLOAD_FLAGS.PHYSICS),
      hasSignals: Boolean(flagByte & PAYLOAD_FLAGS.SIGNAL),
      hasAllUserRtt: Boolean(flagByte & PAYLOAD_FLAGS.ALL_RTT),
      physics: null,
      signals: [],
      allUserRtt: null
    };

    // Decode Physics Section
    if (result.hasPhysics) {
      if (view.byteLength < offset + 7) return result;
      const tick = view.getUint32(offset, false);
      offset += 4;
      const ackCount = view.getUint8(offset);
      offset += 1;

      const acknowledgedControls = [];
      for (let i = 0; i < ackCount; i++) {
        if (view.byteLength < offset + 4) break;
        const carIndex = view.getUint8(offset);
        const b0 = view.getUint8(offset + 1);
        const b1 = view.getUint8(offset + 2);
        const b2 = view.getUint8(offset + 3);
        const controls = InputPacketCodec.unpackTickControls(b0, b1, b2);
        acknowledgedControls.push({ carIndex, controls });
        offset += 4;
      }

      if (view.byteLength >= offset + 2) {
        const snapFloats = view.getUint16(offset, false);
        offset += 2;
        if (view.byteLength >= offset + (snapFloats * 4)) {
          const stateSnapshot = new Float32Array(snapFloats);
          for (let i = 0; i < snapFloats; i++) {
            stateSnapshot[i] = view.getFloat32(offset, false);
            offset += 4;
          }
          result.physics = {
            tick,
            acknowledgedControls,
            stateSnapshot
          };
        }
      }
    }

    // Decode Signals Section
    if (result.hasSignals) {
      if (view.byteLength >= offset + 1) {
        const count = view.getUint8(offset);
        offset += 1;
        for (let i = 0; i < count; i++) {
          if (view.byteLength < offset + 13) break;
          const signalType = view.getUint8(offset);
          const frameId = view.getUint32(offset + 1, false);
          const param1 = view.getUint32(offset + 5, false);
          const param2 = view.getUint32(offset + 9, false);
          result.signals.push({
            signalType,
            name: SIGNAL_NAMES[signalType] || `SIGNAL_${signalType}`,
            frameId,
            param1,
            param2
          });
          offset += 13;
        }
      }
    }

    // Decode All-User RTT Section
    if (result.hasAllUserRtt) {
      if (view.byteLength >= offset + 13) {
        const players = [];
        for (let i = 0; i < 6; i++) {
          const val = view.getUint16(offset, false);
          players.push(val === 0xFFFF ? null : val);
          offset += 2;
        }
        const spectatorCount = view.getUint8(offset);
        offset += 1;

        const spectators = [];
        for (let i = 0; i < spectatorCount; i++) {
          if (view.byteLength < offset + 3) break;
          const id = view.getUint8(offset);
          const rtt = view.getUint16(offset + 1, false);
          spectators.push({ id, rtt });
          offset += 3;
        }

        result.allUserRtt = {
          players,
          spectators
        };
      }
    }

    return result;
  }
}
