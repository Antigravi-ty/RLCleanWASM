import { audioConfig } from '../config/audioConfig.js';
import { getAudioSlotPool, subsystemState } from './audioContext.js';

export class UIAudioEngine {
  playClick(volume = 1.0) {
    const pool = getAudioSlotPool();
    const buf = subsystemState.buffers.get("sfx_error_no_boost");
    if (!pool || !buf) return;
    const master = audioConfig.get('masterVolume');
    pool.playBuffer(buf, {
      volume: Math.max(0, Math.min(5.0, volume * master * 0.3)),
      playbackRate: 2.0,
      priority: 1
    });
  }
}
