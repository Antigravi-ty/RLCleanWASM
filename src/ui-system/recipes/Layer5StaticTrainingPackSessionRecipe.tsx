import React, { useState } from 'react';
import { Info, CornerUpLeft } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import {
  useStaticTrainingPackStore,
  getActiveEditItemVariable,
} from '../../stores/staticTrainingPackStore';
import { dialogue } from '../primitives/dialogue/dialogueStore';
import { StaticTrainingPlayView } from './static-training/StaticTrainingPlayView';
import { StaticTrainingShotListView } from './static-training/StaticTrainingShotListView';
import { StaticTrainingShotInspectorView } from './static-training/StaticTrainingShotInspectorView';

export interface Layer5StaticTrainingPackSessionRecipeProps {
  isLight?: boolean;
  transparent?: boolean;
  onBack?: () => void;
  onCollapsePreview?: () => void;
}

/**
 * [Recipe] Layer 5 Static Training Pack Session Panel (Play & Edit with Live Preview [TAB])
 * - No direct switching between Edit Mode and Play Mode (must return to Pack Browser).
 * - In Edit Mode:
 *   - Starts in full horizontal Shot List view (!isEditingItem).
 *   - Clicking a shot expands the right-side Edit Shot control panel while the left column
 *     narrows to compact shot numbers (#01, #02, ...) with a fixed bottom-left Deselect button.
 *   - Clicking Back prompts a Save / Ignore / Cancel confirmation dialogue backed by the
 *     dedicated Edit-Mode IndexedDB.
 */
export const Layer5StaticTrainingPackSessionRecipe: React.FC<
  Layer5StaticTrainingPackSessionRecipeProps
