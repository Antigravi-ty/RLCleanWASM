import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Volume2, Download, RotateCcw, Info, Sliders, Check, FileDown } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { VStack } from '../layout/VStack';
import {
  getAudioSettings,
  exportAudioSettingsJson,
  AUDIO_SETTINGS_CHANGED_EVENT,
  audioConfig
} from '../../audio/AudioArchitecture.js';

export interface Layer4AdvancedAudioRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

interface AudioVolumeItem {
  key: string;
  label: string;
  note: string;
}

interface AudioVolumeGroup {
  title: string;
  items: AudioVolumeItem[];
}

const AUDIO_VOLUME_GROUPS: AudioVolumeGroup[] = [
  {
    title: 'Core Bus & Powertrain',
    items: [
      { key: 'masterVolume', label: 'Master Volume', note: 'Global master output ceiling for all game audio channels' },
      { key: 'engineVolume', label: 'Engine Synthesizer', note: 'Continuous electric motor EMotorSynth powertrain loop' },
      { key: 'boostVolume', label: 'Boost Loop', note: 'Supersonic rocket boost discharge audio stream' },
    ],
  },
  {
    title: 'Vehicle Actions (Layer 1)',
    items: [
      { key: 'vehicleSelfVolume', label: 'Vehicle Actions Master', note: 'Overall ceiling for single-car kinematic sound effects' },
      { key: 'jumpVolume', label: 'Single Jump', note: 'Initial suspension launch pneumatic impulse' },
      { key: 'doubleJumpVolume', label: 'Double Jump', note: 'Secondary aerial thruster burst' },
      { key: 'dodgeVolume', label: 'Dodge / Flip', note: 'Directional torque flip snap and air friction' },
      { key: 'supersonicVolume', label: 'Supersonic Wind', note: 'Mach 1 shockwave continuous high-speed wind rumble' },
      { key: 'flipResetVolume', label: 'Flip Reset Chime', note: 'Four-wheel surface contact reset confirmation tone' },
    ],
  },
  {
    title: 'Collisions & Interactions (Layer 2)',
    items: [
      { key: 'carCarCollisionVolume', label: 'Car-Car Collision', note: 'Kinematic bumper impact and chassis deflection audio' },
      { key: 'boostCollectVolume', label: 'Boost Pad Collect', note: 'Small canister and full 100% boost orb pickup chime' },
    ],
  },
  {
    title: 'Ball SFX & Environment (Layer 3)',
    items: [
      { key: 'ballCollisionVolume', label: 'Ball Collision Master', note: 'Primary master bus for all ball dynamic contact sounds' },
      { key: 'carBallHitVolume', label: 'Car-Ball Hit Impact', note: 'Hard vehicle bumper impulse striking ball surface' },
      { key: 'ballWorldHitVolume', label: 'Ball-World / Wall Hit', note: 'Arena perimeter glass and curved boundary bounces' },
      { key: 'goalpostHitVolume', label: 'Goalpost Hit', note: 'Metallic goalpost and crossbar deflection acoustic ring' },
      { key: 'ballRollingVolume', label: 'Ball Rolling Loop', note: 'Pitch-scaled turf friction continuous loop' },
      { key: 'ballFlyingVolume', label: 'Ball Flying Loop', note: 'Airborne trajectory whoosh air displacement' },
      { key: 'goalScoredVolume', label: 'Goal Explosion Poof', note: 'Post-goal demolition shockwave sound' },
    ],
  },
];

interface AdvancedSliderRowProps {
  label: string;
  note: string;
  value: number; // 0 to 500 (percent)
  onChange: (val: number) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

const AdvancedSliderRow: React.FC<AdvancedSliderRowProps> = ({
  label,
  note,
  value,
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const [textInput, setTextInput] = useState(String(value));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setTextInput(String(value));
    }
  }, [value, isEditing]);

  const commitTextValue = () => {
    setIsEditing(false);
    const parsed = parseInt(textInput.trim(), 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(0, Math.min(500, parsed));
      onChange(clamped);
      setTextInput(String(clamped));
    } else {
      setTextInput(String(value));
    }
  };

  return (
    <div
      className="flex items-center gap-3 w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 select-none"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className="flex flex-col w-36 sm:w-44 shrink-0 min-w-0 pr-1 text-left">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        <span className={`text-[10px] truncate ${
          isLight ? 'text-neutral-500' : 'text-neutral-400'
        }`}>
          {note}
        </span>
      </div>

      <SliderPrimitive.Root
        value={[value]}
        min={0}
        max={500}
        step={1}
        onValueChange={(vals) => {
          onChange(vals[0]);
          setTextInput(String(vals[0]));
        }}
        className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
      >
        <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
          isLight ? 'bg-neutral-200' : 'bg-neutral-800'
        }`}>
          <SliderPrimitive.Range className={`absolute h-full rounded-full ${
            isLight ? 'bg-amber-600' : 'bg-amber-500'
          }`} />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
          isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
        }`} />
      </SliderPrimitive.Root>

      {/* Editable integer numeric input box */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="text"
          inputMode="numeric"
          value={textInput}
          onFocus={() => setIsEditing(true)}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9]/g, '');
            setTextInput(raw);
          }}
          onBlur={commitTextValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitTextValue();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setTextInput(String(value));
              setIsEditing(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          title="Type integer (0-500) and press Enter"
          className={`font-mono text-[11px] w-12 text-right py-0.5 px-1.5 rounded border outline-none transition-colors ${
            isLight
              ? 'bg-neutral-100 text-neutral-800 border-neutral-300 focus:border-amber-500 focus:bg-white'
              : 'bg-neutral-800 text-neutral-200 border-neutral-700 focus:border-amber-400 focus:bg-neutral-900'
          }`}
        />
        <span className={`font-mono text-[10px] w-3.5 select-none ${
          isLight ? 'text-neutral-500' : 'text-neutral-400'
        }`}>
          %
        </span>
      </div>
    </div>
  );
};

