import React from 'react';
import { Target, Keyboard, LineSquiggle, Video, Sliders, ArrowRight } from 'lucide-react';
import { VStack } from '../../../layout/VStack';
import { ToggleSwitch } from '../../../primitives/ToggleSwitch';
import { useAppStore, type TrajectoryConfig } from '../../../../stores/appStore';

export interface GameplayTabProps {
  isLight?: boolean;
  onNavigateTrainingDetail?: () => void;
  onNavigateKeybindingsDetail?: () => void;
  onNavigateTrajectoryDetail?: () => void;
  onNavigateCameraDetail?: () => void;
  trajectory?: TrajectoryConfig;
  onUpdateTrajectory?: (patch: Partial<TrajectoryConfig>) => void;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const GameplayTab: React.FC<GameplayTabProps> = ({
  isLight = false,
  onNavigateTrainingDetail,
  onNavigateKeybindingsDetail,
  onNavigateTrajectoryDetail,
  onNavigateCameraDetail,
  trajectory: propTrajectory,
  onUpdateTrajectory: propUpdateTrajectory,
  onHover,
  onLeave,
}) => {
  const storeGameplay = useAppStore((s) => s.gameplay);
  const storeUpdateGameplay = useAppStore((s) => s.updateGameplay);
  const gameplay = storeGameplay;
  const updateGameplay = storeUpdateGameplay;

  const storeTrajectory = useAppStore((s) => s.trajectory);
  const storeUpdateTrajectory = useAppStore((s) => s.updateTrajectory);
  const trajectory = propTrajectory ?? storeTrajectory;
  const updateTrajectory = propUpdateTrajectory ?? storeUpdateTrajectory;

  return (
    <VStack gap="md" isLight={isLight}>
      {/* 1. Top Item: Training Mode Configuration (Level 3 Menu Entry) */}
      <div
        className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
        onMouseEnter={() => onHover('Configure training rules, boost mode (standard vs unlimited), goal barrier designer, and car hitbox collision visualization.')}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <Target className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Training Mode Configuration
            </span>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              Boost mode, goal barrier & car hitbox collision overlay
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTrainingDetail?.()}
          className={`py-1 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <span>Configure</span>
          <ArrowRight className="h-3 w-3 opacity-75" />
        </button>
      </div>

      {/* 2. Second Item: Camera Settings */}
      <div
        className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
        onMouseEnter={() => onHover('Field of view, height, angle, distance & tracking stiffness.')}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <Video className="h-4 w-4 text-neutral-400 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Camera Settings
            </span>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              Field of view, distance, height, angle & tracking stiffness
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateCameraDetail?.()}
          onMouseEnter={() => onHover('Open camera live preview panel to adjust FOV, height, angle and stiffness.')}
          onMouseLeave={onLeave}
          className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
          }`}
        >
          <span>Configure</span>
          <ArrowRight className="h-3.5 w-3.5 opacity-75" />
        </button>
      </div>

      {/* 3. Third Item: Key Bindings Settings */}
      <div
        className={`flex items-center justify-between w-full py-2 px-3 rounded-xl border transition-colors select-none ${
          isLight ? 'bg-neutral-50/80 border-neutral-200' : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
        onMouseEnter={() => onHover('Customize keyboard keys and gamepad controller buttons.')}
        onMouseLeave={onLeave}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <Keyboard className="h-4 w-4 text-neutral-400 shrink-0" />
          <div className="flex flex-col text-left leading-tight min-w-0">
            <span className={`text-xs font-semibold truncate ${
              isLight ? 'text-neutral-800' : 'text-neutral-200'
            }`}>
              Key Bindings Settings
            </span>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              Keyboard, mouse & controller mapping configuration
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateKeybindingsDetail?.()}
          onMouseEnter={() => onHover('Open key bindings panel to reassign keyboard and gamepad actions.')}
          onMouseLeave={onLeave}
          className={`shrink-0 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
            isLight
              ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
          }`}
        >
          <span>Configure</span>
          <ArrowRight className="h-3.5 w-3.5 opacity-75" />
        </button>
      </div>

      {/* 4. Fourth Item: Quick Toggle: Ball Cam Indicator (Bound to HUD in-game bottom-left indicator) */}
      <div
        className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
        onMouseEnter={() => onHover('Toggles the on-screen ball camera HUD indicator displayed in the bottom-left corner.')}
        onMouseLeave={onLeave}
        onClick={() => updateGameplay({ ballCamIndicator: !gameplay.ballCamIndicator })}
      >
        <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
          <span className={`text-xs font-semibold truncate ${
            isLight ? 'text-neutral-800' : 'text-neutral-200'
          }`}>
            Ball Cam Indicator
          </span>
          <span className={`text-[11px] mt-0.5 truncate ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            Display HUD indicator in bottom-left corner
          </span>
        </div>
        <ToggleSwitch
          checked={Boolean(gameplay.ballCamIndicator)}
          onCheckedChange={(checked) => updateGameplay({ ballCamIndicator: checked })}
          isLight={isLight}
          variant="neutral"
        />
      </div>

      {/* 5. Fifth Item: Ball Trajectory Predictor Configuration Panel */}
      <div
        className={`p-3.5 rounded-xl border flex flex-col gap-2.5 transition-colors ${
          isLight
            ? 'bg-neutral-50/80 border-neutral-200'
            : 'bg-neutral-850/80 border-neutral-700/80'
        }`}
      >
        <div
          className="flex items-center justify-between w-full cursor-pointer select-none"
          onMouseEnter={() => onHover('Toggles real-time 3D physical flight path prediction for the ball.')}
          onMouseLeave={onLeave}
          onClick={() => updateTrajectory({ enabled: !trajectory.enabled })}
        >
          <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <LineSquiggle className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              <span className={`text-xs font-semibold truncate ${
                isLight ? 'text-neutral-800' : 'text-neutral-200'
              }`}>
                Ball Trajectory Predictor
              </span>
            </div>
            <span className={`text-[11px] mt-0.5 truncate ${
              isLight ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              RocketSim WASM real-time 3D flight trajectory calculation
            </span>
          </div>

          <ToggleSwitch
            checked={Boolean(trajectory.enabled)}
            onCheckedChange={(checked) => updateTrajectory({ enabled: checked })}
            isLight={isLight}
            variant="neutral"
          />
        </div>

        {/* Centered button to enter Layer 3 accuracy predictor panel */}
        <div className="flex justify-center w-full pt-1">
          <button
            type="button"
            onClick={() => onNavigateTrajectoryDetail?.()}
            onMouseEnter={() => onHover('Open trajectory detail panel to adjust prediction horizon, styling, dash intervals and colors.')}
            onMouseLeave={onLeave}
            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.99] ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
            }`}
          >
            <Sliders className="h-3.5 w-3.5 opacity-75" />
            <span>Configure Trajectory Parameters</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-75" />
          </button>
        </div>
      </div>
    </VStack>
  );
};
