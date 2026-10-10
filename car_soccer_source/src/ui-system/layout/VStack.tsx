import React from 'react';
import { UI_SPACING } from '../tokens/spacing';

export type StackGap = 'none' | 'sm' | 'md' | 'lg';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

export interface VStackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: StackGap | 'xs' | 'xl';
  align?: StackAlign;
  justify?: StackJustify;
  divider?: boolean | React.ReactNode;
  isLight?: boolean;
  className?: string;
}

const normalizeGap = (gap?: StackGap | 'xs' | 'xl'): StackGap => {
  if (gap === 'xs') return 'sm';
  if (gap === 'xl') return 'lg';
  return gap ?? 'md';
};

const alignMap: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const justifyMap: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

/**
 * VStack (Vertical Stack)
 * Standardized flex-col container enforcing tokenized Active Canvas width percentages (sm: 1.0%, md: 1.8%, lg: 2.8%).
 * Completely eliminates arbitrary pixel/rem drift between child widgets.
 */
export const VStack: React.FC<VStackProps> = ({
  children,
  gap = 'md',
  align = 'stretch',
  justify = 'start',
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
      data-layout="vstack"
      data-gap={normGap}
      className={`flex flex-col w-full ${alignMap[align]} ${justifyMap[justify]} ${className}`}
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
                  <hr
                    className={`border-none h-px w-full my-0.5 ${
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
