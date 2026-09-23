import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation } from '../src/physics.ts';
import { courseRunout, createCourse, type Course } from '../src/courses.ts';
import { preset } from '../src/shapes.ts';
import { wheelHydro } from '../src/hydrodynamics.ts';
import { splashActivity } from '../src/splash-activity.ts';

await initPhysics();

test('a straight bar lifts and propels the chassis through repeated rotations from four starting angles', () => {
  for (const phase of [0, .4, .8, 1.2]) {
    const course: Course = { ...createCourse(0), zones: [], obstacles: [], waters: [], checkpoints: [2], length: 500, segments: [{ a: { x: -30, y: 0 }, b: { x: 600, y: 0 }, surface: 'stone' }] };
    const sim = new Simulation(course, 1), car = sim.cars[0];
    sim.requestShape([{ x: -1.1, y: 0 }, { x: 1.1, y: 0 }]); sim.resetCar(0, false);
    car.wheels.forEach(w => w.setRotation(phase, true)); sim.started = true;
    let minHeight = Infinity, maxHeight = 0, maxPitch = 0, halfX = 0, peakTorque = 0;
    for (let i = 0; i < 1440; i++) {
      sim.tick(); const p = car.body.translation();
      if (i > 240) { minHeight = Math.min(minHeight, p.y); maxHeight = Math.max(maxHeight, p.y); }
      if (i === 720) halfX = p.x;
      peakTorque = Math.max(peakTorque, ...car.motorTorques.map(Math.abs)); maxPitch = Math.max(maxPitch, Math.abs(car.body.rotation()));
    }
    console.log('straight wheel', { phase, distance: car.body.translation().x - 2, lift: maxHeight - minHeight, peakTorque, maxPitch });
    assert.ok(car.body.translation().x > 10 && car.body.translation().x > halfX + 2, 'a bar must keep walking, not just move once after mounting');
    assert.ok(maxHeight - minHeight > .5, 'wheel contact must repeatedly raise the body');
    assert.ok(maxPitch < 1.3 && peakTorque > 200); assert.equal(car.resets, 0); sim.dispose();
  }
});

test('surface spray follows the wetted contour and speed, without preset or sampling bonuses', () => {
  const water = { start: -20, end: 20, level: 0, deep: true };
  const ring = wheelHydro(preset('round')), paddle = wheelHydro(preset('paddle'));
  const bar = wheelHydro([{ x: -1.1, y: 0 }, { x: 1.1, y: 0 }]);
  const energy = (shapes: typeof ring, omega: number) => {
    let total = 0;
    for (let i = 0; i < 48; i++) total += splashActivity(shapes, { position: { x: 0, y: -.15 }, center: { x: 0, y: -.15 }, angle: i * Math.PI / 24, omega, velocity: { x: 0, y: 0 } }, water).energy;
    return total / 48;
  };
  const circle = energy(ring, -5), teeth = energy(paddle, -5), line = energy(bar, -5), slow = energy(paddle, -2);
  console.log('spray energy', { circle, paddle: teeth, bar: line, slow });
  assert.equal(energy(paddle, 0), 0);
  assert.ok(teeth > circle * 5 && line > circle * 5, 'rotation across the water pushes harder than tangent motion');
  assert.ok(teeth > slow * 8, 'faster paddles must create visibly stronger spray');
  const retraced = wheelHydro([{ x: -1.1, y: 0 }, { x: 1.1, y: 0 }, { x: 0, y: 0 }, { x: -1.1, y: 0 }, { x: 1.1, y: 0 }]);
  assert.ok(Math.abs(energy(retraced, -5) - line) < .005);
  assert.equal(splashActivity(paddle, { position: { x: 0, y: 3 }, center: { x: 0, y: 3 }, angle: 0, omega: -9, velocity: { x: 4, y: 0 } }, water).energy, 0);
});

test('irregular rocks are repeatable, lane-specific convex physical obstacles', () => {
  const course = createCourse(3), copy = createCourse(3);
  assert.deepEqual(course, copy, 'restarting must preserve the same puzzle');
  const rocks = course.obstacles.filter(o => o.kind === 'boulder');
  assert.equal(new Set(rocks.map(o => o.lane)).size, 4);
  assert.ok(new Set(rocks.map(o => o.height.toFixed(2))).size > 8);
  assert.ok(new Set(rocks.map(o => o.x.toFixed(2))).size > 16);
  for (const rock of rocks) {
    const p = rock.outline!;
    const turns = p.map((a, i) => { const b = p[(i + 1) % p.length], c = p[(i + 2) % p.length]; return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); });
    assert.ok(turns.every(t => t < 0), 'visible outline must match the convex physical hull');
  }
  const sim = new Simulation(course, 1), car = sim.cars[0], zone = course.zones.find(z => z.kind === 'rocks')!;
  sim.requestShape(preset('grip')); car.checkpoint = zone.start - 3; sim.resetCar(0, false); sim.started = true;
  let rise = 0;
  for (let i = 0; i < 2400 && car.body.translation().x < zone.end + 1; i++) { sim.tick(); rise = Math.max(rise, car.body.translation().y); }
  assert.ok(car.body.translation().x > zone.end && rise > 1.6, 'the car climbs the visible rocks instead of passing through them');
  assert.equal(car.resets, 0); sim.dispose();
});

test('the ground visible behind the start remains solid under the wheels', () => {
  const c = createCourse(0), borders = courseRunout(c);
  assert.deepEqual(borders[0].b, c.segments[0].a);
  assert.deepEqual(borders[1].a, c.segments.at(-1)!.b);
  const sim = new Simulation(c, 1), car = sim.cars[0]; car.checkpoint = -24; sim.resetCar(0, false); car.drive = 0; sim.started = true;
  for (let i = 0; i < 480; i++) sim.tick();
  assert.ok(car.body.translation().y > .8 && Math.abs(car.body.translation().x + 24) < .2);
  assert.equal(car.resets, 0); sim.dispose();
});
