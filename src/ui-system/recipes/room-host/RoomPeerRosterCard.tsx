import React from 'react';
import { Server, Users, UserMinus } from 'lucide-react';
import { useAppStore } from '../../../stores/appStore';

export interface RoomPeerRosterCardProps {
  isLight: boolean;
  isHosting: boolean;
  maxPlayers: number;
}

export const RoomPeerRosterCard: React.FC<RoomPeerRosterCardProps> = ({
  isLight,
  isHosting,
  maxPlayers,
}) => {
  const { onlineSession, bridge } = useAppStore();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-neutral-400 font-mono font-semibold">
        <span>PLAYERS IN ROOM</span>
        <span>
          {isHosting ? 1 + (onlineSession.connectedPeers?.length || 0) : 2} / {maxPlayers}
        </span>
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
  );
};
