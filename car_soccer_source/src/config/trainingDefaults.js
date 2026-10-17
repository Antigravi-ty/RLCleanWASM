/**
 * src/config/trainingDefaults.js
 * Default settings for offline freeplay and training modes.
 */

export const DEFAULT_TRAINING_SETTINGS = Object.freeze({
  disableGoalReset: false,
  boostOption: 'unlimited',
  showCarHitbox: true,
});

export const DEFAULT_GRAPHICS_SETTINGS = Object.freeze({
  showStadium: true,
  limitFps: true,
  maxFps: 120,
  renderScale: 50,
});
