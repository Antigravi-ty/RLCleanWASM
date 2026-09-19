/**
 * src/network/InputPacketCodec.js
 * Ultra-compact Bit-Packing Binary Codec for Redundant UDP Input Packets.
 * 
 * Packet Layout:
 * - Header (7 bytes):
 *   [0]    Magic (0x52 = 'R')
 *   [1]    Car Index (uint8, 0..5)
 *   [2..5] Target Tick T (uint32 BE)
 *   [6]    History Count N (uint8, e.g. 10)
 * 
 * - Per-Tick Payload (3 bytes = 24 bits per tick):
 *   - Throttle:  6 bits (-31..31 -> 0..62)
 *   - Steer:     6 bits (-31..31 -> 0..62)
 *   - Pitch:     3 bits (-3..3 -> 0..6)
 *   - Yaw:       3 bits (-3..3 -> 0..6)
 *   - Roll:      3 bits (-3..3 -> 0..6)
 *   - Jump:      1 bit  (0 / 1)
 *   - Boost:     1 bit  (0 / 1)
 *   - Handbrake: 1 bit  (0 / 1)
 *   Total: 6 + 6 + 3 + 3 + 3 + 1 + 1 + 1 = 24 bits (3 bytes)
 * 
 * Total Packet Size: 7 + 10 * 3 = 37 bytes (strictly under 40 bytes).
 */

export const MAGIC_BYTE = 0x52; // 'R'
export const HEADER_SIZE = 7;
export const BYTES_PER_TICK = 3;

export class InputPacketCodec {
  /**
   * Packs controls object into 3 bytes
   * @param {object} ctrl
   * @returns {[number, number, number]}
   */
  static packTickControls(ctrl) {
    const thr = Math.max(-31, Math.min(31, Math.round((ctrl.throttle || 0) * 31))) + 31;
    const str = Math.max(-31, Math.min(31, Math.round((ctrl.steer || 0) * 31))) + 31;
    const pit = Math.max(-3, Math.min(3, Math.round((ctrl.pitch || 0) * 3))) + 3;
    const yaw = Math.max(-3, Math.min(3, Math.round((ctrl.yaw || 0) * 3))) + 3;
    const rol = Math.max(-3, Math.min(3, Math.round((ctrl.roll || 0) * 3))) + 3;
    const jmp = ctrl.jump ? 1 : 0;
    const bst = ctrl.boost ? 1 : 0;
    const hnd = ctrl.handbrake ? 1 : 0;

    // Byte 0: thr (6 bits) | top 2 bits of str
    const b0 = (thr & 0x3F) | ((str & 0x30) << 2);
    // Byte 1: lower 4 bits of str | pit (3 bits) | top 1 bit of yaw
    const b1 = (str & 0x0F) | ((pit & 0x07) << 4) | ((yaw & 0x04) << 5);
    // Byte 2: lower 2 bits of yaw | rol (3 bits) | jmp | bst | hnd
    const b2 = (yaw & 0x03) | ((rol & 0x07) << 2) | (jmp << 5) | (bst << 6) | (hnd << 7);

    return [b0, b1, b2];
  }

  /**
   * Unpacks 3 bytes into controls object
   * @param {number} b0
   * @param {number} b1
   * @param {number} b2
   * @returns {object}
   */
  static unpackTickControls(b0, b1, b2) {
    const thr = (b0 & 0x3F) - 31;
    const str = (((b0 >> 2) & 0x30) | (b1 & 0x0F)) - 31;
    const pit = ((b1 >> 4) & 0x07) - 3;
    const yaw = (((b1 >> 5) & 0x04) | (b2 & 0x03)) - 3;
    const rol = ((b2 >> 2) & 0x07) - 3;
    const jump = Boolean(b2 & (1 << 5));
    const boost = Boolean(b2 & (1 << 6));
    const handbrake = Boolean(b2 & (1 << 7));

    return {
      throttle: thr / 31.0,
      steer: str / 31.0,
      pitch: pit / 3.0,
      yaw: yaw / 3.0,
      roll: rol / 3.0,
      jump,
      boost,
      handbrake
    };
  }

  /**
   * Encodes a target tick and redundant history window into a binary Uint8Array
   * @param {number} carIndex
   * @param {number} targetTick
   * @param {Array<{ tick: number, controls: object }>} history Window of ticks ordered oldest to newest
   * @returns {Uint8Array}
   */
  static encode(carIndex, targetTick, history) {
    const count = Math.min(255, history.length);
    const totalSize = HEADER_SIZE + count * BYTES_PER_TICK;
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);

    // Header
    buffer[0] = MAGIC_BYTE;
    buffer[1] = carIndex & 0xFF;
    view.setUint32(2, targetTick >>> 0, false); // Big-Endian
    buffer[6] = count & 0xFF;

    // Payload: [T - count + 1, ..., T]
    for (let i = 0; i < count; i++) {
      const item = history[i];
      const [b0, b1, b2] = this.packTickControls(item.controls);
      const offset = HEADER_SIZE + i * BYTES_PER_TICK;
      buffer[offset] = b0;
      buffer[offset + 1] = b1;
      buffer[offset + 2] = b2;
    }

    return buffer;
  }

  /**
   * Decodes a binary packet (or passes through object packets)
   * @param {Uint8Array|ArrayBuffer|object} data
   * @returns {{ carIndex: number, targetTick: number, history: Array<{ tick: number, carIndex: number, controls: object }> }|null}
   */
  static decode(data) {
    if (!data) return null;

    // Pass through if already decoded object
    if (typeof data === 'object' && !(data instanceof Uint8Array) && !(data instanceof ArrayBuffer)) {
      if (data.history) return data;
      if (data.tick !== undefined && data.controls) {
        return {
          carIndex: data.carIndex ?? 0,
          targetTick: data.tick,
          history: [{ tick: data.tick, carIndex: data.carIndex ?? 0, controls: data.controls }]
        };
      }
      return data;
    }

    const u8 = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    if (u8.length < HEADER_SIZE) return null;
    if (u8[0] !== MAGIC_BYTE) return null;

    const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const carIndex = u8[1];
    const targetTick = view.getUint32(2, false);
    const count = u8[6];

    const expectedSize = HEADER_SIZE + count * BYTES_PER_TICK;
    if (u8.length < expectedSize) return null;

    const history = [];
    const startTick = targetTick - count + 1;

    for (let i = 0; i < count; i++) {
      const offset = HEADER_SIZE + i * BYTES_PER_TICK;
      const b0 = u8[offset];
      const b1 = u8[offset + 1];
      const b2 = u8[offset + 2];
      const controls = this.unpackTickControls(b0, b1, b2);
      history.push({
        tick: startTick + i,
        carIndex,
        controls
      });
    }

    return {
      carIndex,
      targetTick,
      history
    };
  }
}

export default InputPacketCodec;
