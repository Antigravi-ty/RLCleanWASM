import React from 'react';
import { Zap, Play } from 'lucide-react';
import {
  useDevTestLabStore,
  type KickoffDuelModelId,
} from '../../../stores/devTestLabStore';
import { PRECOMPUTED_MATRIX_RESULTS } from '../../../config/kickoffDuelConfig.js';
import { Button } from '../../primitives/Button';

export interface KickoffDuelMatrixCardProps {
  isLight: boolean;
  cardBg: string;
  subPanelBg: string;
}

export const KickoffDuelMatrixCard: React.FC<KickoffDuelMatrixCardProps> = ({
  isLight,
  cardBg,
  subPanelBg,
}) => {
  const {
    kickoffDuelBlueModel,
    kickoffDuelOrangeModel,
    kickoffDuelSlotIndex,
    kickoffDuelBenchmarkRunning,
    kickoffDuelMatrixResults,
    setKickoffDuelModels,
    setKickoffDuelSlotIndex,
    runKickoffDuelBenchmark,
  } = useDevTestLabStore();

  const matrixToShow =
    kickoffDuelMatrixResults && kickoffDuelMatrixResults.length > 0
      ? kickoffDuelMatrixResults
      : PRECOMPUTED_MATRIX_RESULTS;

  return (
    <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-400" />
          <span className="font-semibold text-[11px]">
            All 10 Pairings × 5 Slots Matrix (Click Any Cell to Watch in 3D)
          </span>
        </div>
        <Button
          variant="primary"
          size="sm"
          disabled={kickoffDuelBenchmarkRunning}
          onClick={() => runKickoffDuelBenchmark()}
          isLight={isLight}
          className="gap-1 px-2 py-0.5 text-[10px]"
        >
          <Play className="h-3 w-3 fill-current" />
          <span>
            {kickoffDuelBenchmarkRunning ? 'Simulating 50 Duels...' : 'Re-Run 50 Duels'}
          </span>
        </Button>
      </div>

      <div className={`rounded-lg border overflow-x-auto max-h-52 overflow-y-auto ${subPanelBg}`}>
        <table className="w-full text-[9.5px] font-mono border-collapse">
          <thead>
            <tr
              className={`border-b sticky top-0 ${
                isLight ? 'border-neutral-200 bg-neutral-100' : 'border-neutral-800 bg-neutral-900'
              }`}
            >
              <th className="py-1 px-1.5 text-left">Matchup (Blue vs Orange)</th>
              <th className="py-1 px-1 text-center">DR</th>
              <th className="py-1 px-1 text-center">DL</th>
              <th className="py-1 px-1 text-center">BR</th>
              <th className="py-1 px-1 text-center">BL</th>
              <th className="py-1 px-1 text-center">CT</th>
              <th className="py-1 px-1.5 text-right">W-L-T</th>
            </tr>
          </thead>
          <tbody>
            {matrixToShow.map((row) => {
              const isCurrentPair =
                row.blue === kickoffDuelBlueModel && row.orange === kickoffDuelOrangeModel;
              return (
                <tr
                  key={row.pairId}
                  className={`border-b last:border-b-0 ${
                    isLight ? 'border-neutral-200/60' : 'border-neutral-800/60'
                  } ${isCurrentPair ? 'bg-sky-500/10' : ''}`}
                >
                  <td
                    className="py-1 px-1.5 font-semibold cursor-pointer hover:underline whitespace-nowrap"
                    onClick={() =>
                      setKickoffDuelModels(
                        row.blue as KickoffDuelModelId,
                        row.orange as KickoffDuelModelId
                      )
                    }
                  >
                    {row.label}
                  </td>
                  {row.slots.map((s) => {
                    const isCellActive = isCurrentPair && kickoffDuelSlotIndex === s.slotIndex;
                    const winColor =
                      s.winner === 'BLUE'
                        ? 'text-sky-400'
                        : s.winner === 'ORANGE'
                        ? 'text-orange-400'
                        : 'text-amber-400';
                    const winChar =
                      s.winner === 'BLUE' ? 'B' : s.winner === 'ORANGE' ? 'O' : 'T';
                    return (
                      <td
                        key={s.slotIndex}
                        onClick={() => {
                          setKickoffDuelModels(
                            row.blue as KickoffDuelModelId,
                            row.orange as KickoffDuelModelId
                          );
                          setKickoffDuelSlotIndex(s.slotIndex);
                        }}
                        className={`py-1 px-1 text-center cursor-pointer transition-colors hover:bg-sky-500/20 ${
                          isCellActive ? 'ring-1 ring-inset ring-sky-400 font-bold' : ''
                        } ${winColor}`}
                        title={`${row.label} @ ${s.slotCode}: First Touch=${s.winner} at ${s.touchTick}f (${s.touchSec}s), Dist=${s.blueDist}/${s.orangeDist}uu, Ball Outcome=${s.outcome} (Y=${s.endBallY}, Vy=${s.endBallVy})`}
                      >
                        {winChar}:{s.touchTick}f
                      </td>
                    );
                  })}
                  <td className="py-1 px-1.5 text-right font-bold whitespace-nowrap">
                    <span className="text-sky-400">{row.blueWins}</span>-
                    <span className="text-orange-400">{row.orangeWins}</span>-
                    <span className="text-amber-400">{row.ties}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
