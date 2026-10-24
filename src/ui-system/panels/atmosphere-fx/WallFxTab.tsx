import React from 'react';
import { DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG } from '../../../config/atmosphereFxConfig.js';
import { OuterRingCard } from './OuterRingCard';
import { PulseWaveCard } from './PulseWaveCard';
import { TeamSplitCard } from './TeamSplitCard';

export interface WallFxTabProps {
  wallConfig: typeof DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG;
  applyWallPatch: (patch: Partial<typeof DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG>) => void;
  isLight: boolean;
  cardBg: string;
  mutedText: string;
}

export const WallFxTab: React.FC<WallFxTabProps> = ({
  wallConfig,
  applyWallPatch,
  isLight,
  cardBg,
  mutedText,
}) => {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Layer 1: 3D Sphere-Wall Intersection Outer Ring (Glass Walls Only) */}
      <OuterRingCard
        wallConfig={wallConfig}
        applyWallPatch={applyWallPatch}
        isLight={isLight}
        cardBg={cardBg}
        mutedText={mutedText}
      />

      {/* Layer 2: Periodic Pulse Wave (Shield Hexes & Optional Solid Walls) */}
      <PulseWaveCard
        wallConfig={wallConfig}
        applyWallPatch={applyWallPatch}
        isLight={isLight}
        cardBg={cardBg}
        mutedText={mutedText}
      />

      {/* Layer 3: Half-Field Team Color Split (Shield Hexes Only) */}
      <TeamSplitCard
        wallConfig={wallConfig}
        applyWallPatch={applyWallPatch}
        isLight={isLight}
        cardBg={cardBg}
        mutedText={mutedText}
      />
    </div>
  );
};
