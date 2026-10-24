import React, { useRef } from 'react';
import {
  Film,
  Upload,
  Play,
  Pause,
  Rewind,
  FastForward,
  Trash2,
  Timer,
  History,
} from 'lucide-react';
import {
  useReplayViewerStore,
  type ReplayFlowPreset,
  type ReplayDownCounterOption,
} from '../../stores/replayViewerStore';
import { getRetainedMatchReplay } from '../../replay/ReplayFileExporter.js';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { SliderControl } from '../primitives/SliderControl';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { KeycapBadge } from '../primitives/KeycapBadge';

export interface ReplayViewerFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const ReplayViewerFloatingWindow: React.FC<ReplayViewerFloatingWindowProps> = ({
  isLight = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    viewerState,
    loadedFileName,
    totalFrames,
    cursorFrame,
    targetFrame,
    stateTrackCount,
    incidentTrackCount,
    signalTrackCount,
    recordedSignalCount,
    synthesizedSignalCount,
    incidentMarkers,
    signalMarkers,
    downCounterSec,
    prerollRemainingSec,
    flowPreset,
    customFlowPct,
    effectiveFlowPct,
    errorMessage,
    setDownCounterSec,
    setFlowPreset,
    setCustomFlowPct,
    runtimeHandlers,
  } = useReplayViewerStore();

  const cardBg = isLight
    ? 'bg-neutral-50 border-neutral-200 text-neutral-800'
    : 'bg-neutral-900/60 border-neutral-800 text-neutral-200';
  const subPanelBg = isLight
    ? 'bg-white border-neutral-200 text-neutral-700'
    : 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300';

  const hasRetainedMatch = Boolean(getRetainedMatchReplay());
  const hasFrames = totalFrames > 0;
  const minRequiredFrames = downCounterSec === 0 ? 120 : 240;
  const canResumeFromHere = totalFrames >= minRequiredFrames;
  const cursorRatioPct =
    totalFrames > 0
      ? Math.min(100, Math.max(0, (cursorFrame / Math.max(1, totalFrames - 1)) * 100))
      : 0;

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasFrames) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    runtimeHandlers.onSeekFrame?.(Math.round(ratio * (totalFrames - 1)));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      runtimeHandlers.onUploadReplayFile?.(file);
    }
    e.target.value = '';
  };

  return (
    <div className="flex flex-col gap-2.5 select-none">
      {/* 1. Replay File Upload & Buffer Status */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-semibold text-[11px]">RC Replay File Viewer</span>
          </div>
          <div className="flex items-center gap-1.5">
            {viewerState === 'preroll-countdown' && (
              <Badge variant="amber" size="sm" isLight={isLight} className="font-mono text-[10px]">
                COUNTDOWN {prerollRemainingSec}s
              </Badge>
            )}
            <Badge
              variant={
                viewerState === 'playing' || viewerState === 'preroll-countdown'
                  ? 'emerald'
                  : viewerState === 'idle'
                  ? 'neutral'
                  : 'amber'
              }
              size="sm"
              isLight={isLight}
              className="font-mono text-[10px] uppercase"
            >
              {viewerState}
            </Badge>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".gz,.rcreplay,.json,application/gzip,application/json"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLight={isLight}
            className="flex-1 justify-center gap-1.5 py-1.5 text-[11px] font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Replay (.rcreplay.gz / .json)</span>
          </Button>

          {hasRetainedMatch && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runtimeHandlers.onLoadRetainedMatchReplay?.()}
              isLight={isLight}
              className="gap-1.5 px-2.5 py-1.5 text-[11px]"
              title="Load the most recent match replay from memory"
            >
              <History className="h-3.5 w-3.5 text-amber-400" />
              <span>Last Match</span>
            </Button>
          )}
        </div>

        {errorMessage && (
          <div className="px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[10px]">
            {errorMessage}
          </div>
        )}

        <div className={`p-2 rounded-lg border font-mono text-[10px] flex flex-col gap-1.5 ${subPanelBg}`}>
          <div className="flex items-center justify-between truncate">
            <span className="truncate">
              File: <b>{loadedFileName || 'No file loaded'}</b>
            </span>
            <span className="shrink-0 ml-2">
              Frames: <b>{totalFrames}f</b> ({(totalFrames / 120).toFixed(2)}s)
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>
              Cursor: <b>Frame #{cursorFrame}</b> ({(cursorFrame / 120).toFixed(2)}s)
            </span>
            <span className={canResumeFromHere ? 'text-emerald-400' : 'text-amber-400'}>
              {canResumeFromHere
                ? `Release #${targetFrame} Ready`
                : hasFrames
                ? 'Short clip (< 2.0s)'
                : 'Upload replay to play'}
            </span>
          </div>

          {/* Track A: State + Input Timeline */}
          <div className="flex flex-col gap-0.5 pt-0.5">
            <div className="flex items-center justify-between text-[9px] opacity-80">
              <span>Track A · State + Input</span>
              <span>{stateTrackCount || totalFrames} frames</span>
            </div>
            <div
              className="w-full h-2.5 rounded-full bg-neutral-800 overflow-hidden cursor-pointer relative"
              onClick={handleSeekClick}
              title={hasFrames ? 'Click to seek frame on Track A (State + Input)' : undefined}
            >
              <div
                className="h-full bg-sky-400 transition-all duration-75"
                style={{ width: `${cursorRatioPct}%` }}
              />
            </div>
          </div>

          {/* Track B: Incidents Timeline */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[9px] opacity-80">
              <span>Track B · Incidents</span>
              <span>{incidentTrackCount} events</span>
            </div>
            <div
              className="w-full h-2.5 rounded-full bg-neutral-800/90 overflow-hidden cursor-pointer relative"
              onClick={handleSeekClick}
              title={hasFrames ? 'Click to seek on Track B (Incidents Timeline)' : undefined}
            >
              {hasFrames &&
                incidentMarkers.map((m, idx) => {
                  const leftPct = Math.min(
                    99.5,
                    Math.max(0, (m.frameIndex / Math.max(1, totalFrames - 1)) * 100)
                  );
                  const isGoal = m.type === 0x0e;
                  const isBumpOrDemo = m.type === 0x02 || m.type === 0x03;
                  const colorCls = isGoal
                    ? 'bg-emerald-400 w-1 z-10'
                    : isBumpOrDemo
                    ? 'bg-rose-400 w-0.5'
                    : 'bg-amber-400/75 w-[1.5px]';
                  return (
                    <div
                      key={`${m.frameIndex}-${m.type}-${idx}`}
                      className={`absolute top-0 bottom-0 ${colorCls}`}
                      style={{ left: `${leftPct}%` }}
                      title={`${m.label} @ Frame #${m.frameIndex} (${(m.frameIndex / 120).toFixed(2)}s)`}
                    />
                  );
                })}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none"
                style={{ left: `${cursorRatioPct}%` }}
              />
            </div>
          </div>

          {/* Track C: Signals Timeline */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[9px] opacity-80">
              <span>Track C · Signals</span>
              <span>
                {recordedSignalCount > 0
                  ? `${recordedSignalCount} signals`
                  : synthesizedSignalCount > 0
                  ? `0 raw (${synthesizedSignalCount} synth)`
                  : `${signalTrackCount} signals`}
              </span>
            </div>
            <div
              className="w-full h-2.5 rounded-full bg-neutral-800/90 overflow-hidden cursor-pointer relative"
              onClick={handleSeekClick}
              title={hasFrames ? 'Click to seek on Track C (Signals Timeline)' : undefined}
            >
              {hasFrames &&
                signalMarkers.map((s, idx) => {
                  const leftPct = Math.min(
                    99.5,
                    Math.max(0, (s.frameIndex / Math.max(1, totalFrames - 1)) * 100)
                  );
                  const isScore = s.type === 0x04;
                  const isEnd = s.type === 0x09 || s.type === 0x0a;
                  const colorCls = isScore
                    ? 'bg-emerald-400 w-1 z-10'
                    : isEnd
                    ? 'bg-violet-400 w-1'
                    : 'bg-sky-300/80 w-0.5';
                  return (
                    <div
                      key={`${s.frameIndex}-${s.type}-${idx}`}
                      className={`absolute top-0 bottom-0 ${colorCls}`}
                      style={{ left: `${leftPct}%` }}
                      title={`${s.label}${s.synthesized ? ' (Synthesized)' : ''} @ Frame #${s.frameIndex}`}
                    />
                  );
                })}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none"
                style={{ left: `${cursorRatioPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Transport Controls: Start Playing / Pause + Hold Rewind / Hold Forward */}
        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <Button
            variant={viewerState === 'playing' ? 'primary' : 'secondary'}
            size="sm"
            disabled={!hasFrames}
            onClick={() => runtimeHandlers.onStartPlaying?.()}
            isLight={isLight}
            className="justify-between px-2.5 py-1.5 text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <Play className="h-3 w-3 fill-current text-emerald-400" />
              <span>Start Playing</span>
            </span>
            <KeycapBadge label="O" size="sm" isLight={isLight} />
          </Button>

          <Button
            variant={viewerState === 'paused' ? 'primary' : 'secondary'}
            size="sm"
            disabled={!hasFrames}
            onClick={() => runtimeHandlers.onPausePlaying?.()}
            isLight={isLight}
            className="justify-between px-2.5 py-1.5 text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <Pause className="h-3 w-3 fill-current" />
              <span>Pause</span>
            </span>
            <KeycapBadge label="P" size="sm" isLight={isLight} />
          </Button>

          <button
            type="button"
            disabled={!hasFrames}
            onMouseDown={() => runtimeHandlers.onPushBackwardStart?.()}
            onMouseUp={() => runtimeHandlers.onPushBackwardStop?.()}
            onMouseLeave={() => runtimeHandlers.onPushBackwardStop?.()}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
              !hasFrames
                ? 'opacity-50 cursor-not-allowed border-neutral-800 text-neutral-500'
                : viewerState === 'rewinding'
                ? 'bg-amber-500 text-neutral-950 border-amber-400 cursor-pointer'
                : isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800 cursor-pointer active:scale-95'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 cursor-pointer active:scale-95'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Rewind className="h-3.5 w-3.5" />
              <span>Hold Rewind</span>
            </span>
            <KeycapBadge label="[" size="sm" isLight={isLight} />
          </button>

          <button
            type="button"
            disabled={!hasFrames}
            onMouseDown={() => runtimeHandlers.onPushForwardStart?.()}
            onMouseUp={() => runtimeHandlers.onPushForwardStop?.()}
            onMouseLeave={() => runtimeHandlers.onPushForwardStop?.()}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
              !hasFrames
                ? 'opacity-50 cursor-not-allowed border-neutral-800 text-neutral-500'
                : viewerState === 'forwarding'
                ? 'bg-amber-500 text-neutral-950 border-amber-400 cursor-pointer'
                : isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800 cursor-pointer active:scale-95'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 cursor-pointer active:scale-95'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FastForward className="h-3.5 w-3.5" />
              <span>Hold Forward</span>
            </span>
            <KeycapBadge label="]" size="sm" isLight={isLight} />
          </button>
        </div>

        {/* 3. Down Counter (3 / 2 / 1) Segmented Control */}
        <div className={`p-2 rounded-lg border flex flex-col gap-1.5 ${subPanelBg}`}>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-[11px]">
              <Timer className="h-3.5 w-3.5 text-sky-400" />
              <span>Down Counter</span>
            </span>
            <span className="font-mono text-[10px] opacity-75">
              {downCounterSec === 0
                ? 'Replays from -1s (120f, immediate 1s beep)'
                : `Replays from -${(downCounterSec || 3) + 1}s (${((downCounterSec || 3) + 1) * 120}f)`}
            </span>
          </div>
          <SegmentedSwitch
            value={String(downCounterSec ?? 3)}
            fullWidth
            size="sm"
            isLight={isLight}
            onValueChange={(v) => setDownCounterSec(Number(v) as ReplayDownCounterOption)}
            options={[
              { value: '3', label: '3 (-4s)' },
              { value: '2', label: '2 (-3s)' },
              { value: '1', label: '1 (-2s)' },
              { value: '0', label: '0 (-1s)' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button
            variant="primary"
            size="sm"
            disabled={!canResumeFromHere}
            onClick={() => runtimeHandlers.onResumeFromHere?.()}
            isLight={isLight}
            className="justify-between px-2.5 py-1.5 text-[11px] font-bold"
          >
            <span className="flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Resume From Here</span>
            </span>
            <KeycapBadge label="G" size="sm" isLight={isLight} />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={!hasFrames}
            onClick={() => runtimeHandlers.onClearReplay?.()}
            isLight={isLight}
            className="gap-1.5 py-1.5 text-[11px]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear Buffer</span>
          </Button>
        </div>
      </div>

      {/* 4. Playback & Scrub Flow Speed */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[11px]">Playback / Scrub Flow Speed</span>
          <Badge variant="neutral" size="sm" isLight={isLight} className="font-mono text-[10px]">
            {effectiveFlowPct}% ({Math.round((120 * effectiveFlowPct) / 100)} fps)
          </Badge>
        </div>

        <SegmentedSwitch
          value={flowPreset}
          fullWidth
          size="sm"
          isLight={isLight}
          onValueChange={(v) => setFlowPreset(v as ReplayFlowPreset)}
          options={[
            { value: '100', label: '100%' },
            { value: '75', label: '75%' },
            { value: '50', label: '50%' },
            { value: '25', label: '25%' },
            { value: 'custom', label: 'Custom' },
          ]}
        />

        {flowPreset === 'custom' && (
          <div className={`p-2 rounded-lg border ${subPanelBg}`}>
            <SliderControl
              label={`Custom Flow Speed (${customFlowPct}%)`}
              value={customFlowPct}
              min={5}
              max={200}
              step={5}
              unit="%"
              showStepper={true}
              colorScheme="neutral"
              isLight={isLight}
              onChange={(val) => setCustomFlowPct(val)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
