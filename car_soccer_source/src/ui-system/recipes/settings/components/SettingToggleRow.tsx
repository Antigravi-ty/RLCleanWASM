import React from 'react';
import { ToggleSwitch } from '../../../primitives/ToggleSwitch';

export interface SettingToggleRowProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  label,
  subtitle,
  checked,
  onChange,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 cursor-pointer select-none"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-col text-left leading-tight min-w-0 pr-2">
        <span className={`text-xs font-semibold truncate ${
          isLight ? 'text-neutral-800' : 'text-neutral-200'
        }`}>
          {label}
        </span>
        {subtitle && (
          <span className={`text-[11px] mt-0.5 truncate ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            {subtitle}
          </span>
        )}
      </div>
      <ToggleSwitch
        checked={checked}
        onCheckedChange={onChange}
        isLight={isLight}
        variant="neutral"
      />
    </div>
  );
};
