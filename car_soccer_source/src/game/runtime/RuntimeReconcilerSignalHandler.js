import { MATCH_SIGNALS, CLIENT_COMMAND_TYPES } from '../../network/GlobalPayloadCodec.js';
import { gameAudio } from '../../audio/AudioArchitecture.js';
import { hudStore } from '../../ui-system/index';
import { eventStreamStore } from '../../ui-system/tokens/eventStreamStore';
import {
  WIN_REASON_LABELS,
  handleRuntimeRosterSignal,
  handleRuntimeClockAndPauseSignal
} from './RuntimeSignalDomainHandlers.js';

export function resetRuntimeReconcilerSignalState(runtime) {
  const r = runtime;
  if (!r) return;
  if (r._seenSignalIds instanceof Set) {
    r._seenSignalIds.clear();
  } else {
    r._seenSignalIds = new Set();
  }
  r._lastPreparedMatchSeq = -1;
  r._clientGoalIncidentLatched = false;
  r.lastKickoffTargetFrame = -1;
  if (r.latchedKickoffSeconds instanceof Set) {
    r.latchedKickoffSeconds.clear();
  } else {
    r.latchedKickoffSeconds = new Set();
  }
  r._lastKickoffStartedFrame = -1;
  r._lastAlert60Frame = -1;
  r._lastAlert30Frame = -1;
  r.audioLastRemainingSec = -1;
  r.audioLast10sCountdown = -1;
}

