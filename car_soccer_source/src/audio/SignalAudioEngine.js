import { audioConfig } from './audioConfig.js';
import { getAudioSlotPool } from './audioContext.js';
import { SIGNAL_EVENT_TYPES } from '../physics/RocketSimConstants.js';

export class SignalAudioEngine {
  constructor() {
    this.signalBuffers = new Map();
    this.lastPlayTime = new Map();
  }

  setBuffer(signalKey, buffer) {
    this.signalBuffers.set(signalKey, buffer);
  }

  handleSignal(signalType) {
    let key = null;
    let minInterval = 0;
    switch (signalType) {
      case SIGNAL_EVENT_TYPES.COUNTDOWN_TICK:
      case SIGNAL_EVENT_TYPES.KICKOFF_WILL_START:
      case SIGNAL_EVENT_TYPES.MATCH_WILL_RESUME:
        key = 'match_countdown_321';
        minInterval = 250;
        break;
      case SIGNAL_EVENT_TYPES.KICKOFF_GO:
      case SIGNAL_EVENT_TYPES.KICKOFF_START:
      case SIGNAL_EVENT_TYPES.MATCH_START:
      case SIGNAL_EVENT_TYPES.MATCH_STARTED:
      case SIGNAL_EVENT_TYPES.MATCH_RESUMED:
        key = 'match_start_go';
        minInterval = 300;
        break;
      case SIGNAL_EVENT_TYPES.TIME_ALERT_60S:
        key = 'match_60_seconds_left';
        minInterval = 5000;
        break;
      case SIGNAL_EVENT_TYPES.TIME_ALERT_30S:
        key = 'match_30_seconds_left';
        minInterval = 5000;
        break;
      case SIGNAL_EVENT_TYPES.COUNTDOWN_10S:
      case 'match_countdown_10s':
      case 'countdown_10s':
        key = 'match_countdown_10s';
        minInterval = 200;
        break;
      case SIGNAL_EVENT_TYPES.OVERTIME_START:
      case 'match_entering_overtime':
        key = 'match_entering_overtime';
        minInterval = 1000;
        break;
      case SIGNAL_EVENT_TYPES.MATCH_ENDED:
      case SIGNAL_EVENT_TYPES.PODIUM_START:
      case 'endgame':
      case 'match_ended':
        key = 'endgame';
        minInterval = 5000;
        break;
      default:
        break;
    }
    if (key) {
      this.play(key, 1.0, minInterval);
    }
  }

  play(key, volMult = 1.0, minInterval = 0) {
    const now = performance.now();
    const effectiveMinInterval = key === 'endgame' ? Math.max(minInterval, 5000) : minInterval;
    if (effectiveMinInterval > 0) {
      const last = this.lastPlayTime.get(key) || 0;
      if (now - last < effectiveMinInterval) return;
    }
    this.lastPlayTime.set(key, now);

    const buf = this.signalBuffers.get(key);
    const pool = getAudioSlotPool();
    if (!buf || !pool) return;

    const master = audioConfig.get('masterVolume');
    const sigVol = audioConfig.get('signalVolume');
    let effectiveMult = volMult;
    if (key === 'endgame') {
      const endVol = audioConfig.get('endgameVolume') ?? 2.0;
      effectiveMult *= endVol;
    } else if (key === 'match_countdown_10s') {
      const cdVol = audioConfig.get('countdown10sVolume') ?? 1.0;
      effectiveMult *= cdVol;
    }
    const volume = Math.max(0, Math.min(5.0, effectiveMult * sigVol * master));

    pool.playBuffer(buf, {
      volume,
      priority: 8
    });
  }
}
