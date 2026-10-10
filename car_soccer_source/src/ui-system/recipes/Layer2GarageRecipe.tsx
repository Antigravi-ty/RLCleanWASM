import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Palette, 
  Music, 
  User, 
  Check, 
  ChevronUp, 
  ChevronDown, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { UnderlineTabs, TabItem } from '../primitives/UnderlineTabs';
import { Badge } from '../primitives/Badge';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { UnderConstructionPlaceholder } from '../primitives/UnderConstructionPlaceholder';
import { useUIStore } from '../core/store';
import { garageSettingsStore } from '../../config/vehiclePresets.js';

export interface Layer2GarageRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  initialTab?: string;
}

// 1. Car Tab: 8 vehicles with accurate names and hitboxes (Octane, Dominus, Breakout, Hybrid, Plank, Merc)
export interface CarDef {
  id: string;
  name: string;
  hitbox: 'Octane' | 'Dominus' | 'Breakout' | 'Hybrid' | 'Plank' | 'Merc';
}

export const CARS: CarDef[] = [
  { id: 'hitbox-octane', name: 'Octane (Whitebox)', hitbox: 'Octane' },
  { id: 'hitbox-dominus', name: 'Dominus (Whitebox)', hitbox: 'Dominus' },
  { id: 'hitbox-breakout', name: 'Breakout (Whitebox)', hitbox: 'Breakout' },
  { id: 'hitbox-hybrid', name: 'Hybrid (Whitebox)', hitbox: 'Hybrid' },
  { id: 'hitbox-plank', name: 'Plank (Whitebox)', hitbox: 'Plank' },
  { id: 'hitbox-merc', name: 'Merc (Whitebox)', hitbox: 'Merc' },
  { id: 'game-car', name: 'Cartoon Fennec', hitbox: 'Octane' },
  { id: 'flat-car', name: 'Flat Car', hitbox: 'Dominus' },
];

// 2. Colour Tab: 3 Blue and 3 Orange colors from P2P Online specification (CarColorConstants)
export interface ColorDef {
  id: number;
  name: string;
  hex: string;
  team: 0 | 1; // 0 = Blue, 1 = Orange
}

export const BLUE_TEAM_COLORS: ColorDef[] = [
  { id: 1, name: 'Emerald Green', hex: '#66bb6a', team: 0 },
  { id: 5, name: 'Royal Purple', hex: '#ba68c8', team: 0 },
  { id: 3, name: 'Sky Blue', hex: '#42a5f5', team: 0 },
];

export const ORANGE_TEAM_COLORS: ColorDef[] = [
  { id: 2, name: 'Sunburst Yellow', hex: '#ffc107', team: 1 },
  { id: 4, name: 'Neon Pink', hex: '#fd6e9d', team: 1 },
  { id: 0, name: 'Flame Red', hex: '#ff7043', team: 1 },
];

const COLOR_PREFS_KEY = 'car-soccer.color-preferences.v1';

export interface StoredColorPrefs {
  primaryTeam: 'blue' | 'orange';
  blueOrder: number[];
  orangeOrder: number[];
}

function loadStoredColorPrefs(): StoredColorPrefs {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(COLOR_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.blueOrder) && Array.isArray(parsed.orangeOrder)) {
          return {
            primaryTeam: parsed.primaryTeam === 'blue' ? 'blue' : 'orange',
            blueOrder: parsed.blueOrder,
            orangeOrder: parsed.orangeOrder,
          };
        }
      }
      // Check legacy multiplayer preferred-color slot
      const legacySlot = localStorage.getItem('car-soccer:preferred-color');
      if (legacySlot !== null) {
        const slot = Number(legacySlot);
        if ([2, 4, 0].includes(slot)) {
          const rest = [2, 4, 0].filter((s) => s !== slot);
          return { primaryTeam: 'orange', blueOrder: [1, 5, 3], orangeOrder: [slot, ...rest] };
        } else if ([1, 5, 3].includes(slot)) {
          const rest = [1, 5, 3].filter((s) => s !== slot);
          return { primaryTeam: 'blue', blueOrder: [slot, ...rest], orangeOrder: [2, 4, 0] };
        }
      }
    }
  } catch (_) {}
  return {
    primaryTeam: 'orange',
    orangeOrder: [2, 4, 0],
    blueOrder: [1, 5, 3],
  };
}

