import React from 'react';
import {
  useKickoffTrainingStore,
  KICKOFF_OVERLAY_KEY_ORDER,
  KICKOFF_SPAWNS,
  type KickoffOverlayKey,
} from '../../stores/kickoffTrainingStore';

export interface KickoffKeyboardOverlayProps {
  isLight?: boolean;
}

const LANE_META: Record<
  KickoffOverlayKey,
  {
    label: string;
    subLabel: string;
    widthClass: string;
    barColor: string;
    activeGlow: string;
  }
> = {
  Shift: {
    label: 'Shift',
    subLabel: 'Slide',
    widthClass: 'w-12',
    barColor: 'bg-amber-400/85 border-amber-300',
    activeGlow: 'border-amber-400 bg-amber-500/30 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.45)]',
  },
  Q: {
    label: 'Q',
    subLabel: 'Roll L',
    widthClass: 'w-10',
    barColor: 'bg-violet-400/85 border-violet-300',
    activeGlow: 'border-violet-400 bg-violet-500/30 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.45)]',
  },
  A: {
    label: 'A',
    subLabel: 'Left',
    widthClass: 'w-10',
    barColor: 'bg-sky-400/85 border-sky-300',
    activeGlow: 'border-sky-400 bg-sky-500/30 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.45)]',
  },
  W: {
    label: 'W',
    subLabel: 'Fwd',
    widthClass: 'w-10',
    barColor: 'bg-emerald-400/90 border-emerald-300',
    activeGlow: 'border-emerald-400 bg-emerald-500/35 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.5)]',
  },
  S: {
    label: 'S',
    subLabel: 'Back',
    widthClass: 'w-10',
    barColor: 'bg-rose-400/85 border-rose-300',
    activeGlow: 'border-rose-400 bg-rose-500/30 text-rose-200 shadow-[0_0_12px_rgba(251,113,133,0.45)]',
  },
  D: {
    label: 'D',
    subLabel: 'Right',
    widthClass: 'w-10',
    barColor: 'bg-sky-400/85 border-sky-300',
    activeGlow: 'border-sky-400 bg-sky-500/30 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.45)]',
  },
  E: {
    label: 'E',
    subLabel: 'Roll R',
    widthClass: 'w-10',
    barColor: 'bg-violet-400/85 border-violet-300',
    activeGlow: 'border-violet-400 bg-violet-500/30 text-violet-200 shadow-[0_0_12px_rgba(167,139,250,0.45)]',
  },
  Boost: {
    label: 'Boost',
    subLabel: 'Nitro',
    widthClass: 'w-13',
    barColor: 'bg-orange-400/90 border-orange-300',
    activeGlow: 'border-orange-400 bg-orange-500/35 text-orange-200 shadow-[0_0_12px_rgba(251,146,60,0.5)]',
  },
  Jump: {
    label: 'Jump',
    subLabel: 'Flip',
    widthClass: 'w-13',
    barColor: 'bg-cyan-400/90 border-cyan-200',
    activeGlow: 'border-cyan-300 bg-cyan-500/35 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.6)]',
  },
};

const LOOKAHEAD_TICKS = 76; // ~0.63s window of falling notes @ 120Hz

