import type { Point, ShapeName } from './shapes';
export type Surface = 'stone' | 'ice' | 'mud' | 'road' | 'wood';
export type Feature = 'flat' | 'rocks' | 'steps' | 'ramp' | 'gap' | 'ford' | 'lake' | 'ice' | 'mud' | 'seesaw' | 'logs' | 'tunnel'
  | 'washboard' | 'trenches' | 'rollers' | 'domes' | 'sawtooth' | 'rocking' | 'crawl' | 'causeway' | 'iceclimb'
  | 'ridge' | 'grotto' | 'floodpass' | 'ravine';
export type Theme = 'canyon' | 'alpine' | 'quarry';
export interface Segment { a: Point; b: Point; surface: Surface }
export interface Zone { start: number; end: number; kind: Feature; label: string }
export interface Water { start: number; end: number; level: number; deep: boolean }
export type Structure = 'bridge' | 'arch' | 'cave';
export interface Obstacle { x: number; y: number; width: number; height: number; kind: 'beam' | 'log' | 'ceiling' | 'roller' | 'boulder'; tilt?: number; lane?: number; outline?: Point[]; structure?: Structure }
export interface Course { id: number; name: string; subtitle: string; theme: Theme; difficulty: number; features: Feature[]; segments: Segment[]; waters: Water[]; zones: Zone[]; obstacles: Obstacle[]; checkpoints: number[]; length: number; expedition?: boolean; caches?: Point[] }
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
const expeditionSpecs: [string, string, Feature[]][] = [
  ['Zum Basislager', 'Fahren, formen, ankommen.', ['domes', 'steps', 'tunnel', 'ford']],
  ['Der Höhenweg', 'Erst hinauf. Dann kontrolliert hinunter.', ['ridge', 'crawl', 'trenches', 'gap']],
  ['Die versunkene Schlucht', 'Vom tiefen Wasser auf die Felsen.', ['ford', 'floodpass', 'lake', 'grotto']],
  ['Durch den Canyon', 'Abgründe, Felstore und versunkene Wege.', ['ravine', 'grotto', 'floodpass', 'rocking']],
  ['Frostspur', 'Schwung bewahren, Halt finden.', ['ice', 'iceclimb', 'grotto', 'ford']],
  ['Zwischen Eis und Wasser', 'Klettern, paddeln, balancieren.', ['iceclimb', 'floodpass', 'rocking', 'crawl']],
  ['Die Bruchkante', 'Jede Landung bereitet den nächsten Aufstieg vor.', ['ridge', 'ravine', 'iceclimb', 'tunnel']],
  ['Über den Nordpass', 'Vier Prüfungen bis zum sicheren Lager.', ['iceclimb', 'grotto', 'floodpass', 'ravine']],
  ['Der alte Werkpfad', 'Bewegliche Auflagen und enge Felsgänge.', ['rollers', 'mud', 'grotto', 'rocking', 'trenches']],
  ['Am Sägewerk', 'Über Holz, Wasser und den langen Grat.', ['logs', 'rocking', 'ford', 'ridge', 'crawl']],
  ['Die Flutgrube', 'Die Ausfahrt muss erst verdient werden.', ['mud', 'floodpass', 'rollers', 'grotto', 'ravine']],
  ['Das letzte Lager', 'Deine längste Expedition.', ['ridge', 'grotto', 'iceclimb', 'floodpass', 'ravine', 'rocking']]
];
const labels: Record<Feature, string> = { flat: 'FESTER BODEN', rocks: 'FELSPASSAGE', steps: 'STUFEN', ramp: 'STEIGUNG', gap: 'SPRUNG', ford: 'FURT', lake: 'TIEFES WASSER', ice: 'GLATTEIS', mud: 'SCHLAMM', seesaw: 'WIPPE', logs: 'BAUMSTÄMME', tunnel: 'DURCHFAHRT', washboard: 'WASCHBRETT', trenches: 'QUERGRÄBEN', rollers: 'FREILAUFWALZEN', domes: 'WELLENHÜGEL', sawtooth: 'SÄGEZAHNFELSEN', rocking: 'KIPPPLATTEN', crawl: 'FELSTOR', causeway: 'VERSUNKENER STEG', iceclimb: 'EISANSTIEG', ridge: 'FELSGRAT', grotto: 'FELSGANG', floodpass: 'FLUTPASSAGE', ravine: 'SCHLUCHT' };
export const surfaceFriction: Record<Surface, number> = { stone: 1.15, road: 1.05, ice: .018, mud: .65, wood: .85 };

