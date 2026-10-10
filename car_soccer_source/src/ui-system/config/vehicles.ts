export interface VehicleOption {
  id: string;
  label: string;
  hitbox: string;
  isPreset: boolean;
}

export const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: "hitbox-octane",
    label: "Octane (Whitebox)",
    hitbox: "Octane Hitbox",
    isPreset: true
  },
  {
    id: "hitbox-dominus",
    label: "Dominus (Whitebox)",
    hitbox: "Dominus Hitbox",
    isPreset: true
  },
  {
    id: "hitbox-breakout",
    label: "Breakout (Whitebox)",
    hitbox: "Breakout Hitbox",
    isPreset: true
  },
  {
    id: "hitbox-hybrid",
    label: "Hybrid (Whitebox)",
    hitbox: "Hybrid Hitbox",
    isPreset: true
  },
  {
    id: "hitbox-plank",
    label: "Batmobile / Plank (Whitebox)",
    hitbox: "Plank Hitbox",
    isPreset: true
  },
  {
    id: "hitbox-merc",
    label: "Merc (Whitebox)",
    hitbox: "Merc Hitbox",
    isPreset: true
  },
  {
    id: "game-car",
    label: "Cartoon Fennec",
    hitbox: "Octane Hitbox",
    isPreset: false
  },
  {
    id: "flat-car",
    label: "Flat Car",
    hitbox: "Dominus Hitbox",
    isPreset: false
  }
];