interface MaterialOptionRowProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
  disabled?: boolean;
}

const MaterialOptionRow: React.FC<MaterialOptionRowProps> = ({
  label,
  value,
  onChange,
  options,
  onHover,
  onLeave,
  isLight = false,
  disabled = false,
}) => {
  return (
    <div
      className={`flex items-center justify-between w-full py-1.5 px-3 rounded-lg transition-colors select-none ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-neutral-500/10 cursor-pointer'
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <span className={`text-xs font-semibold truncate ${
        disabled
          ? 'opacity-60 text-neutral-400'
          : isLight ? 'text-neutral-800' : 'text-neutral-200'
      }`}>
        {label}
      </span>
      <div className="shrink-0 w-64 sm:w-80">
        <SegmentedSwitch
          value={value}
          onValueChange={onChange}
          onChange={onChange}
          options={options}
          size="sm"
          fullWidth
          isLight={isLight}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

/**
 * [Recipe] Layer 2 Garage & Vehicle Loadout Menu (Width: 680px)
 * Agent-friendly UI migrated from UIStorybook architecture:
 * 1. Car: 8 real vehicle models with accurate names & hitbox specifications (4x2 grid).
 * 2. Colour: P2P 3-Orange / 3-Blue palette with interactive reordering and primary team priority.
 * 3. Materials: Ball style, body paint, stadium scenery, turf, demolition, boost trail & luminance.
 * 4. Player Anthem: In Development placeholder.
 * 5. Player Name: In Development placeholder.
 */
export const Layer2GarageRecipe: React.FC<Layer2GarageRecipeProps> = ({
  isLight = false,
  onBack,
  initialTab = 'car',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Active Car from unified UI store
  const activeCar = useUIStore((s) => s.activeCar);
  const setActiveCar = useUIStore((s) => s.setActiveCar);

  // Materials & Visuals from unified UI store
  const materials = useUIStore((s) => s.materials);
  const updateMaterials = useUIStore((s) => s.updateMaterials);

  // Hover description state for footer
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Colour Preferences & Reordering State
  const [colorPrefs, setColorPrefs] = useState<StoredColorPrefs>(loadStoredColorPrefs);

  const tabs: TabItem[] = [
    { id: 'car', label: 'Car', icon: <Car className="h-4 w-4" /> },
    { id: 'colour', label: 'Colour', icon: <Palette className="h-4 w-4" /> },
    { id: 'materials', label: 'Visuals & Effects', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'anthem', label: 'Player Anthem', icon: <Music className="h-4 w-4" /> },
    { id: 'player-name', label: 'Player Name', icon: <User className="h-4 w-4" /> },
  ];

  // Helper to persist and broadcast active color to game runtime
  const saveAndBroadcastColors = (nextPrefs: StoredColorPrefs) => {
    setColorPrefs(nextPrefs);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(COLOR_PREFS_KEY, JSON.stringify(nextPrefs));
        const activeSlotId =
          nextPrefs.primaryTeam === 'blue'
            ? nextPrefs.blueOrder[0]
            : nextPrefs.orangeOrder[0];
        localStorage.setItem('car-soccer:preferred-color', String(activeSlotId));
      }
    } catch (_) {}

    // Find the highest priority color for single player / training
    const activeSlotId =
      nextPrefs.primaryTeam === 'blue'
        ? nextPrefs.blueOrder[0]
        : nextPrefs.orangeOrder[0];
    const allColors = [...BLUE_TEAM_COLORS, ...ORANGE_TEAM_COLORS];
    const found = allColors.find((c) => c.id === activeSlotId);
    if (found) {
      const bridge = useUIStore.getState().bridge;
      bridge?.onColorChange?.(found.hex, found.id);
    }
  };

  const handleSelectCar = (carId: string) => {
    setActiveCar(carId);
    try {
      garageSettingsStore.save({ vehiclePreset: carId, carVisual: carId });
    } catch (_) {}
  };

  const handleTeamPriorityChange = (val: string) => {
    const nextPrefs: StoredColorPrefs = {
      ...colorPrefs,
      primaryTeam: val === 'orange' ? 'orange' : 'blue',
    };
    saveAndBroadcastColors(nextPrefs);
  };

  const reorderBlue = (index: number, direction: 'up' | 'down') => {
    const next = [...colorPrefs.blueOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const tmp = next[targetIdx];
    next[targetIdx] = next[index];
    next[index] = tmp;
    saveAndBroadcastColors({ ...colorPrefs, blueOrder: next });
  };

  const reorderOrange = (index: number, direction: 'up' | 'down') => {
    const next = [...colorPrefs.orangeOrder];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    const tmp = next[targetIdx];
    next[targetIdx] = next[index];
    next[index] = tmp;
    saveAndBroadcastColors({ ...colorPrefs, orangeOrder: next });
  };

  // Determine currently active color name and swatch
  const currentActiveSlot =
    colorPrefs.primaryTeam === 'blue'
      ? colorPrefs.blueOrder[0]
      : colorPrefs.orangeOrder[0];
  const currentActiveColor =
    [...BLUE_TEAM_COLORS, ...ORANGE_TEAM_COLORS].find((c) => c.id === currentActiveSlot) ||
    BLUE_TEAM_COLORS[0];

  const currentCarDef = CARS.find((c) => c.id === activeCar) || CARS[0];

  return (
    <PanelContainer isLight={isLight} data-ui-element="garage-panel" className="w-[680px]">
      <PanelHeader
        title="GARAGE LOADOUT"
        subtitle="Vehicle chassis selection, team colour priority & loadout identity"
        badge={
          <Badge variant="primary" size="sm" isLight={isLight}>
            Garage
          </Badge>
        }
        onBack={onBack}
        isLight={isLight}
      />

      {/* Underline Tabs */}
      <div data-ui-element="tabs-wrapper" className="px-6 pt-2">
        <UnderlineTabs
          items={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          isLight={isLight}
          fullWidth={false}
        />
      </div>

      <PanelContent scrollable className="p-6">
        {/* 1. CAR TAB: 8 Models (4 columns x 2 rows), fits completely without scroll */}
        {activeTab === 'car' && (
          <div className="flex flex-col gap-3" data-ui-element="garage-tab-car">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold flex items-center gap-1.5 ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <span>Equipped Chassis:</span>
                <strong className="text-amber-500 font-bold uppercase">{currentCarDef.name}</strong>
              </span>
              <span className="text-[11px] font-mono opacity-70">
                8 Standard Models • Click to Equip
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {CARS.map((car) => {
                const isSelected = activeCar === car.id;
                return (
                  <button
                    key={car.id}
                    type="button"
                    data-ui-element="car-card"
                    data-car-id={car.id}
                    data-equipped={isSelected}
                    onClick={() => handleSelectCar(car.id)}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer relative min-h-[76px] gap-1.5 ${
                      isSelected
                        ? isLight
                          ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/40 text-neutral-900 shadow-xs'
                          : 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/50 text-white shadow-md'
                        : isLight
                        ? 'bg-neutral-50 hover:bg-white border-neutral-200/90 text-neutral-800'
                        : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                    <span className="font-bold text-xs truncate max-w-full">
                      {car.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={isSelected ? 'amber' : 'neutral'}
                        size="sm"
                        isLight={isLight}
                      >
                        {car.hitbox}
                      </Badge>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-amber-500 font-bold">
                          Equipped
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. COLOUR TAB: P2P 3-Orange / 3-Blue palette with reordering & team priority */}
        {activeTab === 'colour' && (
          <div className="flex flex-col gap-3.5" data-ui-element="garage-tab-colour">
            {/* Primary Team Priority Switch */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                  主选阵营优先度 (Primary Team Priority):
                </span>
                <span className="text-[11px] font-mono opacity-70">
                  单人训练模式将使用主选阵营 Top 1 顺位颜色
                </span>
              </div>
              <SegmentedSwitch
                value={colorPrefs.primaryTeam}
                onValueChange={handleTeamPriorityChange}
                options={[
                  {
                    value: 'blue',
                    label: '蓝方优先 (Blue Team First)',
                    icon: <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block mr-1" />
                  },
                  {
                    value: 'orange',
                    label: '橙方优先 (Orange Team First)',
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
              <strong>颜色顺位机制 (Colour Preference Order)：</strong>
              比赛最多 3v3，双方队伍各设置有优先级顺位（1st → 2nd → 3rd）。使用箭头按钮（↑ / ↓）可调整顺位。若第一意向颜色在对局中已被队友占用，系统将自动回退（Fallback）至下一个预设顺位，彻底避免同队撞色。当前本地车辆已自动应用单人最高顺位颜色。
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
                    蓝方顺位表 (Blue Team Order)
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {colorPrefs.primaryTeam === 'blue' ? '★ 单人训练首选' : '备选阵营'}
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
                            onClick={() => reorderBlue(idx, 'up')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            data-ui-element="reorder-down"
                            disabled={isBottom}
                            onClick={() => reorderBlue(idx, 'down')}
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
                    橙方顺位表 (Orange Team Order)
                  </span>
                  <span className="text-[10px] font-mono opacity-70">
                    {colorPrefs.primaryTeam === 'orange' ? '★ 单人训练首选' : '备选阵营'}
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
                            onClick={() => reorderOrange(idx, 'up')}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            title="Move Up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            data-ui-element="reorder-down"
                            disabled={isBottom}
                            onClick={() => reorderOrange(idx, 'down')}
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
          </div>
        )}

        {/* 3. MATERIALS TAB: Ball, Paint, Stadium Scenery, Turf, Demolition, Boost Trail & Luminance */}
        {activeTab === 'materials' && (
          <div className="space-y-1 py-1">
            <MaterialOptionRow
              label="Ball Style"
              value={materials.ballStyle}
              onChange={(val) => updateMaterials({ ballStyle: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Soccer Ball' },
                { value: 'realistic', label: 'Rocket League' },
              ]}
              onHover={() => setHoveredDesc('Choose between classic geodesic soccer ball and authentic Rocket League sphere.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Vehicle Paint Finish"
              value={materials.carPaint}
              onChange={(val) => updateMaterials({ carPaint: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Matte Cel' },
                { value: 'realistic', label: 'Metallic Pearl' },
              ]}
              onHover={() => setHoveredDesc('Switches body finish between vibrant toon matte cel-shading and glossy metallic anodized pearlcoat.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Stadium Scenery"
              value={materials.stadiumScenery}
              onChange={(val) => updateMaterials({ stadiumScenery: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Arcade Cel' },
                { value: 'realistic', label: 'Realistic PBR' },
              ]}
              onHover={() => setHoveredDesc('Switches arena perimeter, goal structures and boundary walls between cel-shading and PBR shading.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Pitch Turf"
              value={materials.pitchTurf}
              onChange={(val) => updateMaterials({ pitchTurf: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Arcade Cel' },
                { value: 'realistic', label: 'Realistic Grass' },
              ]}
              onHover={() => setHoveredDesc('Selects pitch turf surface texture variation while preserving arcade stadium geometry.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Demolition Effect"
              value={materials.demolishedEffect}
              onChange={(val) => updateMaterials({ demolishedEffect: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Cartoon Sparks' },
                { value: 'realistic', label: 'Pyro Explosion' },
              ]}
              onHover={() => setHoveredDesc('Selects supersonic collision demolition aesthetic (arcade comic sparks vs realistic pyro blast).')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Boost Trail Effect"
              value={materials.boostVisual}
              onChange={(val) => updateMaterials({ boostVisual: val as 'arcade' | 'realistic' })}
              options={[
                { value: 'arcade', label: 'Toon Trail' },
                { value: 'realistic', label: 'Vapour Jet' },
              ]}
              onHover={() => setHoveredDesc('Selects rocket booster particle and ribbon trail rendering style.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Boost Flame Luminance"
              value={materials.boostFlameLuminance}
              onChange={(val) => updateMaterials({ boostFlameLuminance: val as 'balanced' | 'dynamic' })}
              options={[
                { value: 'balanced', label: 'Balanced (1.0x)' },
                { value: 'dynamic', label: 'Dynamic Angle' },
              ]}
              disabled={materials.boostVisual !== 'realistic'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'realistic' ? 'Adjusts vehicle nozzle flame intensity: Balanced steady 1.0x vs original perspective Dynamic.' : 'Flame luminance is locked to balanced preset when using Toon Trail.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />

            <MaterialOptionRow
              label="Vapour Plume Luminance"
              value={materials.boostPlumeLuminance}
              onChange={(val) => updateMaterials({ boostPlumeLuminance: val as 'min' | 'balanced' | 'dynamic' | 'hdr' })}
              options={[
                { value: 'min', label: 'Minimum' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'dynamic', label: 'Dynamic' },
                { value: 'hdr', label: 'Vivid HDR' },
              ]}
              disabled={materials.boostVisual !== 'realistic'}
              onHover={() => setHoveredDesc(materials.boostVisual === 'realistic' ? 'Adjusts exhaust smoke trail particle luminance: Minimum soft smoke, Balanced 1.0x, Dynamic angle, or Vivid HDR.' : 'Plume luminance is locked to balanced preset when using Toon Trail.')}
              onLeave={() => setHoveredDesc(null)}
              isLight={isLight}
            />
          </div>
        )}

        {/* 4. PLAYER ANTHEM TAB: In Development Placeholder */}
        {activeTab === 'anthem' && (
          <UnderConstructionPlaceholder
            title="Player Anthem Under Development"
            description="Goal celebration audio stings, MVP celebration tracks and custom team anthems are currently in development."
            badge="IN DEVELOPMENT"
            isLight={isLight}
          />
        )}

        {/* 5. PLAYER NAME TAB: In Development Placeholder */}
        {activeTab === 'player-name' && (
          <UnderConstructionPlaceholder
            title="Player Identity Under Development"
            description="Player gamer tag customization, unique account binding and multiplayer profile synchronization are currently in development."
            badge="IN DEVELOPMENT"
            isLight={isLight}
          />
        )}
      </PanelContent>

      <PanelFooter hint="ESC to Back" isLight={isLight}>
        {hoveredDesc ? (
          <div className="flex items-center gap-2 text-xs truncate">
            <Sparkles className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <span className={`truncate ${isLight ? 'text-neutral-900' : 'text-neutral-100'}`}>
              {hoveredDesc}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-xs">
            <span>Chassis: <strong>{currentCarDef.name}</strong></span>
            <span className="flex items-center gap-1.5">
              Color:
              <span
                className="h-2.5 w-2.5 rounded-full inline-block border border-white/20"
                style={{ backgroundColor: currentActiveColor.hex }}
              />
              <strong>{currentActiveColor.name}</strong>
            </span>
          </div>
        )}
      </PanelFooter>
    </PanelContainer>
  );
};
