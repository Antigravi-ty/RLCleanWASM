import React, { useState, useEffect, useRef } from 'react';
import {
  Keyboard,
  Gamepad2,
  Activity,
  Plus,
  X,
  RotateCcw,
  Sparkles,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { KeycapBadge } from '../primitives/KeycapBadge';
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
  formatBindingDisplayName,
  getEffectiveGamepad,
  detectControllerType,
} from '../../input/InputBindings.js';

const GAMEPAD_QUICK_PRESETS = [
  'A', 'B', 'X', 'Y',
  'LB', 'RB', 'LT', 'RT',
  'View', 'Menu',
  'L Stick', 'R Stick',
  'D-Up', 'D-Down', 'D-Left', 'D-Right'
];

interface RemovableKeycapProps {
  shortcut: string;
  kind: 'keyboard' | 'gamepad';
  isLight: boolean;
  onRemove: () => void;
}

const RemovableKeycap: React.FC<RemovableKeycapProps> = ({
  shortcut,
  kind,
  isLight,
  onRemove,
}) => {
  return (
    <div
      data-element="keycap-wrapper"
      className="group inline-flex items-center shrink-0"
      title={`按键: ${shortcut} (点击右侧叉号可解除绑定)`}
    >
      <KeycapBadge
        shortcut={shortcut}
        kind={kind}
        size="sm"
        isLight={isLight}
        className="!p-0 !min-h-[20px] !h-5 inline-flex items-center overflow-hidden transition-all duration-200 cursor-default select-none"
      >
        <span
          data-element="keycap-label"
          className="inline-flex items-center justify-center h-full pl-1.5 pr-1.5 group-hover:pr-0 group-[.is-expanded]:pr-0 text-[10px] font-mono font-semibold leading-none shrink-0 -translate-y-px select-none transition-all duration-200 ease-out"
        >
          {shortcut}
        </span>
        <span
          data-element="unbind-container"
          className="inline-flex items-center justify-center overflow-hidden w-0 opacity-0 group-hover:w-[18px] group-hover:opacity-100 group-[.is-expanded]:w-[18px] group-[.is-expanded]:opacity-100 transition-all duration-200 ease-out pointer-events-none group-hover:pointer-events-auto group-[.is-expanded]:pointer-events-auto shrink-0"
        >
          <button
            type="button"
            data-element="unbind-button"
            aria-label={`Unbind ${shortcut}`}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-[3px] text-red-500 dark:text-red-400 hover:bg-red-500/15 dark:hover:bg-red-500/25 cursor-pointer transition-colors shrink-0"
            title={`解除绑定: ${shortcut}`}
          >
            <X className="h-2.5 w-2.5 stroke-[2.5]" />
          </button>
        </span>
      </KeycapBadge>
    </div>
  );
};

interface ListeningSlotProps {
  kind: 'keyboard' | 'gamepad';
  isLight: boolean;
  onCancel: () => void;
  onSelectGamepadPreset?: (btn: string) => void;
}

