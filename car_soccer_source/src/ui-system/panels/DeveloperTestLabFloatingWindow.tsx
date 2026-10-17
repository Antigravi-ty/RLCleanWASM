import React from 'react';
import {
  Cpu,
  Layers,
  History,
  Zap,
  Play,
  Square,
  Rewind,
  FastForward,
  RotateCcw,
  Eye,
  ArrowLeftRight,
  Radio,
} from 'lucide-react';
import {
  useDevTestLabStore,
  type DevTestLabTab,
  type TasFlowPreset,
} from '../tokens/devTestLabStore';
import { useUIStore } from '../core/store';
import { UnderlineTabs, type TabItem } from '../primitives/UnderlineTabs';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { SliderControl } from '../primitives/SliderControl';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { IncidentMatchBenchPanel } from './dev-test-lab/IncidentMatchBenchPanel';

export interface DeveloperTestLabFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const DeveloperTestLabFloatingWindow: React.FC<DeveloperTestLabFloatingWindowProps> = ({
  isLight = false,
}) => {
  const {
    activeTab,
    probesEnabled,
    probeBaseAltitudeZ,
    probePeakAltitudeZ,
    probeHoldTolerance,
    probeBoostZ,
    probeBoostVz,
    probeBoostPhase,
    probeBoostHoldTicks,
    probeRollDir,
    probeCameraTarget,
    dualWorldEnabled,
    activeWorldIndex,
    ghostWorldCount,
    ghostCarsPerWorld,
    ghostOpacity,
    tasState,
    tasRecordedFrames,
    tasCursorFrame,
    tasFlowPreset,
    tasCustomFlowPct,
    tasEffectiveFlowPct,
    setActiveTab,
    setProbesEnabled,
    setProbeCameraTarget,
    setDualWorldEnabled,
    switchActiveWorld,
    setGhostWorldCount,
    setGhostCarsPerWorld,
    setGhostOpacity,
    setTasFlowPreset,
    setTasCustomFlowPct,
    runtimeHandlers,
  } = useDevTestLabStore();

  const matchMode = useUIStore((s) => s.matchMode);
  const bridge = useUIStore((s) => s.bridge);
  const isInDevLab = matchMode === 'dev-test-lab';

  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const subPanelBg = isLight
    ? 'bg-white border-neutral-200/90 text-neutral-800'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-200';

  const mutedText = isLight ? 'text-neutral-500' : 'text-neutral-400';

  const tabs: TabItem[] = [
    { id: 'probes', label: '1. Probes', icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'dual-world', label: '2. Multi Ghost', icon: <Layers className="h-3.5 w-3.5" /> },
    { id: 'state-replay', label: '3. State Replay', icon: <History className="h-3.5 w-3.5" /> },
    { id: 'incident-match', label: '4. 90s Match', icon: <Zap className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-2.5 select-none text-xs">
      {/* Header Status Bar */}
      <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${cardBg}`}>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isInDevLab
                  ? isLight
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-emerald-400 animate-pulse'
                  : isLight
                  ? 'bg-amber-500'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-xs truncate">
              {isInDevLab ? 'Developer Test Lab Active' : 'Developer Test Lab Standby'}
            </span>
          </div>
          <span className={`text-[10px] font-mono truncate mt-0.5 ${mutedText}`}>
            {isInDevLab
              ? 'Close window in top-right Stack to auto-return to Free Play'
              : 'Click Enter Lab to activate isolated sandbox benches'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isInDevLab ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => bridge.onStartDevTestLab?.()}
              isLight={isLight}
              className="gap-1.5 px-2.5 py-1 text-[11px] font-semibold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Enter Lab</span>
            </Button>
          ) : (
            <Badge variant="emerald" size="sm" isLight={isLight} className="font-mono text-[10px]">
              70% OPACITY
            </Badge>
          )}
        </div>
      </div>

      {/* 4-Bench Navigation Tabs */}
      <div className="w-full shrink-0">
        <UnderlineTabs
          items={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as DevTestLabTab)}
          isLight={isLight}
          size="sm"
          fullWidth={true}
        />
      </div>

      {/* ================================================================= */}
      {/* BENCH 1: Predictive & Non-Predictive Probes (0G QE + Z-Hover)     */}
      {/* ================================================================= */}
      {activeTab === 'probes' && (
        <div className="flex flex-col gap-2.5">
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-semibold text-[11px]">
                  Two-Car Prediction Probes (Slot 6 & Slot 7 · In-Arena X=-2500)
                </span>
              </div>
              <ToggleSwitch
                checked={probesEnabled}
                onCheckedChange={(v) => setProbesEnabled(v)}
                isLight={isLight}
                variant="neutral"
              />
            </div>

            <p className={`text-[10px] leading-relaxed ${mutedText}`}>
              • <b>Car A (Slot 6 - Unpredictable Boost):</b> Gravity ON, XY locked inside arena at{' '}
              <code>X=-2500, Y=-400</code>. Starts at <code>Z={probeBaseAltitudeZ}</code>, holds boost to{' '}
              <code>Z={probePeakAltitudeZ}</code>, releases to fall below <code>{probeBaseAltitudeZ}</code>, then pulse-taps boost to stabilize within{' '}
              <code>{probeBaseAltitudeZ}±{probeHoldTolerance}</code> for <b>1.0s (120f)</b> before repeating (zero positive-feedback overshoot).
              <br />• <b>Car B (Slot 7 - Predictable QE Roll):</b> 0G locked at <code>X=-2500, Y=+400, Z={probeBaseAltitudeZ + 50}</code>, alternating Q/E roll.
            </p>
          </div>

          {/* Camera Observation Switcher */}
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold text-[11px]">Camera Observation Target</span>
              </div>
              <Badge variant="default" size="sm" isLight={isLight} className="font-mono text-[10px]">
                {probeCameraTarget.toUpperCase()}
              </Badge>
            </div>
            <SegmentedSwitch
              value={probeCameraTarget}
              fullWidth
              size="sm"
              isLight={isLight}
              onValueChange={(v) =>
                setProbeCameraTarget(v as 'player' | 'boost_probe' | 'qe_probe')
              }
              options={[
                { value: 'player', label: 'Player (Car 0)' },
                { value: 'boost_probe', label: `Boost Probe (Z:${probeBaseAltitudeZ}→${probePeakAltitudeZ})` },
                { value: 'qe_probe', label: '0G QE Roll Probe' },
              ]}
            />
          </div>

          {/* Live Telemetry Readout */}
          <div className={`p-2.5 rounded-xl border font-mono text-[10px] flex flex-col gap-1.5 ${subPanelBg}`}>
            <div className="flex items-center justify-between border-b border-neutral-700/30 pb-1">
              <span className="font-bold text-sky-400">LIVE PROBE TELEMETRY (120Hz)</span>
              <span>MAX_ARENA_CARS = 8</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div className="flex flex-col gap-0.5">
                <span className={mutedText}>Car 6 (Gravity Boost Z-Loop):</span>
                <span>
                  Phase: <b className="text-amber-400">{probeBoostPhase}</b>
                </span>
                <span>
                  Alt Z: <b>{probeBoostZ.toFixed(1)}</b> / {probePeakAltitudeZ} uu
                </span>
                <span>
                  Vel Z: <b>{probeBoostVz.toFixed(1)}</b> uu/s
                </span>
                <span>
                  {probeBaseAltitudeZ}±{probeHoldTolerance} Hold: <b>{((probeBoostHoldTicks / 120) * 100).toFixed(0)}%</b> ({probeBoostHoldTicks}/120f)
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={mutedText}>Car 7 (0G QE Air-Roll):</span>
                <span>
                  Gravity: <b>0.0 G (Locked XYZ)</b>
                </span>
                <span>
                  Roll Input: <b className="text-emerald-400">{probeRollDir > 0 ? '+1.0 (Q)' : '-1.0 (E)'}</b>
                </span>
                <span className="text-[9px] opacity-75 mt-1">
                  Toggling Probes OFF or switching tabs removes Slots 1..7 from WASM.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BENCH 2: Multi-World Same-Map Ghost Car Sandbox (2..4 Worlds)     */}
      {/* ================================================================= */}
      {activeTab === 'dual-world' && (
        <div className="flex flex-col gap-2.5">
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2.5 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-semibold text-[11px]">Multi-World Same-Map Ghost Sandbox</span>
              </div>
              <ToggleSwitch
                checked={dualWorldEnabled}
                onCheckedChange={(v) => setDualWorldEnabled(v)}
                isLight={isLight}
                variant="neutral"
              />
            </div>

            <p className={`text-[10px] leading-relaxed ${mutedText}`}>
              Runs up to <b>{ghostWorldCount} independent physics worlds</b> on the same map, with up to <b>8 vehicles + 1 ball per world</b> (no ball trajectory prediction line).
              Cycle control across worlds at any time; non-controlled worlds render as translucent ghosts with zero physical collision interference.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[10px]">Parallel Worlds</span>
                <SegmentedSwitch
                  value={String(ghostWorldCount)}
                  fullWidth
                  size="sm"
                  isLight={isLight}
                  onValueChange={(v) => setGhostWorldCount(Number(v) as 2 | 3 | 4)}
                  options={[
                    { value: '2', label: '2 Worlds' },
                    { value: '3', label: '3 Worlds' },
                    { value: '4', label: '4 Worlds' },
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-semibold text-[10px]">Cars Per World (Max 8)</span>
                <SegmentedSwitch
                  value={String(ghostCarsPerWorld)}
                  fullWidth
                  size="sm"
                  isLight={isLight}
                  onValueChange={(v) => setGhostCarsPerWorld(Number(v))}
                  options={[
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                    { value: '4', label: '4' },
                    { value: '8', label: '8' },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex flex-col">
                <span className="font-bold text-xs">
                  Controlling: World #{activeWorldIndex + 1} of {ghostWorldCount} ({ghostCarsPerWorld} {ghostCarsPerWorld === 1 ? 'Car' : 'Cars'}/World)
                </span>
                <span className={`text-[10px] ${mutedText}`}>
                  Other {ghostWorldCount - 1} world(s) render as translucent ghosts ({Math.round(ghostOpacity * 100)}% opacity)
                </span>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={switchActiveWorld}
                isLight={isLight}
                className="gap-1.5 px-3 py-1.5 text-xs font-bold shrink-0"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Switch World</span>
              </Button>
            </div>

            <div className={`p-2.5 rounded-lg border ${subPanelBg}`}>
              <SliderControl
                label={`Ghost World Opacity (${Math.round(ghostOpacity * 100)}%)`}
                description="Translucency for all parallel ghost worlds (Cars 0..7 + Ball)"
                value={Math.round(ghostOpacity * 100)}
                min={15}
                max={90}
                step={5}
                unit="%"
                showStepper={true}
                colorScheme="neutral"
                isLight={isLight}
                onChange={(val) => setGhostOpacity(val / 100)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BENCH 3: State Replay Scrubbing & Recording (O / P / [ / ])       */}
      {/* ================================================================= */}
      {activeTab === 'state-replay' && (
        <div className="flex flex-col gap-2.5">
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold text-[11px]">State Replay History Recorder</span>
              </div>
              <Badge
                variant={tasState === 'recording' ? 'amber' : tasState === 'idle' ? 'neutral' : 'emerald'}
                size="sm"
                isLight={isLight}
                className="font-mono text-[10px] uppercase"
              >
                {tasState}
              </Badge>
            </div>

            {/* Frame Progress Bar & Readout */}
            <div className={`p-2 rounded-lg border font-mono text-[10px] flex flex-col gap-1.5 ${subPanelBg}`}>
              <div className="flex items-center justify-between">
                <span>
                  Cursor: <b>Frame #{tasCursorFrame}</b> ({(tasCursorFrame / 120).toFixed(2)}s)
                </span>
                <span>
                  Recorded: <b>{tasRecordedFrames}f</b> ({(tasRecordedFrames / 120).toFixed(2)}s)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-75"
                  style={{
                    width: `${
                      tasRecordedFrames > 0
                        ? Math.min(100, Math.max(0, (tasCursorFrame / tasRecordedFrames) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Hotkey Controls Grid (O, P, [, ]) */}
            <div className="grid grid-cols-2 gap-1.5 pt-0.5">
              <Button
                variant={tasState === 'recording' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => runtimeHandlers.onTasStartRecording?.()}
                isLight={isLight}
                className="justify-between px-2.5 py-1.5 text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <Play className="h-3 w-3 fill-current text-rose-400" />
                  <span>Start Rec</span>
                </span>
                <KeycapBadge label="O" size="sm" isLight={isLight} />
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => runtimeHandlers.onTasStopRecording?.()}
                isLight={isLight}
                className="justify-between px-2.5 py-1.5 text-[11px]"
              >
                <span className="flex items-center gap-1.5">
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop Rec</span>
                </span>
                <KeycapBadge label="P" size="sm" isLight={isLight} />
              </Button>

              <button
                type="button"
                onMouseDown={() => runtimeHandlers.onTasPushBackwardStart?.()}
                onMouseUp={() => runtimeHandlers.onTasPushBackwardStop?.()}
                onMouseLeave={() => runtimeHandlers.onTasPushBackwardStop?.()}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer active:scale-95 transition-all ${
                  tasState === 'rewinding'
                    ? 'bg-amber-500 text-neutral-950 border-amber-400'
                    : isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
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
                onMouseDown={() => runtimeHandlers.onTasPushForwardStart?.()}
                onMouseUp={() => runtimeHandlers.onTasPushForwardStop?.()}
                onMouseLeave={() => runtimeHandlers.onTasPushForwardStop?.()}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer active:scale-95 transition-all ${
                  tasState === 'forwarding'
                    ? 'bg-amber-500 text-neutral-950 border-amber-400'
                    : isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FastForward className="h-3.5 w-3.5" />
                  <span>Hold Forward</span>
                </span>
                <KeycapBadge label="]" size="sm" isLight={isLight} />
              </button>
            </div>

            {/* Resume from Here & Cancel Buttons */}
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <Button
                variant="primary"
                size="sm"
                onClick={() => runtimeHandlers.onTasResumeFromHere?.()}
                isLight={isLight}
                className="gap-1.5 py-1.5 text-[11px] font-bold"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Resume From Here</span>
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => runtimeHandlers.onTasCancelToFreeplay?.()}
                isLight={isLight}
                className="gap-1.5 py-1.5 text-[11px]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Cancel (Freeplay)</span>
              </Button>
            </div>
          </div>

          {/* Scrubbing Speed Flow Percentage */}
          <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[11px]">Rewind / Forward Flow Speed</span>
              <Badge variant="neutral" size="sm" isLight={isLight} className="font-mono text-[10px]">
                {tasEffectiveFlowPct}% ({Math.round((120 * tasEffectiveFlowPct) / 100)} fps)
              </Badge>
            </div>

            <SegmentedSwitch
              value={tasFlowPreset}
              fullWidth
              size="sm"
              isLight={isLight}
              onValueChange={(v) => setTasFlowPreset(v as TasFlowPreset)}
              options={[
                { value: '100', label: '100%' },
                { value: '75', label: '75%' },
                { value: '50', label: '50%' },
                { value: '25', label: '25%' },
                { value: 'custom', label: 'Custom' },
              ]}
            />

            {tasFlowPreset === 'custom' && (
              <div className={`p-2 rounded-lg border ${subPanelBg}`}>
                <SliderControl
                  label={`Custom Flow Speed (${tasCustomFlowPct}%)`}
                  value={tasCustomFlowPct}
                  min={5}
                  max={200}
                  step={5}
                  unit="%"
                  showStepper={true}
                  colorScheme="neutral"
                  isLight={isLight}
                  onChange={(val) => setTasCustomFlowPct(val)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* BENCH 4: 90s Incident, Overtime & Possession Match Sandbox        */}
      {/* ================================================================= */}
      {activeTab === 'incident-match' && (
        <IncidentMatchBenchPanel
          isLight={isLight}
          cardBg={cardBg}
          subPanelBg={subPanelBg}
          mutedText={mutedText}
        />
      )}
    </div>
  );
};
