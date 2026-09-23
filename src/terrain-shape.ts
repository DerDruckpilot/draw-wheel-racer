/** A continuous lateral warp: driving contacts remain exactly at z=.03/1.97.
 * The surrounding ledges shear, taper and erode instead of extruding a profile
 * at a right angle across the whole world. The same mapping closes bank seams.
 */
export function terrainWarp(x: number, y: number, z: number,halfWidth=2.03) {
  const outside = Math.max(0, Math.abs(z - 1) - halfWidth);
  const t = Math.min(1, outside / 3), blend = t * t * (3 - 2 * t);
  const shift = blend * (Math.sin(x * .083 + z * .31) * 1.8 + Math.sin(z * .57 + .8) * .9 + (z - 1) * .18);
  const relief = Math.min(1, Math.max(0, y) / .5) * blend * (.17 * Math.sin(x * .73 + z * 1.4) + .12 * Math.cos(x * .31 - z * .53));
  return { x: x + shift, y: y + relief, z };
}
