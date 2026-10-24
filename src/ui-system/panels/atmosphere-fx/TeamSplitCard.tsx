import React from 'react';
import { SliderControl } from '../../primitives/SliderControl';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { TunerColorRow } from '../driftwoods/DriftwoodsTunerControls';
import { DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG } from '../../../config/atmosphereFxConfig.js';

export interface TeamSplitCardProps {
  wallConfig: typeof DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG;
  applyWallPatch: (patch: Partial<typeof DEFAULT_EXPERIMENTAL_WALL_FX_CONFIG>) => void;
  isLight: boolean;
  cardBg: string;
  mutedText: string;
}

export const TeamSplitCard: React.FC<TeamSplitCardProps> = ({
  wallConfig,
  applyWallPatch,
  isLight,
  cardBg,
  mutedText,
}) => {
  return (
    <div className={`p-2.5 rounded-xl border flex flex-col gap-2 ${cardBg}`}>
      <div className="flex flex-col">
        <span className="font-bold text-xs">3. Half-Field Team Split (Shield Hexes Only)</span>
        <span className={`text-[10px] ${mutedText}`}>Target: Woods_Field_Walls_Hexes</span>
      </div>

      <ToggleSwitch
        label="Enable Blue / Orange Half-Field Hex Split"
        description="Tints Shield Hexes into Blue (Z < 0) and Orange (Z > 0)"
        checked={wallConfig.teamGradientEnabled}
        onChange={(checked) => applyWallPatch({ teamGradientEnabled: checked })}
        isLight={isLight}
      />

      <TunerColorRow
        label="Blue Team Color (RGB, Z < 0, Default #0089ff)"
        value={wallConfig.blueTeamColor}
        onChange={(hex) => applyWallPatch({ blueTeamColor: hex })}
        isLight={isLight}
      />

      <SliderControl
        label="Blue Team Alpha"
        value={wallConfig.blueTeamAlpha}
        min={0}
        max={1}
        step={0.02}
        editable={true}
        onChange={(val) => applyWallPatch({ blueTeamAlpha: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />

      <TunerColorRow
        label="Orange Team Color (RGB, Z > 0, Default #ff5200)"
        value={wallConfig.orangeTeamColor}
        onChange={(hex) => applyWallPatch({ orangeTeamColor: hex })}
        isLight={isLight}
      />

      <SliderControl
        label="Orange Team Alpha"
        value={wallConfig.orangeTeamAlpha}
        min={0}
        max={1}
        step={0.02}
        editable={true}
        onChange={(val) => applyWallPatch({ orangeTeamAlpha: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />

      <TunerColorRow
        label="Center Line Color (RGB, Z = 0, Default #ffffff)"
        value={wallConfig.centerLineColor}
        onChange={(hex) => applyWallPatch({ centerLineColor: hex })}
        isLight={isLight}
      />

      <SliderControl
        label="Center Line Alpha (Default 0)"
        value={wallConfig.centerLineAlpha}
        min={0}
        max={1}
        step={0.02}
        editable={true}
        onChange={(val) => applyWallPatch({ centerLineAlpha: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />

      <SliderControl
        label="Center White Line Half-Width"
        description="Half-width of the solid center stripe at |Z| <= HalfWidth before the team gradient starts"
        value={wallConfig.centerLineWidth}
        min={5}
        max={100}
        step={5}
        unit=" uu"
        editable={true}
        allowOutOfBoundsInput={true}
        onChange={(val) => applyWallPatch({ centerLineWidth: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />

      <SliderControl
        label="Team Color Gradient Transition Width"
        value={wallConfig.teamTransitionWidth}
        min={20}
        max={2000}
        step={20}
        unit=" uu"
        editable={true}
        allowOutOfBoundsInput={true}
        onChange={(val) => applyWallPatch({ teamTransitionWidth: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />

      <SliderControl
        label="Team Tint Strength"
        value={wallConfig.teamColorStrength}
        min={0.05}
        max={3.0}
        step={0.05}
        editable={true}
        allowOutOfBoundsInput={true}
        onChange={(val) => applyWallPatch({ teamColorStrength: val })}
        disabled={!wallConfig.teamGradientEnabled}
        isLight={isLight}
      />
    </div>
  );
};
