import React from 'react';
import { AlertCircle, Loader2, Activity, RotateCcw, Settings } from 'lucide-react';
import { setSignalingUrl, DEFAULT_SIGNALING_URL } from '../../../network/SignalingConfig.js';
import { pushQuickNotification } from '../../tokens/quickNotificationStore';
import { dialogue } from '../../primitives/Dialogue';

export interface DiagnosticResult {
  ok: boolean;
  rttMs: number;
  error: string | null;
}

export function spawnConnectionErrorDialogue(shortTitle: string, detailedMessage: string) {
  dialogue.show({
    title: 'ERROR',
    tone: 'error',
    icon: 'octagon-alert',
    content: (
      <div className="flex flex-col gap-2 font-mono text-xs w-full text-left">
        <p className="font-bold text-red-600 dark:text-red-400">{shortTitle}</p>
        <div className="p-3 rounded-lg bg-neutral-100 text-neutral-800 border border-neutral-300 dark:bg-neutral-950/70 dark:border-neutral-800 dark:text-neutral-200 text-[11px] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
          {detailedMessage}
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
          Please check your signaling server configuration or WebRTC network environment.
        </p>
      </div>
    ),
    buttons: [
      {
        label: 'Copy Logs',
        variant: 'outline',
        onClick: async () => {
          if (typeof navigator !== 'undefined') {
            await navigator.clipboard.writeText(detailedMessage);
          }
        },
      },
      {
        label: 'Close',
        variant: 'primary',
      },
    ],
  });
}

export function dispatchConnectionErrorNotification(summary: string, fullDetails: string) {
  pushQuickNotification({
    id: `room-error-${Date.now()}`,
    type: 'persistent',
    tone: 'error',
    icon: 'octagon-alert',
    duration: 0,
    content: summary,
    buttons: [
      {
        label: 'Details',
        color: 'amber',
        onClick: () => {
          spawnConnectionErrorDialogue(summary, fullDetails);
        },
      },
    ],
  });
}

export interface ConnectionErrorBannerProps {
  isLight: boolean;
  errorMessage: string;
  diagRunning: boolean;
  diagResult: DiagnosticResult | null;
  onDismiss: () => void;
  onTestSignaling: () => void;
  onRetry: () => void;
}

export const ConnectionErrorBanner: React.FC<ConnectionErrorBannerProps> = ({
  isLight,
  errorMessage,
  diagRunning,
  diagResult,
  onDismiss,
  onTestSignaling,
  onRetry,
}) => {
  return (
    <div
      className={`p-3 rounded-xl border flex flex-col gap-2 text-xs font-mono select-none ${
        isLight
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Connection Notice</span>
            <p className="opacity-90 leading-tight mt-0.5">{errorMessage}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs opacity-60 hover:opacity-100 font-bold px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onTestSignaling}
          disabled={diagRunning}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-[11px] font-bold cursor-pointer transition-colors"
        >
          {diagRunning ? <Loader2 className="h-3 w-3 animate-spin text-sky-400" /> : <Activity className="h-3 w-3 text-sky-400" />}
          <span>{diagRunning ? 'Testing Ping...' : 'Diagnose Server'}</span>
        </button>

        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold cursor-pointer transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Retry Connection</span>
        </button>
      </div>

      {diagResult && (
        <div className="mt-1 p-2 rounded-lg bg-neutral-900/90 border border-neutral-700 text-[11px]">
          {diagResult.ok ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Signaling Server Online (Handshake RTT: {diagResult.rttMs}ms)
            </span>
          ) : (
            <div className="text-rose-400 flex flex-col gap-0.5">
              <span className="font-bold flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                Signaling Server Unreachable
              </span>
              <span className="opacity-80 text-[10px]">{diagResult.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface SignalingSettingsProps {
  signalingUrl: string;
  signalingInput: string;
  showSignalingConfig: boolean;
  diagRunning: boolean;
  diagResult: DiagnosticResult | null;
  onToggleConfig: () => void;
  onChangeSignalingInput: (val: string) => void;
  onApplySignalingUrl: (url: string, reset?: boolean) => void;
  onTestSignaling: (url?: string) => void;
}

export const SignalingSettings: React.FC<SignalingSettingsProps> = ({
  signalingUrl,
  signalingInput,
  showSignalingConfig,
  diagRunning,
  diagResult,
  onToggleConfig,
  onChangeSignalingInput,
  onApplySignalingUrl,
  onTestSignaling,
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full text-[11px] text-neutral-400 font-mono">
      <div className="flex items-center justify-between w-full">
        <button
          type="button"
          onClick={onToggleConfig}
          className="hover:text-sky-400 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>Signaling: {signalingUrl.replace(/^wss?:\/\//, '').split('/')[0]}</span>
          <Settings className="h-3 w-3 text-neutral-500 hover:text-sky-400" />
        </button>
        <span>120Hz Sub-Tick</span>
      </div>

      {showSignalingConfig && (
        <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
          <span className="text-[10px] text-neutral-400">SIGNALING SERVER ENDPOINT:</span>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={signalingInput}
              onChange={(e) => onChangeSignalingInput(e.target.value)}
              placeholder={DEFAULT_SIGNALING_URL}
              className="w-full px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-sky-400 text-[10px] outline-none font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const clean = signalingInput.trim() || DEFAULT_SIGNALING_URL;
                setSignalingUrl(clean);
                onApplySignalingUrl(clean, false);
              }}
              className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] font-bold cursor-pointer shrink-0"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => onTestSignaling(signalingInput.trim() || DEFAULT_SIGNALING_URL)}
              disabled={diagRunning}
              className="px-2.5 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-[10px] font-bold cursor-pointer shrink-0 flex items-center gap-1"
            >
              {diagRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Activity className="h-2.5 w-2.5" />}
              <span>{diagRunning ? 'Testing...' : 'Ping Test'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSignalingUrl(null);
                onApplySignalingUrl(DEFAULT_SIGNALING_URL, true);
              }}
              className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 text-[10px] font-bold cursor-pointer shrink-0"
            >
              Reset
            </button>
          </div>

          {diagResult && (
            <div className="flex items-center gap-2 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono">
              {diagResult.ok ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  Signaling Handshake: {diagResult.rttMs}ms OK
                </span>
              ) : (
                <span className="text-rose-400 flex items-center gap-1 truncate" title={diagResult.error || ''}>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block shrink-0" />
                  {diagResult.error}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
