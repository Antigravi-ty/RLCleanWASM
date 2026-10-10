import React from 'react';
import { StackGap } from './VStack';
import { UI_SPACING } from '../tokens/spacing';

export interface GridStackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: StackGap | 'xs' | 'xl';
  className?: string;
}

const normalizeGap = (gap?: StackGap | 'xs' | 'xl'): StackGap => {
  if (gap === 'xs') return 'sm';
  if (gap === 'xl') return 'lg';
  return gap ?? 'md';
};

const colsMap = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

/**
 * GridStack
 * Standardized CSS Grid container for cards, inventories, and selection matrices.
 * References Active Canvas width percentages (sm: 1.0%, md: 1.8%, lg: 2.8%).
 */
export const GridStack: React.FC<GridStackProps> = ({
  children,
  cols = 2,
  gap = 'md',
  className = '',
  style,
  ...props
}) => {
  const normGap = normalizeGap(gap);

  return (
    <div
      data-layout="grid-stack"
      data-gap={normGap}
      className={`grid ${colsMap[cols]} w-full ${className}`}
      style={{
        gap: UI_SPACING.stack[normGap],
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
