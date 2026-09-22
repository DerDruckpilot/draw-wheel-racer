import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation, FIXED_DT } from '../src/physics.ts';
import { createCourse, type Course } from '../src/courses.ts';
import { MAX_SHAPE_POINTS, preset, sanitizeShape, restoreShape, radiusOf, type Point } from '../src/shapes.ts';
await initPhysics();
const flat = (): Course => ({ ...createCourse(0), obstacles: [], waters: [], zones: [], checkpoints: [2], length: 500, segments: [{ a: { x: -20, y: 0 }, b: { x: 600, y: 0 }, surface: 'stone' }] });
const largeRound = () => preset('round').map(p => ({ x: p.x * 1.2 / .82, y: p.y * 1.2 / .82 }));
const driveFor = (sim: Simulation, seconds: number) => { for (let i = 0; i < seconds / FIXED_DT; i++) sim.tick(); };

test('invalid and extreme strokes cannot poison the physics world', () => {
  assert.equal(sanitizeShape([{ x: NaN, y: 0 }, { x: 1, y: 0 }]), null);
  assert.equal(sanitizeShape([{ x: 0, y: 0 }, { x: .01, y: 0 }]), null);
  const shape = sanitizeShape([{ x: -100, y: 0 }, { x: 100, y: 0 }])!;
  assert.ok(shape.length <= MAX_SHAPE_POINTS);
  assert.ok(radiusOf(shape) <= 1.3);
});

