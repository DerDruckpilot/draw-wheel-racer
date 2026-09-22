import type { Point } from './shapes';
export type Surface = 'stone' | 'ice' | 'mud' | 'road' | 'wood';
export type Feature = 'flat' | 'rocks' | 'steps' | 'ramp' | 'gap' | 'ford' | 'lake' | 'ice' | 'mud' | 'seesaw' | 'logs' | 'tunnel';
export type Theme = 'canyon' | 'alpine' | 'quarry';
export interface Segment { a: Point; b: Point; surface: Surface }
export interface Zone { start: number; end: number; kind: Feature; label: string }
export interface Water { start: number; end: number; level: number; deep: boolean }
export interface Obstacle { x: number; y: number; width: number; height: number; kind: 'beam' | 'log' | 'ceiling' }
export interface Course { id: number; name: string; subtitle: string; theme: Theme; difficulty: number; features: Feature[]; segments: Segment[]; waters: Water[]; zones: Zone[]; obstacles: Obstacle[]; checkpoints: number[]; length: number }
const specs: [string, string, Feature[]][] = [
  ['Erste Spuren', 'Finde deinen Rhythmus.', ['flat', 'rocks', 'ramp', 'ford', 'steps', 'flat']],
  ['Rote Klippen', 'Kanten brauchen Charakter.', ['rocks', 'steps', 'ramp', 'gap', 'ford', 'rocks']],
  ['Tiefenwasser', 'Aus Rädern werden Paddel.', ['ramp', 'ford', 'lake', 'steps', 'lake', 'flat']],
  ['Canyon-Expedition', 'Deine Form. Dein Weg.', ['steps', 'gap', 'lake', 'seesaw', 'rocks', 'tunnel']],
  ['Frostlinie', 'Wenig Halt. Viel Gefühl.', ['flat', 'ice', 'ramp', 'ice', 'ford', 'steps']],
  ['Gletschersee', 'Kalt wird es unter den Rädern.', ['ice', 'ford', 'lake', 'ice', 'ramp', 'rocks']],
  ['Eiskante', 'Präzision vor Geschwindigkeit.', ['steps', 'ice', 'gap', 'seesaw', 'lake', 'tunnel']],
  ['Nordpass', 'Jeder Meter zählt.', ['ice', 'steps', 'lake', 'gap', 'rocks', 'seesaw', 'ice']],
  ['Schotterwerk', 'Über Stock und Stein.', ['rocks', 'logs', 'mud', 'ramp', 'ford', 'flat']],
  ['Balanceakt', 'Bleib in Bewegung.', ['seesaw', 'logs', 'tunnel', 'lake', 'steps', 'seesaw']],
  ['Flutgrube', 'Land und Wasser im Wechsel.', ['mud', 'lake', 'logs', 'ford', 'gap', 'seesaw']],
  ['Die letzte Etappe', 'Alles, was du gelernt hast.', ['steps', 'ice', 'gap', 'lake', 'mud', 'logs', 'seesaw', 'tunnel']]
];
const labels: Record<Feature, string> = { flat: 'FESTER BODEN', rocks: 'FELSPASSAGE', steps: 'STUFEN', ramp: 'STEIGUNG', gap: 'SPRUNG', ford: 'FURT', lake: 'TIEFES WASSER', ice: 'EIS', mud: 'SCHLAMM', seesaw: 'WIPPE', logs: 'BAUMSTÄMME', tunnel: 'DURCHFAHRT' };
export const surfaceFriction: Record<Surface, number> = { stone: 1.15, road: 1.05, ice: .065, mud: .65, wood: .85 };

