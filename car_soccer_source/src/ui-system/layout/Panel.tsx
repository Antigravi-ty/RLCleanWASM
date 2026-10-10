import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { UI_SPACING, UI_RADIUS } from '../tokens';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { useInMorphContainer } from '../navigation/transitions';

export interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  actions?: React.ReactNode;
  isLight?: boolean;
}

/**
 * 3-Stage Compound Panel Header
 * Standardized SimpleUI .ui-panel__header pattern (px-6 py-4 / 24px horizontal, 16px vertical)
 */
export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  subtitle,
  badge,
  onBack,
  rightElement,
  actions,
  isLight = false,
}) => {
  return (
    <div
      data-ui-element="panel-header"
      data-panel-section="header"
      className={`flex items-center justify-between ${UI_SPACING.panel.header} border-b select-none shrink-0 transition-colors duration-150 ${
        isLight
          ? 'border-neutral-200/90 bg-neutral-100/50 text-neutral-900'
          : 'border-neutral-800/80 bg-neutral-950/40 text-white'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center justify-center h-8 w-8 shrink-0 aspect-square rounded-lg border transition-all active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300/80 text-neutral-700 shadow-2xs'
                : 'bg-neutral-800/80 hover:bg-neutral-700/80 border-neutral-700/60 text-neutral-200 shadow-2xs'
            }`}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
          </button>
        )}

        <div className="flex flex-col text-left leading-tight min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold tracking-tight uppercase truncate">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle && (
            <p className={`text-xs mt-0.5 font-normal truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {rightElement ?? actions ?? null}
      </div>
    </div>
  );
};

export interface PanelContentProps {
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}

/**
 * 3-Stage Compound Panel Content Body
 * Standardized SimpleUI .ui-panel__content pattern (p-6 / 24px uniform padding)
 * Ensures components breathe comfortably without clipping borders or scrollbars.
 */
export const PanelContent: React.FC<PanelContentProps> = ({
  children,
  className = '',
  scrollable = true,
}) => {
  return (
    <div
      data-ui-element="panel-content"
      data-panel-section="content"
      className={`flex flex-col flex-1 min-h-0 ${UI_SPACING.panel.body} w-full box-border ${
        scrollable ? 'overflow-y-auto' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

export interface PanelFooterProps {
  children?: React.ReactNode;
  hint?: string;
  isLight?: boolean;
  className?: string;
}

/**
 * 3-Stage Compound Panel Footer
 * Standardized SimpleUI .ui-panel__footer pattern (px-6 py-3.5) with secondary surface background.
 */
export const PanelFooter: React.FC<PanelFooterProps> = ({
  children,
  hint,
  isLight = false,
  className = '',
}) => {
  return (
    <div
      data-ui-element="panel-footer"
      data-panel-section="footer"
      className={`flex items-center justify-between ${UI_SPACING.panel.footer} border-t text-xs select-none shrink-0 mt-auto transition-colors duration-150 ${
        isLight
          ? 'border-neutral-200/90 text-neutral-600 bg-neutral-100/60'
          : 'border-neutral-800/80 text-neutral-400 bg-neutral-950/50'
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">{children}</div>
      {hint && (
        <div className="shrink-0 ml-3">
          <KeycapBadge size="sm" isLight={isLight}>
            {hint}
          </KeycapBadge>
        </div>
      )}
    </div>
  );
};

export interface PanelContainerProps {
  children: React.ReactNode;
  isLight?: boolean;
  className?: string;
  transparent?: boolean;
}

/**
 * PanelContainer
 * Shell wrapping the 3-stage panel hierarchy (Header -> Content -> Footer).
 * 当处于 MorphContainer 内时作为纯内容承载器，外壳背景与边框由外层容器常驻负责；
 * 当作为独立面板静态展示时，渲染完整的独立容器底板背景与边框。
 */
export const PanelContainer: React.FC<PanelContainerProps> = ({
  children,
  isLight = false,
  className = '',
  transparent,
}) => {
  const inMorphContainer = useInMorphContainer();
  const isTransparent = transparent ?? inMorphContainer;

  // 当处于 MorphContainer 内部时，剥离内层阴影与边框，避免双层边框或内容淡出时将底板背景一同降透明度
  const effectiveClassName = isTransparent
    ? className
        .replace(/shadow-\[[^\]]+\]/g, '')
        .replace(/\bshadow(-\w+)?\b/g, '')
        .trim()
    : className;

  return (
    <div
      data-panel="container"
      className={`flex flex-col h-full w-full overflow-hidden transition-colors ${
        isTransparent
          ? 'bg-transparent border-0 ring-0 shadow-none'
          : `${UI_RADIUS.xl} border shadow-2xl ${
              isLight
                ? 'bg-neutral-50/98 border-neutral-300/80 text-neutral-900 ring-1 ring-black/5'
                : 'bg-neutral-900/98 border-neutral-700/60 text-neutral-100 ring-1 ring-white/10'
            }`
      } ${effectiveClassName}`}
    >
      {children}
    </div>
  );
};
