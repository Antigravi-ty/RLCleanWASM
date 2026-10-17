import React, { useState } from 'react';
import { Copy, Check, Users, Server, RotateCcw, Activity, LogOut, Wifi, WifiOff, RefreshCw, UserMinus, Play, CheckCircle2, Gauge } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { useUIStore } from '../core/store';
import { floatingStore } from '../tokens/floatingStore';
import { networkDiagnosticsStore, useNetworkDiagnosticsData } from '../tokens/networkDiagnosticsStore';
import { NETWORK_DIAGNOSTICS_PRESET } from '../tokens/floatingPresets';

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
  const { onlineSession, setOnlineSession, setMatchMode, bridge } = useUIStore();
  const diagData = useNetworkDiagnosticsData();
  const [copied, setCopied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isHosting = onlineSession.isHosting;
  const isMatchRoom = onlineSession.roomType === 'match';
  const currentGameMode = onlineSession.gameMode || '1v1';
  const currentBotFillMode = onlineSession.botFillMode || 'no_bots';
  const maxPlayers = currentGameMode === '1v1' ? 2 : currentGameMode === '2v2' ? 4 : 6;

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

  const handleStartMatch = () => {
    setOnlineSession({ roomType: 'match' });
    bridge.onForceStartOnlineMatch?.(onlineSession.matchDurationSeconds || 300);
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono font-semibold">
            <span>PLAYERS IN ROOM</span>
            <span>{isHosting ? 1 + (onlineSession.connectedPeers?.length || 0) : 2} / {maxPlayers}</span>
          </div>

          <div
            className={`rounded-xl border p-2 flex flex-col gap-1.5 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            {isHosting ? (
              <>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-sky-500/10 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-sky-400" />
                    <span className="font-bold text-sky-400">
                      {onlineSession.playerName || 'Host'} (You)
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400">0ms • Host</span>
                </div>

                {onlineSession.connectedPeers && onlineSession.connectedPeers.length > 0 ? (
                  onlineSession.connectedPeers.map((peer, idx) => (
                    <div
                      key={peer.id || `peer_${peer.carIndex ?? idx}`}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-800/40 text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-neutral-200">{peer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-emerald-400">{peer.pingMs}ms</span>
                        <button
                          type="button"
                          onClick={() => bridge.onRemovePlayer?.(peer.carIndex ?? 1)}
                          title="Remove Player"
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-semibold cursor-pointer transition-all"
                        >
                          <UserMinus className="h-3 w-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-2.5 py-2 text-center text-xs text-neutral-500 font-mono">
                    Waiting for remote peer to connect...
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-800/40 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-sky-400" />
                    <span className="font-bold text-sky-400">Room Host</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">Host</span>
                </div>

                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-bold text-emerald-400">
                      {onlineSession.playerName || 'Player 2'} (You)
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    {onlineSession.connectedPeers?.[0]?.pingMs ?? 15}ms • Client
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Room Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {isHosting ? (
            <button
              type="button"
              onClick={handleStartMatch}
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>Start {currentGameMode} Match (5:00)</span>
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

          <div className="grid grid-cols-3 gap-2">
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
