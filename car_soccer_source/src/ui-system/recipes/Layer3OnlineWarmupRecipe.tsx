import React, { useState, useEffect } from 'react';
import { Server, Users } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { InlineErrorNotice } from '../primitives/InlineErrorNotice';
import { DEFAULT_PANEL_SIZING, expandQuickNotificationCenter } from '../tokens';
import { useUIStore } from '../core/store';
import { roomConnectionProgress } from '../../network/RoomConnectionProgressManager.js';
import { getSignalingUrl } from '../../network/SignalingConfig.js';
import { WebSocketSignalingClient } from '../../network/WebSocketSignalingClient.js';
import { HostTab } from './online/HostTab';
import { JoinTab } from './online/JoinTab';
import {
  SignalingSettings,
  dispatchConnectionErrorNotification,
  type DiagnosticResult
} from './online/SignalingSettings';

export interface Layer3OnlineWarmupRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onHostSuccess?: (roomId: string) => void;
  onJoinSuccess?: (roomId: string) => void;
}

export const Layer3OnlineWarmupRecipe: React.FC<Layer3OnlineWarmupRecipeProps> = ({
  isLight = false,
  onBack,
  onHostSuccess,
  onJoinSuccess,
}) => {
  const { bridge, setMatchMode, setOnlineSession, onlineSession } = useUIStore();
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [roomType, setRoomType] = useState<'warmup' | 'match'>(
    () => onlineSession.roomType || 'warmup'
  );
  const [gameMode, setGameMode] = useState<'1v1' | '2v2' | '3v3'>(
    () => onlineSession.gameMode || '1v1'
  );
  const [botFillMode, setBotFillMode] = useState<'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom'>(
    () => onlineSession.botFillMode || 'no_bots'
  );

  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('car-soccer:player-name');
      if (saved?.trim()) return saved.trim();
    }
    return `Striker-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [hostRoomId, setHostRoomId] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [joinRoomId, setJoinRoomId] = useState('');

  const [signalingUrl, setCustomSignalingUrl] = useState(() => getSignalingUrl());
  const [signalingInput, setSignalingInput] = useState(() => getSignalingUrl());
  const [showSignalingConfig, setShowSignalingConfig] = useState(false);

  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null);

  const handleTestSignaling = async (targetUrl?: string) => {
    setDiagRunning(true);
    setDiagResult(null);
    try {
      const url = targetUrl || signalingUrl;
      const res = await WebSocketSignalingClient.testConnectivity(url, 5000);
      setDiagResult(res);
    } catch (err: any) {
      console.error('[Layer3OnlineWarmupRecipe] Signaling connectivity diagnostic failed:', err);
      setDiagResult({ ok: false, rttMs: 0, error: err?.message || 'Diagnostic error' });
    } finally {
      setDiagRunning(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressState, setProgressState] = useState(() => roomConnectionProgress.getState());
  const [countdown, setCountdown] = useState(10);

  const notifyConnectionError = (summary: string, fullDetails: string) => {
    setErrorMessage(summary);
    dispatchConnectionErrorNotification(summary, fullDetails);
  };

  useEffect(() => {
    const unsub = roomConnectionProgress.subscribe((state: any) => {
      setProgressState({ ...state });
      if (state.isError) {
        setIsLoading(false);
        const errorText = state.error?.message || state.stepName || 'Connection failed.';
        notifyConnectionError(errorText, JSON.stringify(state, null, 2));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setCountdown(10);
      return;
    }
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleRandomizeHostCode = () => {
    setHostRoomId(String(Math.floor(1000 + Math.random() * 9000)));
  };

  const handleStartHosting = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a valid player name.');
      return;
    }

    const trimmedRoom = hostRoomId.trim();
    if (!trimmedRoom) {
      setErrorMessage('Please enter a room code.');
      return;
    }

    if (!/^[\x21-\x7E]+$/.test(trimmedRoom)) {
      setErrorMessage('Room code only supports English letters, numbers, and symbols (no Chinese or non-English characters).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    roomConnectionProgress.startHost();

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('car-soccer:player-name', trimmedName);
      }

      const effectiveGameMode = roomType === 'match' ? gameMode : '3v3';
      let success = true;
      if (bridge.onHostOnlineWarmup) {
        success = await bridge.onHostOnlineWarmup({
          roomId: trimmedRoom,
          playerName: trimmedName,
          roomType,
          gameMode: effectiveGameMode,
          botFillMode,
          durationSeconds: 300,
          lobbyMode: roomType === 'match',
        });
      }

      if (success) {
        setOnlineSession({
          isHosting: true,
          roomId: trimmedRoom,
          playerName: trimmedName,
          signalingConnected: true,
          roomType,
          gameMode: effectiveGameMode,
          botFillMode,
          matchDurationSeconds: 300,
          connectedPeers: [],
        });
        setMatchMode('online-warmup');
        onHostSuccess?.(trimmedRoom);
      } else {
        notifyConnectionError(
          'Failed to bind to signaling server.',
          'The signaling server did not accept the host registration. Please verify signaling URL and network connectivity.'
        );
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[Layer3OnlineWarmupRecipe] Error creating online host:', err);
      notifyConnectionError('Error creating online host.', err?.stack || err?.message || String(err));
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a valid player name.');
      return;
    }

    const trimmedRoom = joinRoomId.trim();
    if (!trimmedRoom) {
      setErrorMessage('Please enter a room code.');
      return;
    }

    if (!/^[\x21-\x7E]+$/.test(trimmedRoom)) {
      setErrorMessage('Room code only supports English letters, numbers, and symbols (no Chinese or non-English characters).');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    roomConnectionProgress.startJoin();

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('car-soccer:player-name', trimmedName);
      }

      let success = true;
      if (bridge.onJoinOnlineWarmup) {
        success = await bridge.onJoinOnlineWarmup({
          roomId: trimmedRoom,
          playerName: trimmedName,
        });
      }

      if (success) {
        setOnlineSession({
          isHosting: false,
          roomId: trimmedRoom,
          playerName: trimmedName,
          signalingConnected: true,
          connectedPeers: [{ id: 'host', name: 'Room Host', pingMs: 15 }],
        });
        setMatchMode('online-warmup');
        onJoinSuccess?.(trimmedRoom);
      } else {
        notifyConnectionError(
          'Could not find room or host failed to respond within 10s.',
          `Failed to connect to room "${trimmedRoom}". The host may be offline, the room code may be incorrect, or the WebRTC peer negotiation timed out.`
        );
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[Layer3OnlineWarmupRecipe] Error joining online room:', err);
      notifyConnectionError('Error connecting to online room.', err?.stack || err?.message || String(err));
      setIsLoading(false);
    }
  };

  const totalSteps = activeTab === 'host' ? 5 : 6;
  const currentStep = progressState.currentStep > 0 ? progressState.currentStep : 1;
  const stepPercentage = Math.max(12, Math.min(100, progressState.percentage || Math.round((currentStep / totalSteps) * 100)));
  const sizing = DEFAULT_PANEL_SIZING['layer3-online-warmup'];
  const showError = Boolean(errorMessage);

  const handleCheckNotificationClick = () => {
    expandQuickNotificationCenter();
  };

  return (
    <PanelContainer
      isLight={isLight}
      sizing={sizing}
      className="w-full shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85)]"
    >
      <PanelHeader
        isLight={isLight}
        title={roomType === 'match' ? "MULTIPLAYER MATCH" : "ONLINE WARMUP"}
        subtitle={
          roomType === 'match'
            ? "Authoritative 120Hz WebRTC match lobby & ruleset"
            : "Dedicated 120Hz WebRTC multi-client warmup arena"
        }
        onBack={onBack}
      />

      <PanelContent
        scrollable={true}
        className={`px-5 flex flex-col transition-all duration-150 ${
          showError ? 'py-3 gap-2.5' : 'py-5 gap-3.5'
        }`}
      >
        <InlineErrorNotice
          visible={showError}
          message={errorMessage || 'Something went wrong.'}
          isLight={isLight}
          onCheckNotification={handleCheckNotificationClick}
        />

        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-neutral-900/60 border border-neutral-800">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setActiveTab('host');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'host'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Host a Room</span>
          </button>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setActiveTab('join');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              activeTab === 'join'
                ? 'bg-sky-500 text-white shadow-2xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Join a Room</span>
          </button>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <label className="text-neutral-400 font-semibold font-mono text-[11px]">
            YOUR PLAYER NAME:
          </label>
          <input
            type="text"
            disabled={isLoading}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={18}
            className={`w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none transition-all ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-sky-500'
                : 'bg-neutral-850 border-neutral-700 text-neutral-100 focus:border-sky-500'
            }`}
          />
        </div>

        {activeTab === 'host' && (
          <HostTab
            isLight={isLight}
            isLoading={isLoading}
            hostRoomId={hostRoomId}
            onChangeHostRoomId={setHostRoomId}
            onRandomizeHostCode={handleRandomizeHostCode}
            onStartHosting={handleStartHosting}
            currentStep={currentStep}
            totalSteps={totalSteps}
            countdown={countdown}
            stepName={progressState.stepName}
            stepPercentage={stepPercentage}
            roomType={roomType}
            onChangeRoomType={setRoomType}
            gameMode={gameMode}
            onChangeGameMode={setGameMode}
            botFillMode={botFillMode}
            onChangeBotFillMode={setBotFillMode}
          />
        )}

        {activeTab === 'join' && (
          <JoinTab
            isLight={isLight}
            isLoading={isLoading}
            joinRoomId={joinRoomId}
            onChangeJoinRoomId={setJoinRoomId}
            onJoinRoom={handleJoinRoom}
            currentStep={currentStep}
            totalSteps={totalSteps}
            countdown={countdown}
            stepName={progressState.stepName}
            stepPercentage={stepPercentage}
          />
        )}
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <SignalingSettings
          signalingUrl={signalingUrl}
          signalingInput={signalingInput}
          showSignalingConfig={showSignalingConfig}
          diagRunning={diagRunning}
          diagResult={diagResult}
          onToggleConfig={() => setShowSignalingConfig(!showSignalingConfig)}
          onChangeSignalingInput={setSignalingInput}
          onApplySignalingUrl={(url) => {
            setCustomSignalingUrl(url);
            setSignalingInput(url);
            setShowSignalingConfig(false);
          }}
          onTestSignaling={handleTestSignaling}
        />
      </PanelFooter>
    </PanelContainer>
  );
};
