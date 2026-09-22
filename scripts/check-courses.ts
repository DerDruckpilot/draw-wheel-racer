import { initPhysics, Simulation } from '../src/physics.ts';
import { createCourse, zoneAt } from '../src/courses.ts';
import { preset, type ShapeName } from '../src/shapes.ts';
await initPhysics();
let failures = 0;
for (let id = 0; id < 13; id++) {
  const sim = new Simulation(createCourse(id), 1); sim.started = true;
  let last = 'round', lastChange = 0;
  for (let step = 0; step < 120 * 200 && !sim.cars[0].finished; step++) {
    const car = sim.cars[0], p = car.body.translation();
    if (step % 15 === 0) {
      const zone = zoneAt(sim.course, p.x + 3);
      const name: ShapeName = zone?.kind === 'tunnel' ? 'compact' : zone?.kind === 'steps' ? 'claw' : zone?.kind === 'lake' && p.x < zone.end - 4.5 ? 'paddle' : 'round';
      if (name !== last && step - lastChange > 45) { sim.requestShape(preset(name)); last = name; lastChange = step; }
    }
    sim.tick();
  }
  const car = sim.cars[0];
  console.log(JSON.stringify({ level: id + 1, name: sim.course.name, finished: car.finished, time: +sim.elapsed.toFixed(1), x: +car.body.translation().x.toFixed(1), y: +car.body.translation().y.toFixed(1), resets: car.resets, zone: zoneAt(sim.course, car.body.translation().x)?.kind, rotation: +car.body.rotation().toFixed(2) }));
  if (!car.finished || car.resets > 0) failures++;
  sim.dispose();
}
process.exitCode = failures ? 1 : 0;
