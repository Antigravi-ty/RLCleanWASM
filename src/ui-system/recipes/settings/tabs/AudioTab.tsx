import React, { useState, useEffect, useCallback } from 'react';
import { Bug, Terminal, Volume2, RefreshCw, Activity } from 'lucide-react';
import { VStack } from '../../../layout/VStack';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import {
  audioConfig,
  collectAudioDiagnosticReport,
  dumpAudioDiagnosticsToConsole,
  playAudioDiagnosticTestTone,
  forceAudioRecovery,
} from '../../../../config/audioConfig.js';

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
    audioDebugMode: Boolean(audioConfig.get('audioDebugMode')),
    masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
    engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
    boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
  }));

  const [diagReport, setDiagReport] = useState<any>(() => collectAudioDiagnosticReport());
  const [probeStatus, setProbeStatus] = useState<string | null>(null);

  const refreshDiagnostics = useCallback(() => {
    setDiagReport(collectAudioDiagnosticReport());
  }, []);

  useEffect(() => {
    const handleAudioSync = () => {
      setAudioState({
        continueAudioOnLostFocus: Boolean(audioConfig.get('continueAudioOnLostFocus')),
        audioDebugMode: Boolean(audioConfig.get('audioDebugMode')),
        masterVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('masterVolume') ?? 1.0) * 100))),
        engineVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('engineVolume') ?? 1.0) * 100))),
        boostVolume: Math.min(100, Math.max(0, Math.round((audioConfig.get('boostVolume') ?? 0.8) * 100))),
      });
      refreshDiagnostics();
    };
    const unsub = audioConfig.subscribe(handleAudioSync);
    const timer = setInterval(refreshDiagnostics, 1000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refreshDiagnostics]);

  const handleUpdateAudio = (key: string, val: number | boolean) => {
    if (typeof val === 'boolean') {
      audioConfig.set(key, val);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    } else {
      audioConfig.set(key, val / 100);
      setAudioState((prev) => ({ ...prev, [key]: val }));
    }
    setTimeout(refreshDiagnostics, 60);
  };

  const handleDumpConsole = () => {
    const report = dumpAudioDiagnosticsToConsole('Audio Menu — Dump Console Report');
    setDiagReport(report);
    setProbeStatus(`Full diagnostic snapshot printed to DevTools Console (${new Date().toLocaleTimeString()})`);
  };

  const handleTestTone = async () => {
    setProbeStatus('Playing 440Hz → 660Hz test tone & sampling MasterMixer RMS...');
    const res = await playAudioDiagnosticTestTone({ bypassMixer: false });
    refreshDiagnostics();
    if (res.ok) {
      setProbeStatus(
        `Test Tone OK: Web Audio output measured ${res.measuredOutput.dbfs} dBFS (Peak ${res.measuredOutput.peak}). If silent, check browser tab mute or OS output device.`
      );
    } else {
      setProbeStatus(
        `Test Tone Blocked/Silent: Context="${res.contextState}", MasterConnected=${res.masterConnected}, Output=${res.measuredOutput?.dbfs ?? -120} dBFS.`
      );
    }
  };

  const handleForceRecover = async () => {
    setProbeStatus('Running Force Audio Recovery (resume context + reconnect mixer + restart loops)...');
    const res = await forceAudioRecovery();
    if (res.report) setDiagReport(res.report);
    setProbeStatus(
      res.ok
        ? 'Force Recovery succeeded: AudioContext running, MasterMixer connected & state loops restarted.'
        : 'Force Recovery incomplete: check DevTools Console for details.'
    );
  };

  const ctxState = diagReport?.audioContext?.state ?? 'none';
  const masterConnected = Boolean(diagReport?.masterMixer?.connected);
  const masterGainVal = diagReport?.masterMixer?.outputGainValue ?? 0;
  const outputDbfs = diagReport?.masterMixer?.realtimeOutput?.dbfs ?? -120;
  const outputSilent = Boolean(diagReport?.masterMixer?.realtimeOutput?.silent);
  const loadedBuffers = `${diagReport?.gameAudioState?.loadedBuffersCount ?? 0}/${diagReport?.gameAudioState?.totalRegisteredBufferKeys ?? 0}`;
  const verdictCode = diagReport?.verdict?.code ?? 'UNKNOWN';
  const verdictSummary = diagReport?.verdict?.summary ?? '';
  const isHealthy = verdictCode.startsWith('HEALTHY') || verdictCode === 'GAME_STATE_OVERLAY_MUTED';

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

      {/* Audio Debug & Diagnostics Section */}
      <SettingToggleRow
        label="Audio Debug Mode (Console Telemetry)"
        subtitle="Log focus/visibility transitions, periodic RMS heartbeats & mute root-cause alerts to Console"
        checked={audioState.audioDebugMode}
        onChange={(val) => handleUpdateAudio('audioDebugMode', val)}
        onHover={() =>
          onHover(
            'Enable continuous Web Audio telemetry in DevTools Console (also exposes window.__audioDebug) to distinguish browser audio bugs from internal game mute states.'
          )
        }
        onLeave={onLeave}
        isLight={isLight}
      />

      <div
        className={`flex flex-col gap-2.5 w-full p-3.5 rounded-xl border transition-colors select-none ${
          isLight
            ? 'bg-neutral-100/90 border-neutral-200 text-neutral-900'
            : 'bg-neutral-900/70 border-neutral-800 text-neutral-100'
        }`}
        onMouseEnter={() =>
          onHover(
            'Inspect live Web Audio pipeline state, dump full diagnostic tables to DevTools Console, play a hardware test tone, or force-recover stuck audio contexts.'
          )
        }
        onMouseLeave={onLeave}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Bug className="h-4 w-4 text-sky-400 shrink-0" />
            <span className="text-xs font-bold truncate">Audio Pipeline Diagnostics &amp; Recovery</span>
          </div>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold shrink-0 ${
              isHealthy
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/35 text-amber-400'
            }`}
          >
            {verdictCode}
          </span>
        </div>

        {/* Live Telemetry Grid */}
        <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
          <div
            className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <div className="text-[9px] uppercase opacity-60">Context State</div>
            <div className={`font-bold mt-0.5 ${ctxState === 'running' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {ctxState} ({diagReport?.audioContext?.currentTime ?? 0}s)
            </div>
          </div>

          <div
            className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <div className="text-[9px] uppercase opacity-60">Master Bus</div>
            <div className={`font-bold mt-0.5 ${masterConnected && masterGainVal > 0 ? 'text-sky-400' : 'text-amber-400'}`}>
              {masterConnected ? `Gain ${masterGainVal.toFixed(2)}` : 'Disconnected'}
            </div>
          </div>

          <div
            className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <div className="text-[9px] uppercase opacity-60">Realtime PCM Out</div>
            <div className={`font-bold mt-0.5 ${!outputSilent ? 'text-emerald-400' : ' opacity-80'}`}>
              {outputDbfs} dBFS
            </div>
          </div>

          <div
            className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950/60 border-neutral-800'
            }`}
          >
            <div className="text-[9px] uppercase opacity-60">Buffers / Voices</div>
            <div className="font-bold mt-0.5">
              {loadedBuffers} · {diagReport?.slotPool?.activeSlots ?? 0}/{diagReport?.slotPool?.maxSlots ?? 10}
            </div>
          </div>
        </div>

        {/* Verdict Banner */}
        <div
          className={`text-[11px] leading-relaxed px-2.5 py-2 rounded-lg border ${
            isLight
              ? 'bg-neutral-50 border-neutral-200 text-neutral-700'
              : 'bg-neutral-950/50 border-neutral-800/90 text-neutral-300'
          }`}
        >
          <span className="font-semibold text-sky-400">[Verdict] </span>
          {verdictSummary}
        </div>

        {probeStatus && (
          <div
            className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 ${
              isLight
                ? 'bg-sky-50 border-sky-200 text-sky-800'
                : 'bg-sky-950/40 border-sky-500/30 text-sky-300'
            }`}
          >
            <Activity className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{probeStatus}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleDumpConsole}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              isLight
                ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-900 text-white'
                : 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-sky-300'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Dump Console Report</span>
          </button>

          <button
            type="button"
            onClick={handleTestTone}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              isLight
                ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Test Tone (440/660Hz)</span>
          </button>

          <button
            type="button"
            onClick={handleForceRecover}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
              isLight
                ? 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900'
                : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/35 text-amber-300'
            }`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Force Resume / Recover</span>
          </button>
        </div>
      </div>
    </VStack>
  );
};

