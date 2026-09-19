/**
 * src/network/ServerSnapshotCodec.js
 * Ultra-fast Binary Serialization Codec for Authoritative Server State Snapshots.
 * 
 * Wire Protocol:
 * [0]       Magic Byte 0x53 ('S')
 * [1..4]    serverTick (uint32 BE)
 * [5..12]   timestamp (float64 BE)
 * [13..20]  lastReceivedClientTimestamp (float64 BE)
 * [21]      ackCount (uint8, up to 6 cars)
 * [22..]    ackCount * 4 bytes: [carIndex (uint8), packedControls (3 bytes)]
 * [...]     snapFloats (uint32 BE)
 * [...]     snapFloats * 4 bytes (IEEE 754 float32 array)
 * 
 * Provides zero-copy slice deserialization and sub-millisecond execution.
 */

import { InputPacketCodec } from './InputPacketCodec.js';

export const SNAPSHOT_MAGIC = 0x53; // 'S'
export const SNAPSHOT_HEADER_STATIC_SIZE = 22; // magic(1) + tick(4) + ts(8) + clientTs(8) + ackCount(1)

export class ServerSnapshotCodec {
  /**
   * Encodes an authoritative server state packet into a compact binary Uint8Array
   * @param {object} packet
   * @param {number} packet.serverTick
   * @param {Float32Array} packet.stateSnapshot
   * @param {Array<object>} [packet.acknowledgedControls]
   * @param {number} [packet.timestamp]
   * @param {number} [packet.lastReceivedClientTimestamp]
   * @returns {Uint8Array}
   */
  static encode(packet) {
    if (!packet) return new Uint8Array(0);

    const snap = packet.stateSnapshot;
    const snapFloats = snap ? snap.length : 0;
    const ackList = packet.acknowledgedControls || [];
    const ackCount = Math.min(6, ackList.length);

    const headerSize = SNAPSHOT_HEADER_STATIC_SIZE + ackCount * 4 + 4; // +4 for snapFloats count
    const totalBytes = headerSize + snapFloats * 4;

    const buffer = new Uint8Array(totalBytes);
    const view = new DataView(buffer.buffer);

    buffer[0] = SNAPSHOT_MAGIC;
    view.setUint32(1, (packet.serverTick || 0) >>> 0, false);
    view.setFloat64(5, packet.timestamp || 0, false);
    view.setFloat64(13, packet.lastReceivedClientTimestamp || 0, false);
    buffer[21] = ackCount & 0xFF;

    let offset = SNAPSHOT_HEADER_STATIC_SIZE;
    for (let c = 0; c < ackCount; c++) {
      buffer[offset] = c & 0xFF;
      const ctrl = ackList[c] || {};
      const [b0, b1, b2] = InputPacketCodec.packTickControls(ctrl);
      buffer[offset + 1] = b0;
      buffer[offset + 2] = b1;
      buffer[offset + 3] = b2;
      offset += 4;
    }

    view.setUint32(offset, snapFloats >>> 0, false);
    offset += 4;

    if (snapFloats > 0) {
      new Uint8Array(buffer.buffer, offset, snapFloats * 4).set(
        new Uint8Array(snap.buffer, snap.byteOffset, snapFloats * 4)
      );
    }

    return buffer;
  }

  /**
   * Decodes a binary packet into a structured server state packet
   * @param {Uint8Array|ArrayBuffer} raw
   * @returns {object|null}
   */
  static decode(raw) {
    if (!raw) return null;
    const u8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
    if (u8.length < SNAPSHOT_HEADER_STATIC_SIZE + 4) return null;
    if (u8[0] !== SNAPSHOT_MAGIC) return null;

    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const serverTick = view.getUint32(1, false);
    const timestamp = view.getFloat64(5, false);
    const lastReceivedClientTimestamp = view.getFloat64(13, false);
    const ackCount = u8[21];

    let offset = SNAPSHOT_HEADER_STATIC_SIZE;
    const acknowledgedControls = [];
    for (let i = 0; i < ackCount; i++) {
      if (offset + 4 > u8.length) break;
      const carIdx = u8[offset];
      const b0 = u8[offset + 1];
      const b1 = u8[offset + 2];
      const b2 = u8[offset + 3];
      acknowledgedControls[carIdx] = InputPacketCodec.unpackTickControls(b0, b1, b2);
      offset += 4;
    }

    if (offset + 4 > u8.length) return null;
    const snapFloats = view.getUint32(offset, false);
    offset += 4;

    const expectedBytes = offset + snapFloats * 4;
    if (u8.length < expectedBytes) return null;

    // Fast sub-array copy for memory safety
    const snapCopy = new Float32Array(snapFloats);
    new Uint8Array(snapCopy.buffer).set(
      u8.subarray(offset, offset + snapFloats * 4)
    );

    return {
      serverTick,
      timestamp,
      lastReceivedClientTimestamp,
      acknowledgedControls,
      stateSnapshot: snapCopy
    };
  }

  /**
   * Checks whether raw data is a server snapshot binary packet
   * @param {*} raw
   * @returns {boolean}
   */
  static isSnapshotPacket(raw) {
    if (!raw) return false;
    if (raw instanceof ArrayBuffer) {
      const u8 = new Uint8Array(raw, 0, 1);
      return u8[0] === SNAPSHOT_MAGIC;
    }
    if (raw instanceof Uint8Array) {
      return raw.length > 0 && raw[0] === SNAPSHOT_MAGIC;
    }
    return false;
  }
}

export default ServerSnapshotCodec;
