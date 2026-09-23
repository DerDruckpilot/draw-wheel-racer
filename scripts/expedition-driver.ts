import { suggestedShape, zoneAt, type Course } from '../src/courses';
import { preset, type Point } from '../src/shapes';

// Drawings used ONLY by the offline course verifier. They confer no physics
// bonus and are not exposed as presets, hints or an autopilot in the game.
export const cross:Point[]=[{x:-1.2,y:0},{x:1.2,y:0},{x:0,y:-1.2,move:true},{x:0,y:1.2}];
export const hooks:Point[]=Array.from({length:6},(_,i)=>{
  const a=i*Math.PI/3;
  return [{x:.15*Math.cos(a),y:.15*Math.sin(a),...(i?{move:true as const}:{})},
    {x:1.12*Math.cos(a),y:1.12*Math.sin(a)},
    {x:1.12*Math.cos(a)-.22*Math.sin(a),y:1.12*Math.sin(a)+.22*Math.cos(a)}];
}).flat();
export function referenceDrive(course:Course,x:number,y=Infinity){
  const here=zoneAt(course,x),ahead=zoneAt(course,x+2.5);
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
  return {key,shape:shape??preset(key as Parameters<typeof preset>[0]),drive:feature==='highroute'&&key==='grip'?1:z?.kind==='ridge'?.5:.8};
}
