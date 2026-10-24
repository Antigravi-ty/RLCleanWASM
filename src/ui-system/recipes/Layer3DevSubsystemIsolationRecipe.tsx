import React, { useState } from 'react';
import {
  Cpu,
  Radio,
  Layers,
  History,
  Zap,
  Film,
  Swords,
  Play,
  RotateCcw,
  Info,
} from 'lucide-react';
import {
  PanelContainer,
  PanelHeader,
  PanelContent,
  PanelFooter,
} from '../layout/Panel';
import {
  useDevTestLabStore,
  type DevTestLabTab,
} from '../../stores/devTestLabStore';
import { useAppStore } from '../../stores/appStore';
import { floatingStore } from '../../stores/floatingStore';
import { DEV_TEST_LAB_PRESET } from '../../stores/floatingPresets';
import { Badge } from '../primitives/Badge';
import { Button } from '../primitives/Button';
import { DEFAULT_PANEL_SIZING } from '../tokens';

export interface Layer3DevSubsystemIsolationRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onEnterBench?: (tab: DevTestLabTab) => void;
}

interface SubsystemCardMeta {
  id: DevTestLabTab;
  indexLabel: string;
  title: string;
  badge: string;
  summary: string;
  details: string;
  icon: React.ReactNode;
}

const SUBSYSTEM_BENCHES: SubsystemCardMeta[] = [
  {
    id: 'probes',
    indexLabel: '01',
    title: 'Physics & Hover Probes',
    badge: '0G QE · 1G Z-Hover',
    summary: 'Verify isolated angular torque (0G QE) and 1G vertical PID hover control.',
    details:
      'Isolates vehicle rigid-body attitude control and PID thrust stabilization before full arena flight tests.',
    icon: <Radio className="h-4 w-4 text-amber-400" />,
  },
  {
    id: 'dual-world',
    indexLabel: '02',
    title: 'Multi-World Ghost Isolation',
    badge: '2..4 Parallel Worlds',
    summary: 'Run 2 to 4 independent RocketSim physics worlds rendered simultaneously as ghosts.',
    details:
      'Verifies multi-instance WASM memory isolation, independent tick stepping, and ghost vehicle visual synchronization.',
    icon: <Layers className="h-4 w-4 text-sky-400" />,
  },
  {
    id: 'state-replay',
    indexLabel: '03',
    title: 'State Replay & TAS Rewinder',
    badge: 'RingBuffer · Scrubbing',
    summary: 'Record 120Hz physics snapshots, scrub backward/forward, import/export & resume.',
    details:
      'Verifies deterministic RocketSim snapshot serialization, timeline scrubbing ([ / ]), and countdown takeover.',
    icon: <History className="h-4 w-4 text-emerald-400" />,
  },
  {
    id: 'incident-match',
    indexLabel: '04',
    title: '90s Match & Overtime MVP',
    badge: 'MatchController · OT',
    summary: 'Verify regulation clock countdown, 0:00 airborne ball hold, and Overtime sudden death.',
    details:
      'Isolates match state machine transitions, kickoff countdown freezes, and sudden-death victory triggers.',
    icon: <Zap className="h-4 w-4 text-purple-400" />,
  },
  {
    id: 'goal-replay',
    indexLabel: '05',
    title: 'Goal Incident Replay & Podium',
    badge: 'Director Cam · Slow-Mo',
    summary: 'Test goal explosion delay, focal director replay with touch slow-mo, and MVP podium.',
    details:
      'Verifies ReplayTimelineController camera lookahead on scoring touches, speed ramps, and post-match celebration.',
    icon: <Film className="h-4 w-4 text-rose-400" />,
  },
  {
    id: 'kickoff-duel',
    indexLabel: '06',
    title: '4-Model Kickoff Duel Bench',
    badge: '10 Pairings × 5 Slots',
    summary: 'Benchmark Nexto, Necto, Kickoff PPO & Speedflip across all 5 kickoff spawn slots.',
    details:
      'Verifies SafeTensors model inference, kickoff spawn mirroring, and per-tick action diagnostics.',
    icon: <Swords className="h-4 w-4 text-orange-400" />,
  },
];

/**
 * [Recipe] Layer 3 Subsystem Isolation Selection Menu
 * Secondary menu panel asking which of the 6 isolated subsystems to test before entering the lab.
 * Once inside the lab, scene switching is performed via the Floating Window ("Apply & Restart").
 */
