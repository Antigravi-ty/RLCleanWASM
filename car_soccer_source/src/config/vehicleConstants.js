/**
 * vehicleConstants.js
 * Pure, zero-dependency vehicle hitbox, 3D visual model, and role/loadout constants.
 *
 * Modeled after audioConstants.js and CarColorConstants.js:
 * - Zero Three.js or DOM imports (safe for Web Workers, Headless Node.js, and Network Codecs).
 * - Decouples physical collision hitbox index (hitboxIndex: 0..5) from visual 3D model index (visualIndex: 0..31).
 * - Extensible catalog for future lightweight vehicle models.
 */

export const HITBOX_PRESETS = Object.freeze({
  'hitbox-octane': Object.freeze({
    index: 0,
    id: 'hitbox-octane',
    name: 'Octane',
    length: 120.507,
    width: 86.6994,
    height: 38.6591,
    forward: 13.8757,
    up: 20.755
  }),
  'hitbox-dominus': Object.freeze({
    index: 1,
    id: 'hitbox-dominus',
    name: 'Dominus',
    length: 130.427,
    width: 85.7799,
    height: 33.80,
    forward: 9.00,
    up: 15.75
  }),
  'hitbox-plank': Object.freeze({
    index: 2,
    id: 'hitbox-plank',
    name: 'Batmobile (Plank)',
    length: 131.32,
    width: 87.1704,
    height: 31.8944,
    forward: 9.00857,
    up: 12.0942
  }),
  'hitbox-breakout': Object.freeze({
    index: 3,
    id: 'hitbox-breakout',
    name: 'Breakout',
    length: 133.992,
    width: 83.021,
    height: 32.80,
    forward: 12.50,
    up: 11.75
  }),
  'hitbox-hybrid': Object.freeze({
    index: 4,
    id: 'hitbox-hybrid',
    name: 'Hybrid',
    length: 129.519,
    width: 84.6879,
    height: 36.6591,
    forward: 13.8757,
    up: 20.755
  }),
  'hitbox-merc': Object.freeze({
    index: 5,
    id: 'hitbox-merc',
    name: 'Merc',
    length: 123.22,
    width: 79.2103,
    height: 44.1591,
    forward: 11.3757,
    up: 21.505
  })
});

/**
 * Ordered by C++ WASM hitbox index (0..5):
 * 0: Octane, 1: Dominus, 2: Plank, 3: Breakout, 4: Hybrid, 5: Merc
 */
export const HITBOX_INDEX_TO_ID = Object.freeze([
  'hitbox-octane',
  'hitbox-dominus',
  'hitbox-plank',
  'hitbox-breakout',
  'hitbox-hybrid',
  'hitbox-merc'
]);

/**
 * Canonical visual model catalog (index 0..31).
 * New lightweight 3D models can be appended here with their defaultHitboxId.
 */
export const CAR_VISUAL_CATALOG = Object.freeze([
  Object.freeze({ index: 0, id: 'hitbox-octane', label: 'Octane (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-octane' }),
  Object.freeze({ index: 1, id: 'hitbox-dominus', label: 'Dominus (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-dominus' }),
  Object.freeze({ index: 2, id: 'hitbox-breakout', label: 'Breakout (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-breakout' }),
  Object.freeze({ index: 3, id: 'hitbox-hybrid', label: 'Hybrid (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-hybrid' }),
  Object.freeze({ index: 4, id: 'hitbox-plank', label: 'Batmobile/Plank (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-plank' }),
  Object.freeze({ index: 5, id: 'hitbox-merc', label: 'Merc (Whitebox)', isPreset: true, defaultHitboxId: 'hitbox-merc' }),
  Object.freeze({ index: 6, id: 'game-car', label: 'Default Car', isPreset: false, defaultHitboxId: 'hitbox-octane' }),
  Object.freeze({ index: 7, id: 'flat-car', label: 'Flat Car', isPreset: false, defaultHitboxId: 'hitbox-dominus' })
]);

export const CAR_VISUAL_IDS = Object.freeze(CAR_VISUAL_CATALOG.map((item) => item.id));

export const CAR_VISUAL_OPTIONS = Object.freeze(
  CAR_VISUAL_CATALOG.map(({ id, label, isPreset }) => ({ id, label, isPreset }))
);

export const SHORT_VISUAL_ALIAS_MAP = Object.freeze({
  octane: 'game-car',
  dominus: 'hitbox-dominus',
  breakout: 'hitbox-breakout',
  hybrid: 'hitbox-hybrid',
  plank: 'hitbox-plank',
  batmobile: 'hitbox-plank',
  merc: 'hitbox-merc',
  default: 'game-car',
  flat: 'flat-car'
});

export const PLAYER_ROLES = Object.freeze({
  PLAYER: 'player',
  SPECTATOR: 'spectator'
});

