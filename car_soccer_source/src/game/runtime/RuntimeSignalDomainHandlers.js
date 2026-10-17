/**
 * RuntimeSignalDomainHandlers.js
 * Domain-specific handlers for player roster/loadout signals and match clock/pause signals.
 */

import { MATCH_SIGNALS } from '../../network/GlobalPayloadCodec.js';
import { unpackLoadoutSignalParam2 } from '../../network/MatchRosterCoordinator.js';
import { CAR_COLOR_SLOTS } from '../../entities/CarColorConstants.js';
import { hudStore } from '../../ui-system/index';

export const WIN_REASON_LABELS = Object.freeze({
  0: 'SCORE',
  1: 'POSSESSION',
  2: 'FORFEIT'
});

export function handleRuntimeRosterSignal(runtime, reconciler, sig) {
  const r = runtime;
  switch (sig.signalType) {
    case MATCH_SIGNALS.PLAYER_JOINED:
    case MATCH_SIGNALS.PLAYER_SLOT_UPDATED: {
      const carIdx = sig.param1;
      const team = sig.param2 & 0xFF;
      if (typeof carIdx === 'number' && carIdx >= 0 && carIdx < 8) {
        const preset = reconciler.carVisualPresets?.get(carIdx) || 'game-car';
        while (r.physics && r.physics.numCars <= carIdx) {
          const idx = r.physics.numCars;
          r.physics.addCar(idx === carIdx ? team : (idx % 2), reconciler.carVisualPresets?.get(idx) || 'game-car');
        }
        if (r.arena) {
          if (typeof r.arena.ensureCar === 'function') {
            r.arena.ensureCar(carIdx, team, 'game-car');
          } else {
            while (r.arena.cars.length <= carIdx) {
              r.arena.addCar(r.arena.cars.length % 2, 'game-car');
            }
          }
          r.arena.setCarTeam?.(carIdx, team);
          if (r.arena.cars[carIdx]) {
            r.arena.cars[carIdx].visible = true;
          }
        }
        if (preset) {
          r.physics?.setCarHitbox?.(carIdx, preset);
        }
      }
      return true;
    }

    case MATCH_SIGNALS.PLAYER_LOADOUT_UPDATED: {
      const carIdx = sig.param1;
      const {
        visualId,
        hitboxId,
        colorSlot: colorSlotId
      } = unpackLoadoutSignalParam2(sig.param2);

      if (typeof carIdx === 'number' && carIdx >= 0 && carIdx < 8) {
        reconciler.setCarVisualPreset?.(carIdx, visualId);
        if (r.arena && !r.arena.cars[carIdx]) {
          r.arena.ensureCar?.(carIdx, carIdx % 2, 'game-car');
        }
        const currentConfig = r.entityManager?.getVehicleConfig?.(carIdx);
        const currentVisual = currentConfig?.visual;
        const currentHitbox = currentConfig?.hitbox;
        if (currentVisual !== visualId || currentHitbox !== hitboxId) {
          if (r.entityManager) {
            r.entityManager.hotSwapVehicle(carIdx, { visual: visualId, hitbox: hitboxId });
          } else {
            r.arena?.swapCarVisual?.(carIdx, visualId);
            r.physics?.setCarHitbox?.(carIdx, hitboxId);
          }
        } else {
          r.physics?.setCarHitbox?.(carIdx, hitboxId);
        }

        if (colorSlotId >= 0 && colorSlotId < CAR_COLOR_SLOTS.length) {
          const slotObj = CAR_COLOR_SLOTS[colorSlotId] || CAR_COLOR_SLOTS.find((s) => s.id === colorSlotId);
          if (slotObj) {
            r.arena?.setCarColor?.(carIdx, slotObj.hex);
          }
        }
      }
      return true;
    }

    case MATCH_SIGNALS.PLAYER_LEFT: {
      const leftCarIndex = sig.param1;
      if (leftCarIndex >= 0 && leftCarIndex < 65535 && leftCarIndex !== r.playerCarIndex) {
        r.arena?.removeCar(leftCarIndex);
        if (r.flipResetVisuals.has(leftCarIndex)) {
          r.flipResetVisuals.get(leftCarIndex).stopVisual();
          r.flipResetVisuals.delete(leftCarIndex);
        }
      }
      return true;
    }

    default:
      return false;
  }
}

