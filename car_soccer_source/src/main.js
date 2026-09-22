import './utils/ConsoleLoggerEnhancer.js';
import * as THREE from 'three';
import { applyThreeMonkeyPatches } from './utils/ThreeMonkeyPatches.js';

// Apply defensive compatibility patches to standard Three.js
applyThreeMonkeyPatches(THREE);

/**
 * main.js
 * Application bootstrap entry point.
 * Imports complete Car Soccer Game Engine & original styling.
 */

import './styles/game.css';
import './game/CarSoccerEngine.js';

console.log('[CarSoccer] Official Car Soccer Engine online — Free Play ready.');
