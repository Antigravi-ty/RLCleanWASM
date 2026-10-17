/**
 * BoostPadGeometryHelper.js
 * Symmetry and angle calculation helper for Rocket League's 34 boost pads (6 Big + 28 Small).
 * 
 * RocketSim Standard Soccar Arena Coordinate Layout:
 * Origin (0,0,0) at center of pitch. Arena extents: X [-4096, 4096], Y [-5120, 5120].
 * Symmetry: Dual-axis mirror (X & Y) + 180° rotational point symmetry.
 */

export const NUM_BOOST_PADS = 34;
export const NUM_BIG_PADS = 6;
export const NUM_SMALL_PADS = 28;

/**
 * 11 Canonical groups that govern all 34 pads through symmetry:
 * 2 Big Pad groups:
 *   - Mid (2 pads): (-3584, 0) and (3584, 0)
 *   - Corner (4 pads): (+-3072, +-4096)
 * 9 Small Pad groups:
 *   - Axis Y (X=0): 3 pairs at (0, +-4240), (0, +-2816), (0, +-1024)
 *   - Axis X (Y=0): 1 pair at (+-1024, 0)
 *   - Quadrant groups: 5 groups of 4 pads each
 */

export const DEFAULT_ROTATION_GROUPS = Object.freeze({
  rotBigMid: 0,
  rotBigCorner: 45,
  rotSmallAxisY0: 0,
  rotSmallAxisY1: 0,
  rotSmallAxisY2: 0,
  rotSmallAxisX0: 90,
  rotSmallQuadA: 30,
  rotSmallQuadB: -30,
  rotSmallQuadC: 0,
  rotSmallQuadD: 45,
  rotSmallQuadE: -45,
});

/**
 * Maps each pad index (0-33) to its group and relative transform rule.
 * Returns an array of 34 rotation values in DEGREES.
 * @param {typeof DEFAULT_ROTATION_GROUPS} groups
 * @returns {number[]} Array of 34 rotation angles in degrees
 */
export function computeAllPadRotations(groups = DEFAULT_ROTATION_GROUPS) {
  const g = { ...DEFAULT_ROTATION_GROUPS, ...groups };
  const angles = new Array(34).fill(0);

  // --- Big Pads (0 to 5) ---
  // Pad 0: (-3584, 0)
  angles[0] = g.rotBigMid;
  // Pad 1: (3584, 0) -> 180 deg point symmetry
  angles[1] = (g.rotBigMid + 180) % 360;

  // Pad 2: (-3072, 4096) -> Quad 2 (-X, +Y)
  angles[2] = g.rotBigCorner;
  // Pad 3: (3072, 4096) -> Quad 1 (+X, +Y): mirrored across Y axis
  angles[3] = (-g.rotBigCorner + 360) % 360;
  // Pad 4: (-3072, -4096) -> Quad 3 (-X, -Y): mirrored across X axis
  angles[4] = (180 - g.rotBigCorner + 360) % 360;
  // Pad 5: (3072, -4096) -> Quad 4 (+X, -Y): 180 deg point symmetry
  angles[5] = (g.rotBigCorner + 180) % 360;

  // --- Small Pads (6 to 33) ---
  // Axis Y (X = 0):
  // Pad 6: (0, -4240)
  angles[6] = g.rotSmallAxisY0;
  // Pad 33: (0, 4240) -> point symmetry
  angles[33] = (g.rotSmallAxisY0 + 180) % 360;

  // Pad 11: (0, -2816)
  angles[11] = g.rotSmallAxisY1;
  // Pad 28: (0, 2816) -> point symmetry
  angles[28] = (g.rotSmallAxisY1 + 180) % 360;

  // Pad 17: (0, -1024)
  angles[17] = g.rotSmallAxisY2;
  // Pad 22: (0, 1024) -> point symmetry
  angles[22] = (g.rotSmallAxisY2 + 180) % 360;

  // Axis X (Y = 0):
  // Pad 19: (-1024, 0)
  angles[19] = g.rotSmallAxisX0;
  // Pad 20: (1024, 0) -> point symmetry
  angles[20] = (g.rotSmallAxisX0 + 180) % 360;

  // Quad Group A: (+-1792, +-4184)
  // Pad 7 (-1792, -4184)
  angles[7] = g.rotSmallQuadA;
  // Pad 8 (1792, -4184)
  angles[8] = (-g.rotSmallQuadA + 360) % 360;
  // Pad 31 (-1792, 4184)
  angles[31] = (180 - g.rotSmallQuadA + 360) % 360;
  // Pad 32 (1792, 4184)
  angles[32] = (g.rotSmallQuadA + 180) % 360;

  // Quad Group B: (+-940, +-3308)
  // Pad 9 (-940, -3308)
  angles[9] = g.rotSmallQuadB;
  // Pad 10 (940, -3308)
  angles[10] = (-g.rotSmallQuadB + 360) % 360;
  // Pad 29 (-940, 3308)
  angles[29] = (180 - g.rotSmallQuadB + 360) % 360;
  // Pad 30 (940, 3308)
  angles[30] = (g.rotSmallQuadB + 180) % 360;

  // Quad Group C: (+-3584, +-2484)
  // Pad 12 (-3584, -2484)
  angles[12] = g.rotSmallQuadC;
  // Pad 13 (3584, -2484)
  angles[13] = (-g.rotSmallQuadC + 360) % 360;
  // Pad 26 (-3584, 2484)
  angles[26] = (180 - g.rotSmallQuadC + 360) % 360;
  // Pad 27 (3584, 2484)
  angles[27] = (g.rotSmallQuadC + 180) % 360;

  // Quad Group D: (+-1788, +-2300)
  // Pad 14 (-1788, -2300)
  angles[14] = g.rotSmallQuadD;
  // Pad 15 (1788, -2300)
  angles[15] = (-g.rotSmallQuadD + 360) % 360;
  // Pad 24 (-1788, 2300)
  angles[24] = (180 - g.rotSmallQuadD + 360) % 360;
  // Pad 25 (1788, 2300)
  angles[25] = (g.rotSmallQuadD + 180) % 360;

  // Quad Group E: (+-2048, +-1036)
  // Pad 16 (-2048, -1036)
  angles[16] = g.rotSmallQuadE;
  // Pad 18 (2048, -1036)
  angles[18] = (-g.rotSmallQuadE + 360) % 360;
  // Pad 21 (-2048, 1036)
  angles[21] = (180 - g.rotSmallQuadE + 360) % 360;
  // Pad 23 (2048, 1036)
  angles[23] = (g.rotSmallQuadE + 180) % 360;

  return angles;
}

/**
 * Format angles into ready-to-paste TypeScript / JavaScript array code.
 * @param {number[]} angles Array of 34 angles in degrees
 * @returns {string}
 */
export function exportRotationsAsCode(angles) {
  const formatted = angles.map((a, i) => `  /* Pad ${String(i).padStart(2, ' ')} */ ${Number(a).toFixed(1)}`).join(',\n');
  return `/**
 * Pre-computed Boost Pad Orientation Angles (Degrees)
 * 34 pads (0-5: Big 100-boost, 6-33: Small 12-boost)
 */
export const BOOST_PAD_ROTATIONS = Object.freeze([
${formatted}
]);
`;
}
