import React from 'react';
import { Plus, X } from 'lucide-react';
import { useFloatingStore, floatingStore, type FloatingWindowConfig } from '../../../tokens/floatingStore';

export interface FloatingWindowCardProps {
  preset: FloatingWindowConfig;
  icon: React.ReactNode;
  iconBgClass: string;
  badge?: string;
  badgeClass?: string;
  description: string;
  hoverTooltip: string;
  onHover: (desc: string) => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const FloatingWindowCard: React.FC<FloatingWindowCardProps> = ({
  preset,
  icon,
  iconBgClass,
  badge,
  badgeClass = 'bg-sky-500/15 border-sky-500/30 text-sky-400',
  description,
  hoverTooltip,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const { windows } = useFloatingStore();
  const existingWindow = windows.find((w) => w.id === preset.id);

  return (
    <div
      onMouseEnter={() => onHover(hoverTooltip)}
      onMouseLeave={onLeave}
      className={`flex items-center justify-between gap-3 p-4 rounded-xl border text-xs transition-all ${
        isLight
          ? 'bg-neutral-50/90 hover:bg-neutral-100/90 border-neutral-200 shadow-2xs'
          : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80'
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBgClass}`}>
          {icon}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-bold text-sm leading-tight ${
                isLight ? 'text-neutral-900' : 'text-neutral-100'
              }`}
            >
              {preset.title}
            </span>
            {badge && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${badgeClass}`}>
                {badge}
              </span>
            )}
          </div>
          <p
            className={`text-xs leading-normal line-clamp-2 ${
              isLight ? 'text-neutral-600' : 'text-neutral-400'
            }`}
          >
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {existingWindow ? (
          <button
            type="button"
            onClick={() => floatingStore.closeWindow(preset.id)}
            title={`Close "${preset.title}"`}
            className="h-8 w-8 rounded-xl border flex items-center justify-center cursor-pointer transition-all active:scale-95 outline-none bg-red-500/15 hover:bg-red-500/25 border-red-400/40 text-red-500 shrink-0"
          >
            <X className="h-4 w-4 stroke-[2.5]" />
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              const containerEl =
                document.getElementById('game-ui-viewport-host') ||
                document.body;
              floatingStore.spawnWithFlight(preset, e.currentTarget, containerEl);
            }}
            title={`Spawn "${preset.title}" into Stack`}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-2xs shrink-0 ${
              isLight
                ? 'bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-800'
                : 'bg-neutral-100 hover:bg-white text-neutral-950 font-bold border border-neutral-200'
            }`}
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Spawn</span>
          </button>
        )}
      </div>
    </div>
  );
};
