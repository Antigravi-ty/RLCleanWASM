/**
 * SpatialAudioSource.js
 * HRTF 3D spatial audio panner and listener tracking for Car Soccer.
 * Deobfuscates original `cg`, `_1`, and `j1`.
 *
 * Implements:
 * - 3D HRTF Web Audio PannerNode with explicit mono speaker channel routing
 * - Cubic Hermite smoothstep distance attenuation (250 uu -> 4500 uu)
 * - Camera-bound Web Audio Listener synchronization (supports AudioParam & legacy APIs)
 * - Zero-allocation listener orientation updates directly from camera world matrix
 */

export const SPATIAL_AUDIO_CONFIG = {
  MIN_DISTANCE: 250,
  MAX_DISTANCE: 4500,
  MAX_GAIN: 0.4,
  RAMP_TIME: 0.025
};

/**
 * Calculates distance gain attenuation using cubic Hermite interpolation.
 * Replaces original mangled `j1`.
 * @param {number} distance - Distance from listener in Unreal Units (uu)
 * @returns {number} Attenuated gain [0.0, 0.4]
 */

export const INCIDENT_SPATIAL_CONFIG = {
  MIN_DISTANCE: 300,
  MAX_DISTANCE: 9500,
  MIN_GAIN: 0.05
};

/**
 * Calculates distance gain attenuation for discrete physics incidents across RocketSim arena.
 * @param {number} distance - Distance in Unreal Units
 * @returns {number} Attenuated gain factor [0.05, 1.0]
 */
export function calculateIncidentDistanceGain(distance) {
  if (!Number.isFinite(distance)) return 1.0;
  const { MIN_DISTANCE, MAX_DISTANCE, MIN_GAIN } = INCIDENT_SPATIAL_CONFIG;
  if (distance <= MIN_DISTANCE) return 1.0;
  if (distance >= MAX_DISTANCE) return MIN_GAIN;

  const t = (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE);
  const smooth = 1.0 - t * t * (3.0 - 2.0 * t);
  return MIN_GAIN + (1.0 - MIN_GAIN) * smooth;
}

/**
 * Coordinate mapping: RocketSim Unreal Units (X: width, Y: length, Z: up)
 * -> Three.js & Web Audio API (X: width, Y: up, Z: length)
 */
export function toAudioCoordinates(out, pos) {
  if (!pos) return null;
  if (pos.isVector3 || pos.isAudioCoords) {
    out.x = pos.x ?? 0;
    out.y = pos.y ?? 0;
    out.z = pos.z ?? 0;
    return out;
  }
  if (Number.isFinite(pos.posX) && Number.isFinite(pos.posY) && Number.isFinite(pos.posZ)) {
    out.x = pos.posX;
    out.y = pos.posZ;
    out.z = pos.posY;
    return out;
  }
  if (Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
    out.x = pos.x;
    out.y = pos.z;
    out.z = pos.y;
    return out;
  }
  return null;
}

export function calculateDistanceGain(distance) {
  if (!Number.isFinite(distance)) return 0;
  const { MIN_DISTANCE, MAX_DISTANCE, MAX_GAIN } = SPATIAL_AUDIO_CONFIG;
  const clamped = Math.max(0, Math.min(1, (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)));
  return MAX_GAIN * (1 - clamped * clamped * (3 - 2 * clamped));
}

