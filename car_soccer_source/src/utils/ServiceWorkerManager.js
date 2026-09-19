/**
 * src/utils/ServiceWorkerManager.js
 * Service Worker Cleaner & Cache Purger
 *
 * Fully disables and unregisters all service workers, purging any legacy
 * offline caches (including car-soccer-cache-v1) so that no network requests
 * or assets are intercepted by a background worker.
 */

export const DEFAULT_SW_SCOPE = '/';
export const DEFAULT_SW_SCRIPT = `${DEFAULT_SW_SCOPE}game-sw.js`;

/**
 * Backward-compatible helper that resolves immediately without activating any worker.
 *
 * @param {ServiceWorker} [worker]
 * @returns {Promise<void>}
 */
export function waitForServiceWorkerActivation(worker) {
  return Promise.resolve();
}

/**
 * Unregisters any active service workers and deletes all stored caches.
 *
 * @param {string} [scope=DEFAULT_SW_SCOPE]
 * @param {string} [scriptUrl=DEFAULT_SW_SCRIPT]
 * @returns {Promise<null>}
 */
export async function unregisterGameServiceWorkers() {
  if (typeof window === 'undefined') return null;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const key of keys) {
        await caches.delete(key);
      }
    }
  } catch (err) {
    // Non-critical cleanup error; silently continue
  }

  return null;
}

/**
 * Replaces original registration function with unregistration logic to ensure complete removal.
 */
export const registerGameServiceWorker = unregisterGameServiceWorkers;
