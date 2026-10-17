import React, { useRef, useState, useLayoutEffect, useEffect } from 'react';
import { X } from 'lucide-react';
import { UI_RADIUS } from '../../tokens/radius';
import {
  DialogueButtonVariant,
  DialogueButtonConfig,
  DialogueProps,
} from './dialogueTypes';
import {
  buildCombinedShadow,
  getLucideIconComponent,
  getToneConfig,
  MONO_FONT_STACK,
  DEFAULT_TITLES
} from './dialogueStyles';

export const Dialogue: React.FC<DialogueProps> = ({
  tone = 'error',
  title,
  titleFontSize = 26,
  titleLetterSpacing = 8,
  titleFontWeight = 600,
  titleMarginTop = 0,
  titleMarginBottom = 10,
  titleColorMode = 'content',
  titleColor,
  content = '',
  contentMarginBottom = 18,
  icon,
  iconVariant = 'plain',
  iconSize = 42,
  buttons = [
    { label: 'Confirm', variant: 'primary' },
    { label: 'Cancel', variant: 'outline' },
  ],
  isLight = false,
  paddingTop = 10,
  paddingBottom = 16,
  paddingY = 16,
  paddingX = 32,
  dialoguePadding,
  sectionGap,
  innerGlowBlur = 36,
  outerShadowBlur = 20,
  minHeight = 165,
  maxWidth = 560,
  className = '',
  showCloseButton = false,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [equalButtonWidth, setEqualButtonWidth] = useState<number | null>(null);

  const resolvedTitle = title || DEFAULT_TITLES[tone] || 'ALERT';

  const effectivePaddingTop = paddingTop ?? paddingY ?? dialoguePadding ?? 10;
  const effectivePaddingBottom = paddingBottom ?? paddingY ?? dialoguePadding ?? 16;
  const effectivePaddingX = paddingX ?? (dialoguePadding ? Math.round(dialoguePadding * 1.25) : 32);
  const effectiveTitleMarginTop = titleMarginTop ?? 0;
  const effectiveTitleMarginBottom = titleMarginBottom ?? sectionGap ?? 10;
  const effectiveContentMarginBottom = contentMarginBottom ?? sectionGap ?? 20;

  const effectiveIconSize = iconSize ?? (iconVariant === 'plain' ? 46 : 22);

  const toneConfig = getToneConfig(tone, isLight);
  const combinedShadow = buildCombinedShadow(tone, isLight, innerGlowBlur, outerShadowBlur);

  let resolvedIconNode: React.ReactNode = null;
  if (typeof icon === 'string' && icon.trim()) {
    const IconComponent = getLucideIconComponent(icon.trim());
    if (IconComponent) {
      resolvedIconNode = <IconComponent size={effectiveIconSize} className="shrink-0 transition-all" />;
    } else {
      const FallbackIcon = toneConfig.defaultIconComponent;
      resolvedIconNode = <FallbackIcon size={effectiveIconSize} className="shrink-0 transition-all" />;
    }
  } else if (React.isValidElement(icon)) {
    resolvedIconNode = React.cloneElement(icon as React.ReactElement<any>, {
      size: effectiveIconSize,
      className: `${(icon.props as any).className || ''} shrink-0 transition-all`,
    });
  } else if (icon) {
    resolvedIconNode = icon;
  } else {
    const DefaultToneIcon = toneConfig.defaultIconComponent;
    resolvedIconNode = <DefaultToneIcon size={effectiveIconSize} className="shrink-0 transition-all" />;
  }

  const getTitleColorClass = () => {
    if (titleColor) return '';
    switch (titleColorMode) {
      case 'muted':
        return isLight ? 'text-neutral-500' : 'text-neutral-400';
      case 'primary':
        return isLight ? 'text-neutral-900' : 'text-neutral-100';
      case 'tone':
        if (tone === 'error') return isLight ? 'text-red-600' : 'text-red-400';
        if (tone === 'orange') return isLight ? 'text-orange-600' : 'text-orange-400';
        if (tone === 'warning') return isLight ? 'text-yellow-600' : 'text-yellow-400';
        return isLight ? 'text-neutral-600' : 'text-neutral-300';
      case 'content':
      default:
        return isLight ? 'text-neutral-600' : 'text-neutral-300';
    }
  };

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const btnElements = containerRef.current.querySelectorAll<HTMLButtonElement>('button[data-dialogue-btn="true"]');
    if (btnElements.length === 0) return;

    btnElements.forEach((btn) => {
      btn.style.width = 'auto';
    });

    let maxW = 0;
    btnElements.forEach((btn) => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > maxW) maxW = rect.width;
    });

    if (maxW > 0) {
      setEqualButtonWidth(Math.ceil(Math.max(maxW, 92)));
    }
  }, [buttons, isLight, title, content, maxWidth, effectivePaddingX]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const btnElements = containerRef.current.querySelectorAll<HTMLButtonElement>('button[data-dialogue-btn="true"]');
      if (btnElements.length === 0) return;

      btnElements.forEach((btn) => {
        btn.style.width = 'auto';
      });

      let maxW = 0;
      btnElements.forEach((btn) => {
        const rect = btn.getBoundingClientRect();
        if (rect.width > maxW) maxW = rect.width;
      });

      if (maxW > 0) {
        setEqualButtonWidth(Math.ceil(Math.max(maxW, 92)));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [buttons]);

  const minHeightStyle = typeof minHeight === 'number' ? `${minHeight}px` : minHeight;
  const maxWidthStyle = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  const letterSpacingStyle = typeof titleLetterSpacing === 'number' ? `${titleLetterSpacing}px` : titleLetterSpacing;

  const renderButton = (btn: DialogueButtonConfig, index: number) => {
    const variant: DialogueButtonVariant =
      btn.variant ?? (index === 0 ? toneConfig.defaultButtonVariant : 'outline');

    let variantClasses = '';
    if (variant === 'primary') {
      variantClasses = isLight
        ? 'bg-neutral-900 text-white hover:bg-neutral-800 border-neutral-900 shadow-xs'
        : 'bg-white text-neutral-950 hover:bg-neutral-100 border-white shadow-xs';
    } else if (variant === 'danger') {
      variantClasses = isLight
        ? 'bg-red-600 text-white hover:bg-red-700 border-red-600 shadow-xs'
        : 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border-red-500/40 shadow-xs';
    } else {
      variantClasses = isLight
        ? 'bg-transparent text-neutral-800 hover:bg-neutral-100/90 border-neutral-300'
        : 'bg-transparent text-neutral-200 hover:bg-white/10 border-neutral-700';
    }

    const isDisabled = Boolean(btn.disabled);

    return (
      <button
        key={btn.key ?? `${btn.label}-${index}`}
        data-dialogue-btn="true"
        type="button"
        disabled={isDisabled}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (btn.onClick) btn.onClick();
        }}
        style={{
          width: equalButtonWidth ? `${equalButtonWidth}px` : undefined,
          fontFamily: MONO_FONT_STACK,
        }}
        className={`inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg border select-none transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 active:scale-[0.98] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 truncate text-center ${variantClasses}`}
      >
        {btn.label}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      data-component="dialogue"
      data-tone={tone}
      style={{
        minHeight: minHeightStyle,
        maxWidth: maxWidthStyle,
        paddingTop: `${effectivePaddingTop}px`,
        paddingBottom: `${effectivePaddingBottom}px`,
        paddingLeft: `${effectivePaddingX}px`,
        paddingRight: `${effectivePaddingX}px`,
        boxShadow: combinedShadow,
        fontFamily: MONO_FONT_STACK,
      }}
      className={`relative w-full flex flex-col justify-between ${UI_RADIUS.xl} border transition-all duration-150 select-none ${
        isLight
          ? `bg-white text-neutral-900 ${toneConfig.cardBorderClass}`
          : `bg-neutral-900 text-neutral-100 ${toneConfig.cardBorderClass}`
      } ${className}`}
    >
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute top-3.5 right-3.5 p-1 rounded-lg transition-colors cursor-pointer outline-none focus-visible:ring-2 ${
            isLight
              ? 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
              : 'text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div 
        className="w-full shrink-0 flex items-center justify-center text-center px-2"
        style={{ 
          marginTop: `${effectiveTitleMarginTop}px`,
          marginBottom: `${effectiveTitleMarginBottom}px` 
        }}
      >
        <h2
          style={{
            fontSize: `${titleFontSize}px`,
            letterSpacing: letterSpacingStyle,
            fontWeight: Number(titleFontWeight) || 400,
            color: titleColor || undefined,
          }}
          className={`text-center tracking-tight truncate leading-tight transition-colors ${getTitleColorClass()}`}
        >
          {resolvedTitle}
        </h2>
      </div>

      <div 
        className="flex-1 min-h-0 flex items-center gap-4 sm:gap-4.5 px-1"
        style={{ marginBottom: `${effectiveContentMarginBottom}px` }}
      >
        {iconVariant === 'container' ? (
          <div
            className={`shrink-0 rounded-xl flex items-center justify-center p-2.5 transition-transform select-none ${toneConfig.iconContainerClass}`}
          >
            {resolvedIconNode}
          </div>
        ) : (
          <div
            className={`shrink-0 flex items-center justify-center select-none transition-transform ${toneConfig.plainIconColorClass}`}
          >
            {resolvedIconNode}
          </div>
        )}

        <div className="flex-1 min-w-0 text-left">
          {typeof content === 'string' ? (
            <p
              className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line font-normal ${
                isLight ? 'text-neutral-600' : 'text-neutral-300'
              }`}
            >
              {content}
            </p>
          ) : (
            content
          )}
        </div>
      </div>

      {buttons.length > 0 && (
        <div className="shrink-0 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mt-auto w-full">
          {buttons.map((btn, index) => renderButton(btn, index))}
        </div>
      )}
    </div>
  );
};
