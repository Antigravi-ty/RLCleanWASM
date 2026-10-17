/**
 * kickoffPPOWeights.js
 * Externalized MLP Actor Weights Loader & Metadata for the 1v1 Kickoff PPO Agent.
 *
 * The raw Float32 parameter tensor (89,103 floats = 356,412 bytes) is stored as an
 * external binary asset at `/custom/assets/models/kickoff_ppo_actor.bin` in compliance
 * with README Section 3 (Strict Ban on Hardcoded Inline Assets).
 */

import { validateAssetResponse } from '../utils/AssetResponseValidator.js';

export const KICKOFF_PPO_WEIGHTS_URL = '/custom/assets/models/kickoff_ppo_actor.bin';

export const KICKOFF_PPO_META = {
  arch: 'mlp_75_256_256_15_tanh',
  obsDim: 75,
  logitsDim: 15,
  settleTicks: 30,
  actionRepeat: 4,
  totalFloats: 89103,
  byteLength: 356412,
  layers: {
    'actor.0.weight': { shape: [256, 75], offset: 0, length: 19200 },
    'actor.0.bias': { shape: [256], offset: 19200, length: 256 },
    'actor.2.weight': { shape: [256, 256], offset: 19456, length: 65536 },
    'actor.2.bias': { shape: [256], offset: 84992, length: 256 },
    'actor.4.weight': { shape: [15, 256], offset: 85248, length: 3840 },
    'actor.4.bias': { shape: [15], offset: 89088, length: 15 },
  },
};

let _cachedSlices = null;
let _loadingPromise = null;

function sliceFlatWeights(flat, isFallback = false) {
  const l = KICKOFF_PPO_META.layers;
  return {
    w0: flat.subarray(l['actor.0.weight'].offset, l['actor.0.weight'].offset + l['actor.0.weight'].length),
    b0: flat.subarray(l['actor.0.bias'].offset, l['actor.0.bias'].offset + l['actor.0.bias'].length),
    w2: flat.subarray(l['actor.2.weight'].offset, l['actor.2.weight'].offset + l['actor.2.weight'].length),
    b2: flat.subarray(l['actor.2.bias'].offset, l['actor.2.bias'].offset + l['actor.2.bias'].length),
    w4: flat.subarray(l['actor.4.weight'].offset, l['actor.4.weight'].offset + l['actor.4.weight'].length),
    b4: flat.subarray(l['actor.4.bias'].offset, l['actor.4.bias'].offset + l['actor.4.bias'].length),
    isFallback,
  };
}

/**
 * Asynchronously fetches and caches the binary Float32 weights for the Kickoff PPO Actor.
 */
export async function preloadKickoffPPOWeights(url = KICKOFF_PPO_WEIGHTS_URL) {
  if (_cachedSlices && !_cachedSlices.isFallback) {
    return _cachedSlices;
  }
  if (_loadingPromise) {
    return _loadingPromise;
  }

  _loadingPromise = (async () => {
    try {
      if (typeof fetch === 'function') {
        const res = await fetch(url);
        const check = validateAssetResponse(res, url, 'binary');
        if (!check.ok) {
          throw check.error;
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength < KICKOFF_PPO_META.byteLength) {
          throw new Error(
            `[KickoffPPOWeights] Invalid binary byteLength ${buf.byteLength} (expected ${KICKOFF_PPO_META.byteLength})`
          );
        }
        const flat = new Float32Array(buf, 0, KICKOFF_PPO_META.totalFloats);
        _cachedSlices = sliceFlatWeights(flat, false);
        return _cachedSlices;
      }
    } catch (err) {
      console.warn('[KickoffPPOWeights] Failed to fetch binary weights, using fallback until loaded:', err);
    } finally {
      _loadingPromise = null;
    }

    if (!_cachedSlices) {
      _cachedSlices = sliceFlatWeights(new Float32Array(KICKOFF_PPO_META.totalFloats), true);
    }
    return _cachedSlices;
  })();

  return _loadingPromise;
}

/**
 * Synchronously returns the cached Kickoff PPO Actor weights if already preloaded,
 * or triggers background preloading and returns a zero-initialized fallback tensor.
 */
export function getKickoffPPOActorWeights() {
  if (_cachedSlices) {
    return _cachedSlices;
  }
  preloadKickoffPPOWeights();
  _cachedSlices = sliceFlatWeights(new Float32Array(KICKOFF_PPO_META.totalFloats), true);
  return _cachedSlices;
}