/**
 * [Recipe] Layer 4 Advanced Audio Settings Panel (Width: 560px)
 * Developer sub-menu for 0% - 500% volume matrix tuning and configuration export.
 */
export const Layer4AdvancedAudioRecipe: React.FC<Layer4AdvancedAudioRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const [audioSettings, setAudioSettings] = useState<Record<string, any>>(() => {
    try {
      return getAudioSettings();
    } catch {
      return {};
    }
  });

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Sync settings when external changes occur
  useEffect(() => {
    const handleSync = () => {
      setAudioSettings({ ...getAudioSettings() });
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleSync);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleSync);
  }, []);

  const handleUpdateVolume = (key: string, percentVal: number) => {
    const floatVal = percentVal / 100;
    audioConfig.set(key, floatVal);
    setAudioSettings((prev) => ({ ...prev, [key]: floatVal }));
  };

  const handleExportConfig = () => {
    try {
      const json = exportAudioSettingsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audioConfig.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice('audioConfig.json exported successfully!');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (e) {
      setExportNotice('Export failed.');
      setTimeout(() => setExportNotice(null), 3000);
    }
  };

  const handleResetAllVolumes = () => {
    for (const group of AUDIO_VOLUME_GROUPS) {
      for (const item of group.items) {
        handleUpdateVolume(item.key, 100);
      }
    }
  };

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[560px]">
      <PanelHeader
        title="ADVANCED AUDIO SETTINGS"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <VStack gap="md" isLight={isLight}>
          {/* Top Action Bar: Export & Reset */}
          <div className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-2.5 transition-colors ${
            isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/90 border-neutral-700/80'
          }`}>
            <div className="flex flex-col text-left">
              <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Acoustic Matrix Tuning (0% - 500%)
              </span>
              <span className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Direct numeric input or slider drag with Enter confirmation
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportConfig}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition-all cursor-pointer active:scale-95"
                title="Export current parameters to audioConfig.json"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                onClick={handleResetAllVolumes}
                className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
                }`}
                title="Reset all volume gains to standard 100%"
              >
                <RotateCcw className="h-3.5 w-3.5 opacity-75" />
                <span>Reset 100%</span>
              </button>
            </div>
          </div>

          {/* Export Toast Notification */}
          {exportNotice && (
            <div className="py-1.5 px-3 rounded-lg text-xs font-mono font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 animate-fade-in">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>{exportNotice}</span>
            </div>
          )}

          {/* Volume Groups */}
          {AUDIO_VOLUME_GROUPS.map((group) => (
            <div
              key={group.title}
              className={`p-3.5 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                isLight ? 'bg-neutral-50/70 border-neutral-200' : 'bg-neutral-850/70 border-neutral-700/80'
              }`}
            >
              <span className={`text-[11px] font-bold uppercase tracking-wider px-1 pb-1 border-b ${
                isLight ? 'text-neutral-500 border-neutral-200' : 'text-neutral-400 border-neutral-800'
              }`}>
                {group.title}
              </span>

              <div className="flex flex-col divide-y divide-neutral-200/50 dark:divide-neutral-800/50 pt-0.5">
                {group.items.map((item) => {
                  const rawFloat = audioSettings[item.key] ?? 1.0;
                  const percent = Math.round(rawFloat * 100);

                  return (
                    <AdvancedSliderRow
                      key={item.key}
                      label={item.label}
                      note={item.note}
                      value={percent}
                      isLight={isLight}
                      onChange={(newPercent) => handleUpdateVolume(item.key, newPercent)}
                      onHover={() => setHoveredDesc(`${item.label}: ${item.note}`)}
                      onLeave={() => setHoveredDesc(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
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
            {hoveredDesc || 'Adjust audio matrix volumes (0% - 500%) with direct integer input.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