const ListeningSlot: React.FC<ListeningSlotProps> = ({
  kind,
  isLight,
  onCancel,
  onSelectGamepadPreset,
}) => {
  return (
    <div className="relative inline-flex flex-col gap-1.5 z-20">
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium animate-pulse shadow-sm ${
          isLight
            ? 'bg-amber-500/15 border-amber-500 text-amber-700'
            : 'bg-amber-500/20 border-amber-400 text-amber-300'
        }`}
      >
        <Sparkles className="h-3 w-3 animate-spin text-amber-500 shrink-0" />
        <span>{kind === 'keyboard' ? '按下按键 / 鼠标...' : '请按手柄键 / 扳机...'}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="ml-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full hover:bg-neutral-500/20 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          title="取消 (Esc)"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>

      {kind === 'gamepad' && onSelectGamepadPreset && (
        <div
          className={`absolute top-full left-0 mt-1 p-2 rounded-xl border shadow-xl flex flex-col gap-1.5 min-w-[200px] z-50 ${
            isLight
              ? 'bg-white border-neutral-200 shadow-neutral-200/50 text-neutral-800'
              : 'bg-neutral-900 border-neutral-700 shadow-black/80 text-neutral-200'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono px-0.5">
            <span>实体按键或点击预设:</span>
            <span className="text-amber-500 font-bold">监听中</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {GAMEPAD_QUICK_PRESETS.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => onSelectGamepadPreset(btn)}
                className="cursor-pointer transition-transform active:scale-95"
              >
                <KeycapBadge
                  shortcut={btn}
                  kind="gamepad"
                  size="sm"
                  isLight={isLight}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
    } catch {
      return { keyboard: {}, pad: {}, axes: {} };
    }
  });

  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [listeningTarget, setListeningTarget] = useState<{
    actionId: string;
    device: 'keyboard' | 'pad';
    slot: number;
  } | null>(null);

  useEffect(() => {
    hudStore.getState().syncBindings(bindings);
  }, [bindings]);

  // Capture loop
  useEffect(() => {
    if (!listeningTarget) return;

    if (listeningTarget.device === 'keyboard') {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setListeningTarget(null);
          return;
        }
        e.preventDefault();
        e.stopPropagation();

        const clone = {
          keyboard: { ...bindings.keyboard },
          pad: { ...bindings.pad },
          axes: { ...bindings.axes },
        };
        for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
        for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

        const res = assignBinding(
          clone,
          'keyboard',
          listeningTarget.actionId,
          listeningTarget.slot,
          { kind: 'key', code: e.code }
        );
        if (res.changed) {
          saveInputBindings(clone);
          bridge.onBindingsChange?.(clone);
          setBindings(clone);
        }
        setListeningTarget(null);
      };

      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const clone = {
          keyboard: { ...bindings.keyboard },
          pad: { ...bindings.pad },
          axes: { ...bindings.axes },
        };
        for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
        for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

        const res = assignBinding(
          clone,
          'keyboard',
          listeningTarget.actionId,
          listeningTarget.slot,
          { kind: 'mouse', button: e.button }
        );
        if (res.changed) {
          saveInputBindings(clone);
          bridge.onBindingsChange?.(clone);
          setBindings(clone);
        }
        setListeningTarget(null);
      };

      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('mousedown', handleMouseDown, true);
      return () => {
        window.removeEventListener('keydown', handleKeyDown, true);
        window.removeEventListener('mousedown', handleMouseDown, true);
      };
    } else {
      let animId: number;
      let prevButtons: boolean[] = [];
      let prevAxes: number[] = [];

      const initialPad = getEffectiveGamepad();
      if (initialPad) {
        prevButtons = (initialPad.buttons ?? []).map((b) => b.pressed);
        prevAxes = [...(initialPad.axes ?? [])];
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setListeningTarget(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown, true);

      const pollGamepad = () => {
        const pad = getEffectiveGamepad();
        if (pad) {
          for (let i = 0; i < pad.buttons.length; i++) {
            const pressed = pad.buttons[i]?.pressed ?? false;
            if (pressed && !prevButtons[i]) {
              const clone = {
                keyboard: { ...bindings.keyboard },
                pad: { ...bindings.pad },
                axes: { ...bindings.axes },
              };
              for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
              for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

              const res = assignBinding(
                clone,
                'pad',
                listeningTarget.actionId,
                listeningTarget.slot,
                { kind: 'padButton', index: i }
              );
              if (res.changed) {
                saveInputBindings(clone);
                bridge.onBindingsChange?.(clone);
                setBindings(clone);
              }
              setListeningTarget(null);
              return;
            }
            prevButtons[i] = pressed;
          }

          for (let a = 0; a < pad.axes.length; a++) {
            const val = pad.axes[a] ?? 0;
            const prevVal = prevAxes[a] ?? 0;
            prevAxes[a] = val;
            if (Math.abs(val) > 0.7 && (Math.abs(prevVal) <= 0.7 || Math.sign(prevVal) !== Math.sign(val))) {
              const clone = {
                keyboard: { ...bindings.keyboard },
                pad: { ...bindings.pad },
                axes: { ...bindings.axes },
              };
              for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
              for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

              const res = assignBinding(
                clone,
                'pad',
                listeningTarget.actionId,
                listeningTarget.slot,
                { kind: 'padAxis', axis: a, dir: val > 0 ? 1 : -1 }
              );
              if (res.changed) {
                saveInputBindings(clone);
                bridge.onBindingsChange?.(clone);
                setBindings(clone);
              }
              setListeningTarget(null);
              return;
            }
          }
        }
        animId = requestAnimationFrame(pollGamepad);
      };

      animId = requestAnimationFrame(pollGamepad);
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [listeningTarget, bindings, bridge]);

  const handleRemove = (device: 'keyboard' | 'pad', actionId: string, slot: number) => {
    const clone = {
      keyboard: { ...bindings.keyboard },
      pad: { ...bindings.pad },
      axes: { ...bindings.axes },
    };
    for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
    for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

    removeBinding(clone, device, actionId, slot);
    saveInputBindings(clone);
    bridge.onBindingsChange?.(clone);
    setBindings(clone);
  };

  const handleSelectGamepadPreset = (buttonName: string) => {
    if (!listeningTarget || listeningTarget.device !== 'pad') return;
    const btnIndex = XBOX_BUTTON_NAMES.indexOf(buttonName);
    if (btnIndex === -1) return;

    const clone = {
      keyboard: { ...bindings.keyboard },
      pad: { ...bindings.pad },
      axes: { ...bindings.axes },
    };
    for (const k of Object.keys(clone.keyboard)) clone.keyboard[k] = [...clone.keyboard[k]];
    for (const k of Object.keys(clone.pad)) clone.pad[k] = [...clone.pad[k]];

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
    const clone = {
      keyboard: { ...bindings.keyboard },
      pad: { ...bindings.pad },
      axes: { ...bindings.axes },
    };
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
    <PanelContainer isLight={isLight} className={`w-full max-w-[560px] ${className}`}>
      <PanelHeader
        title="KEY BINDINGS"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          {/* Top Entrance: Advanced Controller Settings (Level 4) */}
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

          {/* Group Filter Tabs */}
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

          {/* 3-Column Binding Table Header */}
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

          {/* 3-Column Binding Rows */}
          <div className="flex flex-col divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {filteredActions.map((act) => {
              const keySlots = bindings.keyboard?.[act.id] ?? [];
              const padSlots = bindings.pad?.[act.id] ?? [];

              const isListeningKb =
                listeningTarget?.actionId === act.id && listeningTarget?.device === 'keyboard';
              const isListeningPad =
                listeningTarget?.actionId === act.id && listeningTarget?.device === 'pad';

              return (
                <div
                  key={act.id}
                  className={`grid grid-cols-12 items-center py-2 px-2.5 rounded-lg transition-colors ${
                    isLight ? 'hover:bg-neutral-100/80' : 'hover:bg-neutral-800/40'
                  }`}
                >
                  {/* Col 1: Action */}
                  <div className="col-span-4 flex flex-col pr-2 min-w-0">
                    <span className={`text-xs font-medium truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                      {act.label}
                    </span>
                    {act.note && (
                      <span className={`text-[10px] truncate ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {act.note}
                      </span>
                    )}
                  </div>

                  {/* Col 2: Keyboard / Mouse */}
                  <div className="col-span-4 flex flex-wrap items-center gap-1 pr-2">
                    {keySlots.map((b: any, idx: number) => (
                      <RemovableKeycap
                        key={idx}
                        shortcut={formatBindingDisplayName(b, padLayout)}
                        kind="keyboard"
                        isLight={isLight}
                        onRemove={() => handleRemove('keyboard', act.id, idx)}
                      />
                    ))}

                    {isListeningKb ? (
                      <ListeningSlot
                        kind="keyboard"
                        isLight={isLight}
                        onCancel={() => setListeningTarget(null)}
                      />
                    ) : (
                      keySlots.length < 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setListeningTarget({
                              actionId: act.id,
                              device: 'keyboard',
                              slot: keySlots.length,
                            })
                          }
                          title={`为 "${act.label}" 添加键盘按键绑定`}
                          className={`inline-flex items-center justify-center h-5 w-5 rounded-md border border-dashed transition-all cursor-pointer ${
                            isLight
                              ? 'border-neutral-300 hover:border-amber-500 hover:bg-amber-50 text-neutral-400 hover:text-amber-600'
                              : 'border-neutral-700 hover:border-amber-400 hover:bg-amber-500/10 text-neutral-500 hover:text-amber-400'
                          }`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>

                  {/* Col 3: Gamepad */}
                  <div className="col-span-4 flex flex-wrap items-center gap-1">
                    {padSlots.map((b: any, idx: number) => (
                      <RemovableKeycap
                        key={idx}
                        shortcut={formatBindingDisplayName(b, padLayout)}
                        kind="gamepad"
                        isLight={isLight}
                        onRemove={() => handleRemove('pad', act.id, idx)}
                      />
                    ))}

                    {isListeningPad ? (
                      <ListeningSlot
                        kind="gamepad"
                        isLight={isLight}
                        onCancel={() => setListeningTarget(null)}
                        onSelectGamepadPreset={handleSelectGamepadPreset}
                      />
                    ) : (
                      padSlots.length < 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setListeningTarget({
                              actionId: act.id,
                              device: 'pad',
                              slot: padSlots.length,
                            })
                          }
                          title={`为 "${act.label}" 添加手柄按键绑定`}
                          className={`inline-flex items-center justify-center h-5 w-5 rounded-md border border-dashed transition-all cursor-pointer ${
                            isLight
                              ? 'border-neutral-300 hover:border-amber-500 hover:bg-amber-50 text-neutral-400 hover:text-amber-600'
                              : 'border-neutral-700 hover:border-amber-400 hover:bg-amber-500/10 text-neutral-500 hover:text-amber-400'
                          }`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
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
