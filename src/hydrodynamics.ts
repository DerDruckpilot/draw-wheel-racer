import polygonClipping, { type Polygon, type Pair } from 'polygon-clipping';
import { shapeEdges, spokeTips, SPOKE_RADIUS, STROKE_RADIUS, type Point } from './shapes';
import type { Water } from './courses';

// The existing game uses normalized masses and world lengths, not SI vehicle
// dimensions. One density is shared by every displaced volume and pressure term.
export const WATER_DENSITY = 18;
const GRAVITY = 9.81;
export interface HydroShape {
  rings: Point[][]; width: number;
  dragX: number; dragY: number; skin: number; linearX: number; linearY: number;
}
export interface HydroPose {
  position: Point; center: Point; angle: number; velocity: Point; omega: number;
  invMass: number; invInertia: number;
}
export interface WaterForces {
  x: number; y: number; torque: number; volume: number; buoyancy: number;
  dragX: number; dragY: number; dragTorque: number; dragPower: number;
}

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
export function cacheWheelHydro(shape: Point[], geometry: HydroShape[]) {
  if (cache.size >= 64) cache.delete(cache.keys().next().value!);
  cache.set(JSON.stringify(shape), geometry);
}
export function wheelHydro(shape: Point[]): HydroShape[] {
  if (shape.length < 2) return [];
  const key = JSON.stringify(shape), cached = cache.get(key);
  if (cached) return cached;
  const rim: Polygon[] = [];
  for (const [a, b] of shapeEdges(shape)) rim.push(capsule(a, b, STROKE_RADIUS));
  const origin = { x: 0, y: 0 };
  const spokes = spokeTips(shape).map(p => capsule(origin, p, SPOKE_RADIUS));
  const properties = { dragX: 1.15, dragY: 1.15, skin: .0006, linearX: .01, linearY: .01 };
  const result: HydroShape[] = [
    { rings: unionRings(rim), width: Math.PI * STROKE_RADIUS / 2, ...properties },
    { rings: unionRings(spokes), width: Math.PI * SPOKE_RADIUS / 2, ...properties },
  ];
  // A bounded geometry cache is shared by the two axles and computer rivals.
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

// Rigid hull plus two longer, visible flotation tubes. Their separated
// displacement restores pitch naturally; no rotation lock or upright force.
export const HULL_HYDRO: HydroShape[] = [
  { rings: [[{ x: -1.15, y: -.27 }, { x: 1.15, y: -.27 }, { x: 1.15, y: .27 }, { x: -1.15, y: .27 }]],
    width: .95, dragX: .22, dragY: 1.2, skin: .002, linearX: .25, linearY: 18 },
  { rings: unionRings([capsule({ x: -1.35, y: -.17 }, { x: 1.35, y: -.17 }, .18)]),
    width: .56, dragX: .22, dragY: 1.2, skin: .002, linearX: .25, linearY: 18 },
];

// Sutherland-Hodgman half-plane clipping. Signed areas also handle a concave
// ring clipped into several pieces: connecting edges on the cut cancel out.
function clip(points: Point[], value: (p: Point) => number): Point[] {
  if (!points.length) return points;
  const result: Point[] = [];
  let a = points.at(-1)!, da = value(a);
  for (const b of points) {
    const db = value(b);
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    if (db >= 0) result.push(b);
    a = b; da = db;
  }
  return result;
}

export function submergedArea(rings: Point[][], water: Water) {
  let twiceArea = 0, momentX = 0, momentY = 0;
  for (const ring of rings) {
    let wet = clip(ring, p => water.level - p.y);
    wet = clip(wet, p => p.x - water.start);
    wet = clip(wet, p => water.end - p.x);
    if (wet.length < 3) continue;
    // Translate the origin to retain precision far along a course.
    const origin = wet[0]; let area2 = 0, mx = 0, my = 0;
    for (let i = 0; i < wet.length; i++) {
      const a = wet[i], b = wet[(i + 1) % wet.length];
      const ax = a.x - origin.x, ay = a.y - origin.y, bx = b.x - origin.x, by = b.y - origin.y;
      const cross = ax * by - ay * bx;
      area2 += cross; mx += (ax + bx) * cross; my += (ay + by) * cross;
    }
    twiceArea += area2;
    momentX += mx / 3 + origin.x * area2; momentY += my / 3 + origin.y * area2;
  }
  return twiceArea > 1e-10 ? { area: twiceArea / 2, x: momentX / twiceArea, y: momentY / twiceArea } : { area: 0, x: 0, y: 0 };
}

export interface FluidMedium { density: number; viscosity: number; yieldStress: number; shear: number; pressure: number }
export const MUD_MEDIUM: FluidMedium = { density: 23, viscosity: 38, yieldStress: 28, shear: 8, pressure: 2.2 };
// Regularized yield stress and viscous shear act on the actual wet contour.
// No preset-dependent boost: a paddle pushes clay through its exposed faces.
export function waterForces(shape: HydroShape, pose: HydroPose, water: Water, dt: number, medium?: FluidMedium): WaterForces {
  const density = medium?.density ?? WATER_DENSITY;
  const result: WaterForces = { x: 0, y: 0, torque: 0, volume: 0, buoyancy: 0, dragX: 0, dragY: 0, dragTorque: 0, dragPower: 0 };
  const co = Math.cos(pose.angle), si = Math.sin(pose.angle);
  const rings = shape.rings.map(r => r.map(p => ({ x: pose.position.x + p.x * co - p.y * si, y: pose.position.y + p.x * si + p.y * co })));
  const wet = submergedArea(rings, water);
  result.volume = wet.area * shape.width;
  result.buoyancy = result.volume * density * GRAVITY;
  result.y = result.buoyancy;
  result.torque = (wet.x - pose.center.x) * result.buoyancy;
  if (!wet.area) return result;

  for (const ring of rings) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < 1e-8) continue;
    let lo = 0, hi = 1;
    // Clip the original exposed edge; the artificial waterline is never a face
    // that can propel a wheel. Wet length varies continuously on water entry.
    for (const [v0, v1] of [[water.level - a.y, water.level - b.y], [a.x - water.start, b.x - water.start], [water.end - a.x, water.end - b.x]]) {
      if (v0 < 0 && v1 < 0) { hi = -1; break; }
      if ((v0 >= 0) !== (v1 >= 0)) {
        const t = v0 / (v0 - v1);
        if (v0 < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      }
    }
    if (hi <= lo) continue;
    const tx = dx / length, ty = dy / length, nx = ty, ny = -tx;
    const cd = shape.dragX * nx * nx + shape.dragY * ny * ny;
    const linear = shape.linearX * nx * nx + shape.linearY * ny * ny;
    const normalAtStart = (pose.velocity.x - pose.omega * (a.y - pose.center.y)) * nx + (pose.velocity.y + pose.omega * (a.x - pose.center.x)) * ny;
    const zero = normalAtStart / (pose.omega * length);
    const intervals = zero > lo && zero < hi ? [lo, zero, hi] : [lo, hi];
    // Two-point Gaussian quadrature integrates the changing velocity along
    // each face. Force resolution does not depend on drawing event frequency.
    for (let interval = 1; interval < intervals.length; interval++) for (const g of [.5 - .5 / Math.sqrt(3), .5 + .5 / Math.sqrt(3)]) {
      const from = intervals[interval - 1], to = intervals[interval];
      const area = length * (to - from) * shape.width / 2;
      const t = from + (to - from) * g;
      const x = a.x + dx * t, y = a.y + dy * t, rx = x - pose.center.x, ry = y - pose.center.y;
      const vx = pose.velocity.x - pose.omega * ry, vy = pose.velocity.y + pose.omega * rx;
      const vn = vx * nx + vy * ny, vt = vx * tx + vy * ty;
      // Windward pressure: F = 1/2 rho Cd A v_normal². The wake side does
      // not push a second time. Surface shear remains much smaller.
      const coefficient = .5 * density * cd * area * (medium?.pressure ?? 1);
      const resistance = coefficient * Math.max(0, vn) + (linear + (medium?.viscosity ?? 0) + (medium?.yieldStress ?? 0) / (.08 + Math.abs(vn))) * area;
      const pressure = -vn * resistance;
      const shearCoefficient = (.5 * density * shape.skin * Math.abs(vt) + (medium?.shear ?? 0)) * area;
      const shear = -vt * shearCoefficient;
      const fx = nx * pressure + tx * shear, fy = ny * pressure + ty * shear;
      result.dragX += fx; result.dragY += fy; result.dragTorque += rx * fy - ry * fx;
      result.dragPower += fx * vx + fy * vy;
    }
  }
  // Implicit damping of the complete wrench, independent of face subdivision.
  // With P <= 0 and Q = F²/m + torque²/I, this scale ensures the discrete drag
  // impulse cannot add kinetic energy, even during a fast water entry.
  const q = (result.dragX ** 2 + result.dragY ** 2) * pose.invMass + result.dragTorque ** 2 * pose.invInertia;
  const scale = 1 / (1 + dt * q / Math.max(1e-9, -result.dragPower));
  result.dragX *= scale; result.dragY *= scale; result.dragTorque *= scale; result.dragPower *= scale;
  result.x += result.dragX; result.y += result.dragY; result.torque += result.dragTorque;
  return result;
}
