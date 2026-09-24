import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import { uniqueShapeEdges, spokeTips, SPOKE_RADIUS, STROKE_RADIUS, type Point } from './shapes';

export interface HydroShape { rings: Point[][]; width: number; }

function capsule(a: Point, b: Point, radius: number): Polygon {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const points: Pair[] = [];
  // Analytic capsule approximated to < .002 world units at the tyre radius.
  for (const [p, start] of [[b, angle - Math.PI / 2], [a, angle + Math.PI / 2]] as const) {
    for (let i = 0; i <= 8; i++) {
      const t = start + i * Math.PI / 8;
      // Weld numerically coincident endpoints (sin(pi) is not exactly zero).
      points.push([Math.round((p.x + Math.cos(t) * radius) * 1e6) / 1e6, Math.round((p.y + Math.sin(t) * radius) * 1e6) / 1e6]);
    }
  }
  points.push(points[0]);
  return [points];
}

function unionRings(polygons: Polygon[]): Point[][] {
  // Union removes hidden/internal faces and prevents a retraced or intersecting
  // stroke from displacing the same water twice. Holes retain negative winding.
  return polygonClipping.union(polygons[0], ...polygons.slice(1))
    .flatMap(p => p.map(r => r.slice(0, -1).map(([x, y]) => ({ x, y }))));
}

const cache = new Map<string, HydroShape[]>();
const shapeReferences = new WeakMap<Point[], HydroShape[]>();
export function cacheWheelHydro(shape: Point[], geometry: HydroShape[]) {
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(JSON.stringify(shape), geometry);
  shapeReferences.set(shape, geometry);
}
export function wheelHydro(shape: Point[]): HydroShape[] {
  if (shape.length < 2) return [];
  const reference=shapeReferences.get(shape);if(reference)return reference;
  const key = JSON.stringify(shape), cached = cache.get(key);
  if (cached) {shapeReferences.set(shape,cached);return cached;}
  const rim: Polygon[] = [];
  for (const [a, b] of uniqueShapeEdges(shape)) rim.push(capsule(a, b, STROKE_RADIUS));
  const origin = { x: 0, y: 0 };
  const spokes = spokeTips(shape).map(p => capsule(origin, p, SPOKE_RADIUS));
  const result: HydroShape[] = [
    { rings: unionRings(rim), width: Math.PI * STROKE_RADIUS / 2 },
    { rings: unionRings(spokes), width: Math.PI * SPOKE_RADIUS / 2 },
  ];
  // A bounded geometry cache is shared by the two independently drawn axles.
  cacheWheelHydro(shape, result);
  return result;
}

export function wheelMassProperties(shape: Point[]) {
  const parts = wheelHydro(shape);
  let mass = .24, momentX = 0, momentY = 0, polar = .24 * .15 ** 2 / 2;
  for (const [index, part] of parts.entries()) {
    const density = index === 0 ? .26 / (2 * STROKE_RADIUS) : .02 / (2 * SPOKE_RADIUS);
    for (const ring of part.rings) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], cross = a.x * b.y - b.x * a.y;
      mass += cross * density / 2;
      momentX += (a.x + b.x) * cross * density / 6; momentY += (a.y + b.y) * cross * density / 6;
      polar += (a.x * a.x + a.x * b.x + b.x * b.x + a.y * a.y + a.y * b.y + b.y * b.y) * cross * density / 12;
    }
  }
  const center = { x: momentX / mass, y: momentY / mass };
  return { mass, center, inertia: Math.max(.0001, polar - mass * (center.x ** 2 + center.y ** 2)) };
}
