import React from 'react';
import { useUIStore } from '../core/store';
import { VEHICLE_OPTIONS } from '../config/vehicles';
import { Check } from 'lucide-react';
import {
  PanelContainer,
  PanelHeader,
  PanelContent,
  PanelFooter
} from '../primitives/Panel';
import { UI_RADIUS } from '../tokens/spacing';

export const GaragePanel: React.FC = () => {
  const goBack = useUIStore((s) => s.goBack);
  const activeCar = useUIStore((s) => s.activeCar);
  const setActiveCar = useUIStore((s) => s.setActiveCar);
  const theme = useUIStore((s) => s.theme);

  const isLight = theme === 'light';

  return (
    <PanelContainer>
      {/* 1. Header */}
      <PanelHeader
        title="GARAGE"
        subtitle="Select Vehicle Body & Hitbox"
        onBack={goBack}
      />

      {/* 2. Content Area: 2x3 Grid using clean two-line MenuItem card design */}
      <PanelContent>
        <div className="grid grid-cols-2 gap-3.5 max-h-[380px] overflow-y-auto pr-0.5">
          {VEHICLE_OPTIONS.map((item) => {
            const isSelected = activeCar === item.id;
            return (
              <button
                key={item.id}
                data-ui-element="card"
                type="button"
                onClick={() => setActiveCar(item.id)}
                className={`group relative flex items-center justify-between min-h-[64px] px-4 py-3.5 ${UI_RADIUS.lg} border text-left transition-all duration-150 active:scale-[0.985] outline-none focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer ${
                  isSelected
                    ? isLight
                      ? 'bg-sky-50/90 border-sky-500/90 shadow-sm ring-1 ring-sky-500/25'
                      : 'bg-neutral-800/95 border-sky-500/80 shadow-md ring-1 ring-sky-500/40'
                    : isLight
                      ? 'bg-white hover:bg-neutral-100/90 border-neutral-200/90 hover:border-neutral-300 shadow-2xs'
                      : 'bg-neutral-900/60 hover:bg-neutral-800/70 border-neutral-800/80 hover:border-neutral-700 shadow-2xs'
                }`}
              >
                {/* Two-line text block: Name + Hitbox (identical to MenuItem sans icon) */}
                <div className="flex flex-col items-start justify-center leading-tight min-w-0 pr-2">
                  <span
                    className={`font-semibold text-sm tracking-wide truncate w-full ${
                      isSelected
                        ? isLight
                          ? 'text-sky-950 font-bold'
                          : 'text-white font-bold'
                        : isLight
                          ? 'text-neutral-900'
                          : 'text-neutral-200'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span
                    className={`text-xs font-normal truncate w-full mt-1 ${
                      isSelected
                        ? isLight
                          ? 'text-sky-700/90'
                          : 'text-sky-300/90'
                        : isLight
                          ? 'text-neutral-500'
                          : 'text-neutral-400'
                    }`}
                  >
                    {item.hitbox} Hitbox
                  </span>
                </div>

                {/* Right Selection Indicator */}
                {isSelected && (
                  <div
                    className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
                      isLight
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'bg-sky-500 text-white shadow-xs'
                    }`}
                    aria-label="Equipped"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </PanelContent>

      {/* 3. Footer */}
      <PanelFooter>
        <span className="text-[11px] w-full text-center">
          Vehicle chassis and collision bounds update instantly upon selection.
        </span>
      </PanelFooter>
    </PanelContainer>
  );
};