export function createCourse(id: number): Course {
  const test = id === 12;
  const spec = test ? ['Testgelände', 'Zeit zum Experimentieren.', ['flat', 'steps', 'ramp', 'ice', 'ford', 'lake', 'mud', 'seesaw', 'logs', 'gap', 'tunnel']] as [string, string, Feature[]] : specs[Math.max(0, Math.min(11, id))];
  const theme: Theme = test || id < 4 ? 'canyon' : id < 8 ? 'alpine' : 'quarry';
  const c: Course = { id, name: spec[0], subtitle: spec[1], features: spec[2], theme, difficulty: test ? 1 : id % 4 + 1, segments: [], waters: [], zones: [], obstacles: [], checkpoints: [2], length: 0 };
  let x = -12;
  const line = (length: number, profile: Point[], surface: Surface = 'stone', gaps: number[] = []) => {
    for (let i = 1; i < profile.length; i++) if (!gaps.includes(i)) c.segments.push({ a: { x: x + profile[i - 1].x, y: profile[i - 1].y }, b: { x: x + profile[i].x, y: profile[i].y }, surface });
    x += length;
  };
  line(24, [{ x: 0, y: 0 }, { x: 24, y: 0 }], 'road');
  for (let idx = 0; idx < spec[2].length; idx++) {
    const f = spec[2][idx];
    const start = x;
    c.checkpoints.push(start - 2);
    if (f === 'flat' || f === 'ice' || f === 'mud') {
      const surface = f === 'ice' ? 'ice' : f === 'mud' ? 'mud' : 'road';
      line(20, [{ x: 0, y: 0 }, { x: 5, y: -.1 }, { x: 11, y: f === 'ice' ? .4 : -.1 }, { x: 20, y: 0 }], surface);
    } else if (f === 'rocks') {
      line(18, Array.from({ length: 19 }, (_, i) => ({ x: i, y: i === 0 || i === 18 ? 0 : Math.sin(i * 2.31 + id) * .14 + .15 })));
    } else if (f === 'steps') {
      const h = .27 + c.difficulty * .035;
      line(16, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: h }, { x: 5, y: h }, { x: 5, y: h * 2 }, { x: 7, y: h * 2 }, { x: 7, y: h * 3 }, { x: 10, y: h * 3 }, { x: 16, y: 0 }]);
    } else if (f === 'ramp') {
      line(22, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 12, y: 2.2 }, { x: 15, y: 2.2 }, { x: 22, y: 0 }]);
    } else if (f === 'gap') {
      line(19, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 1.35 }, { x: 8, y: 1.35 }, { x: 10.1, y: -.3 }, { x: 14, y: -.3 }, { x: 19, y: 0 }], 'stone', [4]);
    } else if (f === 'ford' || f === 'lake') {
      const deep = f === 'lake';
      const depth = deep ? 3.4 : .58;
      const len = deep ? 38 : 19;
      const shore = deep ? 11 : 7;
      line(len, [{ x: 0, y: 0 }, { x: 3, y: -.1 }, { x: shore, y: -depth }, { x: len - shore, y: -depth }, { x: len - 3, y: -.1 }, { x: len, y: 0 }]);
      c.waters.push({ start: start + 3, end: start + len - 3, level: -.1, deep });
    } else if (f === 'seesaw') {
      line(18, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: -1.1 }, { x: 14, y: -1.1 }, { x: 16, y: 0 }, { x: 18, y: 0 }]);
      c.obstacles.push({ x: start + 9.5, y: .08, width: 9, height: .18, kind: 'beam' });
    } else if (f === 'logs') {
      line(19, [{ x: 0, y: 0 }, { x: 19, y: 0 }]);
      for (let j = 0; j < 3; j++) c.obstacles.push({ x: start + 5 + j * 3.5, y: .18, width: .55, height: .55, kind: 'log' });
    } else {
      line(17, [{ x: 0, y: 0 }, { x: 17, y: 0 }]);
      c.obstacles.push({ x: start + 8, y: 2.65, width: 5, height: .4, kind: 'ceiling' });
    }
    c.zones.push({ start, end: x, kind: f, label: labels[f] });
    line(6, [{ x: 0, y: 0 }, { x: 6, y: 0 }], 'road');
  }
  c.length = x + 8;
  line(28, [{ x: 0, y: 0 }, { x: 28, y: 0 }], 'road');
  return c;
}

export function groundAt(c: Course, x: number): number {
  let y = -12;
  for (const s of c.segments) {
    if (x >= s.a.x - .001 && x <= s.b.x + .001) {
      const t = (x - s.a.x) / Math.max(.001, s.b.x - s.a.x);
      y = Math.max(y, s.a.y + (s.b.y - s.a.y) * t);
    }
  }
  return y;
}

export function zoneAt(c: Course, x: number) { return c.zones.find(z => x >= z.start && x < z.end); }
export const courseList = Array.from({ length: 13 }, (_, i) => createCourse(i));