export const PLAYER_ROLE_CODES = Object.freeze({
  PLAYER: 0,
  SPECTATOR: 2
});

export function normalizeVisualId(visualId) {
  if (!visualId) return 'game-car';
  const raw = String(visualId).toLowerCase().trim();
  if (CAR_VISUAL_IDS.includes(raw)) return raw;
  if (SHORT_VISUAL_ALIAS_MAP[raw]) return SHORT_VISUAL_ALIAS_MAP[raw];
  console.warn(`[vehicleConstants:Fallback] Unknown visualId "${visualId}", falling back to "game-car".`);
  return 'game-car';
}

export function encodeVisualIdIndex(visualId) {
  if (typeof visualId === 'number' && Number.isFinite(visualId)) {
    if (visualId >= 0 && visualId < CAR_VISUAL_IDS.length) {
      return visualId;
    }
    console.warn(`[vehicleConstants:Fallback] Out-of-range visualIndex ${visualId}, falling back to 6 ("game-car").`);
    return 6;
  }
  const canonical = normalizeVisualId(visualId);
  const idx = CAR_VISUAL_IDS.indexOf(canonical);
  return idx >= 0 ? idx : 6;
}

export function decodeVisualIdIndex(index) {
  if (typeof index === 'string') {
    const trimmed = index.trim();
    if (!/^\d+$/.test(trimmed)) {
      return normalizeVisualId(trimmed);
    }
  }
  const idx = Number(index);
  if (Number.isInteger(idx) && idx >= 0 && idx < CAR_VISUAL_IDS.length) {
    return CAR_VISUAL_IDS[idx];
  }
  console.warn(`[vehicleConstants:Fallback] Out-of-range visualIndex ${index} during decode, falling back to "game-car".`);
  return 'game-car';
}

/**
 * Resolves WASM hitbox index (0..5) from a hitboxId, visualId, or numeric index.
 */
export function resolveHitboxIndex(hitboxOrVisual) {
  if (typeof hitboxOrVisual === 'number' && Number.isFinite(hitboxOrVisual)) {
    if (hitboxOrVisual >= 0 && hitboxOrVisual < HITBOX_INDEX_TO_ID.length) {
      return hitboxOrVisual;
    }
    console.warn(`[vehicleConstants:Fallback] Out-of-range hitboxIndex ${hitboxOrVisual}, falling back to 0 (Octane).`);
    return 0;
  }
  if (!hitboxOrVisual) return 0;
  const lower = String(hitboxOrVisual).toLowerCase().trim();
  if (lower.includes('dominus') || lower.includes('flat')) return 1;
  if (lower.includes('plank') || lower.includes('batmobile')) return 2;
  if (lower.includes('breakout')) return 3;
  if (lower.includes('hybrid')) return 4;
  if (lower.includes('merc')) return 5;
  if (lower.includes('octane') || lower === 'game-car' || lower === 'default') return 0;
  console.warn(`[vehicleConstants:Fallback] Unknown hitbox type "${hitboxOrVisual}", falling back to 0 (Octane).`);
  return 0;
}

export function decodeHitboxIndex(hitboxIndex) {
  const idx = Number(hitboxIndex);
  if (Number.isInteger(idx) && idx >= 0 && idx < HITBOX_INDEX_TO_ID.length) {
    return HITBOX_INDEX_TO_ID[idx];
  }
  console.warn(`[vehicleConstants:Fallback] Out-of-range hitboxIndex ${hitboxIndex} during decode, falling back to "hitbox-octane".`);
  return 'hitbox-octane';
}

export const encodeHitboxIdIndex = resolveHitboxIndex;
export const decodeHitboxIdIndex = decodeHitboxIndex;

export function resolveVehicleHitboxId(hitboxOrVisual) {
  return decodeHitboxIndex(resolveHitboxIndex(hitboxOrVisual));
}

export const VEHICLE_HITBOX_ARCHETYPES = Object.freeze(
  HITBOX_INDEX_TO_ID.map((id) => HITBOX_PRESETS[id])
);
export const VEHICLE_VISUAL_MODELS = CAR_VISUAL_CATALOG;

export function encodeRoleIndex(role) {
  if (role === 'spectator' || role === PLAYER_ROLE_CODES.SPECTATOR || role === 1) {
    return PLAYER_ROLE_CODES.SPECTATOR;
  }
  return PLAYER_ROLE_CODES.PLAYER;
}

export function decodeRoleIndex(code) {
  return (code === PLAYER_ROLE_CODES.SPECTATOR || code === 1 || code === 'spectator')
    ? PLAYER_ROLES.SPECTATOR
    : PLAYER_ROLES.PLAYER;
}

/**
 * Packs visualIndex (5 bits, 0..31), hitboxIndex (3 bits, 0..7), and colorSlot (8 bits, 0..255)
 * into a 16-bit uint16 for PLAYER_LOADOUT_UPDATED.param2:
 *   bits 13..15: hitboxIndex + 1 (1..6, 0 = default from visual)
 *   bits  8..12: visualIndex (0..31)
 *   bits  0..7 : colorSlot   (0..255)
 */
