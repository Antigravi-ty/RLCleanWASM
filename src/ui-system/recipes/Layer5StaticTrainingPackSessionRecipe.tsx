import React, { useState } from 'react';
import { Play, Pencil, Check, Info } from 'lucide-react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import {
  useStaticTrainingPackStore,
  getActiveEditItemVariable,
} from '../../stores/staticTrainingPackStore';
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
 */
export const Layer5StaticTrainingPackSessionRecipe: React.FC<
  Layer5StaticTrainingPackSessionRecipeProps
> = ({ isLight = false, transparent = false, onBack, onCollapsePreview }) => {
  const activePack = useStaticTrainingPackStore((s) => s.activePack);
  const sessionMode = useStaticTrainingPackStore((s) => s.sessionMode);
  const setSessionMode = useStaticTrainingPackStore((s) => s.setSessionMode);
  const currentShotIndex = useStaticTrainingPackStore((s) => s.currentShotIndex);
  const setCurrentShotIndex = useStaticTrainingPackStore((s) => s.setCurrentShotIndex);

  const isEditingItem = useStaticTrainingPackStore((s) => s.isEditingItem);
  const editVarVersion = useStaticTrainingPackStore((s) => s.editVarVersion);
  const enterItemEditMode = useStaticTrainingPackStore((s) => s.enterItemEditMode);
  const exitItemEditModeAndSave = useStaticTrainingPackStore((s) => s.exitItemEditModeAndSave);

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'list' | 'inspector'>('inspector');

  // Subscribe to editVarVersion so fast in-memory variable mutations re-render sliders smoothly
  void editVarVersion;

  const items = activePack?.items || [];
  const safeIndex = Math.max(0, Math.min(Math.max(0, items.length - 1), currentShotIndex));
  const currentShot =
    (sessionMode === 'edit' && isEditingItem && getActiveEditItemVariable()) ||
    items[safeIndex] ||
    null;

  const handleBackClick = async () => {
    if (isEditingItem) {
      await exitItemEditModeAndSave();
    }
    onBack?.();
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
              onClick={async () => {
                if (sessionMode === 'edit') {
                  await exitItemEditModeAndSave();
                  setSessionMode('play');
                } else {
                  setSessionMode('edit');
                  enterItemEditMode(safeIndex);
                }
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
              }`}
              title={sessionMode === 'edit' ? 'Switch to Play Mode' : 'Switch to Edit Mode'}
            >
              {sessionMode === 'edit' ? (
                <>
                  <Play className="h-3 w-3" />
                  <span>Play Mode</span>
                </>
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  <span>Edit Mode</span>
                </>
              )}
            </button>

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

      <PanelContent scrollable={true} className="p-4 flex flex-col gap-3">
        {sessionMode === 'play' && (
          <StaticTrainingPlayView
            isLight={isLight}
            items={items}
            safeIndex={safeIndex}
            currentShot={currentShot}
          />
        )}

        {sessionMode === 'edit' && currentShot && (
          <>
            {/* Top Mode Switcher: Shot List vs Item Inspector */}
            <div className="flex items-center justify-between gap-2">
              <div className="grow">
                <SegmentedSwitch
                  options={[
                    {
                      value: 'inspector',
                      label: `Edit Shot #${safeIndex + 1}: ${currentShot.name}`,
                    },
                    {
                      value: 'list',
                      label: `Shot List & Reorder (${items.length})`,
                    },
                  ]}
                  value={editTab}
                  onChange={(v) => setEditTab(v as 'list' | 'inspector')}
                  isLight={isLight}
                  size="sm"
                />
              </div>

              <button
                type="button"
                onClick={async () => {
                  await exitItemEditModeAndSave();
                  enterItemEditMode(safeIndex);
                  setHoveredDesc(
                    `Saved Shot #${safeIndex + 1} to IndexedDB (/static-training-pack/${activePack?.metadata.uuid}/items/${safeIndex}).`
                  );
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold shrink-0 cursor-pointer ${
                  isLight
                    ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-900 text-white'
                    : 'bg-white hover:bg-neutral-200 border-white text-neutral-900'
                }`}
                title="Commit current in-memory shot variable to IndexedDB"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Save Item</span>
              </button>
            </div>

            {editTab === 'list' ? (
              <StaticTrainingShotListView
                isLight={isLight}
                items={items}
                safeIndex={safeIndex}
                onSelectInspectShot={async (idx) => {
                  if (isEditingItem) await exitItemEditModeAndSave();
                  setCurrentShotIndex(idx);
                  enterItemEditMode(idx);
                  setEditTab('inspector');
                }}
                onHoverDesc={setHoveredDesc}
              />
            ) : (
              <StaticTrainingShotInspectorView
                isLight={isLight}
                currentShot={currentShot}
                onHoverDesc={setHoveredDesc}
              />
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
                ? 'Press TAB for Live Preview. Use [9] / [0] or Right-Click to cycle 3D Edit Sub-Modes.'
                : 'Press TAB for Live Preview. Hotkeys: [R] Reset Shot, [[] Prev Shot, []] Next Shot.')}
          </span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
