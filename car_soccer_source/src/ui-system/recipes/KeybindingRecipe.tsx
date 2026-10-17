import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  Gamepad2,
  Activity,
  RotateCcw,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { useUIStore } from '../core/store';
import { hudStore } from '../hud/hudStore';
import {
  INPUT_ACTIONS,
  XBOX_BUTTON_NAMES,
} from '../../input/InputConstants.js';
import {
  loadInputBindings,
  saveInputBindings,
  assignBinding,
  removeBinding,
  resetDeviceBindings,
  getEffectiveGamepad,
  detectControllerType,
} from '../../input/InputBindings.js';
import {
  KeybindingActionRow,
  type ListeningTarget
} from './keybinding/KeybindingSlots';
import {
  cloneBindingsMap,
  useKeybindingCapture
} from './keybinding/useKeybindingCapture';

export interface KeybindingRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onNavigateAdvanced?: () => void;
  className?: string;
}

const GROUPS = ['All', 'Driving', 'Aerial', 'Camera', 'Ball Control', 'Session'] as const;

export const KeybindingRecipe: React.FC<KeybindingRecipeProps> = ({
  isLight = false,
  onBack,
  onNavigateAdvanced,
  className = '',
}) => {
  const bridge = useUIStore((s) => s.bridge);
  const [bindings, setBindings] = useState(() => {
    try {
      return loadInputBindings();
    } catch (err) {
      console.warn('[KeybindingRecipe] Failed to load input bindings:', err);
      return { keyboard: {}, pad: {}, axes: {} };
    }
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [listeningTarget, setListeningTarget] = useState<ListeningTarget | null>(null);

  useEffect(() => {
    hudStore.getState().syncBindings(bindings);
  }, [bindings]);

  useKeybindingCapture(listeningTarget, bindings, bridge, setBindings, setListeningTarget);

  const handleRemove = (device: 'keyboard' | 'pad', actionId: string, slot: number) => {
    const clone = cloneBindingsMap(bindings);
    removeBinding(clone, device, actionId, slot);
    saveInputBindings(clone);
    bridge.onBindingsChange?.(clone);
    setBindings(clone);
  };

  const handleSelectGamepadPreset = (buttonName: string) => {
    if (!listeningTarget || listeningTarget.device !== 'pad') return;
    const btnIndex = XBOX_BUTTON_NAMES.indexOf(buttonName);
    if (btnIndex === -1) return;

    const clone = cloneBindingsMap(bindings);
    const res = assignBinding(clone, 'pad', listeningTarget.actionId, listeningTarget.slot, {
      kind: 'padButton',
      index: btnIndex,
    });
    if (res.changed) {
      saveInputBindings(clone);
      bridge.onBindingsChange?.(clone);
      setBindings(clone);
    }
    setListeningTarget(null);
  };

  const handleResetDefaults = () => {
    const clone = cloneBindingsMap(bindings);
    resetDeviceBindings(clone, 'keyboard');
    resetDeviceBindings(clone, 'pad');
    saveInputBindings(clone);
    bridge.onBindingsChange?.(clone);
    setBindings(clone);
    setListeningTarget(null);
  };

  const effectivePad = getEffectiveGamepad();
  const padLayout = effectivePad ? detectControllerType(effectivePad.id) : 'xbox';

  const filteredActions = selectedGroup === 'All'
    ? INPUT_ACTIONS
    : INPUT_ACTIONS.filter((a) => a.group === selectedGroup);

  return (
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer3-keybindings']} className={`w-full ${className}`}>
      <PanelHeader
        title="KEY BINDINGS"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
              isLight
                ? 'bg-neutral-50/90 border-neutral-200/90 hover:bg-neutral-100/90'
                : 'bg-neutral-850/80 border-neutral-700/80 hover:bg-neutral-800/80'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`p-1.5 rounded-lg border ${
                  isLight
                    ? 'bg-white border-neutral-200 text-sky-600'
                    : 'bg-neutral-800 border-neutral-700 text-sky-400'
                }`}
              >
                <Sliders className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-left">
                <span className={`text-xs font-semibold ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                  Advanced Controller Settings
                </span>
                <span className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Device selection, analog stick roles & deadzones
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateAdvanced}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
                isLight
                  ? 'bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 shadow-2xs'
                  : 'bg-white text-neutral-900 border-white hover:bg-neutral-100 shadow-2xs'
              }`}
              title="Open Advanced Controller Settings"
            >
              <span>Configure</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {GROUPS.map((grp) => {
              const active = selectedGroup === grp;
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer select-none shrink-0 ${
                    active
                      ? isLight
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-900'
                      : isLight
                      ? 'text-neutral-600 hover:bg-neutral-200/60'
                      : 'text-neutral-400 hover:bg-neutral-800/60'
                  }`}
                >
                  {grp}
                </button>
              );
            })}
          </div>

          <div
            className={`grid grid-cols-12 items-center py-2 px-3 rounded-lg font-mono font-semibold text-[10px] tracking-wider uppercase border transition-colors ${
              isLight
                ? 'bg-neutral-100/90 border-neutral-200 text-neutral-700'
                : 'bg-neutral-900/90 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="col-span-4 flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-amber-500" />
              <span>ACTION</span>
            </div>
            <div className="col-span-4 flex items-center gap-1.5">
              <Keyboard className="h-3 w-3 text-sky-500" />
              <span>KEYBOARD / MOUSE</span>
            </div>
            <div className="col-span-4 flex items-center gap-1.5">
              <Gamepad2 className="h-3 w-3 text-emerald-500" />
              <span>CONTROLLER</span>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {filteredActions.map((act) => (
              <KeybindingActionRow
                key={act.id}
                action={act}
                keySlots={bindings.keyboard?.[act.id] ?? []}
                padSlots={bindings.pad?.[act.id] ?? []}
                padLayout={padLayout}
                isLight={isLight}
                listeningTarget={listeningTarget}
                onStartListening={setListeningTarget}
                onRemove={handleRemove}
                onSelectGamepadPreset={handleSelectGamepadPreset}
              />
            ))}
          </div>
        </div>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] font-mono opacity-70 truncate">
            Click + to rebind, hover keycap to unbind. Esc cancels.
          </span>
          <button
            type="button"
            onClick={handleResetDefaults}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer select-none active:scale-95 ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700 shadow-2xs'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300 shadow-2xs'
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5 opacity-75" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
