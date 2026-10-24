import React from 'react';
import {
  Compass,
  Gauge,
  CircleDot,
  Camera,
  Download,
  RotateCw,
} from 'lucide-react';
import { Badge } from '../../primitives/Badge';
import { ToggleSwitch } from '../../primitives/ToggleSwitch';
import { KeycapBadge } from '../../primitives/KeycapBadge';
import { CompactNumberSlider } from './CompactNumberSlider';
import {
  useStaticTrainingPackStore,
  mutateActiveEditItemVariable,
  type EditSubMode,
  type StaticTrainingShotItem,
} from '../../../stores/staticTrainingPackStore';

export interface StaticTrainingShotInspectorViewProps {
  isLight: boolean;
  currentShot: StaticTrainingShotItem;
  onHoverDesc: (desc: string | null) => void;
}

const radToDeg = (r: number) => Math.round((r * 180) / Math.PI);
const degToRad = (d: number) => Number(((d * Math.PI) / 180).toFixed(4));

const SUB_MODE_OPTIONS: {
  id: EditSubMode;
  label: string;
  icon: React.ReactNode;
  hint: string;
}[] = [
  {
    id: 'car-heading',
    label: '1. Car Heading',
    icon: <Compass className="h-3.5 w-3.5" />,
    hint: 'WASD/Space/V Move Car (V at ground -> Snap 60f) • Drag Mouse = Heading • Q/E = Air Roll • O/P = Boost',
  },
  {
    id: 'car-speed',
    label: '2. Car Speed',
    icon: <Gauge className="h-3.5 w-3.5" />,
    hint: 'WASD/Space/V Move Car • Drag Mouse = Car Speed Direction • [ / ] = Adjust Car Speed',
  },
  {
    id: 'ball-speed',
    label: '3. Ball Speed',
    icon: <CircleDot className="h-3.5 w-3.5" />,
    hint: 'WASD/Space/V Move Ball • Drag Mouse = Ball Launch Direction • [ / ] = Ball Speed ([ at 0 -> Kickoff Freeze)',
  },
  {
    id: 'free-cam',
    label: '4. Free Cam',
    icon: <Camera className="h-3.5 w-3.5" />,
    hint: 'Free Camera Controller (WASD + Space + V + Drag Look) with 3D trajectory & scene annotations',
  },
];

