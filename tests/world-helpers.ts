import {readFileSync} from 'node:fs';
import {Vector3,Quaternion} from 'three';
import {WORLD_DT,type WorldSimulation,type PhysicalProp} from '../src/world-physics';
import {clamp} from '../src/shapes';
import type {WorldLevel,AssetCollisions,V3} from '../src/world-types';
export const worldAssets:AssetCollisions=Object.fromEntries(JSON.parse(readFileSync('public/assets/world/manifest.json','utf8')).map((a:{id:string})=>[a.id,JSON.parse(readFileSync(`public/assets/world/${a.id}.collision.json`,'utf8'))]));
JSON.parse(readFileSync('public/assets/offroad-collision.json','utf8')).parts.forEach((part:AssetCollisions[string],i:number)=>{worldAssets['vehicle-part-'+i]=part;});
export function flatWorld():WorldLevel{return {id:0,name:'Test',biome:'canyon',seed:1,extent:500,start:{x:0,y:0,z:0},heading:0,goal:{x:200,y:0,z:100},parMinutes:7,trails:[{points:[{x:-500,y:0,z:0},{x:500,y:0,z:0}],width:1000,rugged:0}],hills:[],basins:[],props:[],plates:[],gates:[],bridges:[],caches:[],camps:[],relays:[],switches:[],courts:[],features:[],goalRequires:[]};}
export function runFor(sim:WorldSimulation,seconds:number,control?:(sim:WorldSimulation)=>void){sim.started=true;for(let i=0;i<Math.round(seconds/WORLD_DT);i++){control?.(sim);sim.tick();}}
export function placeProp(prop:PhysicalProp,p:V3,rotation=prop.initialRotation){
  const q=new Quaternion().copy(rotation),v=new Vector3();let bottom=Infinity;
  const a=worldAssets[prop.spec.asset].positions;
  for(let i=0;i<a.length;i+=3){v.fromArray(a,i).multiplyScalar(prop.spec.scale).applyQuaternion(q);bottom=Math.min(bottom,v.y);}
  prop.body.setTranslation({x:p.x,y:p.y-bottom+.08,z:p.z},true);prop.body.setRotation(q,true);prop.body.setLinvel({x:0,y:0,z:0},true);prop.body.setAngvel({x:0,y:0,z:0},true);
}
export function steerTo(sim:WorldSimulation,x:number,z:number){const desired=-Math.atan2(z-sim.position.z,x-sim.position.x),error=Math.atan2(Math.sin(desired-sim.heading),Math.cos(desired-sim.heading));sim.steering=clamp(error*2,-.85,.85);}
