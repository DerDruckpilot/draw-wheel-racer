import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation } from '../src/physics.ts';
import { createCourse, type Course } from '../src/courses.ts';
import { MAX_SHAPE_POINTS, preset, restoreShape, sanitizeShape, shapeLength } from '../src/shapes.ts';
import { waterForces, wheelHydro, wheelMassProperties } from '../src/hydrodynamics.ts';
import { landscapeData, TRACK_FRONT, TRACK_BACK } from '../src/landscape.ts';

await initPhysics();

test('a loaded rear axle climbs the Nordpass steps while the front wheel spins freely', () => {
  let peakRearTorque = 0, loadedSamples = 0;
  for (const id of [0, 7]) for (const approach of [3, 6]) for (const phase of [0, .2, .4]) {
    const c = createCourse(id), z = c.zones.find(z => z.kind === 'steps')!;
    const sim = new Simulation(c, 1); sim.requestShape(preset('paddle'));
    const car = sim.cars[0]; car.checkpoint = z.start - approach; sim.resetCar(0, false);
    car.wheels.forEach(w => w.setRotation(phase, true)); sim.started = true;
    let maxPitch = 0;
    for (let i = 0; i < 3000 && car.body.translation().x < z.end + 1; i++) {
      sim.tick(); maxPitch = Math.max(maxPitch, Math.abs(car.body.rotation()));
      if (Math.abs(car.wheels[0].angvel()) < 1 && Math.abs(car.wheels[1].angvel()) > 3) {
        peakRearTorque = Math.max(peakRearTorque, -car.motorTorques[0]); loadedSamples++;
      }
    }
    assert.ok(car.body.translation().x > z.end, `level ${id + 1}, approach ${approach}, wheel phase ${phase}`);
    assert.ok(maxPitch < 1.3, 'clearing a tooth must not launch a backflip');
    assert.equal(car.resets, 0); sim.dispose();
  }
  assert.ok(loadedSamples > 100 && peakRearTorque >= 150, 'airborne front wheels must not reduce rear stall torque');
});

test('ice changes the outcome of an identical climb and contours can engage its ledges', () => {
  const results: Record<string, boolean> = {};
  for (const variant of ['ice-round', 'stone-round', 'ice-teeth']) {
    const c = createCourse(4), z = c.zones.find(z => z.kind === 'iceclimb')!;
    if (variant === 'stone-round') for (const segment of c.segments) if (segment.a.x >= z.start && segment.b.x <= z.end) segment.surface = 'stone';
    const sim = new Simulation(c, 1);
    sim.requestShape(variant === 'ice-teeth' ? preset('grip') : preset('round').map(p => ({ x: p.x * 1.2 / .82, y: p.y * 1.2 / .82 })));
    const car = sim.cars[0]; car.checkpoint = z.start - 6; sim.resetCar(0, false); sim.started = true;
    for (let i = 0; i < 3600 && car.body.translation().x < z.end + 1; i++) sim.tick();
    results[variant] = car.body.translation().x > z.end;
    console.log('ice comparison', variant, { seconds: sim.elapsed, x: car.body.translation().x - z.start });
    assert.equal(car.resets, 0); sim.dispose();
  }
  assert.deepEqual(results, { 'ice-round': false, 'stone-round': true, 'ice-teeth': true });
});

test('free rollers turn under wheel contact and stay attached to their bearings', () => {
  const c = createCourse(8), z = c.zones.find(z => z.kind === 'rollers')!;
  const sim = new Simulation(c, 1); sim.requestShape(preset('grip'));
  const car = sim.cars[0]; car.checkpoint = z.start - 6; sim.resetCar(0, false); sim.started = true;
  let spinning = 0;
  for (let i = 0; i < 2400 && car.body.translation().x < z.end + 1; i++) {
    sim.tick();
    for (const roller of sim.beams.filter(b => b.obstacle.kind === 'roller')) {
      spinning = Math.max(spinning, Math.abs(roller.body.angvel()));
      assert.ok(Math.hypot(roller.body.translation().x - roller.obstacle.x, roller.body.translation().y - roller.obstacle.y) < .025);
    }
  }
  assert.ok(spinning > 1 && car.body.translation().x > z.end); assert.equal(car.resets, 0); sim.dispose();
});

