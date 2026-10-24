import React from 'react';
import { StateReplayBenchPanel } from './dev-test-lab/StateReplayBenchPanel';

export interface RewinderConfiguratorFloatingWindowProps {
  isLight?: boolean;
  active?: boolean;
}

export const RewinderConfiguratorFloatingWindow: React.FC<RewinderConfiguratorFloatingWindowProps> = ({
  isLight = false,
}) => {
  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const subPanelBg = isLight
    ? 'bg-white border-neutral-200/90 text-neutral-800'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-200';

  return (
    <div className="flex flex-col gap-2.5 select-none text-xs">
      <StateReplayBenchPanel
        isLight={isLight}
        cardBg={cardBg}
        subPanelBg={subPanelBg}
      />
    </div>
  );
};
