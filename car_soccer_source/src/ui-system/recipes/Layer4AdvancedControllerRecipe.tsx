import React, { useState, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Gamepad2, RotateCcw, AlertCircle, Sliders, ChevronDown } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { VStack } from '../layout/VStack';
import { useUIStore } from '../core/store';
import {
  loadInputBindings,
  saveInputBindings,
  resetAxisBindings,
  getSelectedController,
  setSelectedController,
  getConnectedGamepads,
  detectControllerType
} from '../../input/InputBindings.js';

export interface Layer4AdvancedControllerRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

const AXIS_OPTIONS = [
  { value: 0, label: 'Axis 0 · Left Stick X (Horizontal)' },
  { value: 1, label: 'Axis 1 · Left Stick Y (Vertical)' },
  { value: 2, label: 'Axis 2 · Right Stick X (Horizontal)' },
  { value: 3, label: 'Axis 3 · Right Stick Y (Vertical)' },
];

/**
 * [Recipe] Layer 4 Advanced Controller Settings Panel (Width: 560px)
 * Dedicated Level 4 nested menu for controller selection, analog axis roles, and stick deadzones.
 */
export const Layer4AdvancedControllerRecipe: React.FC<Layer4AdvancedControllerRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const bridge = useUIStore((s) => s.bridge);
  const [bindings, setBindings] = useState(() => {
    try {
      return loadInputBindings();
    } catch {
      return {
        axes: {
          steer: { axis: 0, invert: false },
          pitch: { axis: 1, invert: false },
          deadzone: 0.12,
          triggerThreshold: 0.15,
        },
      };
    }
  });

  const [connectedPads, setConnectedPads] = useState<Gamepad[]>([]);
  const [selectedPref, setSelectedPref] = useState<{ id: string | null; index: number | null }>(() => {
    try {
      return getSelectedController();
    } catch {
      return { id: null, index: null };
    }
  });

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Poll for connected gamepads
  useEffect(() => {
    const updatePads = () => {
      const pads = getConnectedGamepads().filter((p) => p && p.connected);
      setConnectedPads(pads);
    };

    updatePads();
    const interval = setInterval(updatePads, 1000);
    window.addEventListener('gamepadconnected', updatePads);
    window.addEventListener('gamepaddisconnected', updatePads);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gamepadconnected', updatePads);
      window.removeEventListener('gamepaddisconnected', updatePads);
    };
  }, []);

  const handleDeviceChange = (val: string) => {
    if (val === 'auto') {
      setSelectedController(null);
      setSelectedPref({ id: null, index: null });
    } else {
      const padIdx = parseInt(val, 10);
      const pad = connectedPads.find((p) => p.index === padIdx);
      if (pad) {
        const pref = { id: pad.id, index: pad.index };
        setSelectedController(pref);
        setSelectedPref(pref);
      }
    }
  };

  const handleUpdateAxes = (patch: Partial<typeof bindings.axes>) => {
    const next = {
      ...bindings,
      axes: {
        ...bindings.axes,
        ...patch,
      },
    };
    setBindings(next);
    saveInputBindings(next);
    bridge.onBindingsChange?.(next);
  };

  const handleResetAxes = () => {
    const next = { ...bindings };
    resetAxisBindings(next);
    setBindings(next);
    saveInputBindings(next);
    bridge.onBindingsChange?.(next);
  };

  const activePad = connectedPads.find((p) => {
    if (selectedPref.id === null) return true;
    return p.id === selectedPref.id && p.index === selectedPref.index;
  }) ?? connectedPads[0] ?? null;

  const padLayout = activePad ? detectControllerType(activePad.id) : null;

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[560px]">
      <PanelHeader
        title="ADVANCED CONTROLLER"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <VStack gap="md" isLight={isLight}>

          {/* Section 1: Controller Input Device Choice */}
          <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-colors ${
            isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/90 border-neutral-700/80'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                  Controller Input Device
                </span>
              </div>
              {activePad ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                  {padLayout === 'playstation' ? 'PlayStation' : 'Xbox'} Layout
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-500/15 text-neutral-500 font-medium">
                  未检测到手柄
                </span>
              )}
            </div>

            <div className="relative">
              <select
                value={selectedPref.id === null ? 'auto' : String(selectedPref.index)}
                onChange={(e) => handleDeviceChange(e.target.value)}
                onMouseEnter={() => setHoveredDesc('Choose preferred hardware gamepad for driving and menus.')}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`w-full py-2 pl-3 pr-8 rounded-lg text-xs font-mono font-medium border appearance-none cursor-pointer outline-none transition-colors ${
                  isLight
                    ? 'bg-white border-neutral-300 text-neutral-800 hover:border-neutral-400 focus:border-amber-500'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:border-neutral-600 focus:border-amber-400'
                }`}
              >
                <option value="auto">Automatic (Prefer Game Controller)</option>
                {connectedPads.map((p) => (
                  <option key={p.index} value={p.index}>
                    {p.id ? p.id.replace(/\s*\(.*\)\s*/g, '') : 'Controller'} · Port {p.index + 1}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 opacity-50 pointer-events-none" />
            </div>

            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {activePad
                ? `活跃设备: ${activePad.id} (Port ${activePad.index + 1})`
                : '当前无实体手柄输入。若手柄未显示，请轻按任意手柄按键激活浏览器探测。'}
            </p>
          </div>

          {/* Section 2: Stick Roles */}
          <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-colors ${
            isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/90 border-neutral-700/80'
          }`}>
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-sky-500 shrink-0" />
              <div className="flex flex-col text-left">
                <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                  Analog Stick Roles
                </span>
                <span className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Sticks steer and pitch as continuous analog axes
                </span>
              </div>
            </div>

            {/* Steer / Yaw Axis */}
            <div className="flex flex-col gap-1.5 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  Steer / Yaw Axis
                </span>
                <select
                  value={bindings.axes?.steer?.axis ?? 0}
                  onChange={(e) =>
                    handleUpdateAxes({
                      steer: {
                        axis: parseInt(e.target.value, 10),
                        invert: bindings.axes?.steer?.invert ?? false,
                      },
                    })
                  }
                  className={`py-1 px-2 rounded text-xs font-mono border cursor-pointer ${
                    isLight
                      ? 'bg-white border-neutral-300 text-neutral-800'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                >
                  {AXIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invert Steer */}
              <div
                className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-neutral-500/10 cursor-pointer select-none"
                onClick={() =>
                  handleUpdateAxes({
                    steer: {
                      axis: bindings.axes?.steer?.axis ?? 0,
                      invert: !(bindings.axes?.steer?.invert ?? false),
                    },
                  })
                }
              >
                <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  Invert Steer Axis
                </span>
                <ToggleSwitch
                  checked={bindings.axes?.steer?.invert ?? false}
                  onCheckedChange={(checked) =>
                    handleUpdateAxes({
                      steer: {
                        axis: bindings.axes?.steer?.axis ?? 0,
                        invert: checked,
                      },
                    })
                  }
                  isLight={isLight}
                  variant="neutral"
                />
              </div>
            </div>

            {/* Pitch Axis */}
            <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  Pitch Axis (Tilt)
                </span>
                <select
                  value={bindings.axes?.pitch?.axis ?? 1}
                  onChange={(e) =>
                    handleUpdateAxes({
                      pitch: {
                        axis: parseInt(e.target.value, 10),
                        invert: bindings.axes?.pitch?.invert ?? false,
                      },
                    })
                  }
                  className={`py-1 px-2 rounded text-xs font-mono border cursor-pointer ${
                    isLight
                      ? 'bg-white border-neutral-300 text-neutral-800'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                >
                  {AXIS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invert Pitch */}
              <div
                className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-neutral-500/10 cursor-pointer select-none"
                onClick={() =>
                  handleUpdateAxes({
                    pitch: {
                      axis: bindings.axes?.pitch?.axis ?? 1,
                      invert: !(bindings.axes?.pitch?.invert ?? false),
                    },
                  })
                }
              >
                <div className="flex flex-col">
                  <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                    Invert Pitch Axis
                  </span>
                  <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Stick up noses down when off
                  </span>
                </div>
                <ToggleSwitch
                  checked={bindings.axes?.pitch?.invert ?? false}
                  onCheckedChange={(checked) =>
                    handleUpdateAxes({
                      pitch: {
                        axis: bindings.axes?.pitch?.axis ?? 1,
                        invert: checked,
                      },
                    })
                  }
                  isLight={isLight}
                  variant="neutral"
                />
              </div>
            </div>

            {/* Stick Deadzone Slider */}
            <div className="flex items-center gap-3 w-full py-1.5 px-2 rounded-lg hover:bg-neutral-500/10 cursor-pointer select-none pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <span className={`w-32 shrink-0 text-xs font-semibold truncate ${
                isLight ? 'text-neutral-800' : 'text-neutral-200'
              }`}>
                Stick Deadzone
              </span>
              <SliderPrimitive.Root
                value={[bindings.axes?.deadzone ?? 0.12]}
                min={0}
                max={0.5}
                step={0.01}
                onValueChange={(vals) => handleUpdateAxes({ deadzone: Number(vals[0].toFixed(2)) })}
                className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
              >
                <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
                  isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                }`}>
                  <SliderPrimitive.Range className={`absolute h-full rounded-full ${
                    isLight ? 'bg-neutral-900' : 'bg-white'
                  }`} />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
                }`} />
              </SliderPrimitive.Root>
              <span className={`font-mono text-[11px] w-14 shrink-0 text-center py-0.5 rounded border select-none ${
                isLight
                  ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}>
                {(bindings.axes?.deadzone ?? 0.12).toFixed(2)}
              </span>
            </div>

            {/* Trigger Threshold Slider */}
            <div className="flex items-center gap-3 w-full py-1.5 px-2 rounded-lg hover:bg-neutral-500/10 cursor-pointer select-none">
              <span className={`w-32 shrink-0 text-xs font-semibold truncate ${
                isLight ? 'text-neutral-800' : 'text-neutral-200'
              }`}>
                Trigger Threshold
              </span>
              <SliderPrimitive.Root
                value={[bindings.axes?.triggerThreshold ?? 0.15]}
                min={0.05}
                max={0.95}
                step={0.01}
                onValueChange={(vals) => handleUpdateAxes({ triggerThreshold: Number(vals[0].toFixed(2)) })}
                className="relative flex items-center select-none touch-none grow h-5 cursor-pointer"
              >
                <SliderPrimitive.Track className={`relative grow rounded-full h-1.5 overflow-hidden ${
                  isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                }`}>
                  <SliderPrimitive.Range className={`absolute h-full rounded-full ${
                    isLight ? 'bg-neutral-900' : 'bg-white'
                  }`} />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className={`block h-3.5 w-3.5 rounded-full border shadow-sm transition-transform hover:scale-110 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-neutral-100 border-neutral-400'
                }`} />
              </SliderPrimitive.Root>
              <span className={`font-mono text-[11px] w-14 shrink-0 text-center py-0.5 rounded border select-none ${
                isLight
                  ? 'bg-neutral-100 text-neutral-700 border-neutral-300'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}>
                {(bindings.axes?.triggerThreshold ?? 0.15).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Reset Axes Defaults */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleResetAxes}
              className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-1.5 select-none active:scale-[0.99] ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700 shadow-2xs'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300 shadow-2xs'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5 opacity-75" />
              <span>Reset Stick Roles & Deadzones to Default</span>
            </button>
          </div>
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <span className="text-[11px] font-mono opacity-70 truncate">
          {hoveredDesc ?? 'Adjust controller hardware mapping, analog stick roles and deadzones.'}
        </span>
      </PanelFooter>
    </PanelContainer>
  );
};