export const KickoffKeyboardOverlay: React.FC<KickoffKeyboardOverlayProps> = ({
  isLight = false,
}) => {
  const {
    subMode,
    spawnIndex,
    showKeyboardOverlay,
    showFallingNotes,
    wsVerticalOffsetPct,
    phase,
    episodeTick,
    countdownRemainingTicks,
    requiredKeys,
    requiredKeyStr,
    playerKeys,
    timeline,
    aiTouchTick,
    playerTouchTick,
    lastDeltaTicks,
    setSpawnIndex,
  } = useKickoffTrainingStore();

  if (!showKeyboardOverlay) return null;

  const noteBars = timeline?.noteBars || [];
  const currentTick = episodeTick;

  return (
    <div
      data-ui-element="kickoff-keyboard-overlay"
      className="flex flex-col gap-1.5 select-none pointer-events-auto"
    >
      {/* Top Status & Spawn Bar */}
      <div
        className={`flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] font-mono ${
          isLight
            ? 'bg-white/90 border-neutral-300 text-neutral-800 shadow-md'
            : 'bg-neutral-950/85 border-neutral-800 text-neutral-200 shadow-lg'
        }`}
      >
        <div className="flex items-center gap-1">
          {KICKOFF_SPAWNS.map((sp) => {
            const active = sp.index === spawnIndex;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => setSpawnIndex(sp.index)}
                title={`Switch to ${sp.label} (Hotkey ${sp.key})`}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                  active
                    ? isLight
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-white text-neutral-950 border-white shadow-xs'
                    : isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {sp.key}:{sp.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 text-[10px]">
          <span className={`font-semibold ${isLight ? 'text-sky-600' : 'text-sky-400'}`}>
            AI: {aiTouchTick ? `${(aiTouchTick / 120).toFixed(2)}s (${aiTouchTick}f)` : '--'}
          </span>
          <span className="opacity-40">|</span>
          <span
            className={
              playerTouchTick
                ? lastDeltaTicks !== null && lastDeltaTicks <= 0
                  ? isLight
                    ? 'text-emerald-600 font-bold'
                    : 'text-emerald-400 font-bold'
                  : isLight
                  ? 'text-amber-600 font-bold'
                  : 'text-amber-400 font-bold'
                : isLight
                ? 'text-neutral-500'
                : 'text-neutral-400'
            }
          >
            YOU:{' '}
            {playerTouchTick
              ? `${(playerTouchTick / 120).toFixed(2)}s (${
                  lastDeltaTicks !== null && lastDeltaTicks > 0 ? `+${lastDeltaTicks}f` : `${lastDeltaTicks}f`
                })`
              : `${(currentTick / 120).toFixed(2)}s`}
          </span>
        </div>
      </div>

      {/* Mode Prompt Banner (Easy Learning Step-Gate / Instant Wait / Realistic Countdown) */}
      {phase === 'paused-mismatch' && subMode === 'easy-learning' && (
        <div
          className={`px-3 py-1.5 rounded-xl border backdrop-blur-md font-mono text-xs font-bold flex items-center justify-between animate-pulse shadow-lg ${
            isLight
              ? 'border-amber-500/80 bg-amber-100/95 text-amber-950'
              : 'border-amber-400/70 bg-amber-500/20 text-amber-200'
          }`}
        >
          <span>EASY LEARNING PAUSED · MATCH AI KEYS:</span>
          <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 font-black">
            {requiredKeyStr}
          </span>
        </div>
      )}

      {phase === 'waiting-for-input' && subMode === 'instant' && (
        <div
          className={`px-3 py-1 rounded-xl border backdrop-blur-md font-mono text-[11px] flex items-center justify-between ${
            isLight
              ? 'border-sky-500/50 bg-sky-100/90 text-sky-900'
              : 'border-sky-500/40 bg-sky-500/15 text-sky-300'
          }`}
        >
          <span>INSTANT READY (30f SETTLED)</span>
          <span className={`font-bold ${isLight ? 'text-sky-950' : 'text-sky-200'}`}>
            Press any key to start ({requiredKeyStr})
          </span>
        </div>
      )}

      {phase === 'countdown' && subMode === 'realistic' && (
        <div
          className={`px-3 py-1 rounded-xl border backdrop-blur-md font-mono text-[11px] flex items-center justify-between ${
            isLight
              ? 'border-emerald-500/50 bg-emerald-100/90 text-emerald-900'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
          }`}
        >
          <span>REALISTIC COUNTDOWN</span>
          <span className="font-bold">
            {(countdownRemainingTicks / 120).toFixed(2)}s ({countdownRemainingTicks}f)
          </span>
        </div>
      )}

      {/* DDR Falling Note Highway */}
      {showFallingNotes && (
        <div
          className={`relative h-36 rounded-t-xl border-x border-t overflow-hidden backdrop-blur-md flex items-stretch px-2 ${
            isLight
              ? 'bg-neutral-900/85 border-neutral-700'
              : 'bg-neutral-950/80 border-neutral-800/90'
          }`}
        >
          {/* Horizontal Beat Grid Lines (every 16 ticks = 4 decisions) */}
          {[0.25, 0.5, 0.75].map((frac) => (
            <div
              key={frac}
              className="absolute left-0 right-0 border-t border-white/5 pointer-events-none"
              style={{ bottom: `${frac * 100}%` }}
            />
          ))}

          {/* Receptor Hit Line at Bottom */}
          <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-sky-400/70 shadow-[0_0_8px_rgba(56,189,248,0.8)] z-10 pointer-events-none" />

          {/* 9 Vertical Key Lanes */}
          <div className="flex items-stretch gap-1.5 w-full h-full">
            {KICKOFF_OVERLAY_KEY_ORDER.map((keyName) => {
              const meta = LANE_META[keyName];
              const laneBars = noteBars.filter(
                (b) =>
                  b.key === keyName &&
                  b.endTick > currentTick &&
                  b.startTick < currentTick + LOOKAHEAD_TICKS
              );

              return (
                <div
                  key={keyName}
                  className={`relative h-full ${meta.widthClass} border-x border-white/[0.04] bg-white/[0.01] overflow-hidden`}
                >
                  {laneBars.map((bar, idx) => {
                    const visibleStart = Math.max(bar.startTick, currentTick);
                    const visibleEnd = Math.min(bar.endTick, currentTick + LOOKAHEAD_TICKS);
                    const bottomPct = ((visibleStart - currentTick) / LOOKAHEAD_TICKS) * 100;
                    const heightPct = Math.max(
                      4,
                      ((visibleEnd - visibleStart) / LOOKAHEAD_TICKS) * 100
                    );
                    const isHittingNow = bar.startTick <= currentTick && bar.endTick > currentTick;

                    return (
                      <div
                        key={`${bar.key}-${bar.startTick}-${idx}`}
                        className={`absolute left-1 right-1 rounded-sm border ${meta.barColor} ${
                          isHittingNow ? 'brightness-125 ring-1 ring-white/80' : 'opacity-85'
                        }`}
                        style={{
                          bottom: `${bottomPct}%`,
                          height: `${heightPct}%`,
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 9-Key Receptor Row with configurable W/S Vertical Offset */}
      <div
        className={`flex items-center gap-1.5 px-2 py-3 rounded-b-xl border backdrop-blur-md ${
          !showFallingNotes ? 'rounded-t-xl' : ''
        } ${
          isLight
            ? 'bg-white/90 border-neutral-300 shadow-lg'
            : 'bg-neutral-950/90 border-neutral-800 shadow-xl'
        }`}
      >
        {KICKOFF_OVERLAY_KEY_ORDER.map((keyName) => {
          const meta = LANE_META[keyName];
          const aiActive = Boolean(requiredKeys?.[keyName]);
          const playerActive = Boolean(playerKeys?.[keyName]);
          const isMatchedActive = aiActive && playerActive;
          const isMissing = aiActive && !playerActive;
          const isExtra = !aiActive && playerActive;

          // W shifts UP by wsVerticalOffsetPct%, S shifts DOWN by wsVerticalOffsetPct%
          let verticalTransform = 'translateY(0%)';
          if (keyName === 'W') {
            verticalTransform = `translateY(-${wsVerticalOffsetPct}%)`;
          } else if (keyName === 'S') {
            verticalTransform = `translateY(${wsVerticalOffsetPct}%)`;
          }

          let boxStyle = isLight
            ? 'bg-neutral-100 border-neutral-300 text-neutral-700'
            : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-400';

          if (isMatchedActive) {
            boxStyle = isLight
              ? 'bg-emerald-500/25 border-emerald-500 text-emerald-950 shadow-[0_0_12px_rgba(16,185,129,0.35)] scale-[0.97]'
              : 'bg-emerald-500/35 border-emerald-400 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.55)] scale-[0.97]';
          } else if (isMissing) {
            boxStyle = isLight
              ? 'border-sky-500 bg-sky-500/20 text-sky-950 shadow-[0_0_10px_rgba(14,165,233,0.35)]'
              : meta.activeGlow;
          } else if (isExtra) {
            boxStyle = isLight
              ? 'bg-amber-500/25 border-amber-500 text-amber-950 shadow-[0_0_8px_rgba(245,158,11,0.3)] scale-[0.97]'
              : 'bg-amber-500/25 border-amber-400/80 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.35)] scale-[0.97]';
          }

          return (
            <div
              key={keyName}
              style={{ transform: verticalTransform }}
              className={`relative h-12 ${meta.widthClass} rounded-lg border flex flex-col items-center justify-center transition-all duration-75 font-mono ${boxStyle}`}
            >
              <span className="text-[11px] font-black leading-none tracking-tight">
                {meta.label}
              </span>
              <span className="text-[8px] uppercase opacity-70 mt-0.5 leading-none">
                {meta.subLabel}
              </span>

              {/* Small indicator dot at top-right when player is physically pressing the key */}
              {playerActive && (
                <span
                  className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${
                    aiActive
                      ? isLight
                        ? 'bg-emerald-600'
                        : 'bg-emerald-300'
                      : isLight
                      ? 'bg-amber-600'
                      : 'bg-amber-300'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
