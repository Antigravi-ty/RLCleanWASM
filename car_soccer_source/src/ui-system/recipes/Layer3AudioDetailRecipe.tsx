import React, { useState } from 'react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { SliderControl } from '../primitives/SliderControl';
import { ToggleSwitch } from '../primitives/ToggleSwitch';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { Badge } from '../primitives/Badge';
import { Card } from '../layout/Card';
import { Volume2, Sliders, Waves, Sparkles } from 'lucide-react';

export interface Layer3AudioDetailRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

/**
 * [Recipe] Layer 3 Audio Equalizer & Detailed Acoustics
 * 三级深度菜单：音频均衡器与声场高阶调节面板 (Width: 480px).
 */
export const Layer3AudioDetailRecipe: React.FC<Layer3AudioDetailRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [compressionMode, setCompressionMode] = useState('Dynamic (Full)');
  const [lows, setLows] = useState(65);
  const [mids, setMids] = useState(50);
  const [highs, setHighs] = useState(58);

  return (
    <PanelContainer isLight={isLight} className="w-full max-w-[480px]">
      <PanelHeader
        title="ACOUSTICS & EQ / 音频高级"
        subtitle="Layer 3 Sub-Menu • 32-bit DSP Engine"
        onBack={onBack}
        badge={
          <Badge variant="primary" size="sm" isLight={isLight}>
            DSP ACTIVE
          </Badge>
        }
        isLight={isLight}
      />

      <PanelContent scrollable={true} className="flex flex-col gap-4">
        {/* Dynamic Range Switcher */}
        <div className="flex flex-col gap-1.5">
          <label className={`text-xs font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
            Dynamic Range Profile (动态范围)
          </label>
          <SegmentedSwitch
            options={[
              { value: 'compressed', label: 'Night (Compressed)' },
              { value: 'dynamic', label: 'Dynamic (Full)' },
              { value: 'monitor', label: 'Studio Monitor' },
            ]}
            value={compressionMode}
            onValueChange={setCompressionMode}
            isLight={isLight}
          />
        </div>

        {/* 3-Band Equalizer Sliders */}
        <Card isLight={isLight} variant="outlined" className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold tracking-tight">3-Band Acoustic EQ (三段均衡器)</span>
          </div>

          <SliderControl
            label="Bass / 低频增益 (100Hz)"
            value={lows}
            onChange={setLows}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />

          <SliderControl
            label="Midrange / 中频人声 (1kHz)"
            value={mids}
            onChange={setMids}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />

          <SliderControl
            label="Treble / 高频细节 (10kHz)"
            value={highs}
            onChange={setHighs}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />
        </Card>

        {/* Spatial Audio Toggle */}
        <Card isLight={isLight} variant="flat" className="p-3">
          <ToggleSwitch
            checked={spatialAudio}
            onCheckedChange={setSpatialAudio}
            label="HRTF 3D Spatial Audio (空间环绕定位)"
            description="模拟全景 HRTF 双耳渲染，精准定位球场来球与引擎方位"
            isLight={isLight}
          />
        </Card>
      </PanelContent>

      <PanelFooter hint="Layer 3 -> Layer 2 -> Layer 1" isLight={isLight}>
        <div className="flex items-center gap-1.5 text-[11px] opacity-70">
          <Waves className="h-3 w-3 text-amber-500" />
          <span>7.1 Virtual Surround Enabled</span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
