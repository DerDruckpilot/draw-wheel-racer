import type { Course } from './courses';

/** Arc-length path for the landscape. Physics still uses distance/height.
 * All terrain, obstacles, vehicles and water share this same spatial mapping. */
export class RouteLayout {
  private samples: { x: number; z: number; dx: number; dz: number }[] = [];
  private start = -120;
  private step = 2;
  constructor(private course: Course) {
    let x = 0, z = 0;
    for (let s = this.start; s <= course.length + 164; s += this.step) {
      const a = this.angle(s);
      this.samples.push({ x, z, dx: Math.cos(a), dz: Math.sin(a) });
      const mid = this.angle(s + this.step / 2); x += Math.cos(mid) * this.step; z += Math.sin(mid) * this.step;
    }
    const origin = this.samples[-this.start / this.step];
    const ox = origin.x, oz = origin.z;
    for (const p of this.samples) { p.x -= ox; p.z -= oz; }
  }
  private angle(s: number) {
    if (!this.course.expedition) return 0;
    const phase = this.course.id * .63;
    return .96 * Math.sin(s * .014 + phase) + .28 * Math.sin(s * .031 - phase * .7);
  }
  point(s: number, lateral = 0) {
    if (!this.course.expedition) return { x: s, z: lateral, yaw: 0 };
    // Far scenery compresses outside the playable area so tight landscape
    // bends cannot fold the distant bank mesh back through the road.
    if(Math.abs(lateral)>15)lateral=Math.sign(lateral)*(15+24*(1-Math.exp(-(Math.abs(lateral)-15)/24)));
    const u = (s - this.start) / this.step;
    const i = Math.max(0, Math.min(this.samples.length - 2, Math.floor(u))), t = Math.max(0, Math.min(1, u - i));
    const a = this.samples[i], b = this.samples[i + 1], t2 = t * t, t3 = t2 * t;
    const h0 = 2 * t3 - 3 * t2 + 1, h1 = t3 - 2 * t2 + t, h2 = -2 * t3 + 3 * t2, h3 = t3 - t2;
    const x = h0 * a.x + h1 * this.step * a.dx + h2 * b.x + h3 * this.step * b.dx;
    const z = h0 * a.z + h1 * this.step * a.dz + h2 * b.z + h3 * this.step * b.dz;
    const angle = this.angle(s);
    return { x: x - lateral * Math.sin(angle), z: z + lateral * Math.cos(angle), yaw: -angle };
  }
}
