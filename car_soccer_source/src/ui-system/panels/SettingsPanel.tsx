import React from 'react';
import { useUIStore } from '../core/store';
import { Sun, Moon, Eye, Zap } from 'lucide-react';
import {
  PanelContainer,
  PanelHeader,
  PanelContent,
  PanelFooter
} from '../primitives/Panel';
import { SliderControl } from '../primitives/SliderControl';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { UI_RADIUS } from '../tokens/spacing';

export const SettingsPanel: React.FC = () => {
  const goBack = useUIStore((s) => s.goBack);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const safeAreaMargin = useUIStore((s) => s.safeAreaMargin);
  const setSafeAreaMargin = useUIStore((s) => s.setSafeAreaMargin);
  const renderScale = useUIStore((s) => s.renderScale);
  const setRenderScale = useUIStore((s) => s.setRenderScale);
  const pauseRenderingOnMenu = useUIStore((s) => s.pauseRenderingOnMenu);
  const setPauseRenderingOnMenu = useUIStore((s) => s.setPauseRenderingOnMenu);
  const showSafeAreaHud = useUIStore((s) => s.showSafeAreaHud);
  const setShowSafeAreaHud = useUIStore((s) => s.setShowSafeAreaHud);

  const isLight = theme === 'light';

  return (
    <PanelContainer>
      {/* Header */}
      <PanelHeader
        title="SETTINGS"
        subtitle="Safe Area & Viewport Scaling Engine"
        onBack={goBack}
      />

      {/* Content Area with structured cards and padding */}
      <PanelContent className="gap-3.5">
        {/* Appearance Section Card */}
        <div
          data-ui-element="card"
          className={`flex flex-col gap-2 p-4 ${UI_RADIUS.lg} border transition-colors ${
            isLight ? 'bg-neutral-100/80 border-neutral-200/90' : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
              Appearance Theme
            </span>
            <SegmentedSwitch
              name="appearance-theme"
              value={theme}
              onValueChange={(val) => setTheme(val as 'dark' | 'light')}
              options={[
                { value: 'light', label: 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
                { value: 'dark', label: 'Dark', icon: <Moon className="h-3.5 w-3.5" /> }
              ]}
            />
          </div>
          <p className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            System surface tones and contrast styling for game overlay.
          </p>
        </div>

        {/* Safe Area Margin Section Card */}
        <div
          data-ui-element="card"
          className={`flex flex-col gap-2 p-4 ${UI_RADIUS.lg} border transition-colors ${
            isLight ? 'bg-neutral-100/80 border-neutral-200/90' : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <SliderControl
            id="slider-safe-area"
            label="Safe Area Margin"
            description="SimpleUI adaptive insets (-5% tight boundary to +10% protective buffer)."
            value={safeAreaMargin}
            min={-5}
            max={10}
            step={1}
            unit="%"
            accentColor="sky"
            onValueChange={setSafeAreaMargin}
            onReset={() => setSafeAreaMargin(0)}
          />

          {/* HUD Telemetry toggle checkbox */}
          <div className="px-1 pt-1 border-t border-neutral-200/60 dark:border-neutral-800/60">
            <label className={`flex items-center gap-2 cursor-pointer text-[11px] select-none ${
              isLight ? 'text-neutral-700' : 'text-neutral-300'
            }`}>
              <input
                type="checkbox"
                checked={showSafeAreaHud}
                onChange={(e) => setShowSafeAreaHud(e.target.checked)}
                className="rounded accent-sky-500 cursor-pointer"
              />
              <span className="inline-flex items-center gap-1.5">
                <Eye className={`h-3.5 w-3.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`} />
                Show Boundary Guides & Telemetry HUD Overlay
              </span>
            </label>
          </div>
        </div>

        {/* Viewport Render Scale Card */}
        <div
          data-ui-element="card"
          className={`flex flex-col gap-2 p-4 ${UI_RADIUS.lg} border transition-colors ${
            isLight ? 'bg-neutral-100/80 border-neutral-200/90' : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <SliderControl
            id="slider-render-scale"
            label="Viewport Render Scale"
            description="Scales canvas buffer and typography dynamically (50% to 200%)."
            value={renderScale}
            min={50}
            max={200}
            step={5}
            unit="%"
            accentColor="amber"
            onValueChange={setRenderScale}
            onReset={() => setRenderScale(100)}
          />
        </div>

        {/* Energy Conservation Card */}
        <div
          data-ui-element="card"
          className={`flex flex-col gap-2 p-4 ${UI_RADIUS.lg} border transition-colors ${
            isLight ? 'bg-neutral-100/80 border-neutral-200/90' : 'bg-neutral-900/50 border-neutral-800/80'
          }`}
        >
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={pauseRenderingOnMenu}
              onChange={(e) => setPauseRenderingOnMenu(e.target.checked)}
              className="mt-0.5 rounded accent-emerald-500 cursor-pointer"
            />
            <div className="flex flex-col">
              <span className={`text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                <Zap className="h-3.5 w-3.5 text-emerald-500" />
                Pause 3D Rendering When Menu is Open
              </span>
              <span className={`text-[11px] leading-relaxed mt-0.5 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Suspends WebGL canvas redraws while in pause menu to conserve battery and GPU resources.
              </span>
            </div>
          </label>
        </div>
      </PanelContent>

      {/* Footer */}
      <PanelFooter>
        <span className="text-[11px]">
          Preferences are automatically persisted to LocalStorage.
        </span>
      </PanelFooter>
    </PanelContainer>
  );
};
