import React, { useState, useEffect } from 'react';
import { PanelContainer, PanelHeader, PanelContent, PanelFooter } from '../layout/Panel';
import { DEFAULT_PANEL_SIZING } from '../tokens';
import { SliderControl } from '../primitives/SliderControl';
import { SegmentedSwitch } from '../primitives/SegmentedSwitch';
import { Badge } from '../primitives/Badge';
import { Card } from '../layout/Card';
import { Sliders, Waves, Sparkles, Compass, Radio } from 'lucide-react';
import { audioConfig } from '../../config/audioConfig.js';

export interface Layer3AudioDetailRecipeProps {
  isLight?: boolean;
  onBack?: () => void;
}

/**
 * [Recipe] Layer 3 Audio Equalizer & Detailed Acoustics
 * Layer 3 Sub-menu: Acoustic EQ & Spatial Audio Configuration (Width: 480px).
 */
export const Layer3AudioDetailRecipe: React.FC<Layer3AudioDetailRecipeProps> = ({
  isLight = false,
  onBack,
}) => {
  const [panningModel, setPanningModel] = useState<string>(() => 
    String(audioConfig.get('spatialPanningModel') || 'equalpower')
  );
  const [distanceModel, setDistanceModel] = useState<string>(() => 
    String(audioConfig.get('distanceModel') || 'smoothstep')
  );
  const [gainFloor, setGainFloor] = useState<number>(() => 
    Math.round((Number(audioConfig.get('minAudibleGainFloor')) || 0.15) * 100)
  );
  const [scalePreset, setScalePreset] = useState<string>(() => {
    const s = Number(audioConfig.get('distanceUnitScale')) || 0.01;
    if (s <= 0.007) return 'compact';
    if (s >= 0.013) return 'wide';
    return 'standard';
  });

  const [compressionMode, setCompressionMode] = useState('dynamic');
  const [lows, setLows] = useState(65);
  const [mids, setMids] = useState(50);
  const [highs, setHighs] = useState(58);

  useEffect(() => {
    const handleSync = () => {
      setPanningModel(String(audioConfig.get('spatialPanningModel') || 'equalpower'));
      setDistanceModel(String(audioConfig.get('distanceModel') || 'smoothstep'));
      setGainFloor(Math.round((Number(audioConfig.get('minAudibleGainFloor')) || 0.15) * 100));
      const s = Number(audioConfig.get('distanceUnitScale')) || 0.01;
      if (s <= 0.007) setScalePreset('compact');
      else if (s >= 0.013) setScalePreset('wide');
      else setScalePreset('standard');
    };
    return audioConfig.subscribe(handleSync);
  }, []);

  const handlePanningModelChange = (model: string) => {
    setPanningModel(model);
    audioConfig.set('spatialPanningModel', model);
  };

  const handleDistanceModelChange = (dm: string) => {
    setDistanceModel(dm);
    audioConfig.set('distanceModel', dm);
  };

  const handleGainFloorChange = (pct: number) => {
    setGainFloor(pct);
    audioConfig.set('minAudibleGainFloor', pct / 100);
  };

  const handleScaleChange = (val: string) => {
    setScalePreset(val);
    let scale = 0.01;
    if (val === 'compact') scale = 0.006;
    else if (val === 'wide') scale = 0.015;
    audioConfig.set('distanceUnitScale', scale);
  };

  return (
    <PanelContainer isLight={isLight} sizing={DEFAULT_PANEL_SIZING['layer3-audio-detail']} className="w-full">
      <PanelHeader
        title="ACOUSTICS & ADVANCED EQ"
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
        {/* Spatial Panning Model (Global Unified) */}
        <Card isLight={isLight} variant="outlined" className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-500" />
            <span className="text-xs font-bold tracking-tight">3D Spatial Panning Model</span>
          </div>
          <SegmentedSwitch
            options={[
              { value: 'equalpower', label: 'Equal-Power (Clear • Recommended)' },
              { value: 'HRTF', label: 'HRTF 3D (Binaural)' },
            ]}
            value={panningModel}
            onValueChange={handlePanningModelChange}
            isLight={isLight}
          />
          <p className="text-[11px] opacity-70 leading-relaxed">
            {panningModel === 'equalpower'
              ? 'Equal-power stereo: crisp high frequencies, transparent acoustics, precise competitive directional cues.'
              : 'HRTF binaural impulse response: simulates head/ear acoustic scattering for immersive headphone listening.'}
          </p>
        </Card>

        {/* Distance Attenuation Model */}
        <Card isLight={isLight} variant="outlined" className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold tracking-tight">Distance Rolloff Curve</span>
          </div>
          <SegmentedSwitch
            options={[
              { value: 'smoothstep', label: 'Smoothstep (Hermite)' },
              { value: 'inverse', label: 'Inverse (Physics)' },
              { value: 'linear', label: 'Linear' },
            ]}
            value={distanceModel}
            onValueChange={handleDistanceModelChange}
            isLight={isLight}
          />
          <p className="text-[11px] opacity-70 leading-relaxed">
            {distanceModel === 'smoothstep'
              ? 'Smooth cubic: natural near-field decay with seamless maximum distance falloff.'
              : distanceModel === 'inverse'
              ? 'Inverse distance: authentic acoustic sound-pressure falloff simulation.'
              : 'Linear model: volume attenuates at constant rate over distance.'}
          </p>
        </Card>

        {/* Distant Audibility Floor & Soundfield Scale */}
        <Card isLight={isLight} variant="flat" className="p-3.5 flex flex-col gap-3">
          <SliderControl
            label="Distant Audibility Floor"
            value={gainFloor}
            onChange={handleGainFloorChange}
            min={0}
            max={40}
            unit="%"
            isLight={isLight}
          />
          <p className="text-[10.5px] opacity-60 -mt-1 leading-snug">
            Maintains genuine 3D spatial coords while guaranteeing minimum audibility for distant goalpost and ball hits.
          </p>

          <div className="flex flex-col gap-1.5 pt-1">
            <label className={`text-xs font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              Arena Acoustic Scale
            </label>
            <SegmentedSwitch
              options={[
                { value: 'compact', label: 'Compact (0.006)' },
                { value: 'standard', label: 'Standard (0.010)' },
                { value: 'wide', label: 'Wide (0.015)' },
              ]}
              value={scalePreset}
              onValueChange={handleScaleChange}
              isLight={isLight}
            />
          </div>
        </Card>

        {/* 3-Band Equalizer Sliders */}
        <Card isLight={isLight} variant="outlined" className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-1">
            <Sliders className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold tracking-tight">3-Band Acoustic EQ</span>
          </div>

          <SliderControl
            label="Bass Boost (100Hz)"
            value={lows}
            onChange={setLows}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />

          <SliderControl
            label="Midrange (1kHz)"
            value={mids}
            onChange={setMids}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />

          <SliderControl
            label="Treble (10kHz)"
            value={highs}
            onChange={setHighs}
            min={0}
            max={100}
            unit="%"
            isLight={isLight}
          />
        </Card>
      </PanelContent>

      <PanelFooter hint="Layer 3 -> Layer 2 -> Layer 1" isLight={isLight}>
        <div className="flex items-center gap-1.5 text-[11px] opacity-70">
          <Waves className="h-3 w-3 text-amber-500" />
          <span>Real-Time Unified Spatial Audio Engine</span>
        </div>
      </PanelFooter>
    </PanelContainer>
  );
};
