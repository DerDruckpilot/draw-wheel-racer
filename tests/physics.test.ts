import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation, FIXED_DT } from '../src/physics.ts';
import { createCourse, type Course } from '../src/courses.ts';
import { preset, sanitizeShape, radiusOf } from '../src/shapes.ts';
await initPhysics();
const flat = (): Course => ({ ...createCourse(0), obstacles: [], waters: [], zones: [], checkpoints: [2], length: 500, segments: [{ a: { x: -20, y: 0 }, b: { x: 600, y: 0 }, surface: 'stone' }] });

test('invalid and extreme strokes cannot poison the physics world', () => {
  assert.equal(sanitizeShape([{ x: NaN, y: 0 }, { x: 1, y: 0 }]), null);
  assert.equal(sanitizeShape([{ x: 0, y: 0 }, { x: .01, y: 0 }]), null);
  const shape = sanitizeShape([{ x: -100, y: 0 }, { x: 100, y: 0 }])!;
  assert.ok(shape.length <= 48);
  assert.ok(radiusOf(shape) <= 1.3);
});

test('wheel-ground contact drives the car; low friction removes traction', () => {
  const a = new Simulation(flat(), 1); a.started = true;
  const ice = flat(); ice.segments.forEach(s => s.surface = 'ice');
  const b = new Simulation(ice, 1); b.started = true;
  for (let i = 0; i < 1200; i++) { a.tick(); b.tick(); }
  console.log('flat/ice', a.cars[0].body.translation(), b.cars[0].body.translation());
  assert.ok(a.cars[0].body.translation().x > 22, 'motor must move the vehicle through contact');
  assert.ok(a.cars[0].body.translation().x > b.cars[0].body.translation().x + 2, 'ice must reduce traction');
  assert.equal(a.cars[0].resets, 0);
  a.dispose(); b.dispose();
});

test('unpowered wheels do not acquire sustained forward energy', () => {
  const sim = new Simulation(flat(), 1); sim.started = true; sim.cars[0].drive = 0;
  for (let i = 0; i < 600; i++) sim.tick();
  assert.ok(Math.abs(sim.cars[0].body.translation().x - 2) < .2);
  assert.ok(Math.abs(sim.cars[0].body.linvel().x) < .1);
  sim.dispose();
});

test('open forms stay open and repeated replacement remains finite', () => {
  const sim = new Simulation(flat(), 1); sim.started = true;
  const open = preset('claw');
  assert.ok(Math.hypot(open[0].x - open.at(-1)!.x, open[0].y - open.at(-1)!.y) > .5);
  for (let i = 0; i < 1800; i++) {
    if (i % 90 === 0) sim.requestShape(preset(i % 180 === 0 ? 'claw' : 'paddle'));
    sim.tick();
  }
  const p = sim.cars[0].body.translation();
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  assert.ok(Math.abs(p.y) < 8, 'shape changes must not create launch impulses');
  sim.dispose();
});

test('hull floats and paddle forces drive it across deep water', () => {
  const c = flat(); c.segments[0].a.y = -4; c.segments[0].b.y = -4;
  c.waters = [{ start: -10, end: 500, level: 0, deep: true }];
  const sim = new Simulation(c, 1);
  sim.requestShape(preset('paddle'));
  sim.resetCar(0, false); sim.started = true;
  for (let i = 0; i < 1800; i++) sim.tick();
  const p = sim.cars[0].body.translation();
  console.log('water', p, 'buoyancy', sim.cars[0].buoyancy);
  assert.ok(p.y > -.8 && p.y < 1.8, 'vehicle must float near water surface');
  assert.ok(p.x > 8, 'paddles must supply forward propulsion');
  assert.equal(sim.cars[0].resets, 0);
  sim.dispose();
});

test('all twelve races and test track have finish, checkpoints and required terrain', () => {
  const courses = Array.from({ length: 13 }, (_, i) => createCourse(i));
  for (const c of courses) {
    assert.ok(c.length > 120);
    assert.ok(c.checkpoints.length >= 6);
    assert.ok(c.segments.every(s => Number.isFinite(s.a.y) && Number.isFinite(s.b.y)));
    const sim = new Simulation(c, 1);
    sim.started = true;
    for (let i = 0; i < 20; i++) sim.tick();
    assert.ok(Number.isFinite(sim.cars[0].body.translation().y));
    sim.dispose();
  }
  assert.ok(courses.some(c => c.waters.some(w => w.deep)));
  assert.ok(courses.some(c => c.waters.some(w => !w.deep)));
  assert.equal(FIXED_DT, 1 / 120);
});
