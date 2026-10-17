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

export const COLOR_PREFS_KEY = 'car-soccer.color-preferences.v1';

export interface StoredColorPrefs {
  primaryTeam: 'blue' | 'orange';
  blueOrder: number[];
  orangeOrder: number[];
}

export function loadStoredColorPrefs(): StoredColorPrefs {
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
  } catch (err) {
    console.warn('[Layer2GarageRecipe] Failed to load stored color preferences:', err);
  }
  return {
    primaryTeam: 'orange',
    orangeOrder: [2, 4, 0],
    blueOrder: [1, 5, 3],
  };
}
