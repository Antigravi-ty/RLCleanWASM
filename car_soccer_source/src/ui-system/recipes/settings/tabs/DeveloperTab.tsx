import React from 'react';
import {
  Sliders,
  Zap,
  Activity,
  Target,
  Sparkles,
  Palette,
  ArrowRight,
  Disc3,
  PencilRuler,
  Keyboard,
  Cpu,
  Play,
} from 'lucide-react';
import { VStack } from '../../../layout/VStack';
import { FloatingWindowCard } from '../components/FloatingWindowCard';
import { SettingSegmentedRow } from '../components/SettingSegmentedRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import {
  audioConfig,
  setCarBallSoundMode,
  setCarCarSoundMode,
} from '../../../tokens/audioConfigStore';
import {
  EVENT_STREAM_OB_PRESET,
  DETERMINISM_HARNESS_PRESET,
  BOOST_PAD_TUNER_PRESET,
  DRIFTWOODS_TUNER_PRESET,
  KICKOFF_TRAINING_PRESET,
  DEV_TEST_LAB_PRESET,
} from '../../../tokens/floatingPresets';
import { floatingStore } from '../../../tokens/floatingStore';
import { useUIStore } from '../../../core/store';
import { useKickoffTrainingStore } from '../../../tokens/kickoffTrainingStore';

