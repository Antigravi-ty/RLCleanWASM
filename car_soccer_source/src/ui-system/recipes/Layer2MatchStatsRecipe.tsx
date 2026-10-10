import React from 'react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { Card } from '../layout/Card';
import { HStack } from '../layout/HStack';
import { VStack } from '../layout/VStack';
import { GridStack } from '../layout/GridStack';
import { Badge } from '../primitives/Badge';
import { KeycapBadge } from '../primitives/KeycapBadge';
import { Button } from '../primitives/Button';
import { Trophy, ArrowLeft, Flame, Shield, Target, Zap, Award } from 'lucide-react';

export interface Layer2MatchStatsRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
  onRematch?: () => void;
}

/**
 * [Recipe] Layer 2 Match Stats / Performance Breakdown
 * 二级菜单：比赛数据统计与个人表现明细 (Width: 580px).
 */
export const Layer2MatchStatsRecipe: React.FC<Layer2MatchStatsRecipeProps> = ({
  isLight = false,
  onBack,
  onRematch,
}) => {
  const stats = [
    { label: 'Goals (进球)', value: '3', icon: <Target className="h-4 w-4 text-emerald-500" /> },
    { label: 'Assists (助攻)', value: '1', icon: <Award className="h-4 w-4 text-amber-500" /> },
    { label: 'Saves (扑救)', value: '4', icon: <Shield className="h-4 w-4 text-amber-500" /> },
    { label: 'Shots (射门)', value: '6', icon: <Flame className="h-4 w-4 text-rose-500" /> },
    { label: 'Shot Accuracy (命中率)', value: '50.0%', icon: <Target className="h-4 w-4 text-emerald-400" /> },
    { label: 'Boost Consumed (氮气消耗)', value: '412 L', icon: <Zap className="h-4 w-4 text-amber-500" /> },
  ];

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[580px]">
      <PanelHeader
        title="MATCH SUMMARY / 表现详情"
        subtitle="Match Duration 05:00 • Urban Arena"
        onBack={onBack}
        badge={
          <Badge variant="primary" size="sm" isLight={isLight}>
            MVP • 780 PTS
          </Badge>
        }
        isLight={isLight}
      />

      <PanelContent scrollable={true} className="flex flex-col gap-4">
        {/* Scoreboard Banner Card */}
        <Card isLight={isLight} variant="elevated" className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 text-lg">
                4
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight">TEAM ORANGE (WINNER)</div>
                <div className={`text-xs ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Your Squad • Rating +18 MMR
                </div>
              </div>
            </div>

            <div className="font-mono text-xs font-bold text-neutral-400">VS</div>

            <div className="flex items-center gap-3 text-right">
              <div>
                <div className="font-bold text-sm tracking-tight text-neutral-600 dark:text-neutral-400">
                  TEAM ORANGE
                </div>
                <div className={`text-xs ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  Defeated • Rating -17 MMR
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 text-lg">
                2
              </div>
            </div>
          </div>
        </Card>

        {/* Telemetry Metric Cards */}
        <div>
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 px-1 ${
            isLight ? 'text-neutral-500' : 'text-neutral-400'
          }`}>
            Individual Player Telemetry (个人战术遥测)
          </div>

          <GridStack cols={2} gap="sm">
            {stats.map((s) => (
              <Card key={s.label} isLight={isLight} variant="outlined" className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {s.icon}
                    <span className={`text-xs font-medium ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                      {s.label}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-sm text-amber-500">{s.value}</span>
                </div>
              </Card>
            ))}
          </GridStack>
        </div>

        {/* Progression Card */}
        <Card isLight={isLight} variant="flat" className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold">Competitive Tier Progress:</span>
          </div>
          <HStack gap="sm">
            <Badge variant="warning" size="sm" isLight={isLight}>
              Champion I (Div 3)
            </Badge>
            <KeycapBadge shortcut="ESC" isLight={isLight} size="sm" />
          </HStack>
        </Card>
      </PanelContent>

      <PanelFooter hint="Click Back to Root" isLight={isLight}>
        <HStack gap="sm">
          <Button variant="secondary" size="sm" onClick={onBack} isLight={isLight}>
            Back
          </Button>
          <Button variant="primary" size="sm" onClick={onRematch} isLight={isLight}>
            Next Match
          </Button>
        </HStack>
      </PanelFooter>
    </PanelContainer>
  );
};
