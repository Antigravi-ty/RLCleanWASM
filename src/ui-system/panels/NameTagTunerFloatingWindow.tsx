import React from 'react';
import {
  Play,
  Shuffle,
  RotateCcw,
  Tag,
  Palette,
  Users,
  XCircle,
} from 'lucide-react';
import { useNameTagTunerStore } from '../../stores/nameTagTunerStore';
import { Button } from '../primitives/Button';
import { SliderControl } from '../primitives/SliderControl';
import { ToggleSwitch } from '../primitives/ToggleSwitch';

export interface NameTagTunerFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const NameTagTunerFloatingWindow: React.FC<NameTagTunerFloatingWindowProps> = ({
  isLight = false,
}) => {
  const {
    config,
    isTunerArenaActive,
    kickoffPermutationIndex,
    updateConfig,
    updatePreviewName,
    resetConfig,
    enterTunerArenaAndSpawnSixCars,
    exitTunerArena,
    reshuffleKickoffPositions,
  } = useNameTagTunerStore();

  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const mutedText = isLight ? 'text-neutral-500' : 'text-neutral-400';

  const truncatePreview = (str: string) => {
    const clean = (str || 'Player').trim();
    if (clean.length <= config.maxChars) return clean;
    return `${clean.slice(0, Math.max(1, config.maxChars - 1))}…`;
  };

  return (
    <div className="flex flex-col gap-2.5 select-none text-xs">
      {/* 1. Stadium 6-Car Kickoff Arena Evaluation Controls */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                isTunerArenaActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-xs truncate">
              {isTunerArenaActive
                ? `6-Car Kickoff Arena Active (Formation #${kickoffPermutationIndex + 1})`
                : 'Stadium Evaluation Standby'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] ${mutedText}`}>Enabled</span>
            <ToggleSwitch
              checked={config.enabled}
              onChange={(v) => updateConfig({ enabled: v })}
              isLight={isLight}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="sm"
            onClick={enterTunerArenaAndSpawnSixCars}
            isLight={isLight}
            className="flex-1 gap-1.5 py-1.5 text-[11px] font-semibold justify-center"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>
              {isTunerArenaActive
                ? 'Refocus 6 Kickoff Cars'
                : 'Enter Arena & Spawn 6 Kickoff Cars'}
            </span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={reshuffleKickoffPositions}
            isLight={isLight}
            className="gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Reshuffle Kickoff</span>
          </Button>

          {isTunerArenaActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={exitTunerArena}
              isLight={isLight}
              className="gap-1 px-2 py-1.5 text-[11px] font-semibold text-rose-400"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Exit</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Live 2D Horizontal Pill Preview */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-sky-400" />
            <span>Horizontal Pill Preview (Blue vs Orange)</span>
          </span>
          <span className={`text-[10px] font-mono ${mutedText}`}>
            {config.pillWidth}×{config.pillHeight}px · Font {config.fontSize}px
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 py-1 items-center justify-items-center bg-neutral-950/60 rounded-lg p-2 border border-neutral-800">
          {[0, 1].map((team) => {
            const isOrange = team === 1;
            const bgHex = isOrange ? config.orangeBgColor : config.blueBgColor;
            const borderHex = isOrange ? config.orangeBorderColor : config.blueBorderColor;
            const textHex = isOrange ? config.orangeTextColor : config.blueTextColor;
            const sample = truncatePreview(
              config.previewNames[isOrange ? 3 : 0] || (isOrange ? 'BlazeVortex' : 'AlphaStriker')
            );
            return (
              <div
                key={team}
                style={{
                  width: `${Math.min(200, Math.round(config.pillWidth * 0.65))}px`,
                  height: `${Math.min(54, Math.round(config.pillHeight * 0.65))}px`,
                  backgroundColor: bgHex,
                  borderColor: borderHex,
                  borderWidth: `${Math.max(0, config.borderWidth * 0.75)}px`,
                  borderStyle: 'solid',
                  borderRadius: '9999px',
                  opacity: config.opacity,
                  color: textHex,
                  fontSize: `${Math.max(10, Math.round(config.fontSize * 0.58))}px`,
                }}
                className="flex items-center justify-center font-bold font-mono overflow-hidden px-2 shadow-sm"
              >
                <span className="truncate">{sample}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Pill Dimensions, Typography, Truncation & Camera Scaling */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px]">Dimensions, Typography &amp; Camera Scale</span>
          <button
            type="button"
            onClick={resetConfig}
            className="text-[10px] font-mono text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <SliderControl
            label="Pill Width"
            value={config.pillWidth}
            min={100}
            max={460}
            step={4}
            unit="px"
            onChange={(v) => updateConfig({ pillWidth: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Pill Height"
            value={config.pillHeight}
            min={28}
            max={120}
            step={2}
            unit="px"
            onChange={(v) => updateConfig({ pillHeight: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Font Size"
            value={config.fontSize}
            min={12}
            max={48}
            step={1}
            unit="px"
            onChange={(v) => updateConfig({ fontSize: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Border Thickness"
            value={config.borderWidth}
            min={0}
            max={12}
            step={0.5}
            unit="px"
            onChange={(v) => updateConfig({ borderWidth: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Truncation Length"
            value={config.maxChars}
            min={4}
            max={32}
            step={1}
            unit="chars"
            onChange={(v) => updateConfig({ maxChars: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Camera Relative Scale"
            value={config.cameraScaleFactor}
            min={0.04}
            max={0.3}
            step={0.01}
            onChange={(v) => updateConfig({ cameraScaleFactor: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Card Opacity"
            value={config.opacity}
            min={0.1}
            max={1.0}
            step={0.02}
            onChange={(v) => updateConfig({ opacity: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Background Fill Opacity"
            value={config.bgOpacity}
            min={0.0}
            max={1.0}
            step={0.02}
            onChange={(v) => updateConfig({ bgOpacity: v })}
            isLight={isLight}
          />
          <SliderControl
            label="Vertical Offset Above Car"
            value={config.verticalOffsetUu}
            min={30}
            max={240}
            step={2}
            unit="UU"
            onChange={(v) => updateConfig({ verticalOffsetUu: v })}
            isLight={isLight}
          />
        </div>
      </div>

      {/* 4. Team Color Palette (Fill, Border, Text) */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
        <span className="font-bold text-[11px] flex items-center gap-1.5">
          <Palette className="h-3.5 w-3.5 text-amber-400" />
          <span>Team Pill Colors (Background · Border · Text)</span>
        </span>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Blue Team */}
          <div className="p-2 rounded-lg border border-sky-500/30 bg-sky-500/5 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-sky-400">BLUE TEAM</span>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Background</span>
              <input
                type="color"
                value={config.blueBgColor}
                onChange={(e) => updateConfig({ blueBgColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Border</span>
              <input
                type="color"
                value={config.blueBorderColor}
                onChange={(e) => updateConfig({ blueBorderColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Text</span>
              <input
                type="color"
                value={config.blueTextColor}
                onChange={(e) => updateConfig({ blueTextColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>

          {/* Orange Team */}
          <div className="p-2 rounded-lg border border-orange-500/30 bg-orange-500/5 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-orange-400">ORANGE TEAM</span>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Background</span>
              <input
                type="color"
                value={config.orangeBgColor}
                onChange={(e) => updateConfig({ orangeBgColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Border</span>
              <input
                type="color"
                value={config.orangeBorderColor}
                onChange={(e) => updateConfig({ orangeBorderColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className={mutedText}>Text</span>
              <input
                type="color"
                value={config.orangeTextColor}
                onChange={(e) => updateConfig({ orangeTextColor: e.target.value })}
                className="h-5 w-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. 6 Kickoff Car Sample Usernames */}
      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${cardBg}`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span>6 Kickoff Car Sample Usernames</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] ${mutedText}`}>Show on Local Car</span>
            <ToggleSwitch
              checked={config.showOnLocalCar}
              onChange={(v) => updateConfig({ showOnLocalCar: v })}
              isLight={isLight}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          {config.previewNames.map((name, idx) => {
            const isOrange = idx >= 3;
            return (
              <div key={idx} className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-mono font-bold w-6 shrink-0 ${
                    isOrange ? 'text-orange-400' : 'text-sky-400'
                  }`}
                >
                  {isOrange ? `O${idx - 2}` : `B${idx + 1}`}
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updatePreviewName(idx, e.target.value)}
                  className={`w-full px-2 py-1 rounded border text-[10px] font-mono outline-none ${
                    isLight
                      ? 'bg-white border-neutral-300 text-neutral-800 focus:border-sky-500'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-200 focus:border-sky-400'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
