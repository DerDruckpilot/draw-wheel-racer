import type { Obstacle, Structure } from './courses';

// A flat, exact clearance at the wheel tracks transitions to an irregular arch
// and anchored rock shoulders outside the driving corridor. No floating slab.
export function archSection(o: Obstacle, lateral: number, base: number) {
  const style = o.structure ?? 'arch', z = Math.abs(lateral);
  const halfSpan = style === 'cave' ? 5.6 : style === 'bridge' ? 4.6 : 4.1;
  const clear = o.y - o.height / 2;
  const t = Math.min(1, Math.max(0, (z - 1.35) / (halfSpan - 1.35)));
  const bottom = base + (clear - base) * Math.sqrt(Math.max(0, 1 - t * t));
  const irregular = .16 * Math.sin(lateral * 2.2 + o.x) + .12 * Math.cos(lateral * 3.7 - o.x);
  const top = z <= 1.35 ? clear + (style === 'bridge' ? .85 : style === 'cave' ? 2.85 : .9)
    : style === 'bridge' ? clear + .85 : style === 'cave' ? clear + 2.3 + Math.cos(lateral * .5) * .55 + irregular : bottom + .9 + irregular;
  return { bottom: z >= halfSpan ? base - .6 : bottom, top, halfSpan };
}

/** Physical silhouette at the two wheel tracks, including the raised roof mass. */
export function roofOutline(o: Obstacle) {
  const thickness = o.structure === 'bridge' ? .85 : o.structure === 'cave' ? 2.85 : .9;
  const crest = o.structure === 'bridge' ? 0 : o.structure === 'cave' ? 1.8 : .4;
  return [{ x: -o.width / 2, y: -o.height / 2 }, { x: o.width / 2, y: -o.height / 2 },
    ...Array.from({ length: 5 }, (_, i) => { const t = 1 - i / 4; return { x: (t - .5) * o.width, y: -o.height / 2 + thickness + Math.sin(t * Math.PI) * crest }; })];
}

export function archBands(style: Structure) {
  const edge = style === 'cave' ? 6.5 : style === 'bridge' ? 5.4 : 4.9;
  return [-edge, -edge + .6, -3.6, -2.7, -2, -1.35, -.65, 0, .65, 1.35, 2, 2.7, 3.6, edge - .6, edge].sort((a, b) => a - b);
}
