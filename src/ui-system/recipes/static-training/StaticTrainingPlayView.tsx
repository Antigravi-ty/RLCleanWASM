import React from 'react';
import { RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { Badge } from '../../primitives/Badge';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import { KeycapBadge } from '../../primitives/KeycapBadge';
import {
  useStaticTrainingPackStore,
  type StaticTrainingShotItem,
} from '../../../stores/staticTrainingPackStore';

export interface StaticTrainingPlayViewProps {
  isLight: boolean;
  items: StaticTrainingShotItem[];
  safeIndex: number;
  currentShot: StaticTrainingShotItem | null;
}

export const StaticTrainingPlayView: React.FC<StaticTrainingPlayViewProps> = ({
  isLight,
  items,
  safeIndex,
  currentShot,
}) => {
  const setCurrentShotIndex = useStaticTrainingPackStore((s) => s.setCurrentShotIndex);
  const nextShot = useStaticTrainingPackStore((s) => s.nextShot);
  const prevShot = useStaticTrainingPackStore((s) => s.prevShot);
  const resetCurrentShot = useStaticTrainingPackStore((s) => s.resetCurrentShot);

  const downCounterEnabled = useStaticTrainingPackStore((s) => s.downCounterEnabled);
  const downCounterValue = useStaticTrainingPackStore((s) => s.downCounterValue);
  const setDownCounterEnabled = useStaticTrainingPackStore((s) => s.setDownCounterEnabled);
  const setDownCounterValue = useStaticTrainingPackStore((s) => s.setDownCounterValue);

  return (
    <>
      {/* Active Shot Transport & Hotkeys Bar */}
      <div
        className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
          isLight
            ? 'bg-neutral-50 border-neutral-200 text-neutral-900'
            : 'bg-neutral-900/70 border-neutral-800 text-neutral-100'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="default" size="sm" isLight={isLight}>
              Shot {safeIndex + 1} / {items.length}
            </Badge>
            <span className="text-xs font-bold truncate">
              {currentShot?.name || `Shot ${safeIndex + 1}`}
            </span>
          </div>
          <span className="text-[11px] font-mono opacity-75 shrink-0">
            Timeout: {currentShot?.timeoutSeconds ?? 10}s
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={prevShot}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <SkipBack className="h-3.5 w-3.5" />
            <span>Prev</span>
            <KeycapBadge shortcut="[" size="sm" isLight={isLight} />
          </button>

          <button
            type="button"
            onClick={resetCurrentShot}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-bold cursor-pointer ${
              isLight
                ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-900 text-white'
                : 'bg-white hover:bg-neutral-200 border-white text-neutral-900'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
            <KeycapBadge shortcut="R" size="sm" isLight={isLight} />
          </button>

          <button
            type="button"
            onClick={nextShot}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <span>Next</span>
            <SkipForward className="h-3.5 w-3.5" />
            <KeycapBadge shortcut="]" size="sm" isLight={isLight} />
          </button>
        </div>
      </div>

      {/* Down Counter Toggle */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900/50 border-neutral-800'
        }`}
      >
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setDownCounterEnabled(!downCounterEnabled)}
        >
          <div className="flex flex-col">
            <span className="text-xs font-semibold">Down Counter (3 / 2 / 1)</span>
            <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {downCounterEnabled
                ? `Active: Holds ${downCounterValue + 1}s, plays countdown beep & Go cue`
                : 'Off (Default): Scene waits stationary until your first driving input'}
            </span>
          </div>
          <ToggleSwitch
            checked={downCounterEnabled}
            onCheckedChange={(checked) => setDownCounterEnabled(checked)}
            isLight={isLight}
            variant="neutral"
          />
        </div>

        {downCounterEnabled && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium opacity-80">Countdown Duration</span>
            <div className="w-44">
              <SegmentedSwitch
                options={[
                  { value: '3', label: '3s' },
                  { value: '2', label: '2s' },
                  { value: '1', label: '1s (Default)' },
                ]}
                value={String(downCounterValue)}
                onChange={(val) => setDownCounterValue(Number(val) as 1 | 2 | 3)}
                isLight={isLight}
                size="sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Read-Only Shot List Navigation */}
      <div
        className={`rounded-xl border overflow-hidden flex flex-col ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900/50 border-neutral-800'
        }`}
      >
        <div
          className={`px-3 py-2 border-b text-[11px] font-bold uppercase tracking-wider flex items-center justify-between ${
            isLight
              ? 'bg-neutral-50 border-neutral-200 text-neutral-500'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
          }`}
        >
          <span>Shot Playlist ({items.length} Scenarios)</span>
          <span>Read-Only in Play Mode</span>
        </div>

        <div className="flex flex-col gap-1 p-2 max-h-64 overflow-y-auto">
          {items.map((shot, idx) => {
            const isActive = idx === safeIndex;
            return (
              <button
                key={shot.id || idx}
                type="button"
                onClick={() => setCurrentShotIndex(idx)}
                className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isActive
                    ? isLight
                      ? 'bg-neutral-900 border-neutral-900 text-white'
                      : 'bg-white border-white text-neutral-900'
                    : isLight
                    ? 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
                    : 'bg-neutral-850/60 hover:bg-neutral-800 border-neutral-800 text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold opacity-75">#{idx + 1}</span>
                  <span className="text-xs font-bold truncate">{shot.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono opacity-80">
                  <span>{shot.timeoutSeconds}s</span>
                  <span>•</span>
                  <span>
                    {shot.ball.kickoffState
                      ? 'KICKOFF'
                      : `Ball ${Math.round(shot.ball.speed)} UU/s`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};
