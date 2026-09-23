import {type Course,type Segment } from './courses';

export const TRACK_FRONT = 3.2;
export const TRACK_BACK = -1.2;

// One driving corridor continues into terrain on both sides. These banks continue
// its exact edge into the surrounding land, well beyond the camera's foreground.
export function bankHeight(x: number, y: number, z: number,halfWidth=2.2) {
  const d = Math.max(0, z - (1+halfWidth), (1-halfWidth) - z), t = Math.min(1, d / 10), blend = t * t * (3 - 2 * t);
  const land = .45 + Math.sin(x * .081 + z * .06) * .18 + Math.cos(x * .17 - z * .09) * .12;
  return y * (1 - blend) + land * blend;
}
export function landscapeData(course: Course, front: boolean) {
  const halfWidth=course.routes?.halfWidth??2.2,edge = course.routes?1+(front ? halfWidth : -halfWidth):front?TRACK_FRONT:TRACK_BACK;
  const bands = front ? [0, 1.2, 3, 6, 10, 18, 32, 64] : [0, 2, 5, 10, 20, 35, 55];
  const segments: Segment[] = [];
  let previous = { x: -100, y: 0 };
  for (const s of course.segments.filter(s=>!course.routes||s.lateral===undefined||Math.abs(s.lateral-(front?7:-7))<.1).sort((a,b)=>a.a.x-b.a.x)) {
    if (s.a.x > previous.x + .001) segments.push({ a: previous, b: s.a, surface: 'stone' });
    segments.push(s); previous = s.b;
  }
  segments.push({ a: previous, b: { x: course.length + 100, y: 0 }, surface: 'stone' });
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const height = (x: number, y: number, d: number) => {
    return bankHeight(x, y, edge + (front ? d : -d),halfWidth);
  };
  const fine = course.expedition ? segments.flatMap(s => {
    const count = Math.max(1, Math.ceil((s.b.x - s.a.x) / 2));
    const at = (t: number) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
    return Array.from({ length: count }, (_, i) => ({ a: at(i / count), b: at((i + 1) / count), surface: s.surface }));
  }) : segments;
  for (const s of fine) for (let j = 1; j < bands.length; j++) {
    const i = positions.length / 3;
    for (const p of [s.a, s.b]) for (const d of [bands[j - 1], bands[j]]) {
      const z = edge + (front ? d : -d);
      positions.push(p.x, height(p.x, p.y, d), z); uvs.push(p.x / 5, z / 5);
    }
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  return { positions, uvs, indices };
}
