import test from 'node:test';
import assert from 'node:assert/strict';
import { HULL_HYDRO, WATER_DENSITY, submergedArea, waterForces, wheelHydro, wheelMassProperties, type HydroPose } from '../src/hydrodynamics.ts';
import { MAX_SHAPE_POINTS, SHAPE_TOLERANCE, preset, sanitizeShape, spokeTips, type Point } from '../src/shapes.ts';

const water = { start: -20, end: 20, level: 0, deep: true };
const pose: HydroPose = { position: { x: 0, y: -.05 }, center: { x: 0, y: -.05 }, angle: 0, velocity: { x: 0, y: 0 }, omega: -6.5, invMass: .5, invInertia: 1 };
const near = (a: number, b: number, epsilon = 1e-6) => assert.ok(Math.abs(a - b) < epsilon, `${a} differs from ${b}`);

test('small drawn corners survive simplification and a second mount', () => {
  const points = [{ x: -.9, y: 0 }, { x: -.15, y: 0 }, { x: 0, y: .008 }, { x: .15, y: 0 }, { x: .9, y: 0 }];
  const shape = sanitizeShape(points)!;
  assert.ok(shape.some(p => p.y === .008), 'a small intentional tooth must not disappear');
  assert.deepEqual(sanitizeShape(shape), shape);
  assert.deepEqual(sanitizeShape(preset('triangle')), preset('triangle'), 'straight resampling must not cut off triangle corners');
  const circle = sanitizeShape(preset('round'))!;
  assert.ok(circle.length > 48 && circle.length <= MAX_SHAPE_POINTS);
  assert.equal(SHAPE_TOLERANCE, .003);
});

test('submerged area and centroid retain a hole and clip shore boundaries', () => {
  const rings: Point[][] = [
    [{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: 2, y: 2 }, { x: -2, y: 2 }],
    [{ x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }],
  ];
  const half = submergedArea(rings, water);
  near(half.area, 6); near(half.x, 0); near(half.y, -7 / 6);
  const quarter = submergedArea(rings, { ...water, start: 0 });
  near(quarter.area, 3); near(quarter.x, 7 / 6); near(quarter.y, -7 / 6);
  near(submergedArea(rings, { ...water, level: -3 }).area, 0);
});

test('buoyancy equals displaced volume times density and gravity', () => {
  const stationary = { ...pose, omega: 0, position: { x: 0, y: 0 }, center: { x: 0, y: 0 } };
  const force = waterForces(HULL_HYDRO[0], stationary, water, 1 / 120);
  near(force.volume, 2.3 * .27 * .95);
  near(force.y, force.volume * WATER_DENSITY * 9.81);
  near(force.x, 0); near(force.torque, 0); near(force.dragPower, 0);
  const tilted = waterForces(HULL_HYDRO[0], { ...stationary, angle: .2 }, water, 1 / 120);
  assert.ok(tilted.torque < 0, 'displacement alone must restore a tilted hull');
});

test('water pressure and shear always remove energy, including reverse rotation', () => {
  for (const name of ['round', 'claw', 'grip', 'paddle', 'triangle'] as const) {
    for (const angle of [0, .2, .9, 1.7, 2.4]) for (const omega of [-12, 0, 12]) {
      for (const part of wheelHydro(preset(name))) {
        const force = waterForces(part, { ...pose, angle, omega, velocity: { x: 3, y: -2 } }, water, 1 / 120);
        assert.ok(Number.isFinite(force.torque) && force.volume >= 0);
        assert.ok(force.dragPower <= 1e-9, 'fluid drag must not create energy');
      }
    }
  }
});

test('small changes in paddle depth change forces continuously, without shape categories', () => {
  const thrust = (inset: number) => {
    const shape = preset('paddle').map((p, i) => i % 2 ? { x: p.x * (1 + inset / .34), y: p.y * (1 + inset / .34) } : p);
    return wheelHydro(shape).reduce((sum, part) => sum + waterForces(part, { ...pose, angle: .19 }, water, 1 / 120).dragX, 0);
  };
  const values = [0, .005, .01].map(thrust);
  console.log('small paddle changes, force', values);
  assert.ok(Math.abs(values[1] - values[0]) > .005);
  assert.ok(Math.abs(values[2] - values[1]) > .005);
  assert.ok(Math.abs(values[1] - values[0]) < Math.abs(values[0]) * .04);
  assert.ok(Math.abs((values[2] - values[1]) - (values[1] - values[0])) < .1);
});

test('crossing the waterline or shore changes forces without a midpoint jump', () => {
  const part = wheelHydro([{ x: -.9, y: 0 }, { x: .9, y: 0 }])[0];
  for (const shift of ['height', 'shore']) {
    const values = [-.0001, 0, .0001].map(delta => waterForces(part, { ...pose, position: { x: 0, y: 0 }, center: { x: 0, y: 0 }, omega: 0, velocity: { x: 1, y: -2 } }, { ...water, level: shift === 'height' ? delta : 0, start: shift === 'shore' ? delta : -20 }, 1 / 120));
    for (let i = 1; i < values.length; i++) {
      assert.ok(Math.abs(values[i].y - values[i - 1].y) < .03);
      assert.ok(Math.abs(values[i].volume - values[i - 1].volume) < .0001);
    }
  }
});

test('retracing and adding collinear samples do not multiply displacement or rim mass', () => {
  const original = [{ x: -.9, y: -.3 }, { x: .8, y: .4 }];
  const dense = Array.from({ length: 80 }, (_, i) => ({ x: -.9 + 1.7 * i / 79, y: -.3 + .7 * i / 79 }));
  const retraced = [...original, original[0], original[1]];
  for (const variant of [dense, retraced]) {
    const a = wheelMassProperties(original), b = wheelMassProperties(variant);
    near(a.mass, b.mass, .0001); near(a.inertia, b.inertia, .0001);
    const first = waterForces(wheelHydro(original)[0], pose, water, 1 / 120);
    const second = waterForces(wheelHydro(variant)[0], pose, water, 1 / 120);
    near(first.volume, second.volume, .00001);
    near(first.dragX, second.dragX, .01);
    spokeTips(retraced).forEach((p, i) => { const q = spokeTips(original)[i]; near(p.x, q.x); near(p.y, q.y); });
  }
});

test('off-center material changes center of mass and rotational inertia', () => {
  const a = wheelMassProperties(preset('round'));
  const b = wheelMassProperties(preset('round').map(p => ({ x: p.x + .06, y: p.y })));
  near(a.center.x, 0, .001); near(a.center.y, 0, .001);
  assert.ok(b.center.x > .04 && b.center.x < .06);
  assert.ok(b.inertia > a.inertia);
});

test('self-crossing and irregular strokes build finite fluid geometry', () => {
  let seed = 8191;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let k = 0; k < 50; k++) {
    const raw = Array.from({ length: 10 + k % 12 }, () => { const a = random() * Math.PI * 2, r = .1 + random(); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; });
    const shape = sanitizeShape(raw); if (!shape) continue;
    const mass = wheelMassProperties(shape);
    assert.ok(Number.isFinite(mass.inertia) && mass.mass > 0);
    for (const part of wheelHydro(shape)) {
      const force = waterForces(part, pose, water, 1 / 120);
      assert.ok(Number.isFinite(force.torque) && force.volume >= 0 && force.dragPower <= 0);
    }
  }
});
