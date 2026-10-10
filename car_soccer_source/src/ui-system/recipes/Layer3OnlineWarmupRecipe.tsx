import React, { useState } from 'react';
import { ArrowLeft, Server, Users, RefreshCw, Loader2, AlertCircle, Wifi, ShieldCheck, Check, Copy } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { useUIStore } from '../core/store';

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
  const { bridge, setMatchMode, setOnlineSession } = useUIStore();
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');

  // Form states
  const [playerName, setPlayerName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('car-soccer:player-name');
      if (saved?.trim()) return saved.trim();
    }
    return `Striker-${Math.floor(1000 + Math.random() * 9000)}`;
  });

  const [hostRoomId, setHostRoomId] = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [joinRoomId, setJoinRoomId] = useState('');

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRandomizeHostCode = () => {
    setHostRoomId(String(Math.floor(1000 + Math.random() * 9000)));
  };

  const handleStartHosting = async () => {
    if (!playerName.trim()) {
      setErrorMessage('Please enter a valid player name.');
      return;
    }
    setIsLoading(true);
    setLoadingText('Initializing dedicated 120Hz host server and binding to signaling...');
    setErrorMessage(null);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('car-soccer:player-name', playerName.trim());
      }

      let success = true;
      if (bridge.onHostOnlineWarmup) {
        success = await bridge.onHostOnlineWarmup({
          roomId: hostRoomId,
          playerName: playerName.trim(),
        });
      }

      if (success) {
        setOnlineSession({
          isHosting: true,
          roomId: hostRoomId,
          playerName: playerName.trim(),
          signalingConnected: true,
          connectedPeers: [],
        });
        setMatchMode('online-warmup');
        onHostSuccess?.(hostRoomId);
      } else {
        setErrorMessage('Failed to bind to signaling server. Please check your network and try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error occurred while creating online server.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinRoomId.trim()) {
      setErrorMessage('Please enter a 4-digit room code.');
      return;
    }
    if (!playerName.trim()) {
      setErrorMessage('Please enter a valid player name.');
      return;
    }
    setIsLoading(true);
    setLoadingText('Connecting to signaling server and establishing WebRTC peer connection...');
    setErrorMessage(null);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('car-soccer:player-name', playerName.trim());
      }

      let success = true;
      if (bridge.onJoinOnlineWarmup) {
        success = await bridge.onJoinOnlineWarmup({
          roomId: joinRoomId.trim(),
          playerName: playerName.trim(),
        });
      }

      if (success) {
        setOnlineSession({
          isHosting: false,
          roomId: joinRoomId.trim(),
          playerName: playerName.trim(),
          signalingConnected: true,
          connectedPeers: [{ id: 'host', name: 'Room Host', pingMs: 15 }],
        });
        setMatchMode('online-warmup');
        onJoinSuccess?.(joinRoomId.trim());
      } else {
        setErrorMessage('Could not find room or host failed to respond. Please verify room code.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error connecting to online room.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PanelContainer
      isLight={isLight}
      className="w-full max-w-[440px] shadow-[0_0_0_1px_rgba(255,255,255,0.18),0_0_25px_rgba(0,0,0,0.85)]"
    >
      <PanelHeader
        isLight={isLight}
        title="ONLINE WARMUP"
        subtitle="Dedicated 120Hz WebRTC multi-client arena"
        onBack={onBack}
      />

      <PanelContent scrollable={false} className="p-5 flex flex-col gap-4">
        {/* Simple error dialog/banner */}
        {errorMessage && (
          <div
            className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs font-mono select-none ${
              isLight
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}
          >
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-bold block">Connection Notice</span>
              <p className="opacity-90 leading-tight mt-0.5">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab selection: Host Server vs Join Server */}
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

        {/* Player Name Field */}
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

        {/* Level 4: Host View */}
        {activeTab === 'host' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="text-neutral-400 font-semibold font-mono text-[11px]">
                  ROOM CODE:
                </label>
                <button
                  type="button"
                  onClick={handleRandomizeHostCode}
                  disabled={isLoading}
                  className="flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300 font-mono cursor-pointer"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <span>Randomize</span>
                </button>
              </div>

              <div
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border font-mono text-sm font-bold tracking-widest ${
                  isLight
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-900'
                    : 'bg-neutral-850 border-neutral-700 text-sky-400'
                }`}
              >
                <span>{hostRoomId}</span>
                <span className="text-[10px] tracking-normal font-sans text-neutral-400 font-medium">
                  Share with friends
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-neutral-400">
              Host runs an authoritative 120Hz physics server in a background Web Worker. Guests connect via WebRTC with client-side rollback reconciliation.
            </p>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleStartHosting}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm ${
                isLoading
                  ? 'bg-sky-600/60 text-white cursor-wait'
                  : 'bg-sky-500 hover:bg-sky-400 text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingText || 'Creating Room...'}</span>
                </>
              ) : (
                <>
                  <Server className="h-4 w-4" />
                  <span>Start Hosting Room</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Level 4: Join View */}
        {activeTab === 'join' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 text-xs">
              <label className="text-neutral-400 font-semibold font-mono text-[11px]">
                ENTER HOST ROOM CODE:
              </label>
              <input
                type="text"
                disabled={isLoading}
                placeholder="e.g. 4281"
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                maxLength={6}
                className={`w-full px-3 py-2.5 rounded-xl border font-mono text-base tracking-widest outline-none text-center transition-all ${
                  isLight
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-900 focus:border-sky-500'
                    : 'bg-neutral-850 border-neutral-700 text-sky-400 focus:border-sky-500'
                }`}
              />
            </div>

            <p className="text-[11px] leading-relaxed text-neutral-400">
              Connect to host's room code via signaling server. Full predictive vehicle physics and network smoothing will be enabled.
            </p>

            <button
              type="button"
              disabled={isLoading}
              onClick={handleJoinRoom}
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-sm ${
                isLoading
                  ? 'bg-sky-600/60 text-white cursor-wait'
                  : 'bg-sky-500 hover:bg-sky-400 text-white'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingText || 'Joining Room...'}</span>
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  <span>Join Room</span>
                </>
              )}
            </button>
          </div>
        )}
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center justify-between w-full text-[11px] text-neutral-400 font-mono">
          <span>Signaling: WebSocket P2P</span>
          <span>120Hz Sub-Tick</span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