// Internal listener state shared across all spatial audio instances
class AudioListenerManager {
  constructor() {
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      copy(p) {
        if (p) {
          this.x = p.x ?? 0;
          this.y = p.y ?? 0;
          this.z = p.z ?? 0;
        }
        return this;
      },
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      },
      setFromMatrixPosition(m) {
        if (m && m.elements) {
          this.x = m.elements[12];
          this.y = m.elements[13];
          this.z = m.elements[14];
        }
        return this;
      }
    };
    this.forward = { x: 0, y: 0, z: -1 };
    this.up = { x: 0, y: 1, z: 0 };
    this.quaternion = {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
      copy(q) {
        if (q) {
          this.x = q.x ?? 0;
          this.y = q.y ?? 0;
          this.z = q.z ?? 0;
          this.w = q.w ?? 1;
        }
        return this;
      },
      set(x, y, z, w) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w ?? 1;
        return this;
      }
    };
    this.hasListener = false;
    this.sources = new Set();
    this.context = null;
  }

  setContext(ctx) {
    if (ctx && ctx !== this.context) {
      this.context = ctx;
    }
  }

  register(source) {
    this.sources.add(source);
  }

  unregister(source) {
    this.sources.delete(source);
  }

  /**
   * Applies quaternion rotation to a 3D vector.
   */
  rotateVector(v, q) {
    const x = v.x, y = v.y, z = v.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w ?? 1;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    return {
      x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
      y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
      z: iz * qw + iw * -qz + ix * -qy - iy * -qx
    };
  }

  /**
   * Updates global audio listener state from 3D camera.
   * Replaces original mangled `_1`.
   * @param {Object} camera - Three.js camera or equivalent transform object
   */
  updateFromCamera(camera) {
    if (!camera) return;

    try {
      if (typeof camera.updateWorldMatrix === 'function') {
        camera.updateWorldMatrix(true, false);
      }

      if (camera.matrixWorld && camera.matrixWorld.elements) {
        const te = camera.matrixWorld.elements;
        this.position.x = te[12];
        this.position.y = te[13];
        this.position.z = te[14];

        // Three.js Camera orientation:
        // Forward is local (0, 0, -1) -> -col 2 of matrixWorld: (-te[8], -te[9], -te[10])
        const fx = -te[8], fy = -te[9], fz = -te[10];
        const flen = Math.hypot(fx, fy, fz) || 1;
        this.forward.x = fx / flen;
        this.forward.y = fy / flen;
        this.forward.z = fz / flen;

        // Up is local (0, 1, 0) -> +col 1 of matrixWorld: (te[4], te[5], te[6])
        const ux = te[4], uy = te[5], uz = te[6];
        const ulen = Math.hypot(ux, uy, uz) || 1;
        this.up.x = ux / ulen;
        this.up.y = uy / ulen;
        this.up.z = uz / ulen;
      } else {
        if (typeof camera.getWorldPosition === 'function') {
          camera.getWorldPosition(this.position);
        } else if (camera.position) {
          this.position.x = camera.position.x ?? 0;
          this.position.y = camera.position.y ?? 0;
          this.position.z = camera.position.z ?? 0;
        }

        if (typeof camera.getWorldQuaternion === 'function') {
          camera.getWorldQuaternion(this.quaternion);
        } else if (camera.quaternion) {
          this.quaternion.x = camera.quaternion.x ?? 0;
          this.quaternion.y = camera.quaternion.y ?? 0;
          this.quaternion.z = camera.quaternion.z ?? 0;
          this.quaternion.w = camera.quaternion.w ?? 1;
        }

        this.forward = this.rotateVector({ x: 0, y: 0, z: -1 }, this.quaternion);
        this.up = this.rotateVector({ x: 0, y: 1, z: 0 }, this.quaternion);
      }

      this.hasListener = true;

      if (this.context && this.context.listener) {
        const listener = this.context.listener;
        const t = this.context.currentTime;
        if (listener.positionX) {
          listener.positionX.setValueAtTime(this.position.x, t);
          listener.positionY.setValueAtTime(this.position.y, t);
          listener.positionZ.setValueAtTime(this.position.z, t);
          listener.forwardX.setValueAtTime(this.forward.x, t);
          listener.forwardY.setValueAtTime(this.forward.y, t);
          listener.forwardZ.setValueAtTime(this.forward.z, t);
          listener.upX.setValueAtTime(this.up.x, t);
          listener.upY.setValueAtTime(this.up.y, t);
          listener.upZ.setValueAtTime(this.up.z, t);
        } else if (typeof listener.setPosition === 'function') {
          listener.setPosition(this.position.x, this.position.y, this.position.z);
          listener.setOrientation(this.forward.x, this.forward.y, this.forward.z, this.up.x, this.up.y, this.up.z);
        }
      }

      for (const source of this.sources) {
        source.updateListener();
      }
    } catch (err) {
      console.warn('[AudioListenerManager] Failed to update listener from camera:', err);
    }
  }
}

export const listenerManager = new AudioListenerManager();

/**
 * Updates the global audio listener position & orientation.
 * Replaces original `_1(H.camera)`.
 * @param {Object} camera - Active camera
 */
export function updateAudioListener(camera) {
  try {
    listenerManager.updateFromCamera(camera);
  } catch (err) {
    console.warn('[SpatialAudioSource] updateAudioListener failed:', err);
  }
}

/**
 * 3D Spatial Audio Source for individual sound emitters (e.g. car engines, boost nozzles).
 * Deobfuscates class `cg`.
 */