export function packLoadoutSignalParam2(visualIdOrIndex, colorSlot = 0, hitboxIdOrIndex = null) {
  const visualIndex = encodeVisualIdIndex(visualIdOrIndex) & 0x1F;
  const resolvedHitboxIndex = (hitboxIdOrIndex !== null && hitboxIdOrIndex !== undefined)
    ? resolveHitboxIndex(hitboxIdOrIndex)
    : resolveHitboxIndex(decodeVisualIdIndex(visualIndex));
  const encodedHitboxBits = (resolvedHitboxIndex + 1) & 0x07;
  const safeColor = (typeof colorSlot === 'number' && colorSlot >= 0) ? (colorSlot & 0xFF) : 0;
  return (encodedHitboxBits << 13) | ((visualIndex & 0x1F) << 8) | safeColor;
}

export function unpackLoadoutSignalParam2(param2) {
  const raw = (param2 ?? 0) & 0xFFFF;
  const colorSlotId = raw & 0xFF;
  const visualIndex = (raw >>> 8) & 0x1F;
  const encodedHitboxBits = (raw >>> 13) & 0x07;
  const visualId = decodeVisualIdIndex(visualIndex);
  const hitboxIndex = encodedHitboxBits > 0
    ? (encodedHitboxBits - 1)
    : resolveHitboxIndex(visualId);
  const hitboxId = decodeHitboxIndex(hitboxIndex);
  return {
    visualIndex,
    visualId,
    hitboxIndex,
    hitboxId,
    colorSlot: colorSlotId,
    colorSlotId
  };
}

/**
 * Packs visualIndex and optional explicit hitboxIndex into CMD_SET_LOADOUT.param1 (uint16):
 *   bit 15 (0x8000): 1 if explicit hitboxIndex is encoded in bits 8..14
 *   bits 0..7      : visualIndex (0..255)
 */
export function packLoadoutCommandParam1(visualIdOrIndex, hitboxIdOrIndex = null) {
  const visualIndex = encodeVisualIdIndex(visualIdOrIndex) & 0xFF;
  const hitboxIndex = (hitboxIdOrIndex !== null && hitboxIdOrIndex !== undefined)
    ? resolveHitboxIndex(hitboxIdOrIndex)
    : resolveHitboxIndex(decodeVisualIdIndex(visualIndex));
  return 0x8000 | ((hitboxIndex & 0x7F) << 8) | visualIndex;
}

export function unpackLoadoutCommandParam1(param1) {
  if (typeof param1 === 'string') {
    const visualId = decodeVisualIdIndex(param1);
    const visualIndex = encodeVisualIdIndex(visualId);
    const hitboxIndex = resolveHitboxIndex(visualId);
    return {
      visualIndex,
      visualId,
      hitboxIndex,
      hitboxId: decodeHitboxIndex(hitboxIndex)
    };
  }
  const raw = (param1 ?? 0) & 0xFFFF;
  const visualIndex = raw & 0xFF;
  const visualId = decodeVisualIdIndex(visualIndex);
  const hasExplicitHitbox = (raw & 0x8000) !== 0;
  const hitboxIndex = hasExplicitHitbox
    ? ((raw >>> 8) & 0x7F)
    : resolveHitboxIndex(visualId);
  const hitboxId = decodeHitboxIndex(hitboxIndex);
  return {
    visualIndex,
    visualId,
    hitboxIndex,
    hitboxId
  };
}

/**
 * Standard 6-Color Preset Palette for Car Soccer Multiplayer Customization.
 */
export const CAR_COLOR_SLOTS = Object.freeze([
  Object.freeze({ id: 0, name: 'Red', nameEn: 'Red', hex: '#ff7043', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' }),
  Object.freeze({ id: 1, name: 'Green', nameEn: 'Green', hex: '#66bb6a', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' }),
  Object.freeze({ id: 2, name: 'Yellow', nameEn: 'Yellow', hex: '#ffc107', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' }),
  Object.freeze({ id: 3, name: 'Blue', nameEn: 'Blue', hex: '#42a5f5', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' }),
  Object.freeze({ id: 4, name: 'Pink', nameEn: 'Pink', hex: '#fd6e9d', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' }),
  Object.freeze({ id: 5, name: 'Purple', nameEn: 'Purple', hex: '#ba68c8', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' })
]);

export function getCarColorSlotById(id) {
  const num = Number(id);
  return CAR_COLOR_SLOTS.find(s => s.id === num) || CAR_COLOR_SLOTS[0];
}

export function parseColorToNumber(hex) {
  if (typeof hex === 'number') return hex;
  if (!hex) return 0xff7043;
  return parseInt(String(hex).replace('#', ''), 16);
}

