import React, { useState } from 'react';
import { Copy, Check, RotateCcw, Activity, LogOut, Wifi, WifiOff, RefreshCw, Play, CheckCircle2, Gauge } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { SliderControl } from '../primitives/SliderControl';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { useAppStore } from '../../stores/appStore';
import { floatingStore } from '../../stores/floatingStore';
import { networkDiagnosticsStore, useNetworkDiagnosticsData } from '../../stores/networkDiagnosticsStore';
import { NETWORK_DIAGNOSTICS_PRESET } from '../../stores/floatingPresets';
import { RoomPeerRosterCard } from './room-host/RoomPeerRosterCard';

export interface Layer2RoomHostControlRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onLeaveRoom?: () => void;
}

export const Layer2RoomHostControlRecipe: React.FC<Layer2RoomHostControlRecipeProps> = ({
  isLight = false,
  onBack,
  onLeaveRoom,
}) => {
  const { onlineSession, setOnlineSession, setMatchMode, bridge } = useAppStore();
  const diagData = useNetworkDiagnosticsData();
  const [copied, setCopied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isHosting = onlineSession.isHosting;
  const isMatchRoom = onlineSession.roomType === 'match';
  const currentGameMode = onlineSession.gameMode || '1v1';
  const currentBotFillMode = onlineSession.botFillMode || 'no_bots';
  const currentMatchDuration = onlineSession.matchDurationSeconds ?? 300;
  const maxPlayers = currentGameMode === '1v1' ? 2 : currentGameMode === '2v2' ? 4 : 6;

  const formatDurationLabel = (sec: number) => {
    if (sec === 0) return '0s • Direct Overtime';
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(onlineSession.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Could not copy room id to clipboard', e);
    }
  };

  const handleLeaveOrStop = async () => {
    if (bridge.onLeaveOnlineServer) {
      await bridge.onLeaveOnlineServer();
    }
    setMatchMode('freeplay');
    onLeaveRoom?.();
  };

  const handleReconnectSignaling = async () => {
    setIsReconnecting(true);
    try {
      if (bridge.onReconnectSignaling) {
        await bridge.onReconnectSignaling();
      }
    } finally {
      setTimeout(() => setIsReconnecting(false), 800);
    }
  };

  const handleSpawnDiagnostics = () => {
    floatingStore.spawnWindow({
      ...NETWORK_DIAGNOSTICS_PRESET,
      startMinimized: false,
    });
  };

  const zeroGFleetActive = Boolean(diagData?.metrics?.zeroGFleetEnabled);
  const handleToggleZeroGFleet = async () => {
    await networkDiagnosticsStore.toggleZeroGFleet();
  };

  const handleSelectGameMode = (mode: '1v1' | '2v2' | '3v3') => {
    setOnlineSession({ roomType: 'match', gameMode: mode });
    bridge.onSetOnlineGameMode?.(mode);
  };

  const handleSelectBotFillMode = (mode: 'no_bots' | 'auto_fill' | 'bots_vs_humans' | 'custom') => {
    setOnlineSession({ botFillMode: mode });
    bridge.onSetOnlineBotFillMode?.(mode);
  };

  const handleSelectMatchDuration = (seconds: number) => {
    const cleanSec = Math.max(0, Math.round(seconds));
    setOnlineSession({ matchDurationSeconds: cleanSec });
    bridge.onSetOnlineMatchDuration?.(cleanSec);
  };

  const handleStartMatch = () => {
    setOnlineSession({ roomType: 'match' });
    bridge.onForceStartOnlineMatch?.(currentMatchDuration);
  };

  const handleToggleReady = () => {
    const nextReady = !onlineSession.isReady;
    bridge.onSetClientReady?.(nextReady);
  };

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer2-room-host-control']}
      className="w-full shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85)]"
    >
      <PanelHeader
        isLight={isLight}
        title={isHosting ? "CONFIGURE ROOM" : "ROOM INFORMATION"}
        subtitle={
          isHosting
            ? isMatchRoom
              ? "Match Admin • Lobby Ghost Warmup & Match Control"
              : "Online Warmup • Shared Custom Training Arena"
            : "Connected to active 120Hz multiplayer session"
        }
        onBack={onBack}
      />

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-3.5">
        {/* Room Code Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between font-mono ${
            isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-850 border-neutral-700'
          }`}
        >
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">
              ROOM CODE
            </span>
            <span className="text-xl font-black text-sky-400 tracking-wider">
              {onlineSession.roomId || '----'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopyRoomId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : isLight
                ? 'bg-white hover:bg-neutral-50 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-200'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Signaling Status Badge & Reconnect Button */}
        <div
          className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs font-mono ${
            onlineSession.signalingConnected
              ? isLight
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400'
              : isLight
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {onlineSession.signalingConnected ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-500" />
            )}
            <span>
              {onlineSession.signalingConnected
                ? 'Signaling Server Connected'
                : 'Signaling Disconnected'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReconnectSignaling}
              title="Reconnect Signaling Server"
              className={`p-1 rounded transition-transform cursor-pointer ${
                isReconnecting ? 'animate-spin text-sky-400' : 'hover:scale-110 text-neutral-400 hover:text-sky-400'
              }`}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] opacity-75 font-bold uppercase">
              {isHosting ? 'Host' : 'Client'}
            </span>
          </div>
        </div>

        {/* Match Admin / Team & Ready Controls */}
        {isHosting ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono font-semibold">
              <span>MATCH FORMAT & BOT POLICY</span>
              <span className="text-[10px] text-sky-400">
                {isMatchRoom ? 'Multiplayer Match' : 'Warmup Freeplay'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['1v1', '2v2', '3v3'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSelectGameMode(mode)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-bold font-mono cursor-pointer transition-all ${
                    isMatchRoom && currentGameMode === mode
                      ? 'bg-sky-500 text-white border-sky-400'
                      : isLight
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {mode === '1v1' ? '1v1 Duel' : mode === '2v2' ? '2v2 Doubles' : '3v3 Standard'}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'no_bots', label: 'No Bots' },
                { id: 'auto_fill', label: 'Auto-Fill' },
                { id: 'bots_vs_humans', label: 'Vs AI' },
                { id: 'custom', label: 'Custom' },
              ].map((policy) => (
                <button
                  key={policy.id}
                  type="button"
                  onClick={() => handleSelectBotFillMode(policy.id as any)}
                  className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold font-mono cursor-pointer transition-all ${
                    currentBotFillMode === policy.id
                      ? 'bg-violet-500 text-white border-violet-400'
                      : isLight
                      ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {policy.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => bridge.onAddOnlineBot?.(0)}
                className="py-1 px-2 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-[10px] font-bold font-mono cursor-pointer transition-all"
              >
                + Bot (Blue Team)
              </button>
              <button
                type="button"
                onClick={() => bridge.onAddOnlineBot?.(1)}
                className="py-1 px-2 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[10px] font-bold font-mono cursor-pointer transition-all"
              >
                + Bot (Orange Team)
              </button>
            </div>

            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono font-semibold">
                <span>MATCH DURATION (0s = DIRECT OVERTIME)</span>
                <span className="text-[10px] text-amber-400 font-bold">
                  {formatDurationLabel(currentMatchDuration)}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[
                  { sec: 0, label: '0s (OT)' },
                  { sec: 1, label: '1s' },
                  { sec: 3, label: '3s' },
                  { sec: 5, label: '5s' },
                  { sec: 90, label: '1:30' },
                  { sec: 300, label: '5:00' },
                ].map((preset) => (
                  <button
                    key={preset.sec}
                    type="button"
                    onClick={() => handleSelectMatchDuration(preset.sec)}
                    className={`py-1 px-1 rounded-lg border text-[10px] font-bold font-mono cursor-pointer transition-all ${
                      currentMatchDuration === preset.sec
                        ? 'bg-amber-500 text-neutral-950 border-amber-400'
                        : isLight
                        ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div
                className={`p-2 rounded-lg border ${
                  isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/70 border-neutral-800'
                }`}
              >
                <SliderControl
                  label="Short Test / Custom Duration (s)"
                  description="Slider 0–5s; type any custom value in box & press Enter / unfocus"
                  value={currentMatchDuration}
                  min={0}
                  max={5}
                  step={1}
                  unit="s"
                  editable={true}
                  allowOutOfBoundsInput={true}
                  showStepper={true}
                  colorScheme="amber"
                  isLight={isLight}
                  onChange={(val) => handleSelectMatchDuration(val)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-neutral-400 font-mono font-semibold">
              <span>TEAM & ROLE</span>
              <span className="text-[10px] text-emerald-400">
                {onlineSession.isReady ? 'READY' : 'WARMING UP'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => bridge.onSwitchOnlineRoleTeam?.('player', 0)}
                className="py-1.5 px-2 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 text-xs font-bold font-mono cursor-pointer transition-all"
              >
                Join Blue
              </button>
              <button
                type="button"
                onClick={() => bridge.onSwitchOnlineRoleTeam?.('player', 1)}
                className="py-1.5 px-2 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold font-mono cursor-pointer transition-all"
              >
                Join Orange
              </button>
              <button
                type="button"
                onClick={() => bridge.onSwitchOnlineRoleTeam?.('spectator', 0)}
                className={`py-1.5 px-2 rounded-lg border text-xs font-bold font-mono cursor-pointer transition-all ${
                  isLight
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-700 hover:bg-neutral-200'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                Spectate
              </button>
            </div>
          </div>
        )}

        {/* Connected Peers List */}
        <RoomPeerRosterCard
          isLight={isLight}
          isHosting={isHosting}
          maxPlayers={maxPlayers}
        />

        {/* Room Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {isHosting ? (
            <button
              type="button"
              onClick={handleStartMatch}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start {currentGameMode} Match ({formatDurationLabel(currentMatchDuration)})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleReady}
              className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 ${
                onlineSession.isReady
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-sky-500 hover:bg-sky-400 border-sky-400 text-white'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{onlineSession.isReady ? 'Ready (Click to Unready)' : 'Mark Ready for Match'}</span>
            </button>
          )}

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleToggleZeroGFleet}
              title="Spawn/Despawn 3-Car 0G Deterministic Probe Fleet"
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                zeroGFleetActive
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <Gauge className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{zeroGFleetActive ? 'Probes: ON' : '0G Probes'}</span>
            </button>

            <button
              type="button"
              onClick={() => networkDiagnosticsStore.toggleTestCarAudio()}
              title="Enable/Disable Test Car Audio"
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                diagData?.metrics?.testCarAudioEnabled
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <span className="truncate">
                {diagData?.metrics?.testCarAudioEnabled ? 'Test SFX: ON' : 'Test SFX: OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => bridge.onResetBall?.()}
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Reset Ball</span>
            </button>

            <button
              type="button"
              onClick={handleSpawnDiagnostics}
              className={`py-2 px-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span className="truncate">Net HUD</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleLeaveOrStop}
            className="w-full py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <LogOut className="h-4 w-4" />
            <span>{isHosting ? 'Stop Server & Return to Freeplay' : 'Leave Room & Return to Freeplay'}</span>
          </button>
        </div>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center justify-between w-full text-[11px] text-neutral-400 font-mono">
          <span>Authoritative 120Hz</span>
          <span>RocketSim Bit-Exact</span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
