import React from 'react';
import {
  Code2,
  Router,
  Sliders,
  Activity,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { VStack } from '../../../layout/VStack';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingTwoGrabberSliderRow } from '../components/SettingTwoGrabberSliderRow';
import { FloatingWindowCard } from '../components/FloatingWindowCard';
import { ToggleSwitch } from '../../../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../../../primitives/SegmentedSwitch';
import { useUIStore, type TelemetryConfig } from '../../../core/store';
import {
  DIAGNOSTICS_WINDOW_PRESET,
  NETWORK_DIAGNOSTICS_PRESET,
  OPACITY_MANAGER_PRESET,
} from '../../../tokens/floatingPresets';
import { useFloatingStore } from '../../../tokens/floatingStore';
import { TelemetryConfigCard } from './advanced/TelemetryConfigCard';

export interface AdvancedTabProps {
  isLight?: boolean;
  telemetry?: TelemetryConfig;
  onUpdateTelemetry?: (patch: Partial<TelemetryConfig>) => void;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const AdvancedTab: React.FC<AdvancedTabProps> = ({
  isLight = false,
  telemetry,
  onUpdateTelemetry,
  onHover,
  onLeave,
}) => {
  const developerMode = useUIStore((s) => s.developerMode);
  const clockPacingMode = useUIStore((s) => s.clockPacingMode);
  const setClockPacingMode = useUIStore((s) => s.setClockPacingMode);
  const inputBufferTarget = useUIStore((s) => s.inputBufferTarget);
  const setInputBufferTarget = useUIStore((s) => s.setInputBufferTarget);
  const inputBufferThreshold = useUIStore((s) => s.inputBufferThreshold);
  const setInputBufferThreshold = useUIStore((s) => s.setInputBufferThreshold);
  const showSafeAreaHud = useUIStore((s) => s.showSafeAreaHud);
  const setShowSafeAreaHud = useUIStore((s) => s.setShowSafeAreaHud);
  const { windows } = useFloatingStore();
  const isOpacityManagerActive = windows.some((w) => w.id === OPACITY_MANAGER_PRESET.id);

  const opacityManagerCard = (
    <FloatingWindowCard
      preset={OPACITY_MANAGER_PRESET}
      icon={<Sliders className="h-5 w-5" />}
      iconBgClass="bg-amber-500/10 text-amber-500"
      description="Opacity adjustment (1% - 100%) for all floating telemetry windows"
      hoverTooltip="Floating Window Opacity: Adjust transparency across all active floating windows. Minimum 1%."
      onHover={onHover}
      onLeave={onLeave}
      isLight={isLight}
    />
  );

  return (
    <VStack gap="lg" isLight={isLight}>
      {/* Floating Window Opacity: First position when inactive */}
      {!isOpacityManagerActive && opacityManagerCard}

      {/* Safe Area & Display Scale Observation Toggle Switch */}
      <SettingToggleRow
        label="UI Safe Area & Scale Observation"
        subtitle="Display green safe area outline, 18:9 canonical zone, and floating telemetry calibration pill"
        checked={showSafeAreaHud}
        onChange={(val) => setShowSafeAreaHud(val)}
        onHover={() => onHover('Enables the visual safe area boundary guides and floating bottom telemetry pill to observe and calibrate UI scaling and bezel margins in real-time.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Top Toggle: Developer Settings (URL-controlled) */}
      <div
        className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all cursor-not-allowed ${
          isLight
            ? 'bg-neutral-50/90 border-neutral-200 shadow-2xs opacity-75'
            : 'bg-neutral-850/80 border-neutral-700/80 opacity-75'
        }`}
        onMouseEnter={() =>
          onHover(
            developerMode
              ? 'Developer settings is unlocked. State is locked and cannot be toggled manually.'
              : 'This developer settings is locked.'
          )
        }
        onMouseLeave={onLeave}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              developerMode
                ? 'bg-amber-500/10 text-amber-500'
                : isLight
                ? 'bg-neutral-200/80 text-neutral-400'
                : 'bg-neutral-800 text-neutral-500'
            }`}
          >
            <Code2 className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-sm leading-tight ${
                  isLight ? 'text-neutral-900' : 'text-neutral-100'
                }`}
              >
                Developer Settings
              </span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${
                  developerMode
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-500'
                    : isLight
                    ? 'bg-neutral-200/60 border-neutral-300 text-neutral-500'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
              >
                {developerMode ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <p
              className={`text-xs leading-normal line-clamp-2 ${
                isLight ? 'text-neutral-600' : 'text-neutral-400'
              }`}
            >
              {developerMode
                ? 'Developer settings is unlocked. State is locked and cannot be toggled manually.'
                : 'This developer settings is locked.'}
            </p>
          </div>
        </div>

        <div className="shrink-0 ml-3 pointer-events-none">
          <ToggleSwitch
            checked={developerMode}
            disabled={true}
            onCheckedChange={() => {}}
            isLight={isLight}
            variant="amber"
          />
        </div>
      </div>

      {/* Multiplayer Network Diagnostics Card */}
      <FloatingWindowCard
        preset={NETWORK_DIAGNOSTICS_PRESET}
        icon={<Router className="h-5 w-5" />}
        iconBgClass="bg-violet-500/10 text-violet-500"
        description="Live RTT ping latency, packet loss stress injection, and predictive rollback verification."
        hoverTooltip="Multiplayer Network Diagnostics: Real-time WebRTC RTT latency, client lead ticks, packet loss simulation & predictive rollback smoothing."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Input Buffer / Clock Pacing Scheme (Rocket League GDC) */}
      <div
        onMouseEnter={() =>
          onHover(
            'Input Buffer Pacing: Legacy fixed 120Hz discrete pacing strictly locks 120Hz physics steps to absorb network delay and packet jitter deterministically. CSTS is currently under development.'
          )
        }
        onMouseLeave={onLeave}
        className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs transition-all ${
          isLight
            ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border-neutral-200 shadow-2xs'
            : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
            <Sliders className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-sm leading-tight ${
                  isLight ? 'text-neutral-900' : 'text-neutral-100'
                }`}
              >
                Input Buffer Pacing
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/15 border-amber-500/30 text-amber-400">
                GDC Pacing
              </span>
            </div>
            <p
              className={`text-xs leading-normal line-clamp-2 ${
                isLight ? 'text-neutral-600' : 'text-neutral-400'
              }`}
            >
              Legacy (Fixed 120Hz discrete pacing): Strictly locked 120Hz discrete physics steps. Skips steps when ahead and catches up when behind to guarantee robust timeline synchronization.
            </p>
          </div>
        </div>

        <div className="shrink-0 ml-3">
          <SegmentedSwitch
            options={[
              { value: 'legacy', label: 'Legacy (120Hz)' },
              { value: 'csts', label: 'CSTS (WIP)', disabled: true },
            ]}
            value={clockPacingMode}
            onValueChange={(val) => setClockPacingMode(val as any)}
            size="sm"
            isLight={isLight}
          />
        </div>
      </div>

      {/* Input Buffer Target (alpha: 1..6, default 3) */}
      <div
        className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs transition-all ${
          isLight
            ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border-neutral-200 shadow-2xs'
            : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
        }`}
        onMouseEnter={() =>
          onHover(
            'Input Buffer Target (α): Target number of future input frames queued on the authoritative server to absorb packet arrival jitter. Higher values provide stronger underrun immunity at the expense of proportional input lag.'
          )
        }
        onMouseLeave={onLeave}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-bold text-sm leading-tight ${
                  isLight ? 'text-neutral-900' : 'text-neutral-100'
                }`}
              >
                Input Buffer Target (α)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/15 border-amber-500/30 text-amber-400">
                Target: {inputBufferTarget} Frame{inputBufferTarget > 1 ? 's' : ''}
              </span>
            </div>
            <p
              className={`text-xs leading-normal line-clamp-2 ${
                isLight ? 'text-neutral-600' : 'text-neutral-400'
              }`}
            >
              Authoritative server queue depth target. Recommended: 3 Frames for WebRTC peer-to-peer matches.
            </p>
          </div>
        </div>

        <div className="relative shrink-0 ml-3 w-40 sm:w-48">
          <select
            value={inputBufferTarget}
            onChange={(e) => setInputBufferTarget(Number(e.target.value))}
            className={`w-full py-1.5 pl-3 pr-8 rounded-lg text-xs font-mono font-medium border appearance-none cursor-pointer outline-none transition-colors ${
              isLight
                ? 'bg-white border-neutral-300 text-neutral-800 hover:border-neutral-400 focus:border-amber-500'
                : 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-neutral-600 focus:border-amber-400'
            }`}
          >
            <option value={1}>1 Frame (LAN / 0ms)</option>
            <option value={2}>2 Frames (Aggressive)</option>
            <option value={3}>3 Frames (Default / Rec.)</option>
            <option value={4}>4 Frames (Stable Jitter)</option>
            <option value={5}>5 Frames (High Latency)</option>
            <option value={6}>6 Frames (Max Buffer)</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 opacity-50 pointer-events-none" />
        </div>
      </div>

      {/* Threshold Deadband Range Slider (Two-Grabber Slider [-alpha .. +alpha]) */}
      <SettingTwoGrabberSliderRow
        label="Threshold Tolerance Deadband"
        subtitle={`Allowed queue jitter around target α (${inputBufferTarget}). Catch-up triggers below, step skip triggers above.`}
        target={inputBufferTarget}
        value={inputBufferThreshold}
        onChange={(val) => setInputBufferThreshold(val)}
        isLight={isLight}
        onHover={() =>
          onHover(
            `Threshold Deadband: Defines the asymmetrical deadband [-α .. +α] around input buffer target α (${inputBufferTarget}). If server queue drops below ${inputBufferTarget + inputBufferThreshold[0]} frame(s), client steps extra tick to catch up. If server queue exceeds ${inputBufferTarget + inputBufferThreshold[1]} frames, client pauses a step.`
          )
        }
        onLeave={onLeave}
      />

      {/* Diagnostics Window Card */}
      <FloatingWindowCard
        preset={DIAGNOSTICS_WINDOW_PRESET}
        icon={<Activity className="h-5 w-5" />}
        iconBgClass="bg-sky-500/10 text-sky-500"
        description="Real-time CPU phase breakdown, physics simulation sub-ticks, and WebGL rendering pipeline metrics."
        hoverTooltip="Inspect live frame pacing, tick rate stability, CPU pipeline phases, and GPU draw calls in a dockable floating overlay."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Always Show Telemetry Section */}
      <TelemetryConfigCard
        telemetry={telemetry}
        onUpdateTelemetry={onUpdateTelemetry}
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Floating Window Opacity: Last position when active */}
      {isOpacityManagerActive && opacityManagerCard}
    </VStack>
  );
};
