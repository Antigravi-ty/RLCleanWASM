import React, { useRef, useState } from 'react';
import {
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Unlink2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Copy,
  Check,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { SliderControl } from '../../primitives/SliderControl';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import {
  useReferenceOverlayStore,
  DEFAULT_REFERENCE_RESOLUTION,
  type ReferenceImageItem,
} from '../../../stores/referenceOverlayStore';

export interface ReferenceOverlayCardProps {
  isLight: boolean;
  cardClass: string;
}

export const ReferenceOverlayCard: React.FC<ReferenceOverlayCardProps> = ({
  isLight,
  cardClass,
}) => {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const importJsonInputRef = useRef<HTMLInputElement | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [copiedOverlayJson, setCopiedOverlayJson] = useState(false);

  const overlayEnabled = useReferenceOverlayStore((s) => s.enabled);
  const setOverlayEnabled = useReferenceOverlayStore((s) => s.setEnabled);
  const folderName = useReferenceOverlayStore((s) => s.folderName);
  const images = useReferenceOverlayStore((s) => s.images);
  const activeIndex = useReferenceOverlayStore((s) => s.activeIndex);
  const activeResolutionKey = useReferenceOverlayStore((s) => s.activeResolutionKey);
  const setFolderImages = useReferenceOverlayStore((s) => s.setFolderImages);
  const clearImages = useReferenceOverlayStore((s) => s.clearImages);
  const setActiveIndex = useReferenceOverlayStore((s) => s.setActiveIndex);
  const stepImage = useReferenceOverlayStore((s) => s.stepImage);
  const setActiveResolutionKey = useReferenceOverlayStore((s) => s.setActiveResolutionKey);
  const updateProfile = useReferenceOverlayStore((s) => s.updateProfile);
  const resetProfile = useReferenceOverlayStore((s) => s.resetProfile);
  const exportProfilesJson = useReferenceOverlayStore((s) => s.exportProfilesJson);
  const importProfilesJson = useReferenceOverlayStore((s) => s.importProfilesJson);

  const activeImage = images[activeIndex] || null;
  const effectiveResKey =
    activeResolutionKey !== 'ALL'
      ? activeResolutionKey
      : activeImage
      ? `${activeImage.width}x${activeImage.height}`
      : DEFAULT_REFERENCE_RESOLUTION;

  const activeProfile = useReferenceOverlayStore((s) => s.getProfile(effectiveResKey));

  const resolutionGroups = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const img of images) {
      const k = `${img.width}x${img.height}`;
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    if (!counts.has(DEFAULT_REFERENCE_RESOLUTION)) {
      counts.set(DEFAULT_REFERENCE_RESOLUTION, 0);
    }
    return Array.from(counts.entries());
  }, [images]);

  const filteredImages = React.useMemo(() => {
    if (activeResolutionKey === 'ALL') return images.map((img, idx) => ({ img, idx }));
    const matched = images
      .map((img, idx) => ({ img, idx }))
      .filter(({ img }) => `${img.width}x${img.height}` === activeResolutionKey);
    return matched.length > 0 ? matched : images.map((img, idx) => ({ img, idx }));
  }, [images, activeResolutionKey]);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setLoadingImages(true);
    try {
      const pngFiles = Array.from(fileList)
        .filter(
          (f) =>
            f.type === 'image/png' ||
            f.name.toLowerCase().endsWith('.png')
        )
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      let detectedFolder = 'Selected Folder';
      if (pngFiles.length > 0) {
        const rel = (pngFiles[0] as any).webkitRelativePath || '';
        if (rel.includes('/')) {
          detectedFolder = rel.split('/')[0];
        }
      }

      const loadedItems: ReferenceImageItem[] = [];
      for (let i = 0; i < pngFiles.length; i++) {
        const file = pngFiles[i];
        const url = URL.createObjectURL(file);
        const dims = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () =>
            resolve({
              width: img.naturalWidth || 4112,
              height: img.naturalHeight || 2658,
            });
          img.onerror = () => resolve({ width: 4112, height: 2658 });
          img.src = url;
        });

        loadedItems.push({
          id: `${file.name}-${i}-${file.size}`,
          name: file.name,
          relativePath: (file as any).webkitRelativePath || file.name,
          url,
          width: dims.width,
          height: dims.height,
          sizeBytes: file.size,
        });
      }

      setFolderImages(detectedFolder, loadedItems);
    } finally {
      setLoadingImages(false);
      e.target.value = '';
    }
  };

  const handleCopyOverlayJson = async () => {
    try {
      const payload = exportProfilesJson();
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedOverlayJson(true);
      setTimeout(() => setCopiedOverlayJson(false), 2000);
    } catch (err) {
      console.warn('[ReferenceOverlayCard] Copy overlay JSON failed:', err);
    }
  };

  const handleDownloadOverlayJson = () => {
    try {
      const payload = exportProfilesJson();
      const jsonStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hitbox-reference-overlay-${effectiveResKey}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[ReferenceOverlayCard] Download overlay JSON failed:', err);
    }
  };

  const handleImportOverlayJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      importProfilesJson(parsed);
    } catch (err) {
      console.warn('[ReferenceOverlayCard] Failed to import overlay JSON:', err);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ImageIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-bold text-[11px] text-amber-500 truncate">
            Reference PNG Folder Overlay (z-4 · Normal Alpha Mix)
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-[10px] opacity-75">Invert RGB</span>
            <ToggleSwitch
              checked={activeProfile.invertImage}
              onChange={(invertImage) => updateProfile({ invertImage }, effectiveResKey)}
              isLight={isLight}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono opacity-75">Overlay</span>
            <ToggleSwitch
              checked={overlayEnabled}
              onChange={(checked) => setOverlayEnabled(checked)}
              isLight={isLight}
            />
          </div>
        </div>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        accept=".png,image/png"
        multiple
        // @ts-expect-error webkitdirectory is standard across Chromium/WebKit/Firefox for folder selection
        webkitdirectory=""
        directory=""
        onChange={handleFolderSelect}
        className="hidden"
      />
      <input
        ref={importJsonInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportOverlayJsonFile}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className={`flex-1 min-w-[150px] px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
            isLight
              ? 'bg-amber-500 hover:bg-amber-400 border-amber-500 text-neutral-950'
              : 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-neutral-950'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>
            {loadingImages
              ? 'Reading PNGs...'
              : images.length > 0
              ? `Folder: ${folderName} (${images.length} PNG)`
              : 'Select PNG Reference Folder'}
          </span>
        </button>

        {images.length > 0 && (
          <button
            type="button"
            onClick={clearImages}
            title="Clear loaded reference images"
            className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
              isLight
                ? 'bg-white hover:bg-rose-50 border-neutral-300 text-rose-600'
                : 'bg-neutral-800 hover:bg-rose-950/40 border-neutral-700 text-rose-400'
            }`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        <button
          type="button"
          onClick={handleCopyOverlayJson}
          title="Copy resolution-specific overlay calibration JSON"
          className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
            copiedOverlayJson
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : isLight
              ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          {copiedOverlayJson ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span>{copiedOverlayJson ? 'Copied' : 'Copy Overlay JSON'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadOverlayJson}
          title="Export resolution-specific overlay calibration .JSON"
          className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
            isLight
              ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <Download className="h-3 w-3" />
          <span>Export</span>
        </button>

        <button
          type="button"
          onClick={() => importJsonInputRef.current?.click()}
          title="Import overlay calibration .JSON"
          className={`px-2 py-1.5 rounded-lg border text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
            isLight
              ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
              : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
          }`}
        >
          <Upload className="h-3 w-3" />
          <span>Import</span>
        </button>
      </div>

      {/* Resolution Specialization Filter & Image Switcher */}
      <div
        className={`p-2 rounded-lg border flex flex-col gap-1.5 ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between gap-2 text-[10px]">
          <span className="font-semibold opacity-80">
            Target Resolution Profile (Default Spec: 4112×2658):
          </span>
          <div className="flex items-center gap-1">
            <select
              value={effectiveResKey}
              onChange={(e) => setActiveResolutionKey(e.target.value)}
              className={`px-1.5 py-0.5 rounded border font-mono text-[10px] outline-none ${
                isLight
                  ? 'bg-neutral-50 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-900 border-neutral-700 text-amber-400'
              }`}
            >
              {resolutionGroups.map(([rk, count]) => (
                <option key={rk} value={rk}>
                  {rk} {rk === DEFAULT_REFERENCE_RESOLUTION ? '(Ref Spec)' : ''} [{count}]
                </option>
              ))}
              {images.length > 0 && <option value="ALL">All Resolutions [{images.length}]</option>}
            </select>

            <button
              type="button"
              onClick={() => resetProfile(effectiveResKey)}
              title={`Reset calibration profile for ${effectiveResKey}`}
              className={`px-1.5 py-0.5 rounded border text-[10px] font-mono flex items-center gap-0.5 cursor-pointer ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-700'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'
              }`}
            >
              <RotateCcw className="h-2.5 w-2.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {images.length > 0 ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => stepImage(-1)}
              className={`p-1 rounded border cursor-pointer ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
              }`}
              title="Previous PNG in folder"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <select
              value={activeIndex}
              onChange={(e) => setActiveIndex(Number(e.target.value))}
              className={`flex-1 min-w-0 px-2 py-1 rounded border font-mono text-[11px] truncate outline-none ${
                isLight
                  ? 'bg-neutral-50 border-neutral-300 text-neutral-800'
                  : 'bg-neutral-900 border-neutral-700 text-neutral-100'
              }`}
            >
              {filteredImages.map(({ img, idx }, pos) => (
                <option key={img.id} value={idx}>
                  [{pos + 1}/{filteredImages.length}] {img.name} ({img.width}×{img.height})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => stepImage(1)}
              className={`p-1 rounded border cursor-pointer ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
              }`}
              title="Next PNG in folder"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-[10px] font-mono opacity-60 py-0.5">
            No folder loaded yet. Select a folder containing reference PNG screenshots (e.g. 4112×2658) to overlay on top of the 3D viewport.
          </div>
        )}
      </div>

      {/* Opacity, Scale & Offset Controls */}
      <div className="flex flex-col gap-2 pt-0.5">
        <SliderControl
          label="Overlay Opacity"
          value={activeProfile.opacity}
          min={0}
          max={1}
          step={0.01}
          editable={true}
          allowOutOfBoundsInput={false}
          usePrecisionContext={true}
          onChange={(opacity) => updateProfile({ opacity }, effectiveResKey)}
          isLight={isLight}
        />

        <div className="flex items-center justify-between pt-1 border-t border-neutral-500/20">
          <span className="font-semibold text-[11px]">
            Overlay Scale & Offset ({effectiveResKey})
          </span>
          <button
            type="button"
            onClick={() =>
              updateProfile({ scaleLinked: !activeProfile.scaleLinked }, effectiveResKey)
            }
            className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              activeProfile.scaleLinked
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-600'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400'
            }`}
            title="Toggle proportional linked Scale X & Scale Y vs independent unlinked axes"
          >
            {activeProfile.scaleLinked ? (
              <>
                <Link2 className="h-3 w-3" />
                <span>Scale Linked (X = Y)</span>
              </>
            ) : (
              <>
                <Unlink2 className="h-3 w-3" />
                <span>Unlinked (X / Y)</span>
              </>
            )}
          </button>
        </div>

        {activeProfile.scaleLinked ? (
          <SliderControl
            label="Uniform Image Scale (X & Y Linked)"
            value={activeProfile.scaleX}
            min={0.1}
            max={3.0}
            step={0.001}
            unit="x"
            editable={true}
            allowOutOfBoundsInput={true}
            usePrecisionContext={true}
            onChange={(val) =>
              updateProfile({ scaleX: val, scaleY: val }, effectiveResKey)
            }
            isLight={isLight}
          />
        ) : (
          <>
            <SliderControl
              label="Image Scale X (Horizontal)"
              value={activeProfile.scaleX}
              min={0.1}
              max={3.0}
              step={0.001}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              usePrecisionContext={true}
              onChange={(scaleX) => updateProfile({ scaleX }, effectiveResKey)}
              isLight={isLight}
            />
            <SliderControl
              label="Image Scale Y (Vertical)"
              value={activeProfile.scaleY}
              min={0.1}
              max={3.0}
              step={0.001}
              unit="x"
              editable={true}
              allowOutOfBoundsInput={true}
              usePrecisionContext={true}
              onChange={(scaleY) => updateProfile({ scaleY }, effectiveResKey)}
              isLight={isLight}
            />
          </>
        )}

        <SliderControl
          label="Image Offset X (Horizontal Shift)"
          value={activeProfile.offsetX}
          min={-1500}
          max={1500}
          step={0.5}
          unit=" px"
          variation="centered"
          origin={0}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(offsetX) => updateProfile({ offsetX }, effectiveResKey)}
          isLight={isLight}
        />

        <SliderControl
          label="Image Offset Y (Vertical Shift)"
          value={activeProfile.offsetY}
          min={-1500}
          max={1500}
          step={0.5}
          unit=" px"
          variation="centered"
          origin={0}
          editable={true}
          allowOutOfBoundsInput={true}
          usePrecisionContext={true}
          onChange={(offsetY) => updateProfile({ offsetY }, effectiveResKey)}
          isLight={isLight}
        />
      </div>
    </div>
  );
};
