import React from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { KeycapBadge } from '../../primitives/KeycapBadge';
import { formatBindingDisplayName } from '../../tokens/inputBindingsStore';

export const GAMEPAD_QUICK_PRESETS = [
  'A', 'B', 'X', 'Y',
  'LB', 'RB', 'LT', 'RT',
  'View', 'Menu',
  'L Stick', 'R Stick',
  'D-Up', 'D-Down', 'D-Left', 'D-Right'
];

export interface ListeningTarget {
  actionId: string;
  device: 'keyboard' | 'pad';
  slot: number;
}

export interface RemovableKeycapProps {
  shortcut: string;
  kind: 'keyboard' | 'gamepad';
  isLight: boolean;
  onRemove: () => void;
}

export const RemovableKeycap: React.FC<RemovableKeycapProps> = ({
  shortcut,
  kind,
  isLight,
  onRemove,
}) => {
  return (
    <div
      data-element="keycap-wrapper"
      className="group inline-flex items-center shrink-0"
      title={`Key: ${shortcut} (Click X to unbind)`}
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
            title={`Unbind: ${shortcut}`}
          >
            <X className="h-2.5 w-2.5 stroke-[2.5]" />
          </button>
        </span>
      </KeycapBadge>
    </div>
  );
};

export interface ListeningSlotProps {
  kind: 'keyboard' | 'gamepad';
  isLight: boolean;
  onCancel: () => void;
  onSelectGamepadPreset?: (btn: string) => void;
}

export const ListeningSlot: React.FC<ListeningSlotProps> = ({
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
        <span>{kind === 'keyboard' ? 'Press key / mouse...' : 'Press gamepad button / trigger...'}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="ml-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full hover:bg-neutral-500/20 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
          title="Cancel (Esc)"
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
            <span>Physical input or click preset:</span>
            <span className="text-amber-500 font-bold">Listening...</span>
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

export interface KeybindingActionRowProps {
  action: { id: string; label: string; note?: string; group?: string };
  keySlots: any[];
  padSlots: any[];
  padLayout: string;
  isLight: boolean;
  listeningTarget: ListeningTarget | null;
  onStartListening: (target: ListeningTarget | null) => void;
  onRemove: (device: 'keyboard' | 'pad', actionId: string, slot: number) => void;
  onSelectGamepadPreset: (btn: string) => void;
}

export const KeybindingActionRow: React.FC<KeybindingActionRowProps> = ({
  action,
  keySlots,
  padSlots,
  padLayout,
  isLight,
  listeningTarget,
  onStartListening,
  onRemove,
  onSelectGamepadPreset,
}) => {
  const isListeningKb =
    listeningTarget?.actionId === action.id && listeningTarget?.device === 'keyboard';
  const isListeningPad =
    listeningTarget?.actionId === action.id && listeningTarget?.device === 'pad';

  return (
    <div
      className={`grid grid-cols-12 items-center py-2 px-2.5 rounded-lg transition-colors ${
        isLight ? 'hover:bg-neutral-100/80' : 'hover:bg-neutral-800/40'
      }`}
    >
      <div className="col-span-4 flex flex-col pr-2 min-w-0">
        <span className={`text-xs font-medium truncate ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
          {action.label}
        </span>
        {action.note && (
          <span className={`text-[10px] truncate ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {action.note}
          </span>
        )}
      </div>

      <div className="col-span-4 flex flex-wrap items-center gap-1 pr-2">
        {keySlots.map((b: any, idx: number) => (
          <RemovableKeycap
            key={idx}
            shortcut={formatBindingDisplayName(b, padLayout)}
            kind="keyboard"
            isLight={isLight}
            onRemove={() => onRemove('keyboard', action.id, idx)}
          />
        ))}

        {isListeningKb ? (
          <ListeningSlot
            kind="keyboard"
            isLight={isLight}
            onCancel={() => onStartListening(null)}
          />
        ) : (
          keySlots.length < 2 && (
            <button
              type="button"
              onClick={() =>
                onStartListening({
                  actionId: action.id,
                  device: 'keyboard',
                  slot: keySlots.length,
                })
              }
              title={`Add keyboard binding for "${action.label}"`}
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

      <div className="col-span-4 flex flex-wrap items-center gap-1">
        {padSlots.map((b: any, idx: number) => (
          <RemovableKeycap
            key={idx}
            shortcut={formatBindingDisplayName(b, padLayout)}
            kind="gamepad"
            isLight={isLight}
            onRemove={() => onRemove('pad', action.id, idx)}
          />
        ))}

        {isListeningPad ? (
          <ListeningSlot
            kind="gamepad"
            isLight={isLight}
            onCancel={() => onStartListening(null)}
            onSelectGamepadPreset={onSelectGamepadPreset}
          />
        ) : (
          padSlots.length < 2 && (
            <button
              type="button"
              onClick={() =>
                onStartListening({
                  actionId: action.id,
                  device: 'pad',
                  slot: padSlots.length,
                })
              }
              title={`Add gamepad binding for "${action.label}"`}
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
};