test('saved favorites keep their exact outline across repeated launches', () => {
  const original = preset('triangle'); let shape: Point[] | null = original;
  for (let i = 0; i < 20; i++) shape = restoreShape(JSON.parse(JSON.stringify(shape)));
  assert.deepEqual(shape, original);
  assert.equal(restoreShape([{ x: NaN, y: 0 }, { x: 1, y: 0 }]), null);
  assert.equal(restoreShape([{ x: -100, y: 0 }, { x: 100, y: 0 }]), null);
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

test('motor can lift a triangular wheel through repeated corners without a reset', () => {
  const sim = new Simulation(flat(), 1);
  sim.requestShape(preset('triangle')); sim.resetCar(0, false); sim.started = true;
  driveFor(sim, 10); const x = sim.cars[0].body.translation().x; driveFor(sim, 5);
  assert.ok(sim.cars[0].body.translation().x > 22, 'an angular wheel must keep moving despite the lower contact friction');
  assert.ok(sim.cars[0].body.translation().x > x + 3, 'repeated corners must not leave the wheel stalled');
  assert.equal(sim.cars[0].resets, 0);
  sim.dispose();
});

test('deep water rewards broadside paddles instead of a large smooth rim', () => {
  const cruise = (shape: Point[]) => {
    const c = flat(); c.segments[0].a.y = c.segments[0].b.y = -4;
    c.waters = [{ start: -10, end: 500, level: 0, deep: true }];
    const sim = new Simulation(c, 1); sim.requestShape(shape); sim.resetCar(0, false); sim.started = true;
    driveFor(sim, 10); const x = sim.cars[0].body.translation().x; driveFor(sim, 5);
    const speed = (sim.cars[0].body.translation().x - x) / 5;
    assert.equal(sim.cars[0].resets, 0); sim.dispose(); return speed;
  };
  const round = cruise(largeRound()), paddle = cruise(preset('paddle'));
  console.log('deep-water m/s', { largeRound: round, paddle });
  assert.ok(round < .9, 'a smooth rim must make little progress without contact with the bottom');
  assert.ok(paddle > 2.5 && paddle > round * 3.3, 'paddles must overcome the former excessive drag and clearly outperform a smooth ring');
});

test('a shallow ford slows even the largest round wheels through water drag', () => {
  const crossing = (wet: boolean) => {
    const c = createCourse(0), z = c.zones.find(z => z.kind === 'ford')!;
    if (!wet) c.waters = [];
    const sim = new Simulation(c, 1); sim.requestShape(largeRound()); sim.cars[0].checkpoint = z.start - 6;
    sim.resetCar(0, false); sim.started = true;
    let entry = 0, exit = 0;
    for (let i = 0; i < 120 * 20 && !exit; i++) {
      sim.tick(); const x = sim.cars[0].body.translation().x;
      if (!entry && x >= z.start + 3) entry = sim.elapsed;
      if (x >= z.end - 3) exit = sim.elapsed;
    }
    assert.ok(entry && exit && exit > entry, 'the ford must remain drivable');
    sim.dispose(); return exit - entry;
  };
  const dry = crossing(false), wet = crossing(true);
  console.log('ford crossing seconds', { dry, wet });
  assert.ok(wet > dry * 1.45, 'water must cause a noticeable loss of speed compared with the identical dry channel');
});

test('low roof and high steps demand opposing wheel choices, with recovery by drawing', () => {
  for (const kind of ['tunnel', 'steps'] as const) {
    const c = createCourse(0), z = c.zones.find(z => z.kind === kind)!;
    const sim = new Simulation(c, 1);
    sim.requestShape(kind === 'tunnel' ? largeRound() : preset('compact'));
    sim.cars[0].checkpoint = z.start - 3; sim.resetCar(0, false); sim.started = true;
    driveFor(sim, 14);
    assert.ok(sim.cars[0].body.translation().x < z.end - 2, `${kind}: an unsuitable fixed wheel must not bypass the obstacle`);
    sim.requestShape(preset(kind === 'tunnel' ? 'compact' : 'grip'));
    driveFor(sim, 25);
    assert.ok(sim.cars[0].body.translation().x > z.end + 1, `${kind}: a new suitable form must free the vehicle`);
    assert.equal(sim.cars[0].resets, 0);
    sim.dispose();
  }
});

test('large smooth rims fail high steps that shallow teeth can climb from different approaches', () => {
  for (const approach of [3, 6, 10]) {
    const c = createCourse(0), z = c.zones.find(z => z.kind === 'steps')!;
    const sim = new Simulation(c, 1); sim.requestShape(largeRound());
    sim.cars[0].checkpoint = z.start - approach; sim.resetCar(0, false); sim.started = true;
    driveFor(sim, 20);
    assert.ok(sim.cars[0].body.translation().x < z.start + 8, 'the maximum radius alone must not solve the staircase');
    sim.requestShape(preset('grip'));
    for (let i = 0; i < 120 * 25 && sim.cars[0].body.translation().x < z.end + 1; i++) sim.tick();
    assert.ok(sim.cars[0].body.translation().x > z.end, 'a slightly smaller toothed contour must free the car');
    assert.equal(sim.cars[0].resets, 0); sim.dispose();
  }
});

test('paddling remains stable after tilted entry and while changing the drawing', () => {
  for (const angle of [-.45, 0, .45]) {
    const c = flat(); c.segments[0].a.y = c.segments[0].b.y = -4;
    c.waters = [{ start: -20, end: 500, level: 0, deep: true }];
    const sim = new Simulation(c, 1); sim.requestShape(preset('paddle')); sim.resetCar(0, false);
    const car = sim.cars[0], origin = car.body.translation(), co = Math.cos(angle), si = Math.sin(angle);
    for (const body of [car.body, ...car.wheels, ...car.carriers]) {
      const p = body.translation(), dx = p.x - origin.x, dy = p.y - origin.y;
      body.setTranslation({ x: 2 + dx * co - dy * si, y: .6 + dx * si + dy * co }, true);
      body.setRotation(body.rotation() + angle, true); body.setLinvel({ x: 4, y: -1 }, true);
    }
    sim.started = true; let maxPitch = 0, cruisePitch = 0;
    for (let i = 0; i < 120 * 20; i++) {
      if (i > 600 && i % 240 === 0) sim.requestShape(preset('paddle').map((p, index) => ({ x: p.x, y: p.y + (index % 2 ? .015 : -.01) * (i % 480 ? 1 : -1) })));
      sim.tick(); const pitch = Math.abs(car.body.rotation());
      maxPitch = Math.max(maxPitch, pitch); if (i > 600) cruisePitch = Math.max(cruisePitch, pitch);
      assert.ok(car.waterDragPower <= 1e-7);
    }
    console.log('water stability', { entryAngle: angle, maxPitch, cruisePitch, x: car.body.translation().x });
    assert.ok(maxPitch < 1.2 && cruisePitch < .45, 'the floating chassis must stay upright without locking its rotation');
    assert.ok(car.body.translation().x > 35); assert.equal(car.resets, 0); sim.dispose();
  }
});

test('a corrugated incline needs engagement instead of radius and run-up alone', () => {
  const c = createCourse(1), z = c.zones.find(z => z.kind === 'ramp')!;
  const sim = new Simulation(c, 1); sim.requestShape(largeRound());
  sim.cars[0].checkpoint = z.start - 6; sim.resetCar(0, false); sim.started = true;
  driveFor(sim, 25);
  assert.ok(sim.cars[0].body.translation().x < z.start + 12, 'smooth wheels must lose traction on the ascent');
  sim.requestShape(preset('grip'));
  for (let i = 0; i < 120 * 30 && sim.cars[0].body.translation().x < z.end + 1; i++) sim.tick();
  assert.ok(sim.cars[0].body.translation().x > z.end, 'teeth must carry the same vehicle over the incline');
  assert.equal(sim.cars[0].resets, 0); sim.dispose();
});

test('paddles enter and leave a real lake without overturning', () => {
  const c = createCourse(0), z = c.zones.find(z => z.kind === 'lake')!;
  const sim = new Simulation(c, 1); sim.requestShape(preset('paddle')); sim.cars[0].checkpoint = z.start - 5;
  sim.resetCar(0, false); sim.started = true; let maxWetPitch = 0;
  for (let i = 0; i < 120 * 45 && sim.cars[0].body.translation().x < z.end + 2; i++) {
    sim.tick(); const car = sim.cars[0];
    if (car.water > .3) maxWetPitch = Math.max(maxWetPitch, Math.abs(car.body.rotation()));
  }
  console.log('lake crossing', { seconds: sim.elapsed, maxWetPitch });
  assert.ok(sim.cars[0].body.translation().x > z.end + 1);
  assert.ok(maxWetPitch < 1.15); assert.equal(sim.cars[0].resets, 0); sim.dispose();
});

test('growing wheels waits for the cage and rear wheel to clear a low roof', () => {
  const c = createCourse(0), z = c.zones.find(z => z.kind === 'tunnel')!;
  const sim = new Simulation(c, 1); sim.requestShape(preset('compact'));
  sim.cars[0].checkpoint = z.start - 3; sim.resetCar(0, false); sim.started = true;
  for (let i = 0; i < 120 * 15 && sim.cars[0].body.translation().x < z.start + 8; i++) sim.tick();
  const revision = sim.cars[0].revision;
  sim.requestShape(preset('round')); driveFor(sim, .5);
  assert.equal(sim.cars[0].revision, revision, 'an enlarged wheel must remain pending while its vehicle cannot fit');
  driveFor(sim, 7);
  assert.ok(sim.cars[0].body.translation().x > z.end + 1);
  assert.ok(sim.cars[0].revision > revision, 'the new form must be mounted automatically after leaving the roof');
  assert.equal(sim.cars[0].resets, 0); sim.dispose();
});
