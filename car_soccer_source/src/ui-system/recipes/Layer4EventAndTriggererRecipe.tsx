import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Radio, Zap, Activity, Info, Check, CheckSquare, Square, RotateCcw } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { VStack } from '../layout/VStack';
import {
  audioConfig,
  AUDIO_SETTINGS_CHANGED_EVENT,
  CONSOLE_LOG_EVENT_CATALOG,
  selectAllEventLogs,
  deselectAllEventLogs,
  setEventLogFilterItem,
  createDefaultLogEventFilter
} from '../../audio/AudioArchitecture.js';

export interface Layer4EventAndTriggererRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

interface StepperSliderRowProps {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const StepperSliderRow: React.FC<StepperSliderRowProps> = ({
  label,
  note,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const [inputText, setInputText] = useState(String(value));

  useEffect(() => {
    setInputText(String(value));
  }, [value]);

  const commitInput = () => {
    const parsed = parseInt(inputText, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      onChange(clamped);
      setInputText(String(clamped));
    } else {
      setInputText(String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitInput();
    } else if (e.key === 'Escape') {
      setInputText(String(value));
    }
  };

  return (
    <div
      className={`flex items-center gap-3 w-full py-2 px-2.5 rounded-xl transition-colors select-none ${
        isLight ? 'hover:bg-neutral-500/10' : 'hover:bg-neutral-800/60'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex flex-col text-left leading-tight w-44 shrink-0 min-w-0 pr-1">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        <span className={`text-[10px] mt-0.5 truncate ${
          isLight ? 'text-neutral-500' : 'text-neutral-400'
        }`}>
          {note}
        </span>
      </div>

      <SliderPrimitive.Root
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(vals) => onChange(vals[0])}
        className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
      >
        <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
          isLight ? 'bg-neutral-200' : 'bg-neutral-800'
        }`}>
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-amber-500" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
        }`} />
      </SliderPrimitive.Root>

      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={commitInput}
          onKeyDown={handleKeyDown}
          title="Direct numeric input - Press Enter to confirm"
          className={`font-mono text-xs w-14 text-center py-0.5 px-1 rounded-md border outline-none transition-colors ${
            isLight
              ? 'bg-neutral-100 text-neutral-800 border-neutral-300 focus:border-amber-500 focus:bg-white'
              : 'bg-neutral-900 text-neutral-200 border-neutral-700 focus:border-amber-500 focus:bg-neutral-950'
          }`}
        />
        {unit && (
          <span className={`text-[10px] font-mono shrink-0 w-6 ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

export const Layer4EventAndTriggererRecipe: React.FC<Layer4EventAndTriggererRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Sync state with audioConfig
  const [settings, setSettings] = useState(() => ({
    incidentCooldownMs: audioConfig.get('incidentCooldownMs') ?? 40,
    carBallHitCooldownMs: audioConfig.get('carBallHitCooldownMs') ?? 40,
    goalpostHitCooldownMs: audioConfig.get('goalpostHitCooldownMs') ?? 60,
    carBallHitImpulseThreshold: audioConfig.get('carBallHitImpulseThreshold') ?? 0,
    goalpostHitThreshold: audioConfig.get('goalpostHitThreshold') ?? 120,
    ballGroundHitThreshold: audioConfig.get('ballGroundHitThreshold') ?? 140,
    ballWallHitThreshold: audioConfig.get('ballWallHitThreshold') ?? 160,
    netDualTriggerAngleDeg: audioConfig.get('netDualTriggerAngleDeg') ?? 60,
    logAllEvents: Boolean(audioConfig.get('logAllEvents')),
    logCarBallHitEvents: Boolean(audioConfig.get('logCarBallHitEvents')),
    logEventFilter: audioConfig.config?.logEventFilter || createDefaultLogEventFilter(),
  }));

  useEffect(() => {
    const handleSync = () => {
      setSettings({
        incidentCooldownMs: audioConfig.get('incidentCooldownMs') ?? 40,
        carBallHitCooldownMs: audioConfig.get('carBallHitCooldownMs') ?? 40,
        goalpostHitCooldownMs: audioConfig.get('goalpostHitCooldownMs') ?? 60,
        carBallHitImpulseThreshold: audioConfig.get('carBallHitImpulseThreshold') ?? 0,
        goalpostHitThreshold: audioConfig.get('goalpostHitThreshold') ?? 120,
        ballGroundHitThreshold: audioConfig.get('ballGroundHitThreshold') ?? 140,
        ballWallHitThreshold: audioConfig.get('ballWallHitThreshold') ?? 160,
        netDualTriggerAngleDeg: audioConfig.get('netDualTriggerAngleDeg') ?? 60,
        logAllEvents: Boolean(audioConfig.get('logAllEvents')),
        logCarBallHitEvents: Boolean(audioConfig.get('logCarBallHitEvents')),
        logEventFilter: audioConfig.config?.logEventFilter || createDefaultLogEventFilter(),
      });
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleSync);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleSync);
  }, []);

  const updateSetting = (key: string, val: any) => {
    audioConfig.set(key, val);
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleToggleFilter = (hex: string) => {
    const key = hex.toLowerCase();
    const currentVal = Boolean(settings.logEventFilter[key]);
    const nextVal = !currentVal;
    setEventLogFilterItem(key, nextVal);
    const nextFilters = {
      ...settings.logEventFilter,
      [key]: nextVal,
    };
    const hasAnyChecked = Object.values(nextFilters).some(Boolean);
    const nextLogAll = (hasAnyChecked && !settings.logAllEvents) ? true : settings.logAllEvents;
    setSettings((prev) => ({
      ...prev,
      logAllEvents: nextLogAll,
      logEventFilter: nextFilters,
    }));
  };

  const handleSelectAll = () => {
    selectAllEventLogs();
    const allTrue: Record<string, boolean> = {};
    for (const item of CONSOLE_LOG_EVENT_CATALOG) {
      allTrue[item.hex.toLowerCase()] = true;
    }
    setSettings((prev) => ({
      ...prev,
      logAllEvents: true,
      logEventFilter: allTrue,
    }));
  };

  const handleDeselectAll = () => {
    deselectAllEventLogs();
    const empty: Record<string, boolean> = {};
    for (const item of CONSOLE_LOG_EVENT_CATALOG) {
      empty[item.hex.toLowerCase()] = false;
    }
    setSettings((prev) => ({
      ...prev,
      logAllEvents: false,
      logEventFilter: empty,
    }));
  };

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[580px]">
      <PanelHeader
        title="EVENT & TRIGGERER"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-5">
        <VStack gap="lg" isLight={isLight}>
          {/* Section 1: Audio Debounce & Cooldowns */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Audio Debounce & Shielding
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border flex flex-col gap-1 transition-colors ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
            >
              <StepperSliderRow
                label="Car-Ball Hit Debounce"
                note="Minimum interval between vehicle-ball hit sounds"
                value={settings.carBallHitCooldownMs}
                min={0}
                max={100}
                step={1}
                unit="ms"
                onChange={(val) => updateSetting('carBallHitCooldownMs', val)}
                onHover={() => setHoveredDesc('Prevents stuttering or rapid re-triggering during multi-tick ball contacts.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Goalpost Hit Debounce"
                note="Cooldown between goal frame impact audio triggers"
                value={settings.goalpostHitCooldownMs}
                min={0}
                max={500}
                step={5}
                unit="ms"
                onChange={(val) => updateSetting('goalpostHitCooldownMs', val)}
                onHover={() => setHoveredDesc('Re-trigger debounce window for crossbar and upright net post collisions.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Global Incident Debounce"
                note="Master debounce window for all physics contact sounds"
                value={settings.incidentCooldownMs}
                min={0}
                max={500}
                step={5}
                unit="ms"
                onChange={(val) => updateSetting('incidentCooldownMs', val)}
                onHover={() => setHoveredDesc('Baseline audio event queue cooldown across world, net, and car contacts.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />
            </div>
          </div>

          {/* Section 2: Real Collision Impulse Thresholds */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Activity className="h-3.5 w-3.5 text-amber-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Collision Impulse Thresholds
              </span>
            </div>

            <div
              className={`p-3 rounded-xl border flex flex-col gap-1 transition-colors ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
            >
              <StepperSliderRow
                label="Car-Ball Impulse Threshold"
                note="Minimum bumper impulse required to play hit sound"
                value={settings.carBallHitImpulseThreshold}
                min={0}
                max={1000}
                step={5}
                onChange={(val) => updateSetting('carBallHitImpulseThreshold', val)}
                onHover={() => setHoveredDesc('Filter out weak touches/dribbles so only impactful strikes generate hit audio.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Goalpost Hit Threshold"
                note="Impulse threshold for crossbar / post clanks"
                value={settings.goalpostHitThreshold}
                min={0}
                max={1000}
                step={5}
                onChange={(val) => updateSetting('goalpostHitThreshold', val)}
                onHover={() => setHoveredDesc('Minimum collision force before playing the metallic goalpost impact sound.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Ball-Ground Bounce Threshold"
                note="Ball velocity impulse threshold on pitch floor"
                value={settings.ballGroundHitThreshold}
                min={0}
                max={1000}
                step={5}
                onChange={(val) => updateSetting('ballGroundHitThreshold', val)}
                onHover={() => setHoveredDesc('Minimum downward impulse needed to trigger synthetic grass thud.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Ball-Wall Collision Threshold"
                note="Impulse threshold for curved perimeter walls"
                value={settings.ballWallHitThreshold}
                min={0}
                max={1000}
                step={5}
                onChange={(val) => updateSetting('ballWallHitThreshold', val)}
                onHover={() => setHoveredDesc('Minimum impact energy to trigger Plexiglas/curved arena wall bounce sound.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />

              <StepperSliderRow
                label="Goal Net Trigger Angle"
                note="Dual-trigger entry angle threshold"
                value={settings.netDualTriggerAngleDeg}
                min={0}
                max={90}
                step={1}
                unit="°"
                onChange={(val) => updateSetting('netDualTriggerAngleDeg', val)}
                onHover={() => setHoveredDesc('Ball trajectory incident angle for playing secondary net ripple sound.')}
                onLeave={() => setHoveredDesc(null)}
                isLight={isLight}
              />
            </div>
          </div>

          {/* Section 3: Event Stream & Console Logging */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <Radio className="h-3.5 w-3.5 text-amber-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-neutral-700' : 'text-neutral-300'
              }`}>
                Event Stream & Console Logging
              </span>
            </div>

            <div
              className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-colors ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
              }`}
            >
              {/* Toggles */}
              <div
                className="flex items-center justify-between w-full cursor-pointer select-none"
                onClick={() => updateSetting('logAllEvents', !settings.logAllEvents)}
                onMouseEnter={() => setHoveredDesc('Master switch to stream filtered physics and signal events into developer console.')}
                onMouseLeave={() => setHoveredDesc(null)}
              >
                <div className="flex flex-col text-left leading-tight pr-2">
                  <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                    Enable Event Console Log
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Master switch to stream filtered physics and signal events into developer console
                  </span>
                </div>
                <ToggleSwitch
                  checked={settings.logAllEvents}
                  onCheckedChange={(checked) => updateSetting('logAllEvents', checked)}
                  isLight={isLight}
                  variant="amber"
                />
              </div>

              <div
                className="flex items-center justify-between w-full cursor-pointer select-none"
                onClick={() => updateSetting('logCarBallHitEvents', !settings.logCarBallHitEvents)}
                onMouseEnter={() => setHoveredDesc('Log structured car-ball contact impulses to console.')}
                onMouseLeave={() => setHoveredDesc(null)}
              >
                <div className="flex flex-col text-left leading-tight pr-2">
                  <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                    Log Car-Ball Hit Structs Only
                  </span>
                  <span className={`text-[10px] mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Print vehicle bumper velocity, impulse, and contact normal vector
                  </span>
                </div>
                <ToggleSwitch
                  checked={settings.logCarBallHitEvents}
                  onCheckedChange={(checked) => updateSetting('logCarBallHitEvents', checked)}
                  isLight={isLight}
                  variant="amber"
                />
              </div>

              {/* Event Filter Grid */}
              <div
                className={`pt-3 border-t flex flex-col gap-2.5 ${
                  isLight ? 'border-neutral-200' : 'border-neutral-700/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                    isLight ? 'text-neutral-600' : 'text-neutral-400'
                  }`}>
                    Console Filter Catalog
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                      }`}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-neutral-200 hover:bg-neutral-300 border-neutral-300 text-neutral-800'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
                      }`}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {CONSOLE_LOG_EVENT_CATALOG.map((item) => {
                    const isChecked = Boolean(settings.logEventFilter[item.hex.toLowerCase()]);
                    return (
                      <div
                        key={item.hex}
                        onClick={() => handleToggleFilter(item.hex)}
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                          isChecked
                            ? isLight
                              ? 'bg-amber-500/10 border-amber-500/30 text-neutral-900'
                              : 'bg-amber-500/10 border-amber-500/40 text-neutral-100'
                            : isLight
                            ? 'bg-neutral-100/60 border-neutral-200 text-neutral-400 opacity-60'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-500 opacity-60'
                        }`}
                      >
                        <span className={`font-mono text-[10px] px-1 py-0.5 rounded font-bold ${
                          isChecked
                            ? 'bg-amber-500/20 text-amber-500'
                            : isLight ? 'bg-neutral-200 text-neutral-500' : 'bg-neutral-800 text-neutral-600'
                        }`}>
                          {item.hex}
                        </span>
                        <div className="flex flex-col min-w-0 flex-1 leading-tight">
                          <span className="text-[11px] font-semibold truncate">
                            {item.name}
                          </span>
                          <span className="text-[9px] font-mono opacity-60 truncate">
                            {item.id}
                          </span>
                        </div>
                        {isChecked ? (
                          <CheckSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className={`truncate transition-colors duration-150 ${
            hoveredDesc
              ? (isLight ? 'text-neutral-900' : 'text-neutral-100')
              : (isLight ? 'text-neutral-400' : 'text-neutral-500')
          }`}>
            {hoveredDesc || 'Calibrate acoustic physical debounce intervals, impulse trigger thresholds and console event log stream filters.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
