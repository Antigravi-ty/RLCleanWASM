import React from 'react';
import { useUIStore } from '../core/store';
import { VEHICLE_OPTIONS } from '../config/vehicles';
import { Play, Car, Sliders, Zap } from 'lucide-react';
import {
  MenuContainer,
  MenuItem,
  MenuDivider,
  MenuSectionTitle
} from '../primitives/Menu';
import {
  PanelContainer,
  PanelHeader,
  PanelContent,
  PanelFooter
} from '../primitives/Panel';

export const MainMenuPanel: React.FC = () => {
  const closeMenu = useUIStore((s) => s.closeMenu);
  const navigate = useUIStore((s) => s.navigate);
  const activeCar = useUIStore((s) => s.activeCar);
  const theme = useUIStore((s) => s.theme);
  const pauseRenderingOnMenu = useUIStore((s) => s.pauseRenderingOnMenu);

  const currentVehicle = VEHICLE_OPTIONS.find((v) => v.id === activeCar) ?? VEHICLE_OPTIONS[0];
  const isLight = theme === 'light';

  return (
    <PanelContainer>
      {/* 1. Panel Header */}
      <PanelHeader
        title="PAUSED"
        subtitle="Free Play Training Arena"
      />

      {/* 2. Panel Content with SimpleUI padded breathing room */}
      <PanelContent>
        {/* Navigation Group with tokenized container padding */}
        <MenuContainer ariaLabel="Main Pause Menu">
          <MenuSectionTitle>Quick Navigation</MenuSectionTitle>

          {/* Resume Action */}
          <MenuItem
            id="menu-btn-resume"
            variant="primary"
            title="Resume"
            subtitle="Continue game match"
            badge="ESC"
            autoFocus
            onClick={closeMenu}
            icon={<Play className="h-4 w-4 fill-current ml-0.5 text-emerald-500" />}
          />

          <MenuDivider />

          {/* Garage Navigation */}
          <MenuItem
            id="menu-btn-garage"
            variant="secondary"
            title="Garage"
            subtitle={currentVehicle.label}
            hasArrow
            onClick={() => navigate('garage')}
            icon={<Car className="h-4 w-4 text-sky-400" />}
          />

          {/* Settings Navigation */}
          <MenuItem
            id="menu-btn-settings"
            variant="secondary"
            title="Settings"
            subtitle="Safe Area & Viewport Scaling"
            hasArrow
            onClick={() => navigate('settings')}
            icon={<Sliders className="h-4 w-4 text-amber-400" />}
          />
        </MenuContainer>
      </PanelContent>

      {/* 3. Energy Saver Indicator Footer */}
      <PanelFooter>
        <div className="flex items-center gap-2">
          <Zap
            className={`h-3.5 w-3.5 ${
              pauseRenderingOnMenu ? 'text-amber-500' : isLight ? 'text-neutral-400' : 'text-neutral-500'
            }`}
          />
          <span className="text-[11px]">
            {pauseRenderingOnMenu ? '3D Render Paused' : '3D Render Active'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('settings')}
          className={`text-[11px] underline underline-offset-2 transition-colors font-medium cursor-pointer ${
            isLight ? 'text-sky-600 hover:text-sky-700' : 'text-sky-400 hover:text-sky-300'
          }`}
        >
          Modify settings
        </button>
      </PanelFooter>
    </PanelContainer>
  );
};
