import React, { useEffect, useRef, useState } from 'react';
import { GameViewport } from './core/GameViewport';
import { MenuShell } from './core/MenuShell';
import { useUIStore } from './core/store';
import { copyAndLogLayoutSnapshot } from './core/UIInspector';
import { Copy, Check } from 'lucide-react';

export interface GameUIRootProps {
  portalContainer?: HTMLElement | null;
}

export const GameUIRoot: React.FC<GameUIRootProps> = ({ portalContainer }) => {
  const isOpen = useUIStore((s) => s.isOpen);
  const activeRoute = useUIStore((s) => s.activeRoute);
  const goBack = useUIStore((s) => s.goBack);
  const closeMenu = useUIStore((s) => s.closeMenu);
  const theme = useUIStore((s) => s.theme);
  const isLivePreviewCollapsed = useUIStore((s) => s.isLivePreviewCollapsed);
  const setLivePreviewCollapsed = useUIStore((s) => s.setLivePreviewCollapsed);

  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isLight = theme === 'light';

  // Global hotkeys: Escape and TAB
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Tab key toggles Live Preview when in trajectory or camera mode
      if (e.key === 'Tab') {
        if (isOpen && (activeRoute === 'trajectory' || activeRoute === 'camera')) {
          e.preventDefault();
          e.stopPropagation();
          setLivePreviewCollapsed(!isLivePreviewCollapsed);
          return;
        }
      }

      // 2. Escape key handles navigation stack
      if (e.key === 'Escape') {
        if (isLivePreviewCollapsed) {
          e.preventDefault();
          e.stopPropagation();
          setLivePreviewCollapsed(false);
          return;
        }
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          if (activeRoute !== 'main-menu') {
            goBack();
          } else {
            closeMenu();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, activeRoute, isLivePreviewCollapsed, goBack, closeMenu, setLivePreviewCollapsed]);

  const handleInspect = async () => {
    await copyAndLogLayoutSnapshot(activeRoute);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div ref={rootRef} className="contents">
      <GameViewport>
        {/* Main Morphing Menu Shell with Left-Middle Inspector Slot */}
        <MenuShell
          inspectorSlot={
            isOpen ? (
              <button
                type="button"
                data-ui-element="ui-inspector-btn"
                onClick={handleInspect}
                className={`fixed left-4 top-1/2 -translate-y-1/2 z-[9999] pointer-events-auto flex items-center justify-center p-2.5 rounded-xl text-xs font-mono font-medium shadow-xl border backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
                  isLight
                    ? 'bg-white/95 text-neutral-800 border-neutral-300 hover:bg-neutral-100 shadow-neutral-300/50'
                    : 'bg-neutral-900/95 text-neutral-100 border-neutral-700 hover:bg-neutral-800 shadow-black/60'
                }`}
                title="导出当前菜单布局数据 (已同步输出至控制台并复制到剪贴板)"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-500 stroke-[3]" />
                    <span className="sr-only">已复制布局数据至剪贴板</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 text-amber-500" />
                    <span className="sr-only">导出当前菜单布局数据</span>
                  </>
                )}
              </button>
            ) : null
          }
        />
      </GameViewport>
    </div>
  );
};