test('long intricate drawings mount, displace water and survive saving without truncation', () => {
  const retraced = sanitizeShape(Array.from({ length: 8001 }, (_, i) => ({ x: i % 2 ? -.8 : .8, y: 0 })))!;
  assert.ok(retraced && retraced.length <= MAX_SHAPE_POINTS && shapeLength(retraced) > .35, 'many closed retraces must not collapse into two identical endpoints');
  const clamped = sanitizeShape(Array.from({ length: 1201 }, (_, i) => ({ x: Math.cos(i * .06) * 2, y: Math.sin(i * .06) * 2 })))!;
  assert.deepEqual(sanitizeShape(clamped), clamped, 'mounting must reuse geometry prepared at the size limit');
  const raw = Array.from({ length: 3521 }, (_, i) => {
    const a = i / 160 * Math.PI * 2, r = .2 + .9 * i / 3520;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  const shape = sanitizeShape(raw)!;
  assert.ok(shape && shape.length > 128 && shape.length <= MAX_SHAPE_POINTS);
  assert.ok(shapeLength(shape) > 80, 'the former length limit was 22');
  assert.deepEqual(shape[0], raw[0]); assert.deepEqual(shape.at(-1), raw.at(-1));
  assert.deepEqual(restoreShape(JSON.parse(JSON.stringify(shape))), shape);
  assert.deepEqual(sanitizeShape(shape), shape);
  const mass = wheelMassProperties(shape);
  assert.ok(mass.mass > 0 && Number.isFinite(mass.inertia));
  const course: Course = { ...createCourse(0), zones: [], waters: [{ start: -20, end: 500, level: 0, deep: true }], obstacles: [], checkpoints: [2], length: 500, segments: [{ a: { x: -20, y: -4 }, b: { x: 600, y: -4 }, surface: 'stone' }] };
  const sim = new Simulation(course, 1);
  assert.equal(sim.requestShape(shape), true); sim.resetCar(0, false); sim.started = true;
  for (let i = 0; i < 600; i++) sim.tick();
  assert.equal(sim.cars[0].resets, 0);
  assert.ok(Number.isFinite(sim.cars[0].body.translation().x));
  for (const h of wheelHydro(shape)) {
    const force = waterForces(h, { position: { x: 0, y: 0 }, center: { x: 0, y: 0 }, angle: .3, velocity: { x: 3, y: -1 }, omega: -5, invMass: 1 / mass.mass, invInertia: 1 / mass.inertia }, course.waters[0], 1 / 120);
    assert.ok(force.dragPower <= 0 && Number.isFinite(force.torque));
  }
  sim.dispose();
});

test('the foreground continues beyond the camera and joins the complete track edge', () => {
  const course = createCourse(12);
  for (const front of [true, false]) {
    const data = landscapeData(course, front), edge = front ? TRACK_FRONT : TRACK_BACK;
    assert.ok(data.positions.every(Number.isFinite));
    const vertices = Array.from({ length: data.positions.length / 3 }, (_, i) => ({ x: data.positions[i * 3], y: data.positions[i * 3 + 1], z: data.positions[i * 3 + 2] }));
    assert.ok(front ? vertices.some(p => p.z > 60) : vertices.some(p => p.z < -40));
    for (const segment of course.segments) for (const p of [segment.a, segment.b]) {
      assert.ok(vertices.some(v => v.x === p.x && v.y === p.y && v.z === edge), 'no gap between race surface and banks');
    }
  }
  assert.equal(new Set(course.features).size, 21);
});
