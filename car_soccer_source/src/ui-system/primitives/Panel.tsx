import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useUIStore } from '../core/store';

export interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightElement,
  actions,
  badge
}) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';
  const rightSlot = rightElement ?? actions ?? badge ?? null;

  return (
    <div
      data-ui-element="panel-header"
      className={`flex items-center justify-between px-6 pt-5 pb-4 border-b select-none shrink-0 ${
        isLight ? 'border-neutral-200/90' : 'border-neutral-800/80'
      }`}
    >
      <div className="min-w-14 flex items-center justify-start shrink-0">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 cursor-pointer ${
              isLight
                ? 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/70'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80'
            }`}
            aria-label="Back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
        ) : null}
      </div>

      <div className="text-center px-2 min-w-0 flex-1">
        <h2 className={`text-base font-bold tracking-wide uppercase truncate ${isLight ? 'text-neutral-900' : 'text-white'}`}>
          {title}
        </h2>
        {subtitle && (
          <p className={`text-[11px] font-normal mt-0.5 truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="min-w-14 flex items-center justify-end shrink-0">
        {rightSlot}
      </div>
    </div>
  );
};

export const PanelContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      data-ui-element="panel-content"
      className={`flex flex-col flex-1 min-h-0 px-6 py-5 w-full overflow-y-auto box-border ${className}`}
    >
      {children}
    </div>
  );
};

export const PanelFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const theme = useUIStore((s) => s.theme);
  const isLight = theme === 'light';

  return (
    <div
      data-ui-element="panel-footer"
      className={`flex items-center justify-between px-6 py-4 border-t text-xs select-none shrink-0 mt-auto ${
        isLight
          ? 'border-neutral-200/90 text-neutral-600 bg-neutral-100/50'
          : 'border-neutral-800/80 text-neutral-400 bg-neutral-950/30'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const PanelContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      data-ui-element="panel-container"
      className={`flex flex-col w-full h-full min-w-0 box-border ${className}`}
    >
      {children}
    </div>
  );
};