export class SpatialAudioSource {
  /**
   * @param {AudioContext} context - Active Web Audio context
   * @param {AudioNode} destinationNode - Destination node (typically master mixer input)
   */
  constructor(context, destinationNode) {
    this.context = context;
    this.enabled = true;
    this.targetGain = -1;
    this.position = {
      x: 0,
      y: 0,
      z: 0,
      copy(p) {
        if (p) {
          this.x = p.x ?? 0;
          this.y = p.y ?? 0;
          this.z = p.z ?? 0;
        }
        return this;
      },
      set(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      },
      setFromMatrixPosition(m) {
        if (m && m.elements) {
          this.x = m.elements[12];
          this.y = m.elements[13];
          this.z = m.elements[14];
        }
        return this;
      }
    };

    if (!context) {
      this.input = null;
      this.output = null;
      this.panner = null;
      return;
    }

    try {
      // Explicit mono input bus
      this.input = context.createGain();
      this.input.channelCount = 1;
      this.input.channelCountMode = 'explicit';
      this.input.channelInterpretation = 'speakers';

      // HRTF Spatial Panner
      this.panner = context.createPanner();
      this.panner.panningModel = 'equalpower';
      this.panner.channelCount = 1;
      this.panner.channelCountMode = 'explicit';
      this.panner.rolloffFactor = 0; // Distance gain handled explicitly via smoothstep
      this.panner.coneInnerAngle = 360;
      this.panner.coneOuterAngle = 360;

      // Output attenuation node
      this.output = context.createGain();
      this.output.gain.value = 0;

      // Chain: input -> panner -> output -> destination
      this.input.connect(this.panner);
      this.panner.connect(this.output);
      if (destinationNode) {
        this.output.connect(destinationNode);
      }
    } catch (err) {
      console.warn('[SpatialAudioSource] Failed to create audio nodes:', err);
    }

    listenerManager.register(this);
    this.updateListener();
  }

  /**
   * Sets world-space position of this emitter
   * @param {{x: number, y: number, z: number}} pos 
   */
  setPosition(pos) {
    if (!pos) return;
    // Map Unreal Coordinates (posX, posY, posZ) -> Three.js / Web Audio space (x: width, y: height, z: length)
    if (Number.isFinite(pos.posX) && Number.isFinite(pos.posY) && Number.isFinite(pos.posZ)) {
      this.position.set(pos.posX, pos.posZ, pos.posY);
    } else if (Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z)) {
      this.position.copy(pos);
    }
    if (!this.context || !this.panner) return;
    try {
      const t = this.context.currentTime;
      if (this.panner.positionX) {
        this.panner.positionX.setValueAtTime(this.position.x, t);
        this.panner.positionY.setValueAtTime(this.position.y, t);
        this.panner.positionZ.setValueAtTime(this.position.z, t);
      } else if (typeof this.panner.setPosition === 'function') {
        this.panner.setPosition(this.position.x, this.position.y, this.position.z);
      }
    } catch (err) {}
    this.applyGain();
  }

  /**
   * Enables or disables emitter output
   * @param {boolean} enabled 
   */
  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.applyGain();
  }

  /**
   * Syncs Web Audio listener orientation and updates gain
   */
  updateListener() {
    if (!this.context) return;
    try {
      if (listenerManager.hasListener) {
        const listener = this.context.listener;
        if (!listener) return;
        const t = this.context.currentTime;
        const { position, forward, up } = listenerManager;

        if (listener.positionX) {
          listener.positionX.setValueAtTime(position.x, t);
          listener.positionY.setValueAtTime(position.y, t);
          listener.positionZ.setValueAtTime(position.z, t);
          listener.forwardX.setValueAtTime(forward.x, t);
          listener.forwardY.setValueAtTime(forward.y, t);
          listener.forwardZ.setValueAtTime(forward.z, t);
          listener.upX.setValueAtTime(up.x, t);
          listener.upY.setValueAtTime(up.y, t);
          listener.upZ.setValueAtTime(up.z, t);
        } else if (typeof listener.setPosition === 'function') {
          listener.setPosition(position.x, position.y, position.z);
          listener.setOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z);
        }
      }
    } catch (err) {}
    this.applyGain();
  }

  /**
   * Calculates distance attenuation and schedules gain ramps
   */
  applyGain() {
    if (!this.context || !this.output) return;
    let target = 0;
    if (this.enabled && listenerManager.hasListener) {
      const dx = this.position.x - listenerManager.position.x;
      const dy = this.position.y - listenerManager.position.y;
      const dz = this.position.z - listenerManager.position.z;
      const distance = Math.hypot(dx, dy, dz);
      target = calculateDistanceGain(distance);
    }

    if (target === this.targetGain) return;
    this.targetGain = target;

    try {
      const t = this.context.currentTime;
      const currentGain = this.output.gain.value;
      this.output.gain.cancelScheduledValues(t);

      if (target === 0 || this.context.state !== 'running') {
        this.output.gain.setValueAtTime(target, t);
      } else {
        this.output.gain.setValueAtTime(currentGain, t);
        this.output.gain.linearRampToValueAtTime(target, t + SPATIAL_AUDIO_CONFIG.RAMP_TIME);
      }
    } catch (err) {}
  }

  /**
   * Disposes nodes and unregisters from listener manager
   */
  dispose() {
    this.setEnabled(false);
    listenerManager.unregister(this);
    try {
      this.input?.disconnect();
      this.panner?.disconnect();
      this.output?.disconnect();
    } catch (e) {}
  }
}
