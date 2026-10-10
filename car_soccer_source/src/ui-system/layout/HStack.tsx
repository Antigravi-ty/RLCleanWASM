import React from 'react';
import { StackGap, StackAlign, StackJustify } from './VStack';
import { UI_SPACING } from '../tokens/spacing';

export interface HStackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: StackGap | 'xs' | 'xl';
  align?: StackAlign | 'baseline';
  justify?: StackJustify | 'around';
  wrap?: boolean;
  divider?: boolean | React.ReactNode;
  isLight?: boolean;
  className?: string;
}

const normalizeGap = (gap?: StackGap | 'xs' | 'xl'): StackGap => {
  if (gap === 'xs') return 'sm';
  if (gap === 'xl') return 'lg';
  return gap ?? 'md';
};

const alignMap: Record<StackAlign | 'baseline', string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyMap: Record<StackJustify | 'around', string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

/**
 * HStack (Horizontal Stack)
 * Standardized flex-row container referencing Active Canvas width percentages (sm: 1.0%, md: 1.8%, lg: 2.8%).
 * Completely eliminates arbitrary pixel/rem drift between horizontal widgets.
 */
export const HStack: React.FC<HStackProps> = ({
  children,
  gap = 'md',
  align = 'center',
  justify = 'start',
  wrap = false,
  divider = false,
  isLight = false,
  className = '',
  style,
  ...props
}) => {
  const normGap = normalizeGap(gap);
  const childArray = React.Children.toArray(children);

  return (
    <div
      data-layout="hstack"
      data-gap={normGap}
      className={`flex flex-row ${wrap ? 'flex-wrap' : 'flex-nowrap'} ${alignMap[align]} ${justifyMap[justify]} ${className}`}
      style={{
        gap: UI_SPACING.stack[normGap],
        ...style,
      }}
      {...props}
    >
      {divider
        ? childArray.map((child, index) => (
            <React.Fragment key={index}>
              {child}
              {index < childArray.length - 1 && (
                typeof divider === 'boolean' ? (
                  <span
                    className={`inline-block w-px self-stretch my-1 ${
                      isLight ? 'bg-neutral-200' : 'bg-neutral-800'
                    }`}
                  />
                ) : (
                  divider
                )
              )}
            </React.Fragment>
          ))
        : children}
    </div>
  );
};
