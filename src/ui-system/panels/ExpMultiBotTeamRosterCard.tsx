import React from 'react';
import { Plus, Trash2, Eye, UserCheck } from 'lucide-react';
import {
  EXP_CAR_COLOR_PALETTE,
  getExpColorSwatch,
  type ExpBotPolicyId,
  type ExpMultiBotSlotConfig,
} from '../../stores/expMultiBotsStore';
import { KeycapBadge } from '../primitives/KeycapBadge';

export const BOT_POLICY_OPTIONS: { value: ExpBotPolicyId; label: string }[] = [
  { value: 'nexto', label: 'Nexto' },
  { value: 'necto', label: 'Necto' },
  { value: 'heuristic', label: 'Heuristic' },
];

export interface ExpMultiBotSlotRowProps {
  slot: ExpMultiBotSlotConfig;
  slotIndex: number;
  globalCarIdx: number;
  activeCameraCarIndex: number;
  totalCars: number;
  isLight: boolean;
  subPanelBg: string;
  mutedText: string;
  onSelectCameraCar: (carIdx: number) => void;
  onSetSlotBotType: (team: 0 | 1, slotIndex: number, botType: ExpBotPolicyId) => void;
  onRemoveSlot: (team: 0 | 1, slotIndex: number) => void;
  onSetSlotColor: (team: 0 | 1, slotIndex: number, colorId: string) => void;
  onHoverDesc?: (desc: string | null) => void;
}

