import { useUIStore } from './store';
import { hudStore } from '../hud/hudStore';

export function createOnlineBridgeHandlers(gameRuntime: any) {
  hudStore.getState().setReplayState?.({
    onReplaySeekNormalized: (progress01: number) => {
      const ctrl = gameRuntime?.replayTimelineController;
      if (!ctrl) return;
      ctrl.seekToNormalized(progress01, gameRuntime.interpolator);
      hudStore.getState().setReplayState({
        replayProgress: ctrl.progress,
        replayFrameIndex: ctrl.currentFrameIndex,
        replayTotalFrames: ctrl.getTotalRecordedFrames()
      });
    },
    onReplayTogglePause: () => {
      const ctrl = gameRuntime?.replayTimelineController;
      if (!ctrl) return;
      const paused = ctrl.togglePause();
      hudStore.getState().setReplayState({ replayPaused: paused });
    },
    onReplayCycleSpeed: () => {
      const ctrl = gameRuntime?.replayTimelineController;
      if (!ctrl) return;
      const speed = ctrl.cyclePlaybackSpeed();
      hudStore.getState().setReplayState({ replaySpeed: speed });
    }
  });

  return {
    onHostOnlineWarmup: async (opts: any) => {
      if (!gameRuntime) return false;
      try {
        const session = gameRuntime.multiplayerSession;
        const roomConfig = {
          roomType: opts.roomType || 'warmup',
          gameMode: opts.gameMode || (opts.roomType === 'match' ? '1v1' : '3v3'),
          botFillMode: opts.botFillMode || 'no_bots',
          durationSeconds: opts.durationSeconds || 300,
          lobbyMode: Boolean(opts.lobbyMode ?? (opts.roomType === 'match')),
        };
        if (session) {
          session.playerName = opts.playerName;
          await session.startHosting(opts.roomId, '', roomConfig);
          return true;
        }
        if (typeof gameRuntime.hostOnlineServer === 'function') {
          await gameRuntime.hostOnlineServer({
            roomId: opts.roomId,
            playerName: opts.playerName,
            ...roomConfig,
          });
          return true;
        }
        return false;
      } catch (e) {
        console.error('[mountGameUI] Error hosting online warmup', e);
        return false;
      }
    },
    onJoinOnlineWarmup: async (opts: any) => {
      if (!gameRuntime) return false;
      try {
        const session = gameRuntime.multiplayerSession;
        if (session) {
          session.playerName = opts.playerName;
          return await session.joinRoom(opts.roomId, '', 10000);
        }
        if (typeof gameRuntime.joinOnlineServer === 'function') {
          await gameRuntime.joinOnlineServer({
            roomId: opts.roomId,
            playerName: opts.playerName,
          });
          return true;
        }
        return false;
      } catch (e) {
        console.error('[mountGameUI] Error joining online warmup', e);
        return false;
      }
    },
    onLeaveOnlineServer: async () => {
      if (!gameRuntime) return;
      try {
        const session = gameRuntime.multiplayerSession;
        if (session) {
          if (session.isHosting) {
            await session.stopHosting?.();
          } else {
            await session.leaveSession?.();
          }
        }
        if (typeof gameRuntime.stopOnlineServer === 'function') {
          await gameRuntime.stopOnlineServer();
        }
        useUIStore.getState().setMatchMode('freeplay');
        useUIStore.getState().setOnlineSession({
          isHosting: false,
          roomId: '',
          signalingConnected: false,
          connectedPeers: [],
          roomType: 'warmup',
          isReady: false,
        });
      } catch (e) {
        console.error('[mountGameUI] Error stopping online server', e);
      }
    },
    onRemovePlayer: async (carIndex: number) => {
      if (!gameRuntime) return;
      if (typeof gameRuntime.removeRemotePlayer === 'function') {
        await gameRuntime.removeRemotePlayer(carIndex);
      }
    },
    onReconnectSignaling: async () => {
      if (!gameRuntime) return;
      try {
        const session = gameRuntime.multiplayerSession;
        if (session) {
          if (session.isHosting) {
            session.initHostSignaling?.();
          } else if (session.joinRoomId) {
            await session.joinRoom?.(session.joinRoomId, session.joinPassword);
          }
        }
        useUIStore.getState().setOnlineSession({ signalingConnected: true });
      } catch (e) {
        console.error('[mountGameUI] Error reconnecting signaling', e);
      }
    },
    onResetBall: () => {
      if (!gameRuntime) return;
      gameRuntime.resetKickoff?.();
    },
    onForceStartOnlineMatch: (durationSeconds = 300) => {
      if (!gameRuntime) return;
      useUIStore.getState().closeMenu();
      gameRuntime.forceStartOnlineMatch?.(durationSeconds);
    },
    onSetOnlineGameMode: (gameMode: '1v1' | '2v2' | '3v3') => {
      if (!gameRuntime) return;
      gameRuntime.setOnlineGameMode?.(gameMode);
    },
    onSetOnlineBotFillMode: (botFillMode: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom') => {
      if (!gameRuntime) return;
      useUIStore.getState().setOnlineSession({ botFillMode });
      gameRuntime.setOnlineBotFillMode?.(botFillMode);
    },
    onAddOnlineBot: (team?: number) => {
      if (!gameRuntime) return;
      gameRuntime.addOnlineBot?.(team ?? null);
    },
    onSetClientReady: (ready: boolean) => {
      if (!gameRuntime) return;
      useUIStore.getState().setOnlineSession({ isReady: ready });
      gameRuntime.setClientReady?.(ready);
    },
    onVoteSkipReplay: () => {
      if (!gameRuntime) return;
      gameRuntime.voteSkipReplay?.();
    },
    onVoteRematch: (ready: boolean) => {
      if (!gameRuntime) return;
      gameRuntime.voteRematch?.(ready);
    },
    onSwitchOnlineRoleTeam: (role: 'player' | 'spectator', team: number) => {
      if (!gameRuntime) return;
      gameRuntime.switchOnlineRoleOrTeam?.(role, team);
    },
    onClockPacingModeChange: (mode: 'csts' | 'legacy') => {
      if (gameRuntime.networkReconciler) {
        gameRuntime.networkReconciler.setClockPacingMode(mode);
      }
    },
    onInputBufferTargetChange: (target: number) => {
      if (gameRuntime.networkReconciler) {
        gameRuntime.networkReconciler.setInputBufferTarget(target);
      }
    },
    onInputBufferThresholdChange: (range: [number, number]) => {
      if (gameRuntime.networkReconciler) {
        gameRuntime.networkReconciler.setInputBufferThresholds(range[0], range[1]);
      }
    }
  };
}
