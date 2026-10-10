import React, { useState } from 'react';
import { Target, Zap, Box, Info } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { VStack } from '../layout/VStack';
import { useUIStore, type GameplayConfig } from '../core/store';

export interface Layer3TrainingRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  gameplay?: GameplayConfig;
  onUpdateGameplay?: (patch: Partial<GameplayConfig>) => void;
}

/**
 * [Recipe] Layer 3 Training Configuration Panel (Width: 480px)
 * Streamlined 3-stage compound panel for practice rules:
 * - Boost Rule: SegmentedSwitch (Unlimited vs Standard)
 * - Show Car Hitbox: ToggleSwitch
 * - Live synchronization with physics & collision bounding mesh
 */
export const Layer3TrainingRecipe: React.FC<Layer3TrainingRecipeProps> = ({
  isLight = false,
  onBack,
  gameplay: propGameplay,
  onUpdateGameplay: propUpdateGameplay,
}) => {
  const storeGameplay = useUIStore((s) => s.gameplay);
  const storeUpdateGameplay = useUIStore((s) => s.updateGameplay);

  const gameplay = propGameplay ?? storeGameplay;
  const updateGameplay = propUpdateGameplay ?? storeUpdateGameplay;

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  const boostValue = gameplay.unlimitedBoost ? 'unlimited' : 'standard';

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[480px]">
      <PanelHeader
        title="TRAINING CONFIGURATION"
        onBack={onBack}
        isLight={isLight}
      />

      <PanelContent scrollable className="p-4 sm:p-5">
        <VStack gap="md" isLight={isLight}>
          {/* Section 1: Boost Replenishment Rule */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-colors select-none ${
              isLight ? 'bg-neutral-50/90 border-neutral-200' : 'bg-neutral-850/90 border-neutral-700/80'
            }`}
            onMouseEnter={() =>
              setHoveredDesc('Choose between continuous unlimited boost refill or authentic 100% capacity limitation in practice.')
            }
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                  Boost Rule
                </span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                gameplay.unlimitedBoost
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : isLight
                  ? 'bg-neutral-200 text-neutral-700'
                  : 'bg-neutral-800 text-neutral-300'
              }`}>
                {gameplay.unlimitedBoost ? 'UNLIMITED' : 'STANDARD'}
              </span>
            </div>

            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Select whether boost remains permanently full or follows standard consumption and canister pickup mechanics.
            </p>

            <div className="pt-0.5">
              <SegmentedSwitch
                value={boostValue}
                fullWidth
                isLight={isLight}
                onValueChange={(val) => updateGameplay({ unlimitedBoost: val === 'unlimited' })}
                options={[
                  { value: 'unlimited', label: 'Unlimited' },
                  { value: 'standard', label: 'Standard (100%)' },
                ]}
              />
            </div>
          </div>

          {/* Section 2: Show Car Hitbox Wireframe */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors cursor-pointer select-none ${
              isLight ? 'bg-neutral-50/90 border-neutral-200 hover:bg-neutral-100/80' : 'bg-neutral-850/90 border-neutral-700/80 hover:bg-neutral-800/80'
            }`}
            onClick={() => updateGameplay({ showCarHitbox: !gameplay.showCarHitbox })}
            onMouseEnter={() =>
              setHoveredDesc('Draws accurate 3D oriented bounding box (OBB) wireframe around the vehicle.')
            }
            onMouseLeave={() => setHoveredDesc(null)}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Box className="h-4 w-4 text-emerald-500 shrink-0" />
              <div className="flex flex-col text-left leading-tight min-w-0">
                <span className={`text-xs font-semibold truncate ${
                  isLight ? 'text-neutral-800' : 'text-neutral-200'
                }`}>
                  Show Car Hitbox
                </span>
                <span className={`text-[11px] mt-0.5 truncate ${
                  isLight ? 'text-neutral-500' : 'text-neutral-400'
                }`}>
                  Draws vehicle 3D collision wireframe in real time
                </span>
              </div>
            </div>

            <ToggleSwitch
              checked={Boolean(gameplay.showCarHitbox)}
              onCheckedChange={(checked) => updateGameplay({ showCarHitbox: checked })}
              isLight={isLight}
              variant="neutral"
            />
          </div>
        </VStack>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span className={`truncate transition-colors duration-150 ${
            hoveredDesc
              ? (isLight ? 'text-neutral-900' : 'text-neutral-100')
              : (isLight ? 'text-neutral-400' : 'text-neutral-500')
          }`}>
            {hoveredDesc || 'Configure free play boost rules and visual collision box overlay.'}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
