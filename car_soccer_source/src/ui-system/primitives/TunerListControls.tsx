import React from 'react';
import { ChevronUp, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { Badge } from './Badge';

export interface PriorityQueueItem {
  id: string;
  name: string;
  hex: string;
}

export interface PriorityQueueListProps {
  title: string;
  subtitle?: string;
  items: PriorityQueueItem[];
  onReorder: (index: number, direction: 'up' | 'down') => void;
  accentDotColor?: string;
  isLight?: boolean;
  className?: string;
}

export const PriorityQueueList: React.FC<PriorityQueueListProps> = ({
  title,
  subtitle,
  items,
  onReorder,
  accentDotColor = '#3b82f6',
  isLight = false,
  className = '',
}) => {
  return (
    <div
      data-component="priority-queue-list"
      className={`p-3.5 rounded-xl border flex flex-col gap-2.5 select-none transition-colors ${
        isLight
          ? 'bg-neutral-50/80 border-neutral-200 text-neutral-800'
          : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-xs flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: accentDotColor }} />
          <span>{title}</span>
        </span>
        {subtitle && <span className="text-[10px] font-mono opacity-70">{subtitle}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item, idx) => {
          const isTop = idx === 0;
          const isBottom = idx === items.length - 1;
          return (
            <div
              key={item.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/80 border-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[11px] font-bold text-neutral-400">#{idx + 1}</span>
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/15 dark:border-white/20 shrink-0 shadow-2xs"
                  style={{ backgroundColor: item.hex }}
                />
                <span className="font-medium truncate">{item.name}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Badge size="sm" variant={idx === 0 ? 'amber' : 'neutral'} isLight={isLight}>
                  {idx === 0 ? 'Primary' : `Fallback ${idx}`}
                </Badge>
                <button
                  type="button"
                  disabled={isTop}
                  onClick={() => onReorder(idx, 'up')}
                  className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                    isLight
                      ? 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                      : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                  }`}
                  title="Move Up"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={isBottom}
                  onClick={() => onReorder(idx, 'down')}
                  className={`p-1 rounded border transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                    isLight
                      ? 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
                      : 'border-neutral-700 hover:bg-neutral-800 text-neutral-300'
                  }`}
                  title="Move Down"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export interface EventCatalogEntry {
  hex: string;
  id: string;
  name: string;
}

export interface EventFilterMatrixProps {
  title?: string;
  items: EventCatalogEntry[];
  selectedMap: Record<string, boolean>;
  onToggleItem: (hex: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  isLight?: boolean;
  className?: string;
}

export const EventFilterMatrix: React.FC<EventFilterMatrixProps> = ({
  title = 'Console Event Filter Catalog',
  items,
  selectedMap,
  onToggleItem,
  onSelectAll,
  onDeselectAll,
  isLight = false,
  className = '',
}) => {
  const activeCount = items.filter((i) => selectedMap[i.hex.toLowerCase()]).length;

  return (
    <div
      data-component="event-filter-matrix"
      className={`p-3.5 rounded-xl border flex flex-col gap-2.5 select-none transition-colors ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
          : 'bg-neutral-900/60 border-neutral-800 text-neutral-200'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold uppercase tracking-wider ${
              isLight ? 'text-neutral-700' : 'text-neutral-300'
            }`}
          >
            {title}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-bold">
            {activeCount} / {items.length} Active
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSelectAll}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {items.map((item) => {
          const isChecked = Boolean(selectedMap[item.hex.toLowerCase()]);
          return (
            <div
              key={item.hex}
              onClick={() => onToggleItem(item.hex)}
              className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isChecked
                  ? isLight
                    ? 'bg-amber-500/10 border-amber-500/40 text-neutral-900 shadow-2xs'
                    : 'bg-amber-500/10 border-amber-500/40 text-neutral-100'
                  : isLight
                  ? 'bg-white/60 border-neutral-200 text-neutral-400 opacity-65'
                  : 'bg-neutral-950/50 border-neutral-800 text-neutral-500 opacity-65'
              }`}
            >
              <span
                className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                  isChecked
                    ? 'bg-amber-500/20 text-amber-500'
                    : isLight
                    ? 'bg-neutral-200 text-neutral-500'
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {item.hex}
              </span>
              <div className="flex flex-col min-w-0 flex-1 leading-tight">
                <span className="text-[11px] font-semibold truncate">{item.name}</span>
                <span className="text-[9px] font-mono opacity-60 truncate">{item.id}</span>
              </div>
              {isChecked ? (
                <CheckSquare className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : (
                <Square className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
