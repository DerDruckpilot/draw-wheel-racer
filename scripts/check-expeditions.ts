import { initPhysics, Simulation } from '../src/physics.ts';
import { EXPEDITION_COUNT, createExpedition, suggestedShape, zoneAt } from '../src/courses.ts';
import { preset, type ShapeName } from '../src/shapes.ts';

await initPhysics();
const ids = process.argv.slice(2).map(Number);
let failures = 0;
for (const id of ids.length ? ids : Array.from({ length: EXPEDITION_COUNT }, (_, i) => i)) {
  const sim = new Simulation(createExpedition(id), 1), car = sim.cars[0]; sim.started = true;
  let last: ShapeName = 'round';
  for (let step = 0; step < 120 * (id === 12 ? 600 : 300) && !car.finished; step++) {
    if (step % 15 === 0) {
      const p = car.body.translation(), current = zoneAt(sim.course, p.x);
      const zone = current?.kind === 'lake' || current?.kind === 'ford' ? current : zoneAt(sim.course, p.x + 3);
      const shape = suggestedShape(zone, p.x);
      if (shape !== last) { sim.requestShape(preset(shape)); last = shape; }
      car.drive = current?.kind === 'ridge' ? .5 : 1;
    }
    sim.tick();
  }
  console.log(JSON.stringify({ id, name: sim.course.name, finished: car.finished, time: +sim.elapsed.toFixed(1), x: +car.body.translation().x.toFixed(1), y: +car.body.translation().y.toFixed(1), pitch: +car.body.rotation().toFixed(2), zone: zoneAt(sim.course, car.body.translation().x)?.label, rescues: car.resets, caches: sim.collected.size }));
  if (!car.finished || car.resets > 0) failures++;
  sim.dispose();
}
process.exitCode = failures ? 1 : 0;
