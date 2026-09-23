import type { Point, ShapeName } from './shapes';
export type Surface = 'stone' | 'ice' | 'mud' | 'road' | 'wood';
export type Feature = 'flat' | 'rocks' | 'steps' | 'ramp' | 'gap' | 'ford' | 'lake' | 'ice' | 'mud' | 'seesaw' | 'logs' | 'tunnel'
  | 'washboard' | 'trenches' | 'rollers' | 'domes' | 'sawtooth' | 'rocking' | 'crawl' | 'causeway' | 'iceclimb';
export type Theme = 'canyon' | 'alpine' | 'quarry';
export interface Segment { a: Point; b: Point; surface: Surface }
export interface Zone { start: number; end: number; kind: Feature; label: string }
export interface Water { start: number; end: number; level: number; deep: boolean }
export interface Obstacle { x: number; y: number; width: number; height: number; kind: 'beam' | 'log' | 'ceiling' | 'roller'; tilt?: number }
export interface Course { id: number; name: string; subtitle: string; theme: Theme; difficulty: number; features: Feature[]; segments: Segment[]; waters: Water[]; zones: Zone[]; obstacles: Obstacle[]; checkpoints: number[]; length: number }
const specs: [string, string, Feature[]][] = [
  ['Erste Spuren', 'Groß, klein, paddeln: Wechsle deine Form.', ['flat', 'steps', 'tunnel', 'ford', 'lake', 'washboard']],
  ['Rote Klippen', 'Kanten brauchen Charakter.', ['domes', 'steps', 'ramp', 'trenches', 'gap', 'lake']],
  ['Tiefenwasser', 'Inseln, Untiefen und offene See.', ['washboard', 'ford', 'lake', 'causeway', 'crawl', 'domes']],
  ['Canyon-Expedition', 'Jenseits der vertrauten Wege.', ['sawtooth', 'trenches', 'lake', 'rocking', 'rocks', 'crawl']],
  ['Frostlinie', 'Rutschen ist leicht. Hochkommen nicht.', ['ice', 'iceclimb', 'crawl', 'domes', 'ford', 'lake']],
  ['Gletschersee', 'Vom Eis zwischen die Inseln.', ['washboard', 'ice', 'lake', 'causeway', 'rocking', 'iceclimb']],
  ['Eiskante', 'Präzision vor Geschwindigkeit.', ['trenches', 'iceclimb', 'gap', 'rollers', 'lake', 'crawl']],
  ['Nordpass', 'Jeder Meter zählt.', ['ice', 'steps', 'lake', 'sawtooth', 'crawl', 'rocking', 'iceclimb']],
  ['Schotterwerk', 'Die Walzen drehen mit.', ['rocks', 'rollers', 'mud', 'trenches', 'tunnel', 'causeway', 'lake']],
  ['Balanceakt', 'Ein Brett nach dem anderen.', ['domes', 'rocking', 'crawl', 'lake', 'rollers', 'seesaw', 'sawtooth']],
  ['Flutgrube', 'Versunkene Wege und enge Passagen.', ['mud', 'lake', 'causeway', 'crawl', 'logs', 'trenches', 'rocking']],
  ['Die letzte Etappe', 'Alles, was du gelernt hast.', ['sawtooth', 'iceclimb', 'rollers', 'lake', 'trenches', 'rocking', 'crawl', 'ramp']]
];
const labels: Record<Feature, string> = { flat: 'FESTER BODEN', rocks: 'FELSPASSAGE', steps: 'STUFEN', ramp: 'STEIGUNG', gap: 'SPRUNG', ford: 'FURT', lake: 'TIEFES WASSER', ice: 'GLATTEIS', mud: 'SCHLAMM', seesaw: 'WIPPE', logs: 'BAUMSTÄMME', tunnel: 'DURCHFAHRT', washboard: 'WASCHBRETT', trenches: 'QUERGRÄBEN', rollers: 'FREILAUFWALZEN', domes: 'WELLENHÜGEL', sawtooth: 'SÄGEZAHNFELSEN', rocking: 'KIPPPLATTEN', crawl: 'FELSTOR', causeway: 'VERSUNKENER STEG', iceclimb: 'EISANSTIEG' };
export const surfaceFriction: Record<Surface, number> = { stone: 1.15, road: 1.05, ice: .018, mud: .65, wood: .85 };

