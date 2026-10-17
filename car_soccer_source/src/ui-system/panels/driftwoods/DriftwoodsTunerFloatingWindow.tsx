import React, { useState } from 'react';
import {
  Palette,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Layers,
  Zap,
  Grid,
  ChevronDown,
  Video
} from 'lucide-react';
import { useUIStore } from '../../core/store';
import { DRIFTWOODS_PRESETS, DriftwoodsPreset } from '../../core/driftwoodsConfig';
import { DriftwoodsGroundTab } from './DriftwoodsGroundTab';
import { DriftwoodsSurfacesTab } from './DriftwoodsSurfacesTab';
import { DriftwoodsTransparentTab } from './DriftwoodsTransparentTab';
import { DriftwoodsPerformanceTab } from './DriftwoodsPerformanceTab';
import { TunerPrecisionContext, TunerRow, PrecisionDigitPicker } from './DriftwoodsTunerControls';

export interface DriftwoodsTunerFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

type TunerTab = 'ground' | 'surfaces' | 'transparent' | 'performance';

export const DriftwoodsTunerFloatingWindow: React.FC<DriftwoodsTunerFloatingWindowProps> = ({
  isLight = false,
  active = true,
}) => {
  const config = useUIStore((s) => s.driftwoodsTuner);
  const updateConfig = useUIStore((s) => s.updateDriftwoodsTuner);
  const resetConfig = useUIStore((s) => s.resetDriftwoodsTuner);
  const applyPreset = useUIStore((s) => s.applyDriftwoodsPreset);

  const isFreeCam = useUIStore((s) => s.isFreeCam);
  const freeCamFov = useUIStore((s) => s.freeCamFov);
  const toggleFreeCam = useUIStore((s) => s.toggleFreeCam);
  const setFreeCamFov = useUIStore((s) => s.setFreeCamFov);

  const precisionStep = useUIStore((s) => s.precisionStep);
  const setPrecisionStep = useUIStore((s) => s.setPrecisionStep);

  const [activeTab, setActiveTab] = useState<TunerTab>('ground');
  const [copied, setCopied] = useState<boolean>(false);
  const [presetDropdownOpen, setPresetDropdownOpen] = useState<boolean>(false);

  const handleCopy = () => {
    try {
      const json = JSON.stringify(config, null, 2);
      navigator.clipboard?.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('[DriftwoodsTuner] Failed to copy config to clipboard:', err);
    }
  };

  const handleSelectPreset = (preset: DriftwoodsPreset) => {
    applyPreset(preset);
    setPresetDropdownOpen(false);
  };

  return (
    <TunerPrecisionContext.Provider value={{ step: precisionStep, setStep: setPrecisionStep }}>
      <div className="flex flex-col gap-2 h-full select-none text-xs pb-2">
        {/* 1. Header Toolbar */}
        <div
          className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/60 border-neutral-700/60'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Palette className="h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-xs uppercase tracking-wide truncate">
                Driftwoods Stadium Tuner
              </span>
              <span className="text-[10px] opacity-75 truncate">
                8-Mesh PBR palette, dynamic ground mask & UV matrix
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Preset Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPresetDropdownOpen(!presetDropdownOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
                  isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                    : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-200'
                }`}
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Presets</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {presetDropdownOpen && (
                <div
                  className={`absolute right-0 mt-1 w-56 rounded-xl border shadow-xl py-1 z-50 flex flex-col backdrop-blur-md ${
                    isLight ? 'bg-white/95 border-neutral-200 text-neutral-800' : 'bg-neutral-900/95 border-neutral-700 text-neutral-100'
                  }`}
                >
                  {DRIFTWOODS_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={`px-3 py-1.5 text-left text-xs transition-colors cursor-pointer flex flex-col ${
                        isLight ? 'hover:bg-neutral-100' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <span className="font-semibold text-emerald-500">{p.name}</span>
                      <span className="text-[10px] opacity-70 truncate">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Copy Config */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy current stadium configuration JSON to clipboard"
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer transition-all active:scale-95 ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : isLight
                  ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Reset Defaults */}
            <button
              type="button"
              onClick={resetConfig}
              title="Reset stadium parameters to defaults"
              className={`p-1 rounded-lg border cursor-pointer transition-all active:scale-95 ${
                isLight
                  ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-200'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Step Precision Digit Picker */}
        <PrecisionDigitPicker
          step={precisionStep}
          onStepChange={setPrecisionStep}
          isLight={isLight}
        />

        {/* 3. Free Camera Developer Fly-Cam Switch & Controls */}
        <div
          className={`p-2 rounded-xl border flex flex-col gap-1.5 transition-colors ${
            isFreeCam
              ? isLight
                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400'
                : 'bg-emerald-950/25 border-emerald-500/60 ring-1 ring-emerald-500/30'
              : isLight
              ? 'bg-neutral-50/80 border-neutral-200'
              : 'bg-neutral-900/60 border-neutral-700/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className={`h-4 w-4 shrink-0 ${isFreeCam ? 'text-emerald-400' : 'text-neutral-400'}`} />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs">Free Camera Mode</span>
                  <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                    Shift + F
                  </span>
                </div>
                <span className={`text-[10px] leading-tight ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {isFreeCam ? 'Active: Coordinates Persisted | WASD Move, I/M Altitude' : 'Developer free-flight spectator mode'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isFreeCam && (
                <button
                  type="button"
                  onClick={() => useUIStore.getState().bridge?.onResetFreeCam?.()}
                  title="Reset to stadium default panorama coordinates"
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border cursor-pointer transition-all active:scale-95 ${
                    isLight
                      ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                      : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-600 text-neutral-300'
                  }`}
                >
                  Reset Coords
                </button>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={isFreeCam}
                onClick={() => toggleFreeCam()}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isFreeCam ? 'bg-emerald-500' : isLight ? 'bg-neutral-300' : 'bg-neutral-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isFreeCam ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {isFreeCam && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-emerald-500/20">
              <TunerRow
                label="Free Camera FOV"
                description="Adjust fly-camera field of view in degrees (10° - 140°)"
                value={freeCamFov}
                sliderMin={10}
                sliderMax={140}
                sliderStep={1}
                stepOverride={1}
                unit="°"
                onChange={setFreeCamFov}
                isLight={isLight}
              />

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono text-emerald-400/90 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/25">
                <span>• <strong>WASD</strong>: Horizontal move</span>
                <span>• <strong>I / M</strong>: Elevate UP / DOWN</span>
                <span>• <strong>Mouse Drag</strong>: Free look</span>
                <span>• <strong>Shift</strong>: 2.5x Speed</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Sub-Navigation Tabs */}
        <div
          className={`grid grid-cols-4 p-1 rounded-xl border text-[11px] font-semibold text-center ${
            isLight ? 'bg-neutral-100 border-neutral-200 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('ground')}
            className={`py-1 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === 'ground'
                ? isLight
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'bg-neutral-800 text-emerald-400 shadow-xs'
                : 'hover:text-neutral-200'
            }`}
          >
            <Grid className="h-3 w-3" />
            <span>Ground</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('surfaces')}
            className={`py-1 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === 'surfaces'
                ? isLight
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'bg-neutral-800 text-emerald-400 shadow-xs'
                : 'hover:text-neutral-200'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Surfaces</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transparent')}
            className={`py-1 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === 'transparent'
                ? isLight
                  ? 'bg-white text-emerald-600 shadow-xs'
                  : 'bg-neutral-800 text-emerald-400 shadow-xs'
                : 'hover:text-neutral-200'
            }`}
          >
            <Sparkles className="h-3 w-3" />
            <span>Enclosures</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`py-1 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
              activeTab === 'performance'
                ? isLight
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'bg-neutral-800 text-amber-400 shadow-xs'
                : 'hover:text-neutral-200'
            }`}
          >
            <Zap className="h-3 w-3" />
            <span>Lite Mode</span>
          </button>
        </div>

        {/* 5. Tab Body */}
        <div className="flex-1 overflow-y-auto pr-0.5">
          {activeTab === 'ground' && (
            <DriftwoodsGroundTab
              ground={config.ground}
              onChange={(patch) => updateConfig({ ground: { ...config.ground, ...patch } })}
              isLight={isLight}
            />
          )}

          {activeTab === 'surfaces' && (
            <DriftwoodsSurfacesTab
              config={config}
              onChange={updateConfig}
              isLight={isLight}
            />
          )}

          {activeTab === 'transparent' && (
            <DriftwoodsTransparentTab
              config={config}
              onChange={updateConfig}
              isLight={isLight}
            />
          )}

          {activeTab === 'performance' && (
            <DriftwoodsPerformanceTab
              config={config}
              onChange={updateConfig}
              isLight={isLight}
            />
          )}
        </div>

        {/* 6. Footer Guidelines */}
        <div
          className={`p-2 rounded-xl border text-[10px] leading-relaxed transition-colors font-mono ${
            isLight
              ? 'bg-neutral-100/60 border-neutral-200 text-neutral-600'
              : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
          }`}
        >
          <div>• Real-time GPU updates: zero CPU re-sampling for ground mask & tinting</div>
          <div>• Precision step: select segmented digit & press Arrow keys on any focused parameter</div>
        </div>
      </div>
    </TunerPrecisionContext.Provider>
  );
};
