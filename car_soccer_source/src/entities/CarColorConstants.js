/**
 * CarColorConstants.js
 * Standard 6-Color Preset Palette for Car Soccer Multiplayer Customization.
 *
 * Exact specifications:
 * Slot 0: Red / #ff7043 (Team Orange/Red)
 * Slot 1: Green / #66bb6a (Team Blue)
 * Slot 2: Yellow / #ffc107 (Team Orange/Red)
 * Slot 3: Blue / #42a5f5 (Team Blue)
 * Slot 4: Pink / #fd6e9d (Team Orange/Red)
 * Slot 5: Purple / #ba68c8 (Team Blue)
 */

export const CAR_COLOR_SLOTS = [
  { id: 0, name: 'Red', nameEn: 'Red', hex: '#ff7043', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' },
  { id: 1, name: 'Green', nameEn: 'Green', hex: '#66bb6a', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' },
  { id: 2, name: 'Yellow', nameEn: 'Yellow', hex: '#ffc107', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' },
  { id: 3, name: 'Blue', nameEn: 'Blue', hex: '#42a5f5', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' },
  { id: 4, name: 'Pink', nameEn: 'Pink', hex: '#fd6e9d', team: 1, teamName: 'Team Orange/Red', teamNameEn: 'Team Orange/Red' },
  { id: 5, name: 'Purple', nameEn: 'Purple', hex: '#ba68c8', team: 0, teamName: 'Team Blue', teamNameEn: 'Team Blue' }
];

/**
 * Retrieves color slot metadata by slot ID.
 * @param {number|string} id Slot index (0-5)
 * @returns {object} Slot descriptor
 */
export function getCarColorSlotById(id) {
  const num = Number(id);
  return CAR_COLOR_SLOTS.find(s => s.id === num) || CAR_COLOR_SLOTS[0];
}

/**
 * Converts a hex color string ('#ff7043') to a numeric integer (0xff7043).
 * @param {string|number} hex
 * @returns {number}
 */
export function parseColorToNumber(hex) {
  if (typeof hex === 'number') return hex;
  if (!hex) return 0xff7043;
  return parseInt(String(hex).replace('#', ''), 16);
}