export const Layer3DevSubsystemIsolationRecipe: React.FC<Layer3DevSubsystemIsolationRecipeProps> = ({
  isLight = false,
  onBack,
  onEnterBench,
}) => {
  const {
    activeTab,
    selectedTab,
    setSelectedTab,
    applyAndRestartLab,
  } = useDevTestLabStore();

  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);

  const matchMode = useAppStore((s) => s.matchMode);
  const bridge = useAppStore((s) => s.bridge);
  const closeMenu = useAppStore((s) => s.closeMenu);
  const isInDevLab = matchMode === 'dev-test-lab';

  const handleLaunchSubsystem = (tab: DevTestLabTab) => {
    setSelectedTab(tab);
    applyAndRestartLab(tab);
    if (onEnterBench) {
      onEnterBench(tab);
      return;
    }
    floatingStore.setOpacity(70);
    const exists = floatingStore.getSnapshot().windows.some((w) => w.id === DEV_TEST_LAB_PRESET.id);
    if (!exists) {
      floatingStore.spawnWindow({
        ...DEV_TEST_LAB_PRESET,
        startMinimized: false,
      });
    } else {
      floatingStore.restoreWindow(DEV_TEST_LAB_PRESET.id);
    }
    if (isInDevLab) {
      closeMenu();
    } else {
      bridge.onStartDevTestLab?.();
    }
  };

  const cardBg = isLight
    ? 'bg-neutral-50/90 border-neutral-200 text-neutral-800'
    : 'bg-neutral-850/60 border-neutral-700/60 text-neutral-200';

  const subPanelBg = isLight
    ? 'bg-white border-neutral-200/90 text-neutral-800'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-200';

  const mutedText = isLight ? 'text-neutral-500' : 'text-neutral-400';

  const headerAction = (
    <Button
      variant="primary"
      size="sm"
      onClick={() => handleLaunchSubsystem(selectedTab)}
      isLight={isLight}
      className="gap-1.5 px-3 py-1 text-xs font-semibold"
    >
      {isInDevLab ? (
        <>
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Apply &amp; Restart</span>
        </>
      ) : (
        <>
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Enter Selected</span>
        </>
      )}
    </Button>
  );

  return (
    <PanelContainer
      isLight={isLight}
      sizing={DEFAULT_PANEL_SIZING['layer3-dev-subsystem-isolation']}
      className="w-full"
    >
      <PanelHeader
        title="SUBSYSTEM ISOLATION LAB"
        onBack={onBack}
        isLight={isLight}
        rightElement={headerAction}
        actions={headerAction}
      />

      <PanelContent scrollable={true} className="p-5 flex flex-col gap-3 text-xs select-none">
        {/* Prompt Banner */}
        <div
          className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 ${subPanelBg}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-400">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-[11px] truncate">
                Which isolated subsystem do you want to inspect?
              </span>
              <span className={`text-[10px] truncate ${mutedText}`}>
                Select any of the 6 benches below to enter. Once inside, use the Floating Window to switch &amp; Apply &amp; Restart.
              </span>
            </div>
          </div>
          <Badge
            variant={isInDevLab ? 'emerald' : 'amber'}
            size="sm"
            isLight={isLight}
            className="font-mono text-[10px] shrink-0"
          >
            {isInDevLab ? `ACTIVE: ${activeTab.toUpperCase()}` : '6 BENCHES'}
          </Badge>
        </div>

        {/* 6 Subsystem Selection Cards */}
        <div className="grid grid-cols-1 gap-2">
          {SUBSYSTEM_BENCHES.map((bench) => {
            const isSelected = selectedTab === bench.id;
            const isRunning = isInDevLab && activeTab === bench.id;
            return (
              <div
                key={bench.id}
                onClick={() => setSelectedTab(bench.id)}
                onMouseEnter={() => setHoveredDesc(bench.details)}
                onMouseLeave={() => setHoveredDesc(null)}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? isLight
                      ? 'bg-amber-500/10 border-amber-500/60 text-neutral-900 shadow-xs'
                      : 'bg-amber-500/10 border-amber-400/60 text-neutral-100 shadow-xs'
                    : cardBg
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border font-mono text-[11px] font-bold ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                        : isLight
                        ? 'bg-white border-neutral-200 text-neutral-600'
                        : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                    }`}
                  >
                    {bench.icon}
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-amber-400 font-bold">
                        #{bench.indexLabel}
                      </span>
                      <span className="font-bold text-xs truncate">{bench.title}</span>
                      <span
                        className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider font-semibold ${
                          isLight
                            ? 'bg-neutral-100 border-neutral-300 text-neutral-600'
                            : 'bg-neutral-900/80 border-neutral-700 text-neutral-300'
                        }`}
                      >
                        {bench.badge}
                      </span>
                      {isRunning && (
                        <Badge
                          variant="emerald"
                          size="sm"
                          isLight={isLight}
                          className="font-mono text-[9px]"
                        >
                          RUNNING
                        </Badge>
                      )}
                    </div>
                    <span className={`text-[11px] mt-1 line-clamp-1 ${mutedText}`}>
                      {bench.summary}
                    </span>
                  </div>
                </div>

                <Button
                  variant={isSelected ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLaunchSubsystem(bench.id);
                  }}
                  isLight={isLight}
                  className="gap-1.5 px-3 py-1.5 text-[11px] font-semibold shrink-0"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>{isRunning ? 'Restart' : 'Test'}</span>
                </Button>
              </div>
            );
          })}
        </div>
      </PanelContent>

      <PanelFooter isLight={isLight}>
        <div className="flex items-center justify-between gap-2 w-full text-xs">
          <div className="flex items-center gap-2 min-w-0 truncate">
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
                'Choose a subsystem to isolate and test. Use the floating controller in-game to Apply & Restart.'}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleLaunchSubsystem(selectedTab)}
            isLight={isLight}
            className="gap-1.5 px-3 py-1 text-xs font-semibold shrink-0"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Enter Lab ({selectedTab})</span>
          </Button>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
