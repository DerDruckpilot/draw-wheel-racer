import {waterHeight} from './waves';
import {fluidVelocity} from './hydrodynamics';
import type { HydroShape } from './hydrodynamics';
import type { Water } from './courses';
import type { Point } from './shapes';

export interface SplashPose { position: Point; center: Point; angle: number; velocity: Point; omega: number }
export interface SplashActivity { energy: number; x: number; vx: number; vy: number }

// Only original, welded wet edges contribute. Retracing the drawing or adding
// samples cannot create extra spray. Tangential motion of a ring is almost silent;
// broadside edges of a bar/paddle transfer much more momentum to the water.
export function splashActivity(shapes: HydroShape[], pose: SplashPose, water: Water): SplashActivity {
  const co = Math.cos(pose.angle), si = Math.sin(pose.angle);
  let energy = 0, x = 0, vx = 0, vy = 0;
  const world = (p: Point) => ({ x: pose.position.x + p.x * co - p.y * si, y: pose.position.y + p.x * si + p.y * co });
  for (const shape of shapes) for (const ring of shape.rings) for (let i = 0; i < ring.length; i++) {
    const a = world(ring[i]), b = world(ring[(i + 1) % ring.length]);
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < 1e-8) continue;
    let lo = 0, hi = 1;
    // Clip the edge to a narrow surface layer and to the pool's actual extent.
    for (const [origin, delta, min, max] of [[a.y, dy, waterHeight(water,(a.x+b.x)/2) - .55, waterHeight(water,(a.x+b.x)/2) + .025], [a.x, dx, water.start, water.end]]) {
      if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) hi = -1; }
      else { const t0 = (min - origin) / delta, t1 = (max - origin) / delta; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
    }
    if (hi <= lo) continue;
    const t = (hi + lo) / 2, px = a.x + dx * t, py = a.y + dy * t;
    const flow=fluidVelocity(water,px,py);
    const ux = pose.velocity.x-flow.x - pose.omega * (py - pose.center.y), uy = pose.velocity.y-flow.y + pose.omega * (px - pose.center.x);
    const normalSpeed = Math.max(0, (ux * dy - uy * dx) / length);
    const work = normalSpeed ** 3 * length * (hi - lo) * shape.width;
    energy += work; x += px * work; vx += ux * work; vy += uy * work;
  }
  return energy > 1e-8 ? { energy, x: x / energy, vx: vx / energy, vy: vy / energy } : { energy: 0, x: pose.position.x, vx: 0, vy: 0 };
}