export const ExpMultiBotSlotRow: React.FC<ExpMultiBotSlotRowProps> = ({
  slot,
  slotIndex,
  globalCarIdx,
  activeCameraCarIndex,
  totalCars,
  isLight,
  subPanelBg,
  mutedText,
  onSelectCameraCar,
  onSetSlotBotType,
  onRemoveSlot,
  onSetSlotColor,
  onHoverDesc,
}) => {
  const keyNum = globalCarIdx + 1;
  const swatch = getExpColorSwatch(slot.colorSlot);
  const isCamActive = activeCameraCarIndex === globalCarIdx;

  return (
    <div
      className={`p-2 rounded-lg border flex flex-col gap-1.5 transition-colors ${
        isCamActive ? 'bg-sky-500/10 border-sky-500/40' : subPanelBg
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => onSelectCameraCar(globalCarIdx)}
            onMouseEnter={() =>
              onHoverDesc?.(`Switch Camera POV to Car #${keyNum} (Shortcut Key ${keyNum})`)
            }
            onMouseLeave={() => onHoverDesc?.(null)}
            title={`Switch Camera POV to Car #${keyNum} (Shortcut Key ${keyNum})`}
            className="flex items-center gap-1 cursor-pointer"
          >
            <KeycapBadge label={String(keyNum)} size="sm" isLight={isLight} />
          </button>
          <span
            className="h-3 w-3 rounded-full shrink-0 border border-black/20"
            style={{ backgroundColor: swatch.hex }}
            title={`Color: ${swatch.name} (${swatch.hex})`}
          />
          {slot.isPlayer ? (
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 truncate">
              <UserCheck className="h-3 w-3 shrink-0" />
              <span>HUMAN PLAYER</span>
            </span>
          ) : (
            <div className="flex items-center gap-1">
              {BOT_POLICY_OPTIONS.map((opt) => {
                const selected = slot.botType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetSlotBotType(slot.team, slotIndex, opt.value)}
                    onMouseEnter={() =>
                      onHoverDesc?.(`Set slot #${keyNum} AI policy to ${opt.label}.`)
                    }
                    onMouseLeave={() => onHoverDesc?.(null)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                      selected
                        ? slot.team === 0
                          ? 'bg-sky-500/25 border-sky-400 text-sky-300'
                          : 'bg-orange-500/25 border-orange-400 text-orange-300'
                        : isLight
                          ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-600'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSelectCameraCar(globalCarIdx)}
            onMouseEnter={() => onHoverDesc?.(`Spectate Car #${keyNum} camera POV.`)}
            onMouseLeave={() => onHoverDesc?.(null)}
            title={`Spectate Car #${keyNum}`}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 cursor-pointer transition-colors ${
              isCamActive
                ? 'bg-sky-500/25 border-sky-400 text-sky-300 font-bold'
                : isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-600'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-400'
            }`}
          >
            <Eye className="h-2.5 w-2.5" />
            <span>POV</span>
          </button>
          <button
            type="button"
            disabled={totalCars <= 1}
            onClick={() => onRemoveSlot(slot.team, slotIndex)}
            onMouseEnter={() => onHoverDesc?.('Remove this car slot from the team roster.')}
            onMouseLeave={() => onHoverDesc?.(null)}
            title="Remove slot from team"
            className={`p-1 rounded border transition-colors ${
              totalCars <= 1
                ? 'opacity-30 cursor-not-allowed border-transparent text-neutral-500'
                : 'hover:bg-red-500/20 border-transparent hover:border-red-500/40 text-red-400 cursor-pointer'
            }`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* 6-Color Swatch Selector Row */}
      <div className="flex items-center justify-between pt-1 border-t border-neutral-700/25">
        <span className={`text-[10px] font-mono ${mutedText}`}>
          Color Card: <strong style={{ color: swatch.hex }}>{swatch.name}</strong>
        </span>
        <div className="flex items-center gap-1">
          {EXP_CAR_COLOR_PALETTE.map((c) => {
            const isSelected = slot.colorSlot === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSetSlotColor(slot.team, slotIndex, c.id)}
                onMouseEnter={() =>
                  onHoverDesc?.(`Assign ${c.name} (${c.hex}) color swatch to Car #${keyNum}.`)
                }
                onMouseLeave={() => onHoverDesc?.(null)}
                title={`${c.name} (${c.hex})`}
                className={`h-3.5 w-3.5 rounded-full transition-transform cursor-pointer ${
                  isSelected
                    ? 'scale-125 ring-2 ring-white shadow-sm'
                    : 'opacity-70 hover:opacity-100 hover:scale-110'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export interface ExpMultiBotTeamRosterCardProps {
  team: 0 | 1;
  slots: ExpMultiBotSlotConfig[];
  globalOffset: number;
  activeCameraCarIndex: number;
  totalCars: number;
  isLight: boolean;
  cardBg: string;
  subPanelBg: string;
  mutedText: string;
  onAddBot: (team: 0 | 1, botType: ExpBotPolicyId) => void;
  onSelectCameraCar: (carIdx: number) => void;
  onSetSlotBotType: (team: 0 | 1, slotIndex: number, botType: ExpBotPolicyId) => void;
  onRemoveSlot: (team: 0 | 1, slotIndex: number) => void;
  onSetSlotColor: (team: 0 | 1, slotIndex: number, colorId: string) => void;
  onHoverDesc?: (desc: string | null) => void;
}

export const ExpMultiBotTeamRosterCard: React.FC<ExpMultiBotTeamRosterCardProps> = ({
  team,
  slots,
  globalOffset,
  activeCameraCarIndex,
  totalCars,
  isLight,
  cardBg,
  subPanelBg,
  mutedText,
  onAddBot,
  onSelectCameraCar,
  onSetSlotBotType,
  onRemoveSlot,
  onSetSlotColor,
  onHoverDesc,
}) => {
  const isBlue = team === 0;
  const teamLabel = isBlue ? 'BLUE TEAM' : 'ORANGE TEAM';
  const teamShort = isBlue ? 'Blue' : 'Orange';
  const dotClass = isBlue ? 'bg-sky-400' : 'bg-orange-400';
  const titleColor = isBlue ? 'text-sky-400' : 'text-orange-400';
  const addBtnActiveClass = isBlue
    ? 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-sky-300 cursor-pointer'
    : 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40 text-orange-300 cursor-pointer';

  return (
    <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
          <span className={`font-bold text-xs ${titleColor}`}>
            {teamLabel} ({slots.length} / 3)
          </span>
        </div>
        <button
          type="button"
          disabled={slots.length >= 3}
          onClick={() => onAddBot(team, 'nexto')}
          onMouseEnter={() => onHoverDesc?.(`Add a bot slot to ${teamShort} Team (up to 3 cars).`)}
          onMouseLeave={() => onHoverDesc?.(null)}
          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 transition-colors ${
            slots.length >= 3
              ? 'opacity-40 cursor-not-allowed border-neutral-700 text-neutral-500'
              : addBtnActiveClass
          }`}
        >
          <Plus className="h-3 w-3" />
          <span>Add Bot</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {slots.length === 0 ? (
          <div className={`p-2 rounded-lg border text-center text-[11px] ${subPanelBg} ${mutedText}`}>
            No cars on {teamShort} Team. Click &ldquo;+ Add Bot&rdquo; to spawn a {teamShort} car.
          </div>
        ) : (
          slots.map((slot, idx) => (
            <ExpMultiBotSlotRow
              key={slot.id}
              slot={slot}
              slotIndex={idx}
              globalCarIdx={globalOffset + idx}
              activeCameraCarIndex={activeCameraCarIndex}
              totalCars={totalCars}
              isLight={isLight}
              subPanelBg={subPanelBg}
              mutedText={mutedText}
              onSelectCameraCar={onSelectCameraCar}
              onSetSlotBotType={onSetSlotBotType}
              onRemoveSlot={onRemoveSlot}
              onSetSlotColor={onSetSlotColor}
              onHoverDesc={onHoverDesc}
            />
          ))
        )}
      </div>
    </div>
  );
};
