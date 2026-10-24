/**
 * src/network/GlobalPayloadCodec.js
 * Ultra-fast Binary Serialization & Deserialization for Shared Global Payloads.
 *
 * Wire Protocol Specification:
 * [0] Flag Byte (8-bit bitmask):
 *     - Bit 0 (0x01): FLAG_PHYSICS   - Physics state snapshot & acknowledged user inputs.
 *     - Bit 1 (0x02): FLAG_SIGNAL    - Authoritative signals (0x80..0xBF) & command ACKs.
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
 *     - signalCount * 15 bytes:
 *       - signalId (uint16 BE, 2 bytes)
 *       - signalType (uint8, 1 byte, 0x80..0xBF Server Signal)
 *       - frameId (uint32 BE, 4 bytes)
 *       - param1 (uint32 BE, 4 bytes)
 *       - param2 (uint32 BE, 4 bytes)
 *
 * [...] Section 3: All-User RTT Table (if FLAG_ALL_RTT):
 *     - Fixed 6-player slots (12 bytes = 6 * uint16 BE):
 *       RTT in milliseconds for car indices 0..5 (0xFFFF if slot unoccupied).
 *     - spectatorCount (uint8, 1 byte)
 *     - spectatorCount * 3 bytes: [spectatorId (uint8), rttMs (uint16 BE)]
 */

import { InputPacketCodec } from './InputPacketCodec.js';
import {
  INCIDENT_EVENT_TYPES,
  SIGNAL_EVENT_TYPES,
  CLIENT_COMMAND_TYPES,
  isIncidentEvent,
  isServerSignal,
  isClientCommand
} from '../physics/RocketSimConstants.js';

export {
  INCIDENT_EVENT_TYPES,
  SIGNAL_EVENT_TYPES,
  CLIENT_COMMAND_TYPES,
  isIncidentEvent,
  isServerSignal,
  isClientCommand
};

export const MATCH_SIGNALS = SIGNAL_EVENT_TYPES;

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

export const SIGNAL_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(MATCH_SIGNALS).map(([k, v]) => [v, k]))
);

export class GlobalPayloadCodec {
  static encode(payload = {}) {
    let flagByte = 0;
    const hasPhysics = Boolean(payload.physics && payload.physics.stateSnapshot);
    const signals = payload.signals || [];
    const hasSignals = signals.length > 0;
    const hasAllUserRtt = Boolean(payload.allUserRtt);

    if (hasPhysics) flagByte |= PAYLOAD_FLAGS.PHYSICS;
    if (hasSignals) flagByte |= PAYLOAD_FLAGS.SIGNAL;
    if (hasAllUserRtt) flagByte |= PAYLOAD_FLAGS.ALL_RTT;

    let totalSize = 1;

    let physicsByteSize = 0;
    let snapFloats = 0;
    let ackCount = 0;
    if (hasPhysics) {
      snapFloats = payload.physics.stateSnapshot.length;
      ackCount = Math.min(8, (payload.physics.acknowledgedControls || []).length);
      physicsByteSize = 4 + 1 + (ackCount * 4) + 2 + (snapFloats * 4);
      totalSize += physicsByteSize;
    }

    let signalsByteSize = 0;
    if (hasSignals) {
      signalsByteSize = 1 + (signals.length * 15);
      totalSize += signalsByteSize;
    }

    let rttByteSize = 0;
    const spectators = payload.allUserRtt?.spectators || [];
    if (hasAllUserRtt) {
      rttByteSize = 12 + 1 + (spectators.length * 3);
      totalSize += rttByteSize;
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    view.setUint8(0, flagByte);
    let offset = 1;

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

    if (hasSignals) {
      view.setUint8(offset, signals.length);
      offset += 1;
      for (let i = 0; i < signals.length; i++) {
        const s = signals[i];
        view.setUint16(offset, (s.signalId || 0) & 0xFFFF, false);
        view.setUint8(offset + 2, s.signalType);
        view.setUint32(offset + 3, s.frameId || 0, false);
        view.setUint32(offset + 7, s.param1 || 0, false);
        view.setUint32(offset + 11, s.param2 || 0, false);
        offset += 15;
      }
    }

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

    if (result.hasSignals) {
      if (view.byteLength >= offset + 1) {
        const count = view.getUint8(offset);
        offset += 1;
        for (let i = 0; i < count; i++) {
          if (view.byteLength < offset + 15) break;
          const signalId = view.getUint16(offset, false);
          const signalType = view.getUint8(offset + 2);
          const frameId = view.getUint32(offset + 3, false);
          const param1 = view.getUint32(offset + 7, false);
          const param2 = view.getUint32(offset + 11, false);
          result.signals.push({
            signalId,
            signalType,
            name: SIGNAL_NAMES[signalType] || `SIGNAL_0x${signalType.toString(16).toUpperCase()}`,
            frameId,
            param1,
            param2
          });
          offset += 15;
        }
      }
    }

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
