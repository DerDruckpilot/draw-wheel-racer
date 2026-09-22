export type Point = { x: number; y: number };
export const STROKE_RADIUS = 0.095;
export const MAX_RADIUS = 1.2;
export type ShapeName = 'round' | 'compact' | 'claw' | 'paddle' | 'triangle';
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function preset(name: ShapeName): Point[] {
  if (name === 'compact') return preset('round').map(p => ({ x: p.x * .6, y: p.y * .6 }));
  if (name === 'round') return Array.from({ length: 37 }, (_, i) => ({ x: Math.cos(i / 36 * Math.PI * 2) * 0.82, y: Math.sin(i / 36 * Math.PI * 2) * 0.82 }));
  if (name === 'claw') return Array.from({ length: 29 }, (_, i) => ({ x: Math.cos((i / 28 * 1.65 + 0.175) * Math.PI) * 0.96, y: Math.sin((i / 28 * 1.65 + 0.175) * Math.PI) * 0.96 }));
  if (name === 'triangle') return resample([{ x: 0, y: 1.04 }, { x: -.95, y: -.64 }, { x: .95, y: -.64 }, { x: 0, y: 1.04 }], 37);
  return resample(Array.from({ length: 17 }, (_, i) => {
    const r = i % 2 === 0 ? 1.04 : .34;
    return { x: Math.cos(i / 16 * Math.PI * 2) * r, y: Math.sin(i / 16 * Math.PI * 2) * r };
  }), 41);
}

export function resample(input: Point[], count: number): Point[] {
  if (input.length < 2) return [];
  const lengths = [0];
  for (let i = 1; i < input.length; i++) lengths.push(lengths[i - 1] + Math.hypot(input[i].x - input[i - 1].x, input[i].y - input[i - 1].y));
  const total = lengths.at(-1)!;
  if (total < .24) return [];
  const result: Point[] = [];
  let j = 1;
  for (let i = 0; i < count; i++) {
    const d = total * i / (count - 1);
    while (j < lengths.length - 1 && lengths[j] < d) j++;
    const t = (d - lengths[j - 1]) / Math.max(1e-7, lengths[j] - lengths[j - 1]);
    result.push({ x: input[j - 1].x + (input[j].x - input[j - 1].x) * t, y: input[j - 1].y + (input[j].y - input[j - 1].y) * t });
  }
  return result;
}

export function sanitizeShape(raw: Point[]): Point[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const filtered: Point[] = [];
  for (const p of raw.slice(0, 5000)) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const scale = Math.min(1, MAX_RADIUS / Math.max(.001, Math.hypot(p.x, p.y)));
    const q = { x: p.x * scale, y: p.y * scale };
    const prev = filtered.at(-1);
    if (!prev || Math.hypot(q.x - prev.x, q.y - prev.y) > .025) filtered.push(q);
  }
  let length = 0;
  for (let i = 1; i < filtered.length; i++) length += Math.hypot(filtered[i].x - filtered[i - 1].x, filtered[i].y - filtered[i - 1].y);
  if (length < .35 || length > 22) return null;
  const points = resample(filtered, Math.min(48, Math.max(12, Math.ceil(length / .15))));
  return points.length ? points : null;
}

export function shapeLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}

export function restoreShape(raw: unknown): Point[] | null {
  // Saved strokes are already sampled. Validate them without rounding off
  // their corners again on every launch or PWA update.
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 48) return null;
  if (raw.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.hypot(p.x, p.y) > MAX_RADIUS + 1e-8)) return null;
  const length = shapeLength(raw);
  if (length < .35 || length > 22) return null;
  return raw.map(p => ({ x: p.x, y: p.y }));
}

export function radiusOf(points: Point[]) { return Math.max(...points.map(p => Math.hypot(p.x, p.y))) + STROKE_RADIUS; }
