import React, { useState } from 'react';
import { Palette, Sparkles, Car, Info } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { VStack } from '../layout/VStack';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import {
  EXPERIMENTAL_FEATURES_PRESET,
  VEHICLE_GLOBAL_FX_TUNER_PRESET,
  DRIFTWOODS_TUNER_PRESET,
  BOOST_PAD_TUNER_PRESET,
} from '../../stores/floatingPresets';
import { FloatingWindowCard } from './settings/components/FloatingWindowCard';

export interface Layer3DevCalibratedPresetsRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

/**
 * [Recipe] Layer 3 Calibrated Presets
 * Contains the tuners whose baseline parameters have been calibrated and solidified:
 * 1. Atmosphere & FX Tuner
 * 2. Vehicle Global Surfaces & FX Tuner
 * 3. Driftwoods Stadium Tuner
 * 4. Boost Pad Visual Tuner
 */
export const Layer3DevCalibratedPresetsRecipe: React.FC<Layer3DevCalibratedPresetsRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer3-dev-calibrated-presets']}
      className="w-full"
    >
      <PanelHeader title="CALIBRATED PRESETS" onBack={onBack} isLight={isLight} />

      <PanelContent scrollable className="p-6">
        <VStack gap="md" isLight={isLight}>
          {/* 1. Atmosphere & FX Tuner */}
          <FloatingWindowCard
            preset={EXPERIMENTAL_FEATURES_PRESET}
            icon={<Sparkles className="h-5 w-5" />}
            iconBgClass="bg-sky-500/10 text-sky-500"
            badge="Calibrated"
            badgeClass="bg-sky-500/15 border-sky-500/30 text-sky-400"
            description="Wall & Pulse (Cubic-Bezier Fade-Out Curve), Shadows, Full-Sphere Skybox & 70% Ball"
            hoverTooltip="Atmosphere & FX Tuner: Calibrated 3D Ball-Wall Intersection Ring & Sonar Pulse, Single-Sun Sharp Shadows, Full-Sphere Cloudy Skybox & 70% Ball Opacity."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          {/* 2. Vehicle Global Surfaces & FX Tuner */}
          <FloatingWindowCard
            preset={VEHICLE_GLOBAL_FX_TUNER_PRESET}
            icon={<Car className="h-5 w-5" />}
            iconBgClass="bg-emerald-500/10 text-emerald-500"
            badge="Calibrated"
            badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            description="Universal Surfaces & Paint, Head/Brake Lamps, 3-Face Solid Cylinder Wheels & Boost FX"
            hoverTooltip="Vehicle Global Surfaces & FX Tuner: Calibrated universal vehicle surface materials, headlamp/brake intensities, 7uu solid-cylinder wheels & dual-stream Gold Rush boost FX."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          {/* 3. Driftwoods Stadium Tuner */}
          <FloatingWindowCard
            preset={DRIFTWOODS_TUNER_PRESET}
            icon={<Palette className="h-5 w-5" />}
            iconBgClass="bg-emerald-500/10 text-emerald-500"
            badge="Calibrated"
            badgeClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
            description="Ground dynamic mask, 8-mesh PBR palette, 0.20 Hex Shield & Lite mode"
            hoverTooltip="Driftwoods Stadium Tuner: Calibrated PBR material colors, ground dual-color mask, 0.20 shield hex grid opacity & Lite Lambert mode."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />

          {/* 4. Boost Pad Visual Tuner */}
          <FloatingWindowCard
            preset={BOOST_PAD_TUNER_PRESET}
            icon={<Sparkles className="h-5 w-5" />}
            iconBgClass="bg-amber-500/10 text-amber-500"
            badge="Calibrated"
            badgeClass="bg-amber-500/15 border-amber-500/30 text-amber-400"
            description="Upward gradient opacity, midpoint falloff & Big Pad floating orb"
            hoverTooltip="Boost Pad Visual Tuner: Calibrated upward opacity gradient falloff, midpoint calibration & Big Pad floating orb geometry."
            onHover={setHoveredDesc}
            onLeave={() => setHoveredDesc(null)}
            isLight={isLight}
          />
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span
            className={`truncate transition-colors duration-150 ${
              hoveredDesc
                ? isLight
                  ? 'text-neutral-900'
                  : 'text-neutral-100'
                : isLight
                ? 'text-neutral-400'
                : 'text-neutral-500'
            }`}
          >
            {hoveredDesc ||
              'Calibrated visual presets (Atmosphere & FX, Vehicle Global Surfaces & FX, Driftwoods Stadium & Boost Pad).'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