export function createCourse(id: number, expedition = false): Course {
  const test = id === 12;
  const features = (Object.keys(labels) as Feature[]).filter(f => expedition || !['ridge', 'grotto', 'floodpass', 'ravine'].includes(f));
  const spec = test ? ['Testgelände', `Alle ${features.length} Untergründe und Hindernisse.`, features] as [string, string, Feature[]] : (expedition ? expeditionSpecs : specs)[Math.max(0, Math.min(11, id))];
  const theme: Theme = test || id < 4 ? 'canyon' : id < 8 ? 'alpine' : 'quarry';
  const c: Course = { id, name: spec[0], subtitle: spec[1], features: spec[2], theme, difficulty: test ? 1 : id % 4 + 1, segments: [], waters: [], zones: [], obstacles: [], checkpoints: [2], length: 0 };
  if (expedition) { c.expedition = true; c.caches = []; }
  let x = -12;
  const line = (length: number, profile: Point[], surface: Surface = 'stone', gaps: number[] = []) => {
    for (let i = 1; i < profile.length; i++) {
      const a = { x: x + profile[i - 1].x, y: profile[i - 1].y }, b = { x: x + profile[i].x, y: profile[i].y };
      if (!gaps.includes(i)) c.segments.push({ a, b, surface });
      else if (expedition) {
        // Authored jumps are actual ravines, not missing triangles showing sky.
        const bottom = Math.min(a.y, b.y) - 4.2;
        const left = { x: a.x + .16, y: bottom }, right = { x: b.x - .19, y: bottom + .16 };
        c.segments.push({ a, b: left, surface }, { a: left, b: right, surface }, { a: right, b, surface });
      }
    }
    x += length;
  };
  line(24, [{ x: 0, y: 0 }, { x: 24, y: 0 }], 'road');
  for (let idx = 0; idx < spec[2].length; idx++) {
    const f = spec[2][idx];
    const start = x;
    const zoneCount = c.zones.length;
    let seed = 5371 + id * 8191 + idx * 131;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    c.checkpoints.push(start - 2);
    if (f === 'ridge') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      let top = 0;
      for (let j = 0; j < 9; j++) {
        const at = 3 + j * 1.55;
        profile.push({ x: at + 1.13 + random() * .12, y: top }); top += .53 + random() * .12;
        profile.push({ x: at + 1.55, y: top });
      }
      profile.push({ x: 20, y: top }, { x: 24, y: top - .8 }, { x: 28, y: top - 2.9 }, { x: 31, y: top - 3.1 }, { x: 36, y: .5 }, { x: 40, y: 0 });
      line(40, profile);
      c.zones.push({ start, end: start + 21, kind: 'ramp', label: 'AUF DEN FELSGRAT' }, { start: start + 21, end: x, kind: 'ridge', label: 'ABFAHRT AM GRAT' });
    } else if (f === 'grotto') {
      // One uninterrupted puzzle: climb to an elevated ledge, fit under its
      // roof, then descend. Only its entrance has a recovery checkpoint.
      line(38, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4.12, y: .62 }, { x: 7, y: .62 }, { x: 7.16, y: 1.23 }, { x: 10.6, y: 1.23 }, { x: 10.73, y: 1.85 }, { x: 17, y: 1.85 }, { x: 20, y: 1.92 }, { x: 23, y: 1.85 }, { x: 29.5, y: 1.85 }, { x: 33, y: .8 }, { x: 38, y: 0 }]);
      c.obstacles.push({ x: start + 22, y: 4.06, width: 10, height: .4, kind: 'ceiling' });
      c.zones.push({ start, end: start + 15, kind: 'steps', label: 'AUFSTIEG ZUM FELSGANG' }, { start: start + 15, end: start + 31, kind: 'tunnel', label: 'ENGER FELSGANG' }, { start: start + 31, end: x, kind: 'ridge', label: 'AUSSTIEG AM FELS' });
    } else if (f === 'floodpass') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: -.1 }, { x: 10, y: -3.4 }, { x: 16, y: -3.4 }, { x: 20, y: -1.35 }];
      for (let j = 0; j < 4; j++) {
        const at = 21 + j * 4.8, top = -.25 - random() * .15;
        profile.push({ x: at, y: -1.35 }, { x: at + .32, y: top }, { x: at + 1.8 + random() * .5, y: top + .06 }, { x: at + 2.8, y: -1.35 });
      }
      profile.push({ x: 42, y: -1.35 }, { x: 47, y: -.1 }, { x: 50, y: 0 }); line(50, profile);
      c.waters.push({ start: start + 3, end: start + 47, level: -.1, deep: true });
      c.zones.push({ start, end: start + 21, kind: 'lake', label: 'DIE VERSUNKENE SCHLUCHT' }, { start: start + 21, end: x, kind: 'causeway', label: 'INSELN IM FLUTPASS' });
    } else if (f === 'ravine') {
      line(42, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 5, y: .4 }, { x: 5.2, y: .85 }, { x: 7.2, y: 1.15 }, { x: 7.4, y: 1.65 }, { x: 9.8, y: 2.1 }, { x: 10, y: 2.65 }, { x: 13, y: 2.65 }, { x: 17.7, y: .4 }, { x: 19, y: .4 }, { x: 21, y: -.6 }, { x: 24, y: -.6 }, { x: 26, y: -.6 }, { x: 26.25, y: .08 }, { x: 28.2, y: .08 }, { x: 28.45, y: .8 }, { x: 30.4, y: .8 }, { x: 30.65, y: 1.5 }, { x: 34, y: 1.5 }, { x: 42, y: 0 }], 'stone', [11]);
      c.zones.push({ start, end: start + 14, kind: 'ramp', label: 'ÜBER DIE SCHLUCHTKANTE' }, { start: start + 14, end: start + 24, kind: 'ravine', label: 'HINAB IN DIE SCHLUCHT' }, { start: start + 24, end: x, kind: 'steps', label: 'STUFEN AUS DER SCHLUCHT' });
    } else if (f === 'flat' || f === 'mud') {
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
      const profile = Array.from({ length: 19 }, (_, i) => ({ x: i, y: i === 0 || i === 18 ? 0 : (random() - .3) * .2 }));
      line(18, profile);
      for (let lane = 0; lane < 4; lane++) for (let j = 0; j < 6; j++) {
        const at = start + 3 + j * 2.25 + random() * .7, width = .9 + random() * 1.2, height = .35 + random() * .47;
        const outline = [
          { x: -.55 * width, y: .12 * height }, { x: -.3 * width, y: (.65 + random() * .2) * height },
          { x: (.04 + random() * .12) * width, y: height }, { x: .45 * width, y: (.42 + random() * .18) * height },
          { x: .56 * width, y: -.07 * height }, { x: -.33 * width, y: -.1 * height }
        ];
        c.obstacles.push({ x: at, y: groundAt(c, at), width, height, kind: 'boulder', lane, outline });
      }
    } else if (f === 'steps') {
      let at = 2.8 + random() * .4, top = 0;
      const profile: Point[] = [{ x: 0, y: 0 }];
      for (let j = 0; j < 3; j++) {
        profile.push({ x: at, y: top }); top += .84 + c.difficulty * .012 + random() * .055;
        profile.push({ x: at + .025, y: top }, { x: at + .42, y: top + .018 * (random() - .5) });
        at += 1.8 + random() * .55;
      }
      profile.push({ x: 10.3, y: top - .05 }, { x: 12.5, y: top * .6 }, { x: 16, y: 0 }); line(16, profile);
    } else if (f === 'ramp') {
      // A steep ribbed ascent: a smooth rim loses purchase; protrusions can
      // bear against the risers. The normal contact forces provide the grip.
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 4, y: 0 }];
      let top = 0;
      for (let i = 0; i < 8; i++) {
        profile.push({ x: 4 + i + .68 + random() * .09, y: top }); top += .57 + random() * .08;
        profile.push({ x: 5 + i, y: top });
      }
      profile.push({ x: 15, y: top }, { x: 18.4, y: top * .58 }, { x: 22, y: 0 });
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
      for (let j = 0; j < 20; j++) profile.push({ x: 3.16 + j * .7 + random() * .21, y: .11 + random() * .19 }, { x: 3.61 + j * .7 + random() * .055, y: random() * .04 });
      profile.push({ x: 20, y: 0 }); line(20, profile);
    } else if (f === 'trenches') {
      const profile: Point[] = [{ x: 0, y: 0 }];
      for (let j = 0; j < 4; j++) {
        const a = 3.7 + j * 4 + random() * .6, width = 1.05 + random() * .57, depth = .85 + random() * .5;
        profile.push({ x: a, y: 0 }, { x: a + .1, y: -depth }, { x: a + width - .12, y: -depth + .12 }, { x: a + width, y: 0 });
      }
      profile.push({ x: 23, y: 0 }); line(23, profile);
    } else if (f === 'domes') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      let at = 3;
      for (let j = 0; j < 3; j++) {
        const width = 4.8 + random() * .7, height = .85 + random() * .65, skew = .9 + random() * .2;
        for (let k = 1; k <= 16; k++) {
          const t = k / 16;
          profile.push({ x: at + t * width, y: Math.sin(t ** skew * Math.PI) ** 2 * height * (1 + .06 * Math.sin(t * 13 + j)) });
        }
        at += width;
      }
      profile.push({ x: 22, y: 0 }); line(22, profile);
    } else if (f === 'sawtooth') {
      const profile: Point[] = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
      for (let j = 0; j < 5; j++) {
        const a = 3 + j * 3.4, h = .6 + random() * .35;
        profile.push({ x: a + .13 + random() * .13, y: h }, { x: a + .7 + random() * .6, y: h * (.93 + random() * .07) }, { x: a + 2.3, y: h * .35 }, { x: a + 3.4, y: 0 });
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
        const a = 7.7 + j * 4 + random() * .55, top = -.2 - random() * .2, width = 1.35 + random() * .7;
        profile.push({ x: a, y: -1.35 }, { x: a + .3, y: top }, { x: a + width, y: top + .06 }, { x: a + width + .4, y: -1.35 });
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
    if (c.zones.length === zoneCount) c.zones.push({ start, end: x, kind: f, label: labels[f] });
    line(6, [{ x: 0, y: 0 }, { x: 6, y: 0 }], 'road');
  }
  c.length = x + 8;
  line(28, [{ x: 0, y: 0 }, { x: 28, y: 0 }], 'road');
  if (expedition) {
    const styles: Structure[] = ['bridge', 'arch', 'cave'];
    for (const [i, roof] of c.obstacles.filter(o => o.kind === 'ceiling').entries()) {
      roof.structure = styles[(id + i) % 3];
      if (roof.structure === 'bridge') roof.width = Math.min(roof.width, 4.8);
      if (roof.structure === 'arch') roof.width = Math.min(roof.width, 3.4);
      // Preserve the exact playable corridor; different structures surround it.
      const zone = c.zones.find(z => roof.x >= z.start && roof.x < z.end);
      if (zone) zone.label = roof.structure === 'bridge' ? 'ALTE STEINBRÜCKE' : roof.structure === 'arch' ? 'NATÜRLICHER FELSBOGEN' : 'FELSHÖHLE';
    }
  }
  if (expedition && !test) {
    // Optional caches use actual hull/wheel contact. One high cache rewards
    // reaching beyond the standard ring; completion never requires collecting.
    const land = c.segments.filter(s => s.b.x - s.a.x > 1 && s.a.x > 16 && s.b.x < c.length - 10 && s.a.y >= 0 && s.b.y >= 0 && !c.obstacles.some(o => o.kind === 'ceiling' && s.a.x < o.x + o.width / 2 + 3 && s.b.x > o.x - o.width / 2 - 3));
    for (const [i, fraction] of [.17, .5, .83].entries()) {
      const candidates = [...land].sort((a, b) => Math.abs((a.a.x + a.b.x) / 2 - c.length * fraction) - Math.abs((b.a.x + b.b.x) / 2 - c.length * fraction));
      const s = candidates.find(s => c.caches!.every(p => Math.abs(p.x - (s.a.x + s.b.x) / 2) > 6));
      if (s) { const at = (s.a.x + s.b.x) / 2; c.caches!.push({ x: at, y: groundAt(c, at) + (i === 1 ? 2.65 : 1.5) }); }
    }
  }
  return c;
}

