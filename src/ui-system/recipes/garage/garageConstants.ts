import {
  COLOR_PREFS_KEY,
  type StoredColorPrefs,
} from '../../../config/uiConfig';
import {
  loadStoredColorPrefs,
  saveStoredColorPrefs,
} from '../../../config/uiConfig';

export {
  COLOR_PREFS_KEY,
  type StoredColorPrefs,
  loadStoredColorPrefs,
  saveStoredColorPrefs,
};

// 1. Car Tab: 8 vehicles with accurate names and hitboxes (Octane, Dominus, Breakout, Hybrid, Plank, Merc)
export interface CarDef {
  id: string;
  name: string;
  hitbox: 'Octane' | 'Dominus' | 'Breakout' | 'Hybrid' | 'Plank' | 'Merc';
}

export const CARS: CarDef[] = [
  { id: 'fennec', name: 'Fennec', hitbox: 'Octane' },
  { id: 'insidio', name: 'Insidio', hitbox: 'Hybrid' },
  { id: 'hitbox-octane', name: 'Octane (Whitebox)', hitbox: 'Octane' },
  { id: 'hitbox-dominus', name: 'Dominus (Whitebox)', hitbox: 'Dominus' },
  { id: 'hitbox-breakout', name: 'Breakout (Whitebox)', hitbox: 'Breakout' },
  { id: 'hitbox-plank', name: 'Plank (Whitebox)', hitbox: 'Plank' },
  { id: 'hitbox-merc', name: 'Merc (Whitebox)', hitbox: 'Merc' },
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
