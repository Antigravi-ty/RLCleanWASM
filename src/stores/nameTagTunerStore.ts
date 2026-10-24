import { create } from 'zustand';
import {
  type NameTagConfig,
  getNameTagConfig,
  updateNameTagConfig,
  resetNameTagConfig,
  getNameTagRuntimeState,
  subscribeNameTagConfig,
} from '../config/nameTagConfig';

export interface NameTagTunerStoreState {
  config: NameTagConfig;
  isTunerArenaActive: boolean;
  kickoffPermutationIndex: number;
  updateConfig: (patch: Partial<NameTagConfig>) => void;
  updatePreviewName: (index: number, name: string) => void;
  resetConfig: () => void;
  enterTunerArenaAndSpawnSixCars: () => void;
  exitTunerArena: () => void;
  reshuffleKickoffPositions: () => void;
}

export const useNameTagTunerStore = create<NameTagTunerStoreState>((set) => ({
  config: getNameTagConfig(),
  isTunerArenaActive: getNameTagRuntimeState().isTunerArenaActive,
  kickoffPermutationIndex: getNameTagRuntimeState().kickoffPermutationIndex,

  updateConfig: (patch) => {
    const next = updateNameTagConfig(patch);
    set({ config: next });
  },

  updatePreviewName: (index, name) => {
    const current = getNameTagConfig();
    const nextNames = [...current.previewNames];
    if (index >= 0 && index < 6) {
      nextNames[index] = name;
    }
    const next = updateNameTagConfig({ previewNames: nextNames });
    set({ config: next });
  },

  resetConfig: () => {
    const next = resetNameTagConfig();
    set({ config: next });
  },

  enterTunerArenaAndSpawnSixCars: () => {
    const rt = getNameTagRuntimeState();
    rt.onEnterTunerArena?.();
  },

  exitTunerArena: () => {
    const rt = getNameTagRuntimeState();
    rt.onExitTunerArena?.();
  },

  reshuffleKickoffPositions: () => {
    const rt = getNameTagRuntimeState();
    rt.onReshuffleKickoffPositions?.();
  },
}));

subscribeNameTagConfig(() => {
  const cfg = getNameTagConfig();
  const rt = getNameTagRuntimeState();
  useNameTagTunerStore.setState({
    config: cfg,
    isTunerArenaActive: rt.isTunerArenaActive,
    kickoffPermutationIndex: rt.kickoffPermutationIndex,
  });
});
