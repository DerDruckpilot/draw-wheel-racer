import { initPhysics, Simulation } from '../src/physics.ts';
import { createCourse, suggestedShape, zoneAt } from '../src/courses.ts';
import { preset } from '../src/shapes.ts';

await initPhysics();
let failures = 0;
// Optional arguments select zero-based race indices; otherwise run all 12.
const ids = process.argv.length > 2 ? process.argv.slice(2).map(Number) : Array.from({ length: 12 }, (_, i) => i);
if (ids.some(id => !Number.isInteger(id) || id < 0 || id > 11)) throw new Error('Race indices must be integers from 0 to 11.');
for (const id of ids) {
  const sim = new Simulation(createCourse(id), 4); sim.started = true;
  let last = 'round';
  const finishes = new Map<number, { id: number; time: number; resets: number }>();
  for (let step = 0; step < 120 * 180 && finishes.size < 4; step++) {
    if (step % 15 === 0) {
      const p = sim.cars[0].body.translation();
      const shape = suggestedShape(zoneAt(sim.course, p.x + 3), p.x);
      if (shape !== last) { sim.requestShape(preset(shape)); last = shape; }
    }
    sim.tick();
    // Capture at the finish, before a finished car can coast beyond the scenery.
    for (const car of sim.cars) if (car.finished && !finishes.has(car.id)) {
      finishes.set(car.id, { id: car.id, time: +car.finishTime.toFixed(1), resets: car.resets });
    }
  }
  console.log(JSON.stringify({ level: id + 1, finishes: [...finishes.values()], remaining: sim.cars.filter(c => !c.finished).map(c => ({ id: c.id, x: c.body.translation().x, zone: zoneAt(sim.course, c.body.translation().x)?.kind })) }));
  if (finishes.size < 4 || [...finishes.values()].some(c => c.resets)) failures++;
  sim.dispose();
}
process.exitCode = failures ? 1 : 0;
