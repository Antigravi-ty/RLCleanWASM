import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { GameUIRoot } from './GameUIRoot';
import { useAppStore, type ActiveMenuRoute } from '../stores/appStore';
import { perfTelemetryStore } from '../stores/perfTelemetryStore';
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
    openMenu: (route = 'main-menu') => useAppStore.getState().openMenu(route),
    closeMenu: () => useAppStore.getState().closeMenu(),
    toggleMenu: () => useAppStore.getState().toggleMenu(),
    syncVisualMaterials: () => syncMaterialsToGame(gameRuntime),
    destroy: () => {
      perfTelemetryStore.setSampler(null);
      root.unmount();
      rootEl?.remove();
    }
  };
}

export { useAppStore } from '../stores/appStore';
export { GameUIRoot } from './GameUIRoot';
export { hudStore } from '../stores/hudStore';
export { networkDiagnosticsStore } from '../stores/networkDiagnosticsStore';

