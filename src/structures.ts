import type { Obstacle, Structure } from './courses';

// A flat, exact clearance at the wheel tracks transitions to an irregular arch
// and anchored rock shoulders outside the driving corridor. No floating slab.
export function archSection(o: Obstacle, lateral: number, base: number) {
  const style = o.structure ?? 'arch', z = Math.abs(lateral);
  const halfSpan = o.channel!==undefined?2.5:style === 'cave' ? 4.4 : style === 'bridge' ? 3.5 : 3.3;
  const clear = o.y - o.height / 2;
  const t = Math.min(1, Math.max(0, (z - 1.35) / (halfSpan - 1.35)));
  const bottom = z <= 1.35 ? clear : base + (clear - base) * Math.sqrt(Math.max(0, 1 - t * t));
  const irregular = .16 * Math.sin(lateral * 2.2 + o.x) + .12 * Math.cos(lateral * 3.7 - o.x);
  let top = clear + (style === 'bridge' ? .85 : style === 'cave' ? .6 : .55) + (z <= 1.35 || style === 'bridge' ? 0 : irregular * .25);
  if (z > halfSpan) {
    const extent = structureExtent(style,o.channel!==undefined?o.depth:undefined), t = Math.min(1, (z - halfSpan) / (extent - halfSpan)), blend = t * t * (3 - 2 * t);
    top = top * (1 - blend) + (base - .12) * blend;
  }
  const underside=z >= halfSpan ? base - .6 : bottom;
  return { bottom: underside, top:Math.max(top,underside+.22), halfSpan };
}

/** Physical silhouette at the two wheel tracks, including the raised roof mass. */
export function roofOutline(o: Obstacle) {
  const thickness = o.structure === 'bridge' ? .85 : o.structure === 'cave' ? .6 : .55;
  const crest = o.structure === 'bridge' ? 0 : o.structure === 'cave' ? 1.75 : .3;
  return [{ x: -o.width / 2, y: -o.height / 2 }, { x: o.width / 2, y: -o.height / 2 },
    ...Array.from({ length: 5 }, (_, i) => { const t = 1 - i / 4; return { x: (t - .5) * o.width, y: -o.height / 2 + thickness + Math.sin(t * Math.PI) * crest }; })];
}

export const structureExtent = (style: Structure,depth?:number) => depth?depth/2+.7:style === 'cave' ? 10 : style === 'bridge' ? 9 : 7;
export function archBands(style: Structure) {
  const edge = structureExtent(style), shoulder = style === 'cave' ? 4.4 : style === 'bridge' ? 3.5 : 3.3;
  const bands = [0, .65, 1.35, 2, 2.7, shoulder, shoulder + 1, edge - 1, edge];
  return [...new Set(bands.flatMap(z => [-z, z]))].sort((a, b) => a - b);
}