export function createCourse(id: number): Course {
  const test = id === 12;
  const spec = test ? ['Testgelände', 'Alle 21 Untergründe und Hindernisse.', Object.keys(labels) as Feature[]] as [string, string, Feature[]] : specs[Math.max(0, Math.min(11, id))];
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
    if (f === 'flat' || f === 'mud') {
      line(20, [{ x: 0, y: 0 }, { x: 5, y: -.1 }, { x: 11, y: -.1 }, { x: 20, y: 0 }], f === 'mud' ? 'mud' : 'road');
    } else if (f === 'ice') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 7, y: -.8 }, { x: 18, y: -.8 }];
      for (let j = 0; j < 5; j++) profile.push({ x: 19.5 + j * 1.7, y: -.8 + j * .16 }, { x: 19.7 + j * 1.7, y: -.8 + (j + 1) * .16 });
      profile.push({ x: 28, y: 0 }); line(28, profile, 'ice');
    } else if (f === 'iceclimb') {
      // Frozen ledges give protrusions something to bear against. There is no
      // shape-dependent friction bonus: the very low ice friction applies to all.
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
      for (let i = 0; i < 12; i++) profile.push({ x: 4 + i * 1.3 + 1.08, y: i * .38 }, { x: 4 + (i + 1) * 1.3, y: (i + 1) * .38 });
      profile.push({ x: 24, y: 4.56 }, { x: 36, y: 0 });
      line(36, profile, 'ice');
    } else if (f === 'rocks') {
      line(18, Array.from({ length: 19 }, (_, i) => ({ x: i, y: i === 0 || i === 18 ? 0 : Math.sin(i * 2.31 + id) * (.2 + c.difficulty * .025) + .24 })));
    } else if (f === 'steps') {
      const h = .84 + c.difficulty * .015;
      line(16, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: h }, { x: 5, y: h }, { x: 5, y: h * 2 }, { x: 7, y: h * 2 }, { x: 7, y: h * 3 }, { x: 10, y: h * 3 }, { x: 16, y: 0 }]);
    } else if (f === 'ramp') {
      // A steep ribbed ascent: a smooth rim loses purchase; protrusions can
      // bear against the risers. The normal contact forces provide the grip.
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
      for (let i = 0; i < 8; i++) profile.push({ x: 4 + i + .7, y: i * .54 }, { x: 5 + i, y: (i + 1) * .54 });
      profile.push({ x: 15, y: 4.32 }, { x: 22, y: 0 });
      line(22, profile);
    } else if (f === 'gap') {
      line(21, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 7, y: 1.35 }, { x: 10, y: 1.35 }, { x: 12.1, y: -.3 }, { x: 16, y: -.3 }, { x: 21, y: 0 }], 'stone', [4]);
    } else if (f === 'ford' || f === 'lake') {
      const deep = f === 'lake';
      const depth = deep ? 3.4 : .92 + c.difficulty * .05;
      const len = deep ? 42 + c.difficulty * 2 : 24;
      const shore = deep ? 11 : 8;
      line(len, [{ x: 0, y: 0 }, { x: 3, y: -.1 }, { x: shore, y: -depth }, { x: len - shore, y: -depth }, { x: len - 3, y: -.1 }, { x: len, y: 0 }]);
      c.waters.push({ start: start + 3, end: start + len - 3, level: -.1, deep });
    } else if (f === 'washboard') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      for (let j = 0; j < 20; j++) profile.push({ x: 3.3 + j * .7, y: .17 + (j % 3) * .025 }, { x: 3.65 + j * .7, y: 0 });
      profile.push({ x: 20, y: 0 }); line(20, profile);
    } else if (f === 'trenches') {
      const profile: Point[] = [{ x: 0, y: 0 }];
      for (let j = 0; j < 4; j++) {
        const a = 4 + j * 4, width = 1.15 + j * .12;
        profile.push({ x: a, y: 0 }, { x: a, y: -1.15 }, { x: a + width, y: -1.15 }, { x: a + width, y: 0 });
      }
      profile.push({ x: 23, y: 0 }); line(23, profile);
    } else if (f === 'domes') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      for (let j = 0; j < 3; j++) for (let k = 1; k <= 16; k++) {
        profile.push({ x: 3 + j * 5 + k * 5 / 16, y: Math.sin(k / 16 * Math.PI) ** 2 * (1.15 + j * .32) });
      }
      profile.push({ x: 22, y: 0 }); line(22, profile);
    } else if (f === 'sawtooth') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      for (let j = 0; j < 5; j++) {
        const a = 3 + j * 3.4, h = .65 + (j % 3) * .14;
        profile.push({ x: a + .22, y: h }, { x: a + 1, y: h }, { x: a + 3.4, y: 0 });
      }
      profile.push({ x: 24, y: 0 }); line(24, profile);
    } else if (f === 'rollers') {
      line(22, [{ x: 0, y: 0 }, { x: 22, y: 0 }]);
      for (let j = 0; j < 6; j++) c.obstacles.push({ x: start + 5 + j * 2.25, y: .13, width: 1.25, height: 1.25, kind: 'roller' });
    } else if (f === 'rocking') {
      line(22, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4, y: -.9 }, { x: 18, y: -.9 }, { x: 19, y: 0 }, { x: 22, y: 0 }]);
      for (let j = 0; j < 3; j++) c.obstacles.push({ x: start + 6 + j * 4.5, y: .12, width: 4.3, height: .2, kind: 'beam', tilt: .22 });
    } else if (f === 'causeway') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: -.1 }, { x: 7, y: -1.35 }];
      for (let j = 0; j < 4; j++) {
        const a = 8 + j * 4;
        profile.push({ x: a, y: -1.35 }, { x: a + .35, y: -.28 }, { x: a + 2, y: -.28 }, { x: a + 2.35, y: -1.35 });
      }
      profile.push({ x: 25, y: -1.35 }, { x: 29, y: -.1 }, { x: 32, y: 0 }); line(32, profile);
      c.waters.push({ start: start + 3, end: start + 29, level: -.1, deep: false });
    } else if (f === 'crawl') {
      line(22, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 7, y: .12 }, { x: 9, y: 0 }, { x: 11, y: .1 }, { x: 13, y: 0 }, { x: 22, y: 0 }]);
      c.obstacles.push({ x: start + 10, y: 2.13, width: 12, height: .4, kind: 'ceiling' });
    } else if (f === 'seesaw') {
      line(18, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: -1.1 }, { x: 14, y: -1.1 }, { x: 16, y: 0 }, { x: 18, y: 0 }]);
      c.obstacles.push({ x: start + 9.5, y: .08, width: 9, height: .18, kind: 'beam' });
    } else if (f === 'logs') {
      line(19, [{ x: 0, y: 0 }, { x: 19, y: 0 }]);
      for (let j = 0; j < 3; j++) c.obstacles.push({ x: start + 5 + j * 3.5, y: .26, width: .76 + c.difficulty * .04, height: .76 + c.difficulty * .04, kind: 'log' });
    } else if (f === 'tunnel') {
      line(17, [{ x: 0, y: 0 }, { x: 17, y: 0 }]);
      c.obstacles.push({ x: start + 8.5, y: 2.01, width: 8, height: .4, kind: 'ceiling' });
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
// Opponents use the same geometry and motors as the player. This is only their
// drawing strategy; contact forces never inspect a preset name or zone label.
export function suggestedShape(zone: Zone | undefined, x: number): ShapeName {
  if (!zone) return 'round';
  if (zone.kind === 'tunnel' || zone.kind === 'crawl') return 'compact';
  if (['steps', 'ramp', 'logs', 'trenches', 'rollers', 'sawtooth', 'causeway', 'iceclimb'].includes(zone.kind)) return 'grip';
  if (zone.kind === 'lake' && x < zone.end - 4.5) return 'paddle';
  return 'round';
}
export const courseList = Array.from({ length: 13 }, (_, i) => createCourse(i));
