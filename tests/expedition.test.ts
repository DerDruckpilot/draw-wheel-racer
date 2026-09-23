import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpedition, groundAt, type Course } from '../src/courses.ts';
import { initPhysics, Simulation } from '../src/physics.ts';
import { recordExpedition, restoreExpeditions, expeditionStars } from '../src/expedition.ts';
import { preset } from '../src/shapes.ts';
import { RouteLayout } from '../src/route-layout.ts';
import { archSection, archBands, roofOutline } from '../src/structures.ts';

await initPhysics();
const flat = (ice = false) => ({ ...createExpedition(0), obstacles: [], waters: [], zones: [], caches: [], checkpoints: [2], length: 400, segments: [{ a: { x: -100, y: 0 }, b: { x: 500, y: 0 }, surface: ice ? 'ice' as const : 'stone' as const }] });
const run = (sim: Simulation, seconds: number) => { sim.started = true; for (let i = 0; i < seconds * 120; i++) sim.tick(); };

test('expeditions wait for a pedal, support controlled speed and real reverse', () => {
  const sim = new Simulation(flat(), 1), car = sim.cars[0];
  run(sim, 3); assert.ok(Math.abs(car.body.translation().x - 2) < .1); assert.equal(car.stuck, 0);
  car.drive = .3; run(sim, 4); const slow = car.body.linvel().x;
  car.drive = 1; run(sim, 4); const fast = car.body.linvel().x;
  assert.ok(slow > .4 && fast > slow * 1.8, `pedal speeds: ${slow}, ${fast}`);
  car.drive = 0; car.brake = 1; run(sim, 3);
  assert.ok(Math.abs(car.body.linvel().x) < .3, 'braking stops through tyre contact');
  const turn = car.body.translation().x;
  car.brake = 0; car.drive = -.8; run(sim, 5);
  assert.ok(car.body.translation().x < turn - 5); assert.ok(Math.abs(car.body.rotation()) < .5); assert.equal(car.resets, 0);
  sim.dispose();
});

test('locked wheels still slide on ice rather than gaining artificial braking grip', () => {
  const distances: number[] = [];
  for (const ice of [false, true]) {
    const sim = new Simulation(flat(ice), 1), car = sim.cars[0];
    for (const b of [car.body, ...car.wheels, ...car.carriers]) b.setLinvel({ x: 4, y: 0 }, true);
    car.wheels.forEach(w => w.setAngvel(-4 / .915, true)); car.brake = 1;
    run(sim, 3); distances.push(car.body.translation().x - 2); assert.equal(car.resets, 0); sim.dispose();
  }
  console.log('braking distances stone/ice', distances);
  assert.ok(distances[1] > distances[0] * 2 && distances[1] > 5);
});

test('cache collection uses contact, survives recovery and cannot be farmed twice', () => {
  const c: Course = flat(); c.caches = [{ x: 7, y: 1.5 }, { x: 9, y: 5 }];
  const sim = new Simulation(c, 1), car = sim.cars[0]; car.drive = .6;
  run(sim, 5); assert.deepEqual([...sim.collected], [0]);
  sim.resetCar(); run(sim, 5); assert.deepEqual([...sim.collected], [0]); assert.equal(car.resets, 1);
  sim.dispose();
});

test('completion rewards ignore speed and preserve separate expedition achievements', () => {
  const first = recordExpedition(undefined, 2, 3, 3);
  assert.equal(expeditionStars(first), 1); assert.equal(first.noRescue, false);
  const second = recordExpedition(first, 0, 1, 3);
  assert.equal(expeditionStars(second), 2); assert.equal(second.fewestRescues, 0);
  assert.equal(recordExpedition(undefined, 0, 0, 0).allCaches, false);
  assert.deepEqual(restoreExpeditions({ 0: second, 1: { time: 30, stars: 3 }, 99: second, bad: second }), { 0: second });
});

test('all expeditions are deterministic without automatic collectibles and with safe recovery ledges', () => {
  for (let id = 0; id < 12; id++) {
    const c = createExpedition(id); assert.deepEqual(c, createExpedition(id));
    assert.equal(c.caches!.length, 0);
    for (const p of c.caches!) { const aboveGround = p.y - groundAt(c, p.x); assert.ok(aboveGround >= 1.49 && aboveGround <= 2.66); }
    for (const cp of c.checkpoints) {
      assert.equal(groundAt(c, cp), 0);
      assert.ok(!c.obstacles.some(o => o.kind === 'ceiling' && Math.abs(cp - o.x) < o.width / 2 + 2.5));
    }
    const combinations = c.features.filter(f => ['ridge', 'grotto', 'floodpass', 'ravine'].includes(f));
    assert.ok(c.features.length>=6);
  }
});

test('large circles cannot drive through the elevated grotto, compact contours can', () => {
  const c = createExpedition(2), zone = c.zones.find(z => z.kind === 'tunnel')!;
  const results: number[] = [];
  for (const small of [false, true]) {
    const sim = new Simulation(c, 1), car = sim.cars[0];
    sim.requestShape(small ? preset('compact') : preset('round').map(p => ({ x: p.x * 1.2 / .82, y: p.y * 1.2 / .82 })));
    car.checkpoint = zone.start - 2; sim.resetCar(0, false); car.drive = .75;
    run(sim, 20); results.push(car.body.translation().x - zone.start); assert.equal(car.resets, 0); sim.dispose();
  }
  console.log('grotto large/compact progress', results);
  assert.ok(results[0] < 5); assert.ok(results[1] > 16);
});

test('the spatial route preserves distance, bends smoothly and keeps lateral alignment', () => {
  const c = createExpedition(11), layout = new RouteLayout(c);
  const zs: number[] = [];
  for (let s = -90; s < c.length + 90; s += .7) {
    const p = layout.point(s), next = layout.point(s + .01), side = layout.point(s, 3);
    assert.ok(Math.abs(Math.hypot(next.x - p.x, next.z - p.z) - .01) < .00001);
    assert.ok(Math.abs(Math.hypot(side.x - p.x, side.z - p.z) - 3) < .000001);
    assert.ok(next.x > p.x); zs.push(p.z);
  }
  assert.ok(Math.max(...zs) - Math.min(...zs) > 6);
});

test('bridges, natural arches and caves have grounded shoulders and the same physical clearance as their visible wheel-track section', () => {
  const styles = new Set<string>();
  for (let id = 0; id < 12; id++) {
    const c = createExpedition(id);
    for (const roof of c.obstacles.filter(o => o.structure)) {
      styles.add(roof.structure!); const base = groundAt(c, roof.x), edge = archBands(roof.structure!).at(-1)!;
      for (const z of [-.97, 0, .97]) assert.equal(archSection(roof, z, base).bottom, roof.y - roof.height / 2);
      assert.ok(archSection(roof, edge, base).bottom < base);
      const outline = roofOutline(roof); assert.ok(outline.every(p => Number.isFinite(p.x + p.y)));
      assert.equal(outline[0].y, -roof.height / 2);
      assert.ok(Math.abs(outline[2].y + roof.y - archSection(roof, 0, base).top) < 1e-10);
    }
  }
  assert.deepEqual([...styles].sort(), ['arch', 'bridge', 'cave']);
});
