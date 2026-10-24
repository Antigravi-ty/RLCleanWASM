import React from 'react';
import { Check, ChevronUp, ChevronDown, ShieldCheck } from 'lucide-react';
import { Badge } from '../../primitives/Badge';
import { SegmentedSwitch } from '../../primitives/SegmentedSwitch';
import {
  BLUE_TEAM_COLORS,
  ORANGE_TEAM_COLORS,
  StoredColorPrefs,
  ColorDef
} from './garageConstants';

export interface GarageColorTabProps {
  colorPrefs: StoredColorPrefs;
  activeColorSlot: number;
  paintFinish?: 'matte' | 'metallic';
  onPaintFinishChange?: (val: 'matte' | 'metallic') => void;
  onTeamPriorityChange: (val: string) => void;
  onSelectColor: (color: ColorDef) => void;
  onReorderBlue: (index: number, direction: 'up' | 'down') => void;
  onReorderOrange: (index: number, direction: 'up' | 'down') => void;
  onHover: (text: string) => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const GarageColorTab: React.FC<GarageColorTabProps> = ({
  colorPrefs,
  activeColorSlot,
  paintFinish = 'matte',
  onPaintFinishChange,
  onTeamPriorityChange,
  onSelectColor,
  onReorderBlue,
  onReorderOrange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div className="flex flex-col gap-3.5" data-ui-element="garage-tab-colour">
            {/* Primary Team Priority Switch */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  Primary Team Priority:
                </span>
                <span className="text-[11px] font-mono opacity-70">
                  Freeplay training utilizes Top 1 priority of selected primary team
                </span>
              </div>
              <SegmentedSwitch
                value={colorPrefs.primaryTeam}
                onValueChange={onTeamPriorityChange}
                options={[
                  {
                    value: 'blue',
                    label: 'Blue Team',
                    icon: <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block mr-1" />
                  },
                  {
                    value: 'orange',
                    label: 'Orange Team',
                    icon: <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block mr-1" />
                  },
                ]}
                isLight={isLight}
                size="sm"
                fullWidth
              />
            </div>

            {/* Explanatory banner */}
            <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
              isLight ? 'bg-amber-50/70 border-amber-200/80 text-amber-950' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}>
              <strong>Colour Preference Order:</strong>
              Matches support up to 3v3 with team color preference queues (1st &rarr; 2nd &rarr; 3rd). Use arrow buttons to reorder. If a color is taken by a teammate, the system automatically falls back to the next preferred color to prevent conflict. Local vehicle reflects Top 1 priority.
            </div>

            {/* Reorderable Blue & Orange Team Palettes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Blue Team Order */}
              <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850 border-neutral-700/80'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-blue-500 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Blue Team
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {colorPrefs.primaryTeam === 'blue' ? '★ Primary Choice' : 'Secondary Team'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {colorPrefs.blueOrder.map((cId, idx) => {
                    const c = BLUE_TEAM_COLORS.find((item) => item.id === cId) || BLUE_TEAM_COLORS[0];
                    const isTop = idx === 0;
                    const isBottom = idx === colorPrefs.blueOrder.length - 1;
                    return (
                      <div
                        key={c.id}
                        data-ui-element="color-order-item"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${
                          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-neutral-400">#{idx + 1}</span>
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="font-medium">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge size="sm" variant={idx === 0 ? 'primary' : 'neutral'} isLight={isLight}>
                            {idx === 0 ? 'Primary' : `Fallback ${idx}`}
                          </Badge>
                          <button
                            type="button"
                            data-ui-element="reorder-up"
                            disabled={isTop}
                            onClick={() => onReorderBlue(idx, 'up')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            data-ui-element="reorder-down"
                            disabled={isBottom}
                            onClick={() => onReorderBlue(idx, 'down')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Down"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Orange Team Order */}
              <div className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850 border-neutral-700/80'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-orange-500 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    Orange Team
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {colorPrefs.primaryTeam === 'orange' ? '★ Primary Choice' : 'Secondary Team'}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {colorPrefs.orangeOrder.map((cId, idx) => {
                    const c = ORANGE_TEAM_COLORS.find((item) => item.id === cId) || ORANGE_TEAM_COLORS[0];
                    const isTop = idx === 0;
                    const isBottom = idx === colorPrefs.orangeOrder.length - 1;
                    return (
                      <div
                        key={c.id}
                        data-ui-element="color-order-item"
                        className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs ${
                          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900 border-neutral-700/80'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-neutral-400">#{idx + 1}</span>
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-white/20 shrink-0 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="font-medium">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge size="sm" variant={idx === 0 ? 'warning' : 'neutral'} isLight={isLight}>
                            {idx === 0 ? 'Primary' : `Fallback ${idx}`}
                          </Badge>
                          <button
                            type="button"
                            data-ui-element="reorder-up"
                            disabled={isTop}
                            onClick={() => onReorderOrange(idx, 'up')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            data-ui-element="reorder-down"
                            disabled={isBottom}
                            onClick={() => onReorderOrange(idx, 'down')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Down"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className="flex flex-col gap-1.5 pt-1"
              onMouseEnter={() =>
                onHover(
                  'Switches vehicle body finish between Matte (Metallic 0.50, Roughness 0.85) and Metallic (Metallic 0.70, Roughness 0.45).'
                )
              }
              onMouseLeave={onLeave}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  Vehicle Paint Finishes:
                </span>
                <span className="text-[11px] font-mono opacity-70">
                  {paintFinish === 'metallic'
                    ? 'Metallic (M: 0.70 / R: 0.45)'
                    : 'Matte (M: 0.50 / R: 0.85)'}
                </span>
              </div>
              <SegmentedSwitch
                value={paintFinish}
                onValueChange={(nextFinish) => onPaintFinishChange?.(nextFinish as 'matte' | 'metallic')}
                options={[
                  { value: 'matte', label: 'Matte' },
                  { value: 'metallic', label: 'Metallic' },
                ]}
                isLight={isLight}
                size="sm"
                fullWidth
              />
            </div>
          </div>
  );
};