> = ({ isLight = false, transparent = false, onBack, onCollapsePreview }) => {
  const activePack = useStaticTrainingPackStore((s) => s.activePack);
  const sessionMode = useStaticTrainingPackStore((s) => s.sessionMode);
  const currentShotIndex = useStaticTrainingPackStore((s) => s.currentShotIndex);

  const isEditingItem = useStaticTrainingPackStore((s) => s.isEditingItem);
  const editVarVersion = useStaticTrainingPackStore((s) => s.editVarVersion);
  const enterItemEditMode = useStaticTrainingPackStore((s) => s.enterItemEditMode);
  const deselectEditShot = useStaticTrainingPackStore((s) => s.deselectEditShot);
  const commitEditSessionToMainDb = useStaticTrainingPackStore((s) => s.commitEditSessionToMainDb);
  const discardEditSessionChanges = useStaticTrainingPackStore((s) => s.discardEditSessionChanges);

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  // Subscribe to editVarVersion so fast in-memory variable mutations re-render sliders smoothly
  void editVarVersion;

  const items = activePack?.items || [];
  const safeIndex = Math.max(0, Math.min(Math.max(0, items.length - 1), currentShotIndex));
  const currentShot =
    (sessionMode === 'edit' && isEditingItem && getActiveEditItemVariable()) ||
    items[safeIndex] ||
    null;

  const handleBackClick = () => {
    if (sessionMode !== 'edit') {
      onBack?.();
      return;
    }

    dialogue.show({
      id: 'static-training-exit-edit-confirm',
      title: 'EXIT EDIT MODE',
      tone: 'warning',
      icon: 'triangle-alert',
      maxWidth: 500,
      content:
        'Do you want to save your previous edits before exiting Edit Mode?',
      buttons: [
        {
          label: 'Save',
          variant: 'primary',
          onClick: async () => {
            await commitEditSessionToMainDb();
            onBack?.();
          },
        },
        {
          label: 'Ignore',
          variant: 'danger',
          onClick: async () => {
            await discardEditSessionChanges();
            onBack?.();
          },
        },
        {
          label: 'Cancel',
          variant: 'outline',
        },
      ],
    });
  };

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer5-static-training-pack-session']}
      transparent={transparent}
      className="w-full"
    >
      <PanelHeader
        title={
          sessionMode === 'edit'
            ? `EDIT: ${activePack?.metadata.title || 'PACK'}`
            : `PLAY: ${activePack?.metadata.title || 'PACK'}`
        }
        onBack={handleBackClick}
        isLight={isLight}
        rightElement={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCollapsePreview}
              onMouseEnter={() =>
                setHoveredDesc(
                  'Press TAB or click to collapse panel into Live Preview dock and control the 3D scene directly.'
                )
              }
              onMouseLeave={() => setHoveredDesc(null)}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs transition-all cursor-pointer select-none active:scale-95 ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 shadow-2xs'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200 shadow-2xs'
              }`}
              title="Press TAB or click to collapse to Live Preview dock"
            >
              <span
                className={`text-[11px] font-sans font-medium ${
                  isLight ? 'text-neutral-700' : 'text-neutral-300'
                }`}
              >
                Live Preview
              </span>
              <KeycapBadge shortcut="TAB" size="sm" isLight={isLight} />
            </button>
          </div>
        }
      />

      <PanelContent
        scrollable={sessionMode === 'play'}
        className="p-4 flex flex-col gap-3 h-full min-h-0 overflow-hidden"
      >
        {sessionMode === 'play' && (
          <StaticTrainingPlayView
            isLight={isLight}
            items={items}
            safeIndex={safeIndex}
            currentShot={currentShot}
          />
        )}

        {sessionMode === 'edit' && (
          <>
            {!isEditingItem || !currentShot ? (
              /* State 1: Full-width horizontal Shot List when no shot is selected */
              <StaticTrainingShotListView
                isLight={isLight}
                items={items}
                safeIndex={safeIndex}
                onSelectInspectShot={(idx) => {
                  enterItemEditMode(idx);
                }}
                onHoverDesc={setHoveredDesc}
              />
            ) : (
              /* State 2: Split View — Compact Shot Number List + Fixed Deselect on Left, Edit Shot Panel on Right */
              <div className="grid grid-cols-12 gap-3.5 h-full min-h-0 overflow-hidden">
                {/* LEFT COLUMN: Compact Shot Numbers + Fixed Bottom Deselect (3 cols) */}
                <div
                  className={`col-span-3 flex flex-col justify-between rounded-xl border overflow-hidden min-h-0 ${
                    isLight
                      ? 'bg-neutral-50/80 border-neutral-200'
                      : 'bg-neutral-900/60 border-neutral-800'
                  }`}
                >
                  <div
                    className={`px-2.5 py-2 border-b text-[10px] font-mono font-bold uppercase tracking-wider text-center shrink-0 ${
                      isLight
                        ? 'border-neutral-200 text-neutral-500 bg-neutral-100/70'
                        : 'border-neutral-800 text-neutral-400 bg-neutral-900/90'
                    }`}
                  >
                    SHOTS ({items.length})
                  </div>

                  <div className="flex flex-col gap-1 p-1.5 overflow-y-auto grow min-h-0">
                    {items.map((shot, idx) => {
                      const active = idx === safeIndex;
                      const numStr = `#${String(idx + 1).padStart(2, '0')}`;
                      return (
                        <button
                          key={shot.id || idx}
                          type="button"
                          onClick={() => enterItemEditMode(idx)}
                          onMouseEnter={() =>
                            setHoveredDesc(`Select ${numStr} (${shot.name})`)
                          }
                          onMouseLeave={() => setHoveredDesc(null)}
                          className={`w-full py-2 px-2 rounded-lg border font-mono text-xs font-extrabold text-center transition-all cursor-pointer ${
                            active
                              ? isLight
                                ? 'bg-neutral-900 border-neutral-900 text-white shadow-xs'
                                : 'bg-white border-white text-neutral-900 shadow-xs'
                              : isLight
                              ? 'bg-white/80 hover:bg-white border-neutral-200 text-neutral-700'
                              : 'bg-neutral-850/70 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                          }`}
                        >
                          {numStr}
                        </button>
                      );
                    })}
                  </div>

                  {/* Fixed Bottom-Left Deselect Button */}
                  <div
                    className={`p-1.5 border-t shrink-0 ${
                      isLight
                        ? 'border-neutral-200 bg-neutral-100/70'
                        : 'border-neutral-800 bg-neutral-900/90'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => void deselectEditShot()}
                      onMouseEnter={() =>
                        setHoveredDesc(
                          'Deselect shot and return to full Shot List to reorder, duplicate, export JSON, or import JSON.'
                        )
                      }
                      onMouseLeave={() => setHoveredDesc(null)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                        isLight
                          ? 'bg-white hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                          : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-100'
                      }`}
                    >
                      <CornerUpLeft className="h-3.5 w-3.5" />
                      <span>Deselect</span>
                    </button>
                  </div>
                </div>

                {/* RIGHT COLUMN: Edit Shot Control Panel (9 cols) */}
                <div className="col-span-9 flex flex-col min-h-0 overflow-y-auto pr-1">
                  <div className="flex items-center justify-between pb-2 shrink-0">
                    <span className="text-xs font-extrabold uppercase tracking-wider opacity-80">
                      EDIT SHOT #{String(safeIndex + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <StaticTrainingShotInspectorView
                    isLight={isLight}
                    currentShot={currentShot}
                    onHoverDesc={setHoveredDesc}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center gap-2 w-full text-xs truncate">
          <Info className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          <span
            className={`truncate transition-colors duration-150 ${
              hoveredDesc
                ? isLight
                  ? 'text-neutral-900'
                  : 'text-neutral-100'
                : isLight
                ? 'text-neutral-400'
                : 'text-neutral-500'
            }`}
          >
            {hoveredDesc ||
              (sessionMode === 'edit'
                ? 'Press TAB for Live Preview. 9/0 Cycle Selection · V to Move Down · O/P Boost · [/] Speed.'
                : 'Press TAB for Live Preview. Hotkeys: [R] Reset Shot, [[] Prev Shot, []] Next Shot.')}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