export interface DeveloperTabProps {
  isLight?: boolean;
  onNavigateAdvancedAudio?: () => void;
  onNavigateEventAndTriggerer?: () => void;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const DeveloperTab: React.FC<DeveloperTabProps> = ({
  isLight = false,
  onNavigateAdvancedAudio,
  onNavigateEventAndTriggerer,
  onHover,
  onLeave,
}) => {
  const [carBallMode, setCarBallMode] = React.useState<string>(
    () => String(audioConfig.get('carBallSoundMode') || 'vehicle_body')
  );
  const [carCarMode, setCarCarMode] = React.useState<string>(
    () => String(audioConfig.get('carCarSoundMode') || 'vehicle_detail')
  );
  const wsVerticalOffsetPct = useKickoffTrainingStore((s) => s.wsVerticalOffsetPct);
  const setWsVerticalOffsetPct = useKickoffTrainingStore((s) => s.setWsVerticalOffsetPct);

  React.useEffect(() => {
    const handleSettingsChanged = () => {
      setCarBallMode(String(audioConfig.get('carBallSoundMode') || 'vehicle_body'));
      setCarCarMode(String(audioConfig.get('carCarSoundMode') || 'vehicle_detail'));
    };
    return audioConfig.subscribe(handleSettingsChanged);
  }, []);

  const onCarBallModeChange = (mode: string) => {
    setCarBallMode(mode);
    setCarBallSoundMode(mode);
  };

  const onCarCarModeChange = (mode: string) => {
    setCarCarMode(mode);
    setCarCarSoundMode(mode);
  };

  const ballSoundOptions = [
    { value: 'vehicle_body', label: 'Vehicle Body (Random 1 of 4)' },
    { value: 'vehicle_accent', label: 'Vehicle Accent (Single File)' },
  ];

  const carCarSoundOptions = [
    { value: 'vehicle_detail', label: 'Vehicle Detail (Default)' },
    { value: 'sfx_collision', label: 'SoundFX Collision' },
  ];

  return (
    <VStack gap="md" isLight={isLight}>
      {/* Entry 0: Developer Test Lab (4 Isolated Sandbox Benches + 70% Opacity Floating Controller) */}
      <div
        className={`flex items-center justify-between w-full p-3.5 rounded-xl border transition-colors select-none ${
          isLight
            ? 'bg-amber-500/10 border-amber-500/30 text-neutral-900'
            : 'bg-amber-500/10 border-amber-500/30 text-neutral-100'
        }`}
        onMouseEnter={() =>
          onHover(
            'Enter the Developer Test Lab: Automatically spawns the 70% opacity Floating Controller for 0G/Z-Hover Probes, Dual-World Ghost, TAS Replay (O/P/[/]), and 90s Incident Match.'
          )
        }
        onMouseLeave={onLeave}
      >
        <div className="flex items-start gap-3 min-w-0 pr-2">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 bg-amber-500/20 text-amber-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-left leading-tight min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold truncate">Developer Test Lab</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold bg-amber-500/20 border-amber-500/40 text-amber-400">
                4 Benches
              </span>
            </div>
            <span className={`text-xs mt-0.5 line-clamp-2 ${isLight ? 'text-neutral-600' : 'text-neutral-300'}`}>
              Probes (Z:100→200 + QE), Dual-World Ghost, TAS Replay (O/P/[/]), & 90s Incident Match
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            floatingStore.setOpacity(70);
            useUIStore.getState().bridge.onStartDevTestLab?.();
          }}
          className={`py-1.5 px-3.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
            isLight
              ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-white'
              : 'bg-amber-400 hover:bg-amber-300 border-amber-300 text-neutral-950'
          }`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Enter Lab</span>
        </button>
      </div>

      {/* Entry 0.5: Developer Test Lab Floating Window Spawner */}
      <FloatingWindowCard
        preset={DEV_TEST_LAB_PRESET}
        icon={<Cpu className="h-5 w-5" />}
        iconBgClass="bg-amber-500/10 text-amber-500"
        badge="70% Opacity"
        badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-400"
        description="Floating controller for Probes, Dual-World Ghost, TAS Scrubbing & 90s Incident Match"
        hoverTooltip="Developer Test Lab Controller: Closing this window from the top-right Stack automatically returns to Free Play."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Kickoff Keyboard Overlay W / S Vertical Offset Calibration (0% - 50%, default 10%) */}
      <div
        className={`w-full p-2.5 rounded-xl border select-none flex flex-col gap-2 ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center gap-2 px-1 pb-1 border-b border-neutral-700/30">
          <Keyboard className="h-4 w-4 text-sky-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
              Kickoff Rhythm Overlay Key Stagger
            </span>
            <span className={`text-[10px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              W (upward) & S (downward) vertical container offset (0% – 50%, default 10%)
            </span>
          </div>
        </div>

        <SettingSliderRow
          label="W / S Vertical Offset"
          value={wsVerticalOffsetPct}
          min={0}
          max={50}
          step={1}
          unit="%"
          onChange={(val) => setWsVerticalOffsetPct(val)}
          onHover={() =>
            onHover(
              'Adjusts the vertical stagger of W (upward) and S (downward) key receptors in the Kickoff Training rhythm overlay (0% to 50%, default 10%).'
            )
          }
          onLeave={onLeave}
          isLight={isLight}
        />
      </div>

      {/* Audio Variant Sound Sets (Segmented Controls) */}
      <div
        className={`w-full p-2.5 rounded-xl border select-none flex flex-col gap-2 ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div className="flex items-center gap-2 px-1 pb-1 border-b border-neutral-700/30">
          <Disc3 className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
              Audio Variant Sound Sets
            </span>
            <span className={`text-[10px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Ball Hit & Vehicle Collision Sound Schemes
            </span>
          </div>
        </div>

        <SettingSegmentedRow
          label="Car-Ball Hit Audio"
          subtitle="Vehicle Body (Random 1 of 4) vs Vehicle Accent"
          value={carBallMode}
          onChange={onCarBallModeChange}
          options={ballSoundOptions}
          onHover={() => onHover('Car-Ball impact audio scheme: Vehicle Body (random 01-04) or Vehicle Accent (single asset).')}
          onLeave={onLeave}
          isLight={isLight}
        />

        <SettingSegmentedRow
          label="Car-Car Bump Audio"
          subtitle="Vehicle Detail default (Random 1 of 6) vs SoundFX Collision"
          value={carCarMode}
          onChange={onCarCarModeChange}
          options={carCarSoundOptions}
          onHover={() => onHover('Car-Car collision audio scheme: Vehicle Detail (Random 1 of 6, default) or SoundFX Collision.')}
          onLeave={onLeave}
          isLight={isLight}
        />
      </div>

      {/* Entry 1: Advanced Audio Settings */}
      <div
        className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
        onMouseEnter={() => onHover('Multi-bus audio calibration (0% - 500%), arbitrary integer direct inputs, and configuration export.')}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <Sliders className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Advanced Audio Settings
            </span>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              Extended 0% - 500% multi-bus calibration & JSON export
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateAdvancedAudio?.()}
          className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <span>Configure</span>
          <ArrowRight className="h-3 w-3 opacity-75" />
        </button>
      </div>

      {/* Entry 2: Event and Triggerer */}
      <div
        className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
        onMouseEnter={() => onHover('Calibrate physical collision debounce timers, impulse thresholds, and console stream filters.')}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Event and Triggerer
            </span>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              Audio debounce windows, impulse thresholds & console filters
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateEventAndTriggerer?.()}
          className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <span>Configure</span>
          <ArrowRight className="h-3 w-3 opacity-75" />
        </button>
      </div>

      {/* Entry 2.5: Kickoff Training Configurator Floating Window */}
      <FloatingWindowCard
        preset={KICKOFF_TRAINING_PRESET}
        icon={<PencilRuler className="h-5 w-5" />}
        iconBgClass="bg-sky-500/10 text-sky-500"
        badge="PPO AI"
        badgeClass="bg-sky-500/15 border-sky-500/30 text-sky-400"
        description="Kickoff sub-modes, realistic wait (0.25s steps), N/120 speed & W/S offset"
        hoverTooltip="Kickoff Training Config: Floating tuner for PPO AI kickoff training parameters."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Entry 3: Event Stream OB */}
      <FloatingWindowCard
        preset={EVENT_STREAM_OB_PRESET}
        icon={<Activity className="h-5 w-5" />}
        iconBgClass="bg-sky-500/10 text-sky-500"
        badge="Shift+I"
        badgeClass="bg-sky-500/15 border-sky-500/30 text-sky-400"
        description="Physics collision observer, impulse curves & threshold visualizer"
        hoverTooltip="Event Stream OB: Real-time collision dynamics observer, impulse curves & audio threshold calibration (Shift+I)."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Entry 4: Dual-Arena Determinism Harness */}
      <FloatingWindowCard
        preset={DETERMINISM_HARNESS_PRESET}
        icon={<Target className="h-5 w-5" />}
        iconBgClass="bg-emerald-500/10 text-emerald-500"
        badge="Shift+O"
        badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
        description="Bit-exact physics rollback verification & desync delta monitoring"
        hoverTooltip="Dual-Arena Determinism Harness: Parallel RocketSim physics verification with live rollback desync checking (Shift+O)."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Entry 5: Boost Pad Visual Tuner */}
      <FloatingWindowCard
        preset={BOOST_PAD_TUNER_PRESET}
        icon={<Sparkles className="h-4 w-4" />}
        iconBgClass="bg-amber-500/10 text-amber-500"
        description="Upward gradient opacity, midpoint falloff & Big Pad floating orb"
        hoverTooltip="Boost Pad Visual Tuner: Upward opacity gradient falloff, midpoint calibration & Big Pad floating orb geometry."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />

      {/* Entry 6: Driftwoods Stadium Tuner */}
      <FloatingWindowCard
        preset={DRIFTWOODS_TUNER_PRESET}
        icon={<Palette className="h-4 w-4" />}
        iconBgClass="bg-emerald-500/10 text-emerald-500"
        description="Ground dynamic mask, 8-mesh PBR palette, UV scale & Lite mode"
        hoverTooltip="Driftwoods Stadium Tuner: Granular PBR material colors, ground dual-color mask, UV repeat/offset transforms & Lite Lambert mode."
        onHover={onHover}
        onLeave={onLeave}
        isLight={isLight}
      />
    </VStack>
  );
};
