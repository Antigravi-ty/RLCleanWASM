import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { GameUIRoot } from './GameUIRoot';
import { useUIStore, type ActiveMenuRoute } from './core/store';
import { perfTelemetryStore } from './tokens/perfTelemetryStore';
import { attachGameRuntimeBridge, syncMaterialsToGame } from './core/runtimeBridgeAdapter';
import '../styles/ui-system.css';

export { syncMaterialsToGame };

export interface GameUIRuntimeHandle {
  openMenu: (route?: ActiveMenuRoute) => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  syncVisualMaterials?: () => void;
  destroy: () => void;
}

export function mountGameUI(
  container: HTMLElement,
  gameRuntime?: any
): GameUIRuntimeHandle {
  let rootEl = container.querySelector<HTMLElement>('#game-ui-root');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'game-ui-root';
    rootEl.style.position = 'absolute';
    rootEl.style.inset = '0';
    rootEl.style.pointerEvents = 'none';
    rootEl.style.zIndex = '500';
    container.appendChild(rootEl);
  }

  const root: Root = createRoot(rootEl);
  root.render(<GameUIRoot portalContainer={rootEl} />);

  if (gameRuntime) {
    attachGameRuntimeBridge(gameRuntime);
  }

  return {
    openMenu: (route = 'main-menu') => useUIStore.getState().openMenu(route),
    closeMenu: () => useUIStore.getState().closeMenu(),
    toggleMenu: () => useUIStore.getState().toggleMenu(),
    syncVisualMaterials: () => syncMaterialsToGame(gameRuntime),
    destroy: () => {
      perfTelemetryStore.setSampler(null);
      root.unmount();
      rootEl?.remove();
    }
  };
}

export { useUIStore } from './core/store';
export { GameUIRoot } from './GameUIRoot';
export * from './tokens';
export * from './primitives';
export * from './layout';
export * from './charts';
export * from './navigation';
export * from './recipes';
export * from './panels/DiagnosticsFloatingWindow';
export * from './core/UIInspector';
export * from './hud';

