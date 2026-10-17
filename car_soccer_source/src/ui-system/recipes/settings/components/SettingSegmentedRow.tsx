import React from 'react';
import { SegmentedSwitch } from '../../../primitives/SegmentedSwitch';

export interface SettingSegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SettingSegmentedRowProps {
  label: string;
  subtitle?: string;
  value: string;
  onChange: (val: string) => void;
  options: SettingSegmentedOption[];
  onHover: () => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const SettingSegmentedRow: React.FC<SettingSegmentedRowProps> = ({
  label,
  subtitle,
  value,
  onChange,
  options,
  onHover,
  onLeave,
  isLight = false,
}) => {
  return (
    <div
      className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg transition-colors hover:bg-neutral-500/10 select-none gap-4"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
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
      <div className="shrink-0">
        <SegmentedSwitch
          value={value}
          onValueChange={onChange}
          options={options}
          isLight={isLight}
          size="sm"
        />
      </div>
    </div>
  );
};