export const StaticTrainingShotInspectorView: React.FC<StaticTrainingShotInspectorViewProps> = ({
  isLight,
  currentShot,
  onHoverDesc,
}) => {
  const editSubMode = useStaticTrainingPackStore((s) => s.editSubMode);
  const setEditSubMode = useStaticTrainingPackStore((s) => s.setEditSubMode);
  const exportSingleShotJson = useStaticTrainingPackStore((s) => s.exportSingleShotJson);

  return (
    <div className="flex flex-col gap-3">
      {/* 4 Separated Edit Sub-Modes Selector ([9] Prev / [0] or Right-Click Next) */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900/70 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
            Active 3D Edit Sub-Mode
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono opacity-80">
            <span>Prev:</span>
            <KeycapBadge shortcut="9" size="sm" isLight={isLight} />
            <span>Next:</span>
            <KeycapBadge shortcut="0 / R-Click" size="sm" isLight={isLight} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {SUB_MODE_OPTIONS.map((opt) => {
            const active = editSubMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEditSubMode(opt.id)}
                onMouseEnter={() => onHoverDesc(opt.hint)}
                onMouseLeave={() => onHoverDesc(null)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                  active
                    ? isLight
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                      : 'bg-white border-white text-neutral-900 shadow-2xs'
                    : isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                    : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
              >
                {opt.icon}
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div
          className={`text-[10px] font-mono px-2 py-1 rounded border ${
            isLight
              ? 'bg-white border-neutral-200 text-neutral-600'
              : 'bg-neutral-950/60 border-neutral-800 text-neutral-300'
          }`}
        >
          {SUB_MODE_OPTIONS.find((o) => o.id === editSubMode)?.hint}
        </div>
      </div>

      {/* Shot Name, Timeout & Single-Item JSON Export */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-2 ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900/50 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            value={currentShot.name}
            onChange={(e) =>
              mutateActiveEditItemVariable((d) => {
                d.name = e.target.value;
              })
            }
            className={`px-2.5 py-1 rounded-lg border text-xs font-bold grow outline-none ${
              isLight
                ? 'bg-neutral-50 border-neutral-300 text-neutral-900'
                : 'bg-neutral-850 border-neutral-700 text-neutral-100'
            }`}
            placeholder="Shot Name"
          />
          <button
            type="button"
            onClick={() => exportSingleShotJson()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0 cursor-pointer ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
            title="Export this shot item as a standalone .json file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Item .JSON</span>
          </button>
        </div>

        <CompactNumberSlider
          label="Shot Timeout"
          value={currentShot.timeoutSeconds}
          min={1}
          max={60}
          step={1}
          unit="s"
          onChange={(val) =>
            mutateActiveEditItemVariable((d) => {
              d.timeoutSeconds = val;
            })
          }
          isLight={isLight}
        />
      </div>

      {/* CAR CONFIGURATION SECTION */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900/50 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between pb-1 border-b border-neutral-500/15">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Vehicle State (X: {Math.round(currentShot.car.location[0])}, Y:{' '}
            {Math.round(currentShot.car.location[1])}, Z:{' '}
            {Math.round(currentShot.car.location[2])})
          </span>
          <button
            type="button"
            onClick={() =>
              mutateActiveEditItemVariable((d) => {
                d.car.airRoll = 0;
                d.car.headingPitch = 0;
              })
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold cursor-pointer ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
            title="Restore car pitch and air roll to horizontal level (0 deg)"
          >
            <RotateCw className="h-3 w-3" />
            <span>Reset Level (Q/E=0)</span>
          </button>
        </div>

        <div className="flex items-center justify-between py-0.5 px-1.5">
          <span className="text-[11px] font-semibold">
            Snap to Ground (60-Frame Suspension Settle [V])
          </span>
          <ToggleSwitch
            checked={currentShot.car.snapToGround}
            onCheckedChange={(checked) =>
              mutateActiveEditItemVariable((d) => {
                d.car.snapToGround = checked;
                if (checked) {
                  d.car.location[2] = 17.05;
                  d.car.headingPitch = 0;
                  d.car.airRoll = 0;
                }
              })
            }
            isLight={isLight}
            variant="neutral"
          />
        </div>

        <CompactNumberSlider
          label="Car Heading Yaw"
          value={radToDeg(currentShot.car.headingYaw)}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(deg) =>
            mutateActiveEditItemVariable((d) => {
              d.car.headingYaw = degToRad(deg);
            })
          }
          isLight={isLight}
        />

        <CompactNumberSlider
          label="Car Air Roll [Q/E]"
          value={radToDeg(currentShot.car.airRoll)}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(deg) =>
            mutateActiveEditItemVariable((d) => {
              d.car.airRoll = degToRad(deg);
              if (deg !== 0) d.car.snapToGround = false;
            })
          }
          isLight={isLight}
        />

        <CompactNumberSlider
          label="Car Speed [ / ]"
          value={Math.round(currentShot.car.speed)}
          min={0}
          max={2300}
          step={10}
          unit=" UU"
          onChange={(spd) =>
            mutateActiveEditItemVariable((d) => {
              d.car.speed = spd;
            })
          }
          isLight={isLight}
        />

        <CompactNumberSlider
          label="Car Speed Yaw"
          value={radToDeg(currentShot.car.speedYaw)}
          min={-180}
          max={180}
          step={1}
          unit="°"
          onChange={(deg) =>
            mutateActiveEditItemVariable((d) => {
              d.car.speedYaw = degToRad(deg);
            })
          }
          isLight={isLight}
        />

        <div className="flex items-center justify-between py-0.5 px-1.5">
          <span className="text-[11px] font-semibold">
            Unlimited Boost (Press [P] at 100)
          </span>
          <ToggleSwitch
            checked={currentShot.car.unlimitedBoost}
            onCheckedChange={(checked) =>
              mutateActiveEditItemVariable((d) => {
                d.car.unlimitedBoost = checked;
                if (checked) d.car.initialBoost = 100;
              })
            }
            isLight={isLight}
            variant="neutral"
          />
        </div>

        {!currentShot.car.unlimitedBoost && (
          <CompactNumberSlider
            label="Initial Boost [O/P]"
            value={Math.round(currentShot.car.initialBoost)}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(b) =>
              mutateActiveEditItemVariable((d) => {
                d.car.initialBoost = b;
              })
            }
            isLight={isLight}
          />
        )}
      </div>

      {/* BALL CONFIGURATION SECTION */}
      <div
        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
          isLight ? 'bg-white border-neutral-200' : 'bg-neutral-900/50 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between pb-1 border-b border-neutral-500/15">
          <span className="text-[11px] font-bold uppercase tracking-wider">
            Ball State (X: {Math.round(currentShot.ball.location[0])}, Y:{' '}
            {Math.round(currentShot.ball.location[1])}, Z:{' '}
            {Math.round(currentShot.ball.location[2])})
          </span>
          {currentShot.ball.kickoffState && (
            <Badge variant="default" size="sm" isLight={isLight}>
              KICKOFF FREEZE
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between py-0.5 px-1.5">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold">
              Kickoff State (Stationary Mid-Air Until Touched)
            </span>
            <span className="text-[10px] opacity-65">
              Auto-activates when pressing &apos;[&apos; again at 0 speed
            </span>
          </div>
          <ToggleSwitch
            checked={currentShot.ball.kickoffState}
            onCheckedChange={(checked) =>
              mutateActiveEditItemVariable((d) => {
                d.ball.kickoffState = checked;
                if (checked) d.ball.speed = 0;
              })
            }
            isLight={isLight}
            variant="neutral"
          />
        </div>

        {!currentShot.ball.kickoffState && (
          <>
            <CompactNumberSlider
              label="Ball Speed [ / ]"
              value={Math.round(currentShot.ball.speed)}
              min={0}
              max={4000}
              step={10}
              unit=" UU"
              onChange={(spd) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.speed = spd;
                })
              }
              isLight={isLight}
            />

            <CompactNumberSlider
              label="Ball Speed Yaw"
              value={radToDeg(currentShot.ball.speedYaw)}
              min={-180}
              max={180}
              step={1}
              unit="°"
              onChange={(deg) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.speedYaw = degToRad(deg);
                })
              }
              isLight={isLight}
            />

            <CompactNumberSlider
              label="Ball Speed Pitch"
              value={radToDeg(currentShot.ball.speedPitch)}
              min={-85}
              max={85}
              step={1}
              unit="°"
              onChange={(deg) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.speedPitch = degToRad(deg);
                })
              }
              isLight={isLight}
            />
          </>
        )}

        {/* Random vs Manual 3-Axis Angular Velocity */}
        <div className="flex items-center justify-between py-0.5 px-1.5">
          <span className="text-[11px] font-semibold">Random Angular Velocity</span>
          <ToggleSwitch
            checked={currentShot.ball.randomAngularVelocity}
            onCheckedChange={(checked) =>
              mutateActiveEditItemVariable((d) => {
                d.ball.randomAngularVelocity = checked;
              })
            }
            isLight={isLight}
            variant="neutral"
          />
        </div>

        {!currentShot.ball.randomAngularVelocity && (
          <div className="flex flex-col gap-1 pt-1 border-t border-neutral-500/10">
            <CompactNumberSlider
              label="AngVel X (Pitch)"
              value={currentShot.ball.angularVelocity[0]}
              min={-6}
              max={6}
              step={0.1}
              unit=" r/s"
              onChange={(v) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.angularVelocity[0] = Number(v.toFixed(2));
                })
              }
              isLight={isLight}
            />
            <CompactNumberSlider
              label="AngVel Y (Roll)"
              value={currentShot.ball.angularVelocity[1]}
              min={-6}
              max={6}
              step={0.1}
              unit=" r/s"
              onChange={(v) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.angularVelocity[1] = Number(v.toFixed(2));
                })
              }
              isLight={isLight}
            />
            <CompactNumberSlider
              label="AngVel Z (Yaw)"
              value={currentShot.ball.angularVelocity[2]}
              min={-6}
              max={6}
              step={0.1}
              unit=" r/s"
              onChange={(v) =>
                mutateActiveEditItemVariable((d) => {
                  d.ball.angularVelocity[2] = Number(v.toFixed(2));
                })
              }
              isLight={isLight}
            />
          </div>
        )}
      </div>
    </div>
  );
};
