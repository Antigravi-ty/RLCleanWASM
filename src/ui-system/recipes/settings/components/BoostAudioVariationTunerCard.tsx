import React from 'react';
import { Flame, Volume2, RotateCcw, Check } from 'lucide-react';
import {
  audioConfig,
  BOOST_AUDIO_VARIATIONS,
  DEFAULT_BOOST_VARIATION,
  setBoostStartVariation,
  setBoostLoopVariation,
  setBoostEndVariation,
  setAllBoostAudioVariations,
} from '../../../../config/audioConfig.js';
import { gameAudio } from '../../../../audio/GameAudioEngineFacade.js';

export interface BoostAudioVariationTunerCardProps {
  isLight?: boolean;
  onHover?: (desc: string) => void;
  onLeave?: () => void;
}

type BoostPhase = 'start' | 'loop' | 'end';

export const BoostAudioVariationTunerCard: React.FC<BoostAudioVariationTunerCardProps> = ({
  isLight = false,
  onHover,
  onLeave,
}) => {
  const [startVar, setStartVar] = React.useState<string>(
    () => String(audioConfig.get('boostStartVariation') || DEFAULT_BOOST_VARIATION)
  );
  const [loopVar, setLoopVar] = React.useState<string>(
    () => String(audioConfig.get('boostLoopVariation') || DEFAULT_BOOST_VARIATION)
  );
  const [endVar, setEndVar] = React.useState<string>(
    () => String(audioConfig.get('boostEndVariation') || DEFAULT_BOOST_VARIATION)
  );

  React.useEffect(() => {
    const syncFromConfig = () => {
      setStartVar(String(audioConfig.get('boostStartVariation') || DEFAULT_BOOST_VARIATION));
      setLoopVar(String(audioConfig.get('boostLoopVariation') || DEFAULT_BOOST_VARIATION));
      setEndVar(String(audioConfig.get('boostEndVariation') || DEFAULT_BOOST_VARIATION));
    };
    return audioConfig.subscribe(syncFromConfig);
  }, []);

  const handleSelectPhase = (variationId: string, phase: BoostPhase) => {
    if (phase === 'start') {
      setStartVar(variationId);
      setBoostStartVariation(variationId);
    } else if (phase === 'loop') {
      setLoopVar(variationId);
      setBoostLoopVariation(variationId);
    } else {
      setEndVar(variationId);
      setBoostEndVariation(variationId);
    }
    gameAudio?.previewBoostVariation?.(variationId, phase);
  };

  const handleSelectAllForRow = (variationId: string) => {
    setStartVar(variationId);
    setLoopVar(variationId);
    setEndVar(variationId);
    setAllBoostAudioVariations(variationId);
    gameAudio?.previewBoostVariation?.(variationId, 'start');
  };

  const isAllDefaultRush =
    startVar === DEFAULT_BOOST_VARIATION &&
    loopVar === DEFAULT_BOOST_VARIATION &&
    endVar === DEFAULT_BOOST_VARIATION;

  return (
    <div
      className={`w-full p-2.5 rounded-xl border select-none flex flex-col gap-2 ${
        isLight
          ? 'bg-neutral-50/80 border-neutral-200'
          : 'bg-neutral-850/80 border-neutral-700/80'
      }`}
      onMouseEnter={() =>
        onHover?.(
          'Boost Audio Variation Tuner: Mix and match Start, Loop, and End samples across 7 boost audio variations (Default: Rush).'
        )
      }
      onMouseLeave={() => onLeave?.()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5 border-b border-neutral-700/30">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-semibold truncate ${
                  isLight ? 'text-neutral-800' : 'text-neutral-200'
                }`}
              >
                Boost Audio Variation Tuner
              </span>
              <span
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                  isLight
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}
              >
                7 Sets · M4A
              </span>
            </div>
            <span
              className={`text-[10px] mt-0.5 truncate ${
                isLight ? 'text-neutral-500' : 'text-neutral-400'
              }`}
            >
              Select one variation per column (Start / Loop / End) · Click cell to preview
            </span>
          </div>
        </div>

        {!isAllDefaultRush && (
          <button
            type="button"
            onClick={() => handleSelectAllForRow(DEFAULT_BOOST_VARIATION)}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
            }`}
            title="Reset Start, Loop, and End to Rush"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            <span>Reset Rush</span>
          </button>
        )}
      </div>

      {/* Matrix Table: Rows = Variations, Columns = Start | Loop | End */}
      <div
        className={`w-full rounded-lg border overflow-hidden ${
          isLight ? 'border-neutral-200 bg-white/80' : 'border-neutral-800 bg-neutral-900/60'
        }`}
      >
        {/* Table Column Headers */}
        <div
          className={`grid grid-cols-[1.35fr_1fr_1fr_1fr_auto] items-center px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider border-b ${
            isLight
              ? 'bg-neutral-100/90 border-neutral-200 text-neutral-500'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400'
          }`}
        >
          <span className="text-left">Variation</span>
          <span className="text-center">Start</span>
          <span className="text-center">Loop</span>
          <span className="text-center">End</span>
          <span className="text-right pr-1">Preset</span>
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-neutral-700/20">
          {BOOST_AUDIO_VARIATIONS.map((v) => {
            const isStartSelected = startVar === v.id;
            const isLoopSelected = loopVar === v.id;
            const isEndSelected = endVar === v.id;
            const isFullRowSelected = isStartSelected && isLoopSelected && isEndSelected;

            const renderPhaseCell = (phase: BoostPhase, selected: boolean, phaseLabel: string) => (
              <div className="px-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleSelectPhase(v.id, phase)}
                  aria-pressed={selected}
                  className={`w-full py-1 px-2 rounded-md text-[10px] font-medium border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    selected
                      ? isLight
                        ? 'bg-amber-500/20 border-amber-500 text-amber-900 font-bold shadow-xs'
                        : 'bg-amber-500/20 border-amber-400/80 text-amber-300 font-semibold shadow-xs'
                      : isLight
                        ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200/90 text-neutral-500 hover:text-neutral-800'
                        : 'bg-neutral-850/60 hover:bg-neutral-800 border-neutral-700/50 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 transition-colors ${
                      selected
                        ? 'bg-amber-400'
                        : isLight
                          ? 'bg-neutral-300'
                          : 'bg-neutral-600'
                    }`}
                  />
                  <span>{phaseLabel}</span>
                  {selected && <Volume2 className="h-2.5 w-2.5 opacity-80 shrink-0" />}
                </button>
              </div>
            );

            return (
              <div
                key={v.id}
                className={`grid grid-cols-[1.35fr_1fr_1fr_1fr_auto] items-center px-2.5 py-1.5 transition-colors ${
                  isFullRowSelected
                    ? isLight
                      ? 'bg-amber-500/5'
                      : 'bg-amber-500/[0.04]'
                    : isLight
                      ? 'hover:bg-neutral-50'
                      : 'hover:bg-neutral-850/40'
                }`}
              >
                {/* Row Label */}
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span
                    className={`text-[11px] font-semibold truncate ${
                      isStartSelected || isLoopSelected || isEndSelected
                        ? isLight
                          ? 'text-neutral-900'
                          : 'text-neutral-100'
                        : isLight
                          ? 'text-neutral-600'
                          : 'text-neutral-400'
                    }`}
                  >
                    {v.label}
                  </span>
                  {v.id === DEFAULT_BOOST_VARIATION && (
                    <span
                      className={`text-[8px] font-mono uppercase px-1 py-0.2 rounded ${
                        isLight
                          ? 'bg-neutral-200 text-neutral-600'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      def
                    </span>
                  )}
                </div>

                {/* Start | Loop | End Radio Cells */}
                {renderPhaseCell('start', isStartSelected, 'Start')}
                {renderPhaseCell('loop', isLoopSelected, 'Loop')}
                {renderPhaseCell('end', isEndSelected, 'End')}

                {/* Row Quick-Select All Button */}
                <div className="pl-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSelectAllForRow(v.id)}
                    className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-0.5 ${
                      isFullRowSelected
                        ? isLight
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-700 font-bold'
                          : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
                        : isLight
                          ? 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-800'
                          : 'bg-neutral-800/80 hover:bg-neutral-700 border-neutral-700 text-neutral-400 hover:text-neutral-200'
                    }`}
                    title={`Use ${v.label} for Start, Loop, and End`}
                  >
                    {isFullRowSelected && <Check className="h-2.5 w-2.5" />}
                    <span>All</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
