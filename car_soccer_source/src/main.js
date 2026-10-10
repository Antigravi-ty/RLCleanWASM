import './utils/ConsoleLoggerEnhancer.js';

/**
 * main.js
 * Application bootstrap entry point.
 * Minimum JavaScript entry: starts loader, then dynamically loads the engine.
 */

// 1. Stream game styles in parallel
import('./styles/game.css');

// 2. Dynamically import CarSoccerEngine to trigger fast-boot lifecycle
import('./game/CarSoccerEngine.js')
  .then(() => {
    console.log('[CarSoccer] Official Car Soccer Engine online — Free Play ready.');
  })
  .catch((err) => {
    console.error('[CarSoccer] Fatal bootstrap failure:', err);
  });
