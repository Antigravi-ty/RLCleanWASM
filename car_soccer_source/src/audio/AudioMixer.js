import { clampVolume } from './audioConstants.js';

export class AudioMixer {
  constructor(context) {
    this.context = context;
    this.input = context.createGain();
    this.output = context.createGain();
    this.output.gain.value = 0;
    this.volume = 1;
    this.active = false;
    this.connected = false;
    this.input.connect(this.output);
  }

  setVolume(vol) {
    this.volume = clampVolume(vol);
    this.apply();
  }

  setActive(active) {
    this.active = Boolean(active);
    this.apply();
  }

  flush() {
    if (!this.context) return;
    const now = this.context.currentTime;
    try {
      this.output.gain.cancelScheduledValues(now);
      this.output.gain.setValueAtTime(0, now);
    } catch (e) {
      console.warn('[AudioArchitecture] Error cancelling output gain schedule on reset:', e);
    }
  }

  apply() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const target = this.active ? this.volume : 0;
    const current = this.output.gain.value;

    try {
      this.output.gain.cancelScheduledValues(now);
      if (target === 0) {
        this.output.gain.setValueAtTime(0, now);
        if (this.connected) {
          this.output.disconnect(this.context.destination);
          this.connected = false;
        }
        return;
      }

      if (!this.connected) {
        this.output.gain.setValueAtTime(0, now);
        this.output.connect(this.context.destination);
        this.connected = true;
      }

      if (this.context.state === "running") {
        this.output.gain.setValueAtTime(Math.min(current, target), now);
        this.output.gain.linearRampToValueAtTime(target, now + 0.05);
      } else {
        this.output.gain.setValueAtTime(target, now);
      }
    } catch (e) {
      console.warn('[AudioArchitecture] Error setting output gain on apply:', e);
    }
  }
}
