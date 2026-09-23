import { initPhysics, Simulation } from '../src/physics.ts';
import { EXPEDITION_COUNT, createExpedition, suggestedShape, zoneAt } from '../src/courses.ts';
import { referenceDrive,cross,referenceSteering } from './expedition-driver.ts';
import {ADVENTURE_FEATURES} from '../src/adventure-courses';

await initPhysics();
const alternative=process.argv.includes('--alternative');
const ids = process.argv.slice(2).filter(a=>!a.startsWith('--')).map(Number);
let failures = 0;
for (const id of ids.length ? ids : Array.from({ length: EXPEDITION_COUNT }, (_, i) => i)) {
  const sim = new Simulation(createExpedition(id), 1), car = sim.cars[0]; sim.started = true;
  let last = 'round', anchor=2, stuck=0, reverse=0, overturned=0,furthest=2,noProgress=0;
  let alternateUntil=-Infinity;
  for (let step = 0; step < 120 * (id === 12 ? 1400 : 680) && !car.finished; step++) {
    if (step % 15 === 0) {
      referenceSteering(sim,alternative);
      const p=car.body.translation(),action=referenceDrive(sim.course,p.x,p.y,car.lateral.offset);
      const activeZone=zoneAt(sim.course,p.x,car.lateral.offset);
      if(activeZone?.feature==='stepwell'&&noProgress>8)alternateUntil=activeZone.end+1;
      if(p.x<alternateUntil){action.key='stepwell-lever';action.shape=cross;}
      if(action.key!==last){sim.requestShape(action.shape);last=action.key;}
      const pitch=Math.atan2(Math.sin(car.body.rotation()),Math.cos(car.body.rotation()));
      const advanced=id>=16||ADVENTURE_FEATURES.includes(zoneAt(sim.course,p.x,car.lateral.offset)?.feature as any);
      if(p.x>furthest+.3){furthest=p.x;noProgress=0;}else noProgress+=.125;
      if(advanced&&noProgress>22&&car.resets<3){sim.resetCar();furthest=car.body.translation().x;noProgress=0;anchor=furthest;stuck=0;reverse=0;continue;}
      car.ballastTarget=Math.max(-1,Math.min(1,pitch*1.3+car.body.angvel()*.35));
      const tipping=pitch>.66 && car.body.angvel()>.05;
      overturned=Math.abs(pitch)>1.8&&(advanced||Math.abs(car.body.linvel().x)<.25)?overturned+.125:0;
      if(overturned>3 && car.resets<3){sim.resetCar();overturned=0;anchor=car.body.translation().x;stuck=0;reverse=0;continue;}
      if(Math.abs(p.x-anchor)>.2){anchor=p.x;stuck=0;}else stuck+=.125;
      if(stuck>2.5){reverse=.7;stuck=0;}
      if(reverse>0){car.drive=-.55;car.brake=0;reverse-=.125;}
      else {car.drive=tipping?0:action.drive;car.brake=tipping?.7:0;}
    }
    sim.tick();
  }
  console.log(JSON.stringify({ id, name: sim.course.name, finished: car.finished, time: +sim.elapsed.toFixed(1), x: +car.body.translation().x.toFixed(1), y: +car.body.translation().y.toFixed(1), lateral:+car.lateral.offset.toFixed(2), pitch: +car.body.rotation().toFixed(2), zone: zoneAt(sim.course, car.body.translation().x,car.lateral.offset)?.label, rescues: car.resets, mastered:sim.mechanics.mastered.length,freight:sim.mechanics.cargo?.health }));
  if (!car.finished || car.resets > 2) failures++;
  sim.dispose();
}
process.exitCode = failures ? 1 : 0;
