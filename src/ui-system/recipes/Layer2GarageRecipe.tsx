import React, { useState } from 'react';
import { 
  Car, 
  Palette, 
  Music, 
  User, 
  Sparkles
} from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { UnderlineTabs, TabItem } from '../primitives/UnderlineTabs';
import { Badge } from '../primitives/Badge';
import { UnderConstructionPlaceholder } from '../primitives/UnderConstructionPlaceholder';
import { useAppStore, garageSettingsStore } from '../../stores/appStore';
import {
  CARS,
  BLUE_TEAM_COLORS,
  ORANGE_TEAM_COLORS,
  COLOR_PREFS_KEY,
  StoredColorPrefs,
  loadStoredColorPrefs,
  saveStoredColorPrefs,
  ColorDef,
  CarDef
} from './garage/garageConstants';
import { GarageCarTab } from './garage/GarageCarTab';
import { GarageColorTab } from './garage/GarageColorTab';
import { GarageMaterialsTab } from './garage/GarageMaterialsTab';

export * from './garage/garageConstants';
export * from './garage/GarageCarTab';
export * from './garage/GarageColorTab';
export * from './garage/GarageMaterialsTab';

export interface Layer2GarageRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  initialTab?: string;
}

/**
 * [Recipe] Layer 2 Garage & Vehicle Loadout Menu (Width: 680px)
 * Modular nested architecture maintaining < 20KB per file:
 * - GarageCarTab: 8 vehicle chassis models with accurate hitbox specifications
 * - GarageColorTab: P2P 3-Orange / 3-Blue palette with interactive reordering and primary team priority
 * - GarageMaterialsTab: Ball style, body paint, stadium scenery, turf, demolition, boost trail & luminance
 */
export const Layer2GarageRecipe: React.FC<Layer2GarageRecipeProps> = ({
  isLight = false,
  onBack,
  initialTab = 'car',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  // Active Car from unified UI store
  const activeCar = useAppStore((s) => s.activeCar);
  const setActiveCar = useAppStore((s) => s.setActiveCar);

  // Materials & Visuals from unified UI store
  const materials = useAppStore((s) => s.materials);
  const updateMaterials = useAppStore((s) => s.updateMaterials);

  // Hover description state for footer
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Colour Preferences & Reordering State
  const [colorPrefs, setColorPrefs] = useState<StoredColorPrefs>(loadStoredColorPrefs);

  const tabs: TabItem[] = [
    { id: 'car', label: 'Car', icon: <Car className="h-4 w-4" /> },
    { id: 'colour', label: 'Paint', icon: <Palette className="h-4 w-4" /> },
    { id: 'materials', label: 'Loadout', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'anthem', label: 'Anthem', icon: <Music className="h-4 w-4" /> },
    { id: 'player-name', label: 'Name', icon: <User className="h-4 w-4" /> },
  ];

  // Helper to persist and broadcast active color to game runtime
  const saveAndBroadcastColors = (nextPrefs: StoredColorPrefs) => {
    setColorPrefs(nextPrefs);
    const activeSlotId = saveStoredColorPrefs(nextPrefs);

    // Find the highest priority color for single player / training
    const allColors = [...BLUE_TEAM_COLORS, ...ORANGE_TEAM_COLORS];
    const found = allColors.find((c) => c.id === activeSlotId);
    if (found) {
      const bridge = useAppStore.getState().bridge;
      bridge?.onColorChange?.(found.hex, found.id);
    }
  };

  const handleSelectCar = (carId: string) => {
    setActiveCar(carId);
    try {
      garageSettingsStore.save({ vehiclePreset: carId, carVisual: carId });
    } catch (err) {
      console.warn('[Layer2GarageRecipe] Failed to save garage vehicle preset:', err);
    }
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
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer2-garage']} data-ui-element="garage-panel" className="w-full">
      <PanelHeader
        title="GARAGE"
        onBack={onBack}
        isLight={isLight}
      />

      {/* Underline Tabs */}
      <div data-ui-element="tabs-wrapper" data-panel-section="tabs" className="px-6 pt-2 shrink-0">
        <UnderlineTabs
          items={tabs}
          activeId={activeTab}
          onChange={setActiveTab}
          isLight={isLight}
        />
      </div>

      <PanelContent isLight={isLight} scrollable={true} className="p-6">
        {/* 1. CAR TAB */}
        {activeTab === 'car' && (
          <GarageCarTab
            activeCar={activeCar}
            onSelectCar={handleSelectCar}
            onHoverCar={(car) => setHoveredDesc(`${car.name} (${car.hitbox} Hitbox Preset)`)}
            onLeaveCar={() => setHoveredDesc(null)}
            isLight={isLight}
          />
        )}

        {/* 2. PAINT TAB */}
        {activeTab === 'colour' && (
          <GarageColorTab
            colorPrefs={colorPrefs}
            activeColorSlot={currentActiveSlot}
            paintFinish={materials.paintFinish === 'metallic' ? 'metallic' : 'matte'}
            onPaintFinishChange={(paintFinish) => updateMaterials({ paintFinish })}
            onTeamPriorityChange={handleTeamPriorityChange}
            onSelectColor={(color) => {
              const teamKey = color.team === 0 ? 'blueOrder' : 'orangeOrder';
              const oldOrder = colorPrefs[teamKey];
              const rest = oldOrder.filter((id) => id !== color.id);
              const nextPrefs: StoredColorPrefs = {
                ...colorPrefs,
                primaryTeam: color.team === 0 ? 'blue' : 'orange',
                [teamKey]: [color.id, ...rest],
              };
              saveAndBroadcastColors(nextPrefs);
            }}
            onReorderBlue={reorderBlue}
            onReorderOrange={reorderOrange}
            onHover={(desc) => setHoveredDesc(desc)}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />
        )}

        {/* 3. LOADOUT TAB */}
        {activeTab === 'materials' && (
          <GarageMaterialsTab
            materials={materials}
            updateMaterials={updateMaterials}
            onHover={(desc) => setHoveredDesc(desc)}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />
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
