export type Point = { x: number; y: number };
export const STROKE_RADIUS = 0.095;
export const MAX_RADIUS = 1.2;
export const MAX_SHAPE_POINTS = 512;
export const MAX_INPUT_POINTS = 32768;
// About a fifth of a CSS pixel on the phone's drawing pad. Corners above
// this tolerance survive; no uniform resampling cuts across them.
export const SHAPE_TOLERANCE = .003;
export const SPOKE_RADIUS = .006;
export type ShapeName = 'round' | 'compact' | 'claw' | 'grip' | 'paddle' | 'triangle';
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function preset(name: ShapeName): Point[] {
  if (name === 'compact') return preset('round').map(p => ({ x: p.x * .6, y: p.y * .6 }));
  if (name === 'round') return Array.from({ length: 73 }, (_, i) => ({ x: Math.cos(i / 72 * Math.PI * 2) * 0.82, y: Math.sin(i / 72 * Math.PI * 2) * 0.82 }));
  if (name === 'claw') return Array.from({ length: 65 }, (_, i) => ({ x: Math.cos((i / 64 * 1.65 + 0.175) * Math.PI) * 0.96, y: Math.sin((i / 64 * 1.65 + 0.175) * Math.PI) * 0.96 }));
  if (name === 'triangle') return [{ x: 0, y: 1.04 }, { x: -.95, y: -.64 }, { x: .95, y: -.64 }, { x: 0, y: 1.04 }];
  if (name === 'grip') return Array.from({ length: 17 }, (_, i) => {
    const r = i % 2 === 0 ? 1.18 : .85;
    return { x: Math.cos(i / 16 * Math.PI * 2) * r, y: Math.sin(i / 16 * Math.PI * 2) * r };
  });
  return Array.from({ length: 17 }, (_, i) => {
    const r = i % 2 === 0 ? 1.04 : .34;
    return { x: Math.cos(i / 16 * Math.PI * 2) * r, y: Math.sin(i / 16 * Math.PI * 2) * r };
  });
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
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_INPUT_POINTS) return null;
  const filtered: Point[] = [];
  for (const p of raw) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    const distance = Math.hypot(p.x, p.y);
    // Keep normalization idempotent at the rim: a rounding error of 1 ulp
    // must not change a worker-prepared contour's cache key on the next mount.
    const scale = distance > MAX_RADIUS + 1e-10 ? MAX_RADIUS / distance : 1;
    const q = { x: p.x * scale, y: p.y * scale };
    const prev = filtered.at(-1);
    if (!prev || Math.hypot(q.x - prev.x, q.y - prev.y) > .0001) filtered.push(q);
  }
  let length = 0;
  for (let i = 1; i < filtered.length; i++) length += Math.hypot(filtered[i].x - filtered[i - 1].x, filtered[i].y - filtered[i - 1].y);
  if (length < .35) return null;
  // Keep the full stroke, including its tail. Only drawings beyond the mobile
  // collider budget get adaptive spatial simplification, never rejection for
  // length or complexity. Ordinary contours retain the original .003 tolerance.
  const result = simplifyStroke(filtered, SHAPE_TOLERANCE, MAX_SHAPE_POINTS);
  return shapeLength(result) >= .35 ? result : null;
}

export function simplifyStroke(points: Point[], tolerance: number, budget = MAX_SHAPE_POINTS): Point[] {
  // Budgeted Ramer-Douglas-Peucker: resolve the largest remaining deviation
  // first. A dense/retraced stroke cannot trigger repeated quadratic passes or
  // collapse to two coincident endpoints when a raised tolerance skips a loop.
  if (points.length < 3) return points.slice();
  const keep = new Set([0, points.length - 1]);
  type Span = { first: number; last: number; index: number; error: number };
  const heap: Span[] = [];
  const add = (first: number, last: number) => {
    const a = points[first], b = points[last];
    const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
    let max = tolerance ** 2, index = -1;
    for (let i = first + 1; i < last; i++) {
      const p = points[i], t = length2 ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length2, 0, 1) : 0;
      const distance2 = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (distance2 > max) { max = distance2; index = i; }
    }
    if (index === -1) return;
    const span = { first, last, index, error: max };
    let i = heap.length; heap.push(span);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].error >= span.error) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = span;
  };
  add(0, points.length - 1);
  while (heap.length && keep.size < budget) {
    const span = heap[0], tail = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].error > heap[child].error) child++;
        if (heap[child].error <= tail.error) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = tail;
    }
    keep.add(span.index);
    if (keep.size < budget) { add(span.first, span.index); add(span.index, span.last); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

export function shapeLength(points: Point[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return length;
}

export function restoreShape(raw: unknown): Point[] | null {
  // Saved strokes are already sampled. Validate them without rounding off
  // their corners again on every launch or PWA update.
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_SHAPE_POINTS) return null;
  if (raw.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.hypot(p.x, p.y) > MAX_RADIUS + 1e-8)) return null;
  const length = shapeLength(raw);
  if (length < .35) return null;
  return raw.map(p => ({ x: p.x, y: p.y }));
}

export function radiusOf(points: Point[]) { return Math.max(...points.map(p => Math.hypot(p.x, p.y))) + STROKE_RADIUS; }

// Radial supports depend on the contour, not drawing speed or retracing a line.
// An open side connects to its nearest extreme instead of closing the opening.
export function spokeTips(shape: Point[]): Point[] {
  return [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }].map(ray => {
    let distance = -1;
    for (let i = 1; i < shape.length; i++) {
      const a = shape[i - 1], b = shape[i], dx = b.x - a.x, dy = b.y - a.y;
      const cross = ray.x * dy - ray.y * dx;
      if (Math.abs(cross) < 1e-10) {
        if (Math.abs(a.x * ray.y - a.y * ray.x) < 1e-10) distance = Math.max(distance, a.x * ray.x + a.y * ray.y, b.x * ray.x + b.y * ray.y);
        continue;
      }
      const along = (a.x * dy - a.y * dx) / cross, t = (a.x * ray.y - a.y * ray.x) / cross;
      if (along >= 0 && t >= -1e-9 && t <= 1 + 1e-9) distance = Math.max(distance, along);
    }
    if (distance >= 0) return { x: ray.x * distance, y: ray.y * distance };
    return shape.reduce((best, p) => p.x * ray.x + p.y * ray.y > best.x * ray.x + best.y * ray.y ? p : best);
  });
}
