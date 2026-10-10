import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, Users, Server, RotateCcw, Activity, LogOut, Wifi, WifiOff, RefreshCw, UserMinus } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { useUIStore } from '../core/store';
import { floatingStore } from '../tokens/floatingStore';
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
  const { onlineSession, setMatchMode, bridge } = useUIStore();
  const [copied, setCopied] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isHosting = onlineSession.isHosting;

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

  return (
    <PanelContainer
      isLight={isLight}
      className="w-full max-w-[440px] shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85)]"
    >
      <PanelHeader
        isLight={isLight}
        title={isHosting ? "CONFIGURE ROOM" : "ROOM INFORMATION"}
        subtitle={
          isHosting
            ? "Manage active online session & connected players"
            : "Connected to active 120Hz multiplayer session"
        }
        onBack={onBack}
      />

      <PanelContent scrollable={false} className="p-5 flex flex-col gap-4">
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

        {/* Connected Peers List */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-mono font-semibold">
            <span>PLAYERS IN ROOM</span>
            <span>{isHosting ? 1 + (onlineSession.connectedPeers?.length || 0) : 2} / 2</span>
          </div>

          <div
            className={`rounded-xl border p-2 flex flex-col gap-1.5 ${
              isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/60 border-neutral-800'
            }`}
          >
            {isHosting ? (
              <>
                {/* Host (You) */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-sky-500/10 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-sky-400" />
                    <span className="font-bold text-sky-400">
                      {onlineSession.playerName || 'Host'} (You)
                    </span>
                  </div>
                  <span className="text-[10px] text-neutral-400">0ms • Host</span>
                </div>

                {/* Peer list with Remove Button */}
                {onlineSession.connectedPeers && onlineSession.connectedPeers.length > 0 ? (
                  onlineSession.connectedPeers.map((peer) => (
                    <div
                      key={peer.id}
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
                {/* Room Host */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-800/40 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-sky-400" />
                    <span className="font-bold text-sky-400">Room Host</span>
                  </div>
                  <span className="text-[10px] text-neutral-400">Host</span>
                </div>

                {/* Client (You) */}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => bridge.onResetBall?.()}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Ball</span>
            </button>

            <button
              type="button"
              onClick={handleSpawnDiagnostics}
              className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5 text-violet-400" />
              <span>Network HUD</span>
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
