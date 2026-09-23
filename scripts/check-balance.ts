import {initPhysics,Simulation} from '../src/physics';
import {createExpedition,EXPEDITION_COUNT,zoneAt} from '../src/courses';
import {preset} from '../src/shapes';
import {hooks,referenceSteering} from './expedition-driver';
await initPhysics();
let failures=0;
for(const [name,shape] of [['large-ring',preset('round').map(p=>({x:p.x*1.2/.82,y:p.y*1.2/.82}))],['open-hooks',hooks],['small-ring',preset('compact')]] as const){
 const results=[];
 for(let id=0;id<EXPEDITION_COUNT;id++){
  if(id===12)continue;
  const sim=new Simulation(createExpedition(id),1),v=sim.cars[0];sim.requestShape(shape.slice());v.drive=.8;sim.started=true;
  let far=2,lastProgress=0;
  for(let i=0;i<120*240&&!v.finished;i++){
   if(i%15===0)referenceSteering(sim);sim.tick();if(v.body.translation().x>far+.4){far=v.body.translation().x;lastProgress=i;}
   if(i-lastProgress>120*16)break;
  }
  results.push({id,finished:v.finished,progress:Math.round(v.body.translation().x/sim.course.length*100),blocked:zoneAt(sim.course,v.body.translation().x,v.lateral.offset)?.feature});
  if(v.finished)failures++;
  sim.dispose();
 }
 console.log(JSON.stringify({drawing:name,routes:results}));
}
if(failures)console.error(`${failures} unchanged reference drawings bypassed every challenge.`);
process.exitCode=failures?1:0;