// Wide camera views can see behind the start and beyond the finish. Continue
// the center strip there as well as the already extended landscape banks.
export function courseRunout(c: Course): Segment[] {
  if (!c.segments.length) return [];
  const first = c.segments[0].a, last = c.segments.at(-1)!.b;
  return [
    { a: { x: Math.min(-100, first.x - 80), y: first.y }, b: first, surface: 'stone' as const },
    { a: last, b: { x: Math.max(c.length + 100, last.x + 80), y: last.y }, surface: 'stone' as const }
  ];
}

export function groundAt(c: Course, x: number): number {
  const first = c.segments[0]?.a, last = c.segments.at(-1)?.b;
  if (first && x < first.x && x >= Math.min(-100, first.x - 80)) return first.y;
  if (last && x > last.x && x <= Math.max(c.length + 100, last.x + 80)) return last.y;
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
  if (['rocks', 'steps', 'ramp', 'logs', 'trenches', 'rollers', 'sawtooth', 'causeway', 'iceclimb'].includes(zone.kind)) return 'grip';
  if (zone.kind === 'lake' || zone.kind === 'ford') return 'paddle';
  return 'round';
}
export const courseList = Array.from({ length: 13 }, (_, i) => createCourse(i));
export const createExpedition = (id: number) => createCourse(id, true);
export const expeditionList = Array.from({ length: 13 }, (_, i) => createExpedition(i));