export function handleRuntimeClockAndPauseSignal(runtime, reconciler, sig, currentTick, audio) {
  const r = runtime;
  switch (sig.signalType) {
    case MATCH_SIGNALS.TIME_ALERT_60S: {
      if (r._lastAlert60Frame !== sig.frameId) {
        r._lastAlert60Frame = sig.frameId;
        audio?.play('match_60_seconds_left', 1.0, 10000);
      }
      return true;
    }

    case MATCH_SIGNALS.TIME_ALERT_30S: {
      if (r._lastAlert30Frame !== sig.frameId) {
        r._lastAlert30Frame = sig.frameId;
        audio?.play('match_30_seconds_left', 1.0, 10000);
      }
      return true;
    }

    case MATCH_SIGNALS.COUNTDOWN_10S: {
      const sec = sig.param1;
      if (sec >= 1 && sec <= 10 && r.audioLast10sCountdown !== sec) {
        r.audioLast10sCountdown = sec;
        audio?.play('match_countdown_10s', 1.0);
      }
      return true;
    }

    case MATCH_SIGNALS.CLOCK_UPDATED_SECONDS: {
      const seconds = sig.param1;
      const clockMode = sig.param2 || 0;
      const isOt = clockMode === 1;
      const isCountUpTraining = clockMode === 2 || r.match?.state?.mode !== 'match';
      const remSec = isOt ? 0 : seconds;
      const otSec = isOt ? seconds : 0;

      if (r.match) {
        r.match.state.remainingSeconds = remSec;
        r.match.state.overtime = isOt;
        r.match.state.overtimeSeconds = otSec;
      }

      hudStore.getState().setMatchState({
        remainingSeconds: remSec,
        isOvertime: isOt,
        overtimeSeconds: otSec
      });

      if (!isOt && !isCountUpTraining && !r.isPaused) {
        if (remSec === 30 && r.audioLastRemainingSec !== 30) {
          audio?.play('match_30_seconds_left', 1.0, 10000);
        }
        r.audioLastRemainingSec = remSec;

        if (remSec <= 10 && remSec >= 1) {
          if (remSec !== r.audioLast10sCountdown) {
            r.audioLast10sCountdown = remSec;
            audio?.play('match_countdown_10s', 1.0);
          }
        } else if (remSec > 10 || remSec <= 0) {
          r.audioLast10sCountdown = -1;
        }
      }
      return true;
    }

    case MATCH_SIGNALS.MATCH_PAUSED: {
      if (r.match) r.match.state.paused = true;
      hudStore.getState().setMatchState({ isPaused: true, matchPhase: 'paused' });
      return true;
    }

    case MATCH_SIGNALS.MATCH_WILL_RESUME: {
      const resumeAtTick = sig.param1;
      const remTicks = Math.max(0, resumeAtTick - currentTick);
      const remSec = Math.ceil(remTicks / 120);
      hudStore.getState().setMatchState({
        isPaused: true,
        kickoffCountdown: remSec
      });
      return true;
    }

    case MATCH_SIGNALS.MATCH_RESUMED: {
      if (r.match) {
        r.match.state.paused = false;
        if (r.match.state.phase === 'paused') {
          r.match.state.phase = 'playing';
        }
      }
      hudStore.getState().setMatchState({
        isPaused: false,
        matchPhase: r.match?.state?.phase || 'playing',
        kickoffCountdown: 0
      });
      return true;
    }

    case MATCH_SIGNALS.OVERTIME_START: {
      const wasNotOvertime = !r.match?.state?.overtime;
      if (r.match) {
        r.match.state.overtime = true;
        r.match.state.overtimeSeconds = 0;
      }
      hudStore.getState().setMatchState({
        isOvertime: true,
        overtimeSeconds: 0
      });
      if (wasNotOvertime) {
        audio?.play('match_entering_overtime', 1.0);
      }
      return true;
    }

    default:
      return false;
  }
}
