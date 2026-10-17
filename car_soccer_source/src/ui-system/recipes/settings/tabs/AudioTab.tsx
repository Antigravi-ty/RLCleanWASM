import React, { useState, useEffect } from 'react';
import { VStack } from '../../../layout/VStack';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { audioConfig, AUDIO_SETTINGS_CHANGED_EVENT } from '../../../../audio/AudioArchitecture.js';

export interface AudioTabProps {
  isLight?: boolean;
  onHover: (desc: string) => void;
  onLeave: () => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  isLight = false,
  onHover,
  onLeave,
}) => {
  const [audioState, setAudioState] = useState(() => ({
    continueAudioOnLostFocus: Boolean(audioConfig.get('continueAudioOnLostFocus')),
    masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
    engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
    boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
  }));

  useEffect(() => {
    const handleAudioSync = () => {
      setAudioState({
        continueAudioOnLostFocus: Boolean(audioConfig.get('continueAudioOnLostFocus')),
        masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
        engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
        boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
      });
    };
    window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleAudioSync);
    return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, handleAudioSync);
  }, []);

  const handleUpdateAudio = (key: string, val: number | boolean) => {
    if (typeof val === 'boolean') {
      audioConfig.set(key, val);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    } else {
      audioConfig.set(key, val / 100);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    }
  };

  return (
    <VStack gap="md" isLight={isLight}>
      <SettingToggleRow
        label="Play Audio in Background"
        subtitle="Keep engine synthesis and game sound active when tab is unfocused"
        checked={audioState.continueAudioOnLostFocus}
        onChange={(val) => handleUpdateAudio('continueAudioOnLostFocus', val)}
        onHover={() => onHover('Keep game sound and engine synthesis active even when the window or tab is unfocused.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      <SettingSliderRow
        label="Master Volume"
        value={audioState.masterVolume}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(val) => handleUpdateAudio('masterVolume', val)}
        onHover={() => onHover('Global audio output ceiling across all spatial audio and powertrain sound channels.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      <SettingSliderRow
        label="Engine Volume"
        value={audioState.engineVolume}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(val) => handleUpdateAudio('engineVolume', val)}
        onHover={() => onHover('Dynamic electric motor synthesis (EMotorSynth) powertrain continuous audio.')}
        onLeave={onLeave}
        isLight={isLight}
      />

      <SettingSliderRow
        label="Boost Volume"
        value={audioState.boostVolume}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(val) => handleUpdateAudio('boostVolume', val)}
        onHover={() => onHover('Rocket thruster discharge loop and supersonic acceleration sound.')}
        onLeave={onLeave}
        isLight={isLight}
      />
    </VStack>
  );
};