export function bindReconcilerSignals(runtime, reconciler) {
  const r = runtime;
  if (!reconciler) return;

  resetRuntimeReconcilerSignalState(r);

  reconciler.onSignals = (signals) => {
    const audio = r.options.gameAudio || gameAudio;
    const currentTick = reconciler.lastAckedServerTick >= 0 ? reconciler.lastAckedServerTick : (reconciler.serverTick ?? 0);

    for (const sig of signals) {
      if (!sig) continue;

      if (typeof sig.signalId === 'number' && sig.signalId > 0) {
        reconciler.acknowledgeSignal?.(sig.signalId, sig.signalType);
      }

      const isFirstSeenSignalId = !sig.signalId || !r._seenSignalIds.has(sig.signalId);
      if (sig.signalId) {
        r._seenSignalIds.add(sig.signalId);
        if (r._seenSignalIds.size > 512) {
          const oldest = r._seenSignalIds.values().next().value;
          r._seenSignalIds.delete(oldest);
        }
      }

      if (isFirstSeenSignalId) {
        eventStreamStore.addEvent({
          type: (sig.signalType || 0) | 0x80,
          impulse: sig.param1 || 0,
          speed: sig.param2 || 0,
          x: 0,
          y: 0,
          z: 0,
          tick: sig.frameId
        });
      } else if (sig.signalType !== MATCH_SIGNALS.KICKOFF_WILL_START) {
        continue;
      }

      if (handleRuntimeRosterSignal(r, reconciler, sig)) {
        continue;
      }
      if (handleRuntimeClockAndPauseSignal(r, reconciler, sig, currentTick, audio)) {
        continue;
      }

      switch (sig.signalType) {
        case MATCH_SIGNALS.COMMAND_ACK: {
          reconciler.resolveClientCommandAck?.(sig.param1);
          break;
        }

        case MATCH_SIGNALS.MATCH_PREPARE: {
          const matchSeq = sig.param1 || 1;
          r.physics?.resetGoalLatch?.();
          r.physics?.setSimulationFrozen?.(false);
          r.physics?.setUnlimitedBoost?.(false);
          r.networkManager?.setLobbyGhostMode?.(false);
          r._clientGoalIncidentLatched = false;
          r.arena?.resetBallTrail?.();

          if (r.arena) {
            r.arena.isLobbyMode = false;
          }
          if (r.match) {
            r.match.state.mode = 'match';
            r.match.state.phase = 'prepare';
            r.match.state.paused = false;
          }
          useUIStore.getState().setMatchMode('match');
          hudStore.getState().setMatchState({
            matchPhase: 'prepare',
            kickoffCountdown: 0,
            winner: null,
            winReason: null
          });

          if (r._lastPreparedMatchSeq !== matchSeq) {
            r._lastPreparedMatchSeq = matchSeq;
            reconciler.queueClientCommand?.(CLIENT_COMMAND_TYPES.CMD_ARENA_LOADED_ACK, matchSeq, 1);
          }
          break;
        }

        case MATCH_SIGNALS.MATCH_STARTED: {
          r.physics?.resetGoalLatch?.();
          r.physics?.setSimulationFrozen?.(false);
          r.physics?.setUnlimitedBoost?.(false);
          r.networkManager?.setLobbyGhostMode?.(false);
          r._clientGoalIncidentLatched = false;
          if (r.arena) {
            r.arena.isLobbyMode = false;
          }
          const durationSec = sig.param1 > 0 ? sig.param1 : 300;
          if (r.match) {
            r.match.state.mode = 'match';
            r.match.state.blueScore = 0;
            r.match.state.orangeScore = 0;
            r.match.state.remainingSeconds = durationSec;
            r.match.state.overtime = false;
            r.match.state.overtimeSeconds = 0;
            r.match.state.winner = null;
          }
          useUIStore.getState().setMatchMode('match');
          hudStore.getState().setMatchState({
            blueScore: 0,
            orangeScore: 0,
            remainingSeconds: durationSec,
            isOvertime: false,
            overtimeSeconds: 0,
            winner: null,
            winReason: null
          });
          break;
        }

        case MATCH_SIGNALS.KICKOFF_WILL_START: {
          r.physics?.resetGoalLatch?.();
          r.physics?.setSimulationFrozen?.(false);
          r.physics?.setUnlimitedBoost?.(false);
          r.networkManager?.setLobbyGhostMode?.(false);
          if (r.arena) {
            r.arena.isLobbyMode = false;
          }
          r.replayTimelineController?.endReplaySession?.();
          r.podiumController?.exitPodium?.();
          const targetFrame = sig.param1;
          reconciler.setKickoffMaskUntilTick?.(targetFrame);

          const remainingTicks = Math.max(0, targetFrame - currentTick);
          const displaySec = remainingTicks > 0 ? Math.min(3, Math.ceil(remainingTicks / 120)) : 0;

          if (r.match) {
            r.match.state.mode = 'match';
            r.match.state.phase = 'kickoff';
            r.match.state.paused = false;
            r.match.state.countdown = displaySec;
          }
          useUIStore.getState().setMatchMode('match');

          hudStore.getState().setMatchState({
            matchPhase: 'kickoff',
            kickoffCountdown: displaySec
          });

          if (r.lastKickoffTargetFrame !== targetFrame || isFirstSeenSignalId) {
            r.lastKickoffTargetFrame = targetFrame;
            r.latchedKickoffSeconds = new Set();
          }

          if (remainingTicks <= 360 && remainingTicks > 240 && !r.latchedKickoffSeconds.has(3)) {
            r.latchedKickoffSeconds.add(3);
            audio?.play('match_countdown_321', 1.0);
          } else if (remainingTicks <= 240 && remainingTicks > 120 && !r.latchedKickoffSeconds.has(2)) {
            r.latchedKickoffSeconds.add(2);
            audio?.play('match_countdown_321', 1.0);
          } else if (remainingTicks <= 120 && remainingTicks > 0 && !r.latchedKickoffSeconds.has(1)) {
            r.latchedKickoffSeconds.add(1);
            audio?.play('match_countdown_321', 1.0);
          }
          break;
        }

        case MATCH_SIGNALS.KICKOFF_START: {
          r.physics?.resetGoalLatch?.();
          r.physics?.setSimulationFrozen?.(false);
          r.replayTimelineController?.endReplaySession?.();
          r.podiumController?.exitPodium?.();
          reconciler.setKickoffMaskUntilTick?.(-1);

          const isNewKickoffStart = r._lastKickoffStartedFrame !== sig.frameId || isFirstSeenSignalId;
          r._lastKickoffStartedFrame = sig.frameId;
          r.lastKickoffTargetFrame = -1;
          r.latchedKickoffSeconds?.clear();

          if (r.match) {
            r.match.state.phase = 'playing';
            r.match.state.countdown = 0;
          }
          hudStore.getState().setMatchState({
            matchPhase: 'playing',
            kickoffCountdown: 0
          });
          if (isNewKickoffStart) {
            audio?.play('match_start_go', 1.0);
          }
          break;
        }

        case MATCH_SIGNALS.SCORE_UPDATED: {
          const bScore = sig.param1;
          const oScore = sig.param2;
          const isScoreChange = r.match?.state?.blueScore !== bScore || r.match?.state?.orangeScore !== oScore;

          if (r.match) {
            r.match.state.phase = 'goal';
            r.match.state.blueScore = bScore;
            r.match.state.orangeScore = oScore;
          }

          hudStore.getState().setMatchState({
            matchPhase: 'goal',
            blueScore: bScore,
            orangeScore: oScore
          });

          if (isScoreChange) {
            audio?.play('sfx_goal_poof', 1.0);
          }
          break;
        }

        case MATCH_SIGNALS.GOAL_REPLAY_WILL_START: {
          const scoringTeam = sig.param1 ?? 0;
          if (r.match) {
            r.match.state.phase = 'goal';
            r.match.state.scorer = scoringTeam;
          }
          hudStore.getState().setMatchState({
            matchPhase: 'goal'
          });
          break;
        }

        case MATCH_SIGNALS.GOAL_REPLAY_START: {
          r.physics?.resetGoalLatch?.();
          const replayTicks = sig.param1 > 0 ? sig.param1 : 360;
          if (r.match) {
            r.match.state.phase = 'replay';
          }
          r.replayTimelineController?.beginReplaySession?.({
            durationTicks: replayTicks,
            scoringTeam: r.match?.state?.scorer ?? 0
          });
          hudStore.getState().setMatchState({
            matchPhase: 'replay'
          });
          break;
        }

        case MATCH_SIGNALS.GOAL_REPLAY_WILL_END:
        case MATCH_SIGNALS.GOAL_REPLAY_END: {
          r.physics?.resetGoalLatch?.();
          r.physics?.setSimulationFrozen?.(false);
          r.replayTimelineController?.endReplaySession?.();
          if (r.match && r.match.state.phase === 'replay') {
            r.match.state.phase = 'kickoff';
          }
          break;
        }

        case MATCH_SIGNALS.BALL_RESET: {
          r.physics?.resetGoalLatch?.();
          r.arena?.resetBallTrail?.();
          r.replayTimelineController?.endReplaySession?.();
          r.podiumController?.exitPodium?.();
          r.lastKickoffTargetFrame = -1;
          r.latchedKickoffSeconds?.clear();
          reconciler.setKickoffMaskUntilTick?.(-1);
          if (r.match) {
            r.match.state.phase = 'playing';
            r.match.state.countdown = 0;
          }
          hudStore.getState().setMatchState({
            matchPhase: 'playing',
            kickoffCountdown: 0
          });
          break;
        }

        case MATCH_SIGNALS.MATCH_DESTROYED: {
          reconciler.setKickoffMaskUntilTick?.(-1);
          r.replayTimelineController?.endReplaySession?.();
          r.podiumController?.exitPodium?.();
          resetRuntimeReconcilerSignalState(r);
          break;
        }

        case MATCH_SIGNALS.MATCH_ENDED:
        case MATCH_SIGNALS.PODIUM_START: {
          const winningTeam = sig.param1;
          const winReasonCode = sig.param2 || 0;
          const winnerName = winningTeam === 0 ? 'BLUE' : (winningTeam === 1 ? 'ORANGE' : 'DRAW');
          const winReason = WIN_REASON_LABELS[winReasonCode] || 'SCORE';
          const targetPhase = sig.signalType === MATCH_SIGNALS.PODIUM_START ? 'podium' : 'ended';
          const wasNotEnded = r.match?.state?.phase !== 'ended' && r.match?.state?.phase !== 'podium';

          reconciler.setKickoffMaskUntilTick?.(-1);
          r.replayTimelineController?.endReplaySession?.();
          r.podiumController?.enterPodium?.(winningTeam, winReason);

          if (r.match) {
            r.match.state.phase = targetPhase;
            r.match.state.winner = winnerName;
            r.match.state.winReason = winReason;
          }

          hudStore.getState().setMatchState({
            matchPhase: targetPhase,
            winner: winnerName,
            winReason
          });

          if (wasNotEnded) {
            audio?.play('endgame', 1.0);
          }
          break;
        }

        case MATCH_SIGNALS.DEMOLITION: {
          if (isFirstSeenSignalId) {
            audio?.play('sfx_goal_poof', 1.2);
          }
          break;
        }

        default:
          break;
      }
    }
  };
}
