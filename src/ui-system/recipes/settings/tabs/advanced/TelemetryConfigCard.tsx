import React from 'react';
import {
  MonitorPlay,
  RefreshCw,
  Ruler,
  Gauge,
  Router,
} from 'lucide-react';
import { ToggleSwitch } from '../../../../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../../../../primitives/SegmentedSwitch';
import { useAppStore, type TelemetryConfig } from '../../../../../stores/appStore';

export interface TelemetryConfigCardProps {
  telemetry?: TelemetryConfig;
  onUpdateTelemetry?: (patch: Partial<TelemetryConfig>) => void;
  onHover: (desc: string) => void;
  onLeave: () => void;
  isLight?: boolean;
}

export const TelemetryConfigCard: React.FC<TelemetryConfigCardProps> = ({
  telemetry: propTelemetry,
  onUpdateTelemetry: propUpdateTelemetry,
  onHover,
  onLeave,
  isLight = false,
}) => {
  const storeTelemetry = useAppStore((s) => s.telemetry);
  const storeUpdateTelemetry = useAppStore((s) => s.updateTelemetry);
  const telemetry = propTelemetry ?? storeTelemetry;
  const updateTelemetry = propUpdateTelemetry ?? storeUpdateTelemetry;

  return (
    <div
      className={`p-4 rounded-xl border text-xs flex flex-col gap-3 transition-all ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-200 shadow-2xs'
          : 'bg-neutral-850 border-neutral-700/80'
      }`}
    >
      {/* Master Toggle Row */}
      <div
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onMouseEnter={() =>
          onHover(
            'Toggle persistent display of performance and hardware telemetry overlay in the top-left corner.'
          )
        }
        onMouseLeave={onLeave}
        onClick={() => updateTelemetry({ alwaysShow: !telemetry.alwaysShow })}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
            <MonitorPlay className="h-5 w-5" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className={`font-bold text-sm leading-tight ${
                isLight ? 'text-neutral-900' : 'text-neutral-100'
              }`}
            >
              Always Show Telemetry
            </span>
            <p
              className={`text-xs leading-normal line-clamp-2 ${
                isLight ? 'text-neutral-600' : 'text-neutral-400'
              }`}
            >
              Display real-time performance indicators and hardware metrics during gameplay.
            </p>
          </div>
        </div>

        <div className="shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
          <ToggleSwitch
            checked={telemetry.alwaysShow}
            onCheckedChange={(checked) => updateTelemetry({ alwaysShow: checked })}
            isLight={isLight}
          />
        </div>
      </div>

      {/* Sub-controls: Only rendered when alwaysShow is true */}
      {telemetry.alwaysShow && (
        <div
          className={`flex flex-col gap-2.5 pt-3 border-t ${
            isLight ? 'border-neutral-200' : 'border-neutral-700/60'
          }`}
        >
          {/* 1. Frames Per Second (FPS) */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
            onMouseEnter={() =>
              onHover(
                'Display real-time frame presentation rate (e.g. 120hz).'
              )
            }
            onMouseLeave={onLeave}
          >
            <div className="flex items-center gap-2 text-xs">
              <MonitorPlay className={`h-4 w-4 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Frames Per Second (FPS)
              </span>
            </div>
            <SegmentedSwitch
              size="sm"
              value={telemetry.fpsMode}
              isLight={isLight}
              onValueChange={(val) => updateTelemetry({ fpsMode: val as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_demand', label: 'On Demand', disabled: true },
                { value: 'always', label: 'Always On' },
              ]}
            />
          </div>

          {/* 2. Screen Refresh Rate (requires FPS to be enabled) */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none transition-opacity ${
              telemetry.fpsMode === 'off' ? 'opacity-40' : ''
            }`}
            onMouseEnter={() =>
              onHover(
                telemetry.fpsMode === 'off'
                  ? 'Display screen hardware refresh rate (e.g. / 120hz). Requires FPS to be enabled.'
                  : 'Display screen hardware refresh rate appended to FPS (e.g. / 120hz).'
              )
            }
            onMouseLeave={onLeave}
          >
            <div className="flex items-center gap-2 text-xs">
              <RefreshCw className={`h-4 w-4 shrink-0 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
              <div className="flex flex-col">
                <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                  Screen Refresh Rate
                </span>
                {telemetry.fpsMode === 'off' && (
                  <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Requires FPS to be enabled
                  </span>
                )}
              </div>
            </div>
            <SegmentedSwitch
              size="sm"
              disabled={telemetry.fpsMode === 'off'}
              value={telemetry.fpsMode === 'off' ? 'off' : telemetry.refreshRateMode}
              isLight={isLight}
              onValueChange={(val) => updateTelemetry({ refreshRateMode: val as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_demand', label: 'On Demand', disabled: true },
                { value: 'always', label: 'Always On' },
              ]}
            />
          </div>

          {/* 3. Render Scale */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
            onMouseEnter={() =>
              onHover(
                'Display current 3D viewport canvas rendering scale percentage (e.g. 50%).'
              )
            }
            onMouseLeave={onLeave}
          >
            <div className="flex items-center gap-2 text-xs">
              <Ruler className={`h-4 w-4 shrink-0 ${isLight ? 'text-sky-600' : 'text-sky-400'}`} />
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Render Scale
              </span>
            </div>
            <SegmentedSwitch
              size="sm"
              value={telemetry.renderScaleMode}
              isLight={isLight}
              onValueChange={(val) => updateTelemetry({ renderScaleMode: val as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_demand', label: 'On Demand', disabled: true },
                { value: 'always', label: 'Always On' },
              ]}
            />
          </div>

          {/* 4. Physics Rate */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
            onMouseEnter={() =>
              onHover(
                'Display physical simulation tick rate (118 to 122 Hz, integer steps).'
              )
            }
            onMouseLeave={onLeave}
          >
            <div className="flex items-center gap-2 text-xs">
              <Gauge className={`h-4 w-4 shrink-0 ${isLight ? 'text-purple-600' : 'text-purple-400'}`} />
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Physics Rate
              </span>
            </div>
            <SegmentedSwitch
              size="sm"
              value={telemetry.physicsRateMode}
              isLight={isLight}
              onValueChange={(val) => updateTelemetry({ physicsRateMode: val as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_demand', label: 'On Demand', disabled: true },
                { value: 'always', label: 'Always On' },
              ]}
            />
          </div>

          {/* 5. Network Latency */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1 select-none"
            onMouseEnter={() =>
              onHover(
                'Display network round-trip ping and simulated latency offset (e.g. 0ms(+0)).'
              )
            }
            onMouseLeave={onLeave}
          >
            <div className="flex items-center gap-2 text-xs">
              <Router className={`h-4 w-4 shrink-0 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
              <span className={`font-semibold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                Network Latency
              </span>
            </div>
            <SegmentedSwitch
              size="sm"
              value={telemetry.latencyMode}
              isLight={isLight}
              onValueChange={(val) => updateTelemetry({ latencyMode: val as any })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on_demand', label: 'On Demand', disabled: true },
                { value: 'always', label: 'Always On' },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
};
