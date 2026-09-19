/**
 * CarColorConstants.js
 * Standard 6-Color Preset Palette for Car Soccer Multiplayer Customization.
 *
 * Exact specifications:
 * Slot 0: Red / 红 / #ff7043 (Team Red/Orange)
 * Slot 1: Green / 绿 / #66bb6a (Team Blue)
 * Slot 2: Yellow / 黄 / #ffc107 (Team Red/Orange)
 * Slot 3: Blue / 蓝 / #42a5f5 (Team Blue)
 * Slot 4: Pink / 粉 / #fd6e9d (Team Red/Orange)
 * Slot 5: Purple / 紫 / #ba68c8 (Team Blue)
 */

export const CAR_COLOR_SLOTS = [
  { id: 0, nameEn: 'Red', nameZh: '红', hex: '#ff7043', team: 1, teamName: '红队 / 橙队', teamNameEn: 'Team Orange/Red' },
  { id: 1, nameEn: 'Green', nameZh: '绿', hex: '#66bb6a', team: 0, teamName: '蓝队', teamNameEn: 'Team Blue' },
  { id: 2, nameEn: 'Yellow', nameZh: '黄', hex: '#ffc107', team: 1, teamName: '红队 / 橙队', teamNameEn: 'Team Orange/Red' },
  { id: 3, nameEn: 'Blue', nameZh: '蓝', hex: '#42a5f5', team: 0, teamName: '蓝队', teamNameEn: 'Team Blue' },
  { id: 4, nameEn: 'Pink', nameZh: '粉', hex: '#fd6e9d', team: 1, teamName: '红队 / 橙队', teamNameEn: 'Team Orange/Red' },
  { id: 5, nameEn: 'Purple', nameZh: '紫', hex: '#ba68c8', team: 0, teamName: '蓝队', teamNameEn: 'Team Blue' }
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
