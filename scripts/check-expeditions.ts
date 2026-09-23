import { initPhysics, Simulation } from '../src/physics.ts';
import { EXPEDITION_COUNT, createExpedition, suggestedShape, zoneAt } from '../src/courses.ts';
import { referenceDrive } from './expedition-driver.ts';

await initPhysics();
const ids = process.argv.slice(2).map(Number);
let failures = 0;
for (const id of ids.length ? ids : Array.from({ length: EXPEDITION_COUNT }, (_, i) => i)) {
  const sim = new Simulation(createExpedition(id), 1), car = sim.cars[0]; sim.started = true;
  let last = 'round', anchor=2, stuck=0, reverse=0, overturned=0;
  for (let step = 0; step < 120 * (id === 12 ? 900 : 360) && !car.finished; step++) {
    if (step % 15 === 0) {
      const p=car.body.translation(),action=referenceDrive(sim.course,p.x);
      if(action.key!==last){sim.requestShape(action.shape);last=action.key;}
      const pitch=Math.atan2(Math.sin(car.body.rotation()),Math.cos(car.body.rotation()));
      const tipping=pitch>.66 && car.body.angvel()>.05;
      overturned=Math.abs(pitch)>1.8 && Math.abs(car.body.linvel().x)<.25?overturned+.125:0;
      if(overturned>3 && car.resets<3){sim.resetCar();overturned=0;anchor=car.body.translation().x;stuck=0;reverse=0;continue;}
      if(Math.abs(p.x-anchor)>.2){anchor=p.x;stuck=0;}else stuck+=.125;
      if(stuck>2.5){reverse=.7;stuck=0;}
      if(reverse>0){car.drive=-.55;car.brake=0;reverse-=.125;}
      else {car.drive=tipping?0:action.drive;car.brake=tipping?.7:0;}
    }
    sim.tick();
  }
  console.log(JSON.stringify({ id, name: sim.course.name, finished: car.finished, time: +sim.elapsed.toFixed(1), x: +car.body.translation().x.toFixed(1), y: +car.body.translation().y.toFixed(1), pitch: +car.body.rotation().toFixed(2), zone: zoneAt(sim.course, car.body.translation().x)?.label, rescues: car.resets, caches: sim.collected.size }));
  if (!car.finished || car.resets > 2) failures++;
  sim.dispose();
}
process.exitCode = failures ? 1 : 0;
