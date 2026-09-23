import { suggestedShape, zoneAt, type Course } from '../src/courses';
import { preset, type Point } from '../src/shapes';
import type { Simulation } from '../src/physics';

// Drawings used ONLY by the offline course verifier. They confer no physics
// bonus and are not exposed as presets, hints or an autopilot in the game.
export const cross:Point[]=[{x:-1.2,y:0},{x:1.2,y:0},{x:0,y:-1.2,move:true},{x:0,y:1.2}];
export const hooks:Point[]=Array.from({length:6},(_,i)=>{
  const a=i*Math.PI/3;
  return [{x:.15*Math.cos(a),y:.15*Math.sin(a),...(i?{move:true as const}:{})},
    {x:1.12*Math.cos(a),y:1.12*Math.sin(a)},
    {x:1.12*Math.cos(a)-.22*Math.sin(a),y:1.12*Math.sin(a)+.22*Math.cos(a)}];
}).flat();
export function referenceDrive(course:Course,x:number,y=Infinity,lateral=0){
  const here=zoneAt(course,x,lateral),ahead=zoneAt(course,x+2.5,lateral);
  const z=here&&['lake','ford','tidalcave'].includes(here.kind)?here:ahead??here;
  const feature=z?.feature;
  let key:string=suggestedShape(z,x),shape:Point[]|undefined;
  if(feature==='tidalcave'){key='hooks';shape=hooks;}
  if(feature==='escarpment'||feature==='knifeedge'||feature==='crater'){key='cross';shape=cross;}
  if(feature==='siltclimb')key='paddle';
  if(feature==='softground'||feature==='current')key='paddle';
  if(feature==='thinice')key='grip';
  if(feature==='loosefield')key='grip';
  if(feature==='precisionjump')key='grip';
  if(feature==='highroute'){key=y<.7?'paddle':'grip';}
  if(feature==='stepwell')key='grip';
  if(feature==='rubblegate'&&z?.kind==='steps'){key='cross';shape=cross;}
  return {key,shape:shape??preset(key as Parameters<typeof preset>[0]),drive:course.freight&&z?.feature!==undefined?.5:feature==='highroute'&&key==='grip'?1:z?.kind==='ridge'?.5:.8};
}

// Steer into the optional fill control, then return to the passage. This uses
// the same bounded steering input as the player, never lateral teleportation.
export function referenceSteering(sim:Simulation,alternative=false){
  const car=sim.cars[0],x=car.body.translation().x;
  if(sim.course.routes){
    const fork=sim.course.routes.forks.find(f=>x<f.end+4);
    const index=(sim.course.id+(fork?.start??0))%2<1?0:1;
    const path=fork?.paths.filter(p=>!p.blocked)[alternative?1-index:index];
    let target=path?.center??0;
    const control=sim.mechanics.machines.find(m=>m.spec.channel===path?.channel&&['plate','counterweight'].includes(m.spec.kind)&&x>m.spec.x-12&&x<m.spec.x+3.5&&(m.spec.lateral!<(path?.center??0)||sim.course.waters.some(w=>w.drainControl===m.spec.signal&&m.spec.x>w.start+15)));
    if(control)target+=Math.sign(control.spec.lateral!-target)*.9;
    else if(sim.course.obstacles.some(o=>o.channel===path?.channel&&o.kind==='boulder'&&Math.abs((o.lateral??0)-(path?.center??0)+.95)<.01&&Math.abs(x-o.x)<7))target+=.95;
    car.lateral.input=Math.max(-1,Math.min(1,(target-car.lateral.offset)*3))*Math.sign(car.body.linvel().x||1);return;
  }
  const switchAhead=sim.mechanics.machines.find(m=>['plate','counterweight'].includes(m.spec.kind)&&m.spec.lateral!==undefined&&x>m.spec.x-14&&x<m.spec.x+3.5&&(m.spec.lateral<0||sim.course.waters.some(w=>w.drainControl===m.spec.signal&&m.spec.x>w.start+15)));
  let target=switchAhead?Math.sign(switchAhead.spec.lateral!)*.9:0;
  if(sim.course.obstacles.some(o=>o.kind==='boulder'&&o.lateral===-.95&&Math.abs(x-o.x)<7)&&!switchAhead)target=.95;
  car.lateral.input=Math.max(-1,Math.min(1,(target-car.lateral.offset)*4))*Math.sign(car.body.linvel().x||1);
}
