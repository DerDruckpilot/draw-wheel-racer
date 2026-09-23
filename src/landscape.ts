import type { Course, Segment } from './courses';

export const TRACK_FRONT = 3.2;
export const TRACK_BACK = -11;

// The collision course remains in the four marked lanes. These banks continue
// its exact edge into the surrounding land, well beyond the camera's foreground.
export function landscapeData(course: Course, front: boolean) {
  const edge = front ? TRACK_FRONT : TRACK_BACK;
  const bands = front ? [0, 1.2, 3, 6, 10, 18, 32, 64] : [0, 2, 5, 10, 20, 35];
  const segments: Segment[] = [];
  let previous = { x: -100, y: 0 };
  for (const s of course.segments) {
    if (s.a.x > previous.x + .001) segments.push({ a: previous, b: s.a, surface: 'stone' });
    segments.push(s); previous = s.b;
  }
  segments.push({ a: previous, b: { x: course.length + 100, y: 0 }, surface: 'stone' });
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const height = (x: number, y: number, d: number) => {
    const t = Math.min(1, d / 10), blend = t * t * (3 - 2 * t);
    const z = edge + (front ? d : -d);
    const land = .45 + Math.sin(x * .081 + z * .06) * .18 + Math.cos(x * .17 - z * .09) * .12;
    return y * (1 - blend) + land * blend;
  };
  for (const s of segments) for (let j = 1; j < bands.length; j++) {
    const i = positions.length / 3;
    for (const p of [s.a, s.b]) for (const d of [bands[j - 1], bands[j]]) {
      const z = edge + (front ? d : -d);
      positions.push(p.x, height(p.x, p.y, d), z); uvs.push(p.x / 5, z / 5);
    }
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  return { positions, uvs, indices };
}
