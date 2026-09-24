import {WORLD_COUNT} from './world-levels';
import {sanitizeShape,clamp,type Point} from './shapes';
import type {WorldSimulation} from './world-physics';
export interface WorldRecord {stars:number;rescues:number;time:number;relics:string[]}
export interface WorldRun {
  seed:number;elapsed:number;rescues:number;shapeChanges:number;checkpoint:string;
  foundCamps:string[];collected:string[];activatedRelays:string[];latchedSwitches?:string[];shapes:Point[][];stiffness:number[];
  props:Record<string,number[]>;gates:Record<string,number>;basins:Record<string,number>;bridges?:Record<string,number>;
}
export interface WorldSave {schema:2;level:number;records:Record<number,WorldRecord>;runs:Record<number,WorldRun>;sound:boolean;quality:'auto'|'high'|'eco';tutorial:boolean}
export const WORLD_SAVE_KEY='formdrive.world.v2';
export function freshWorldSave():WorldSave{return {schema:2,level:0,records:{},runs:{},sound:false,quality:'auto',tutorial:false};}
function parse(value:string|null){try{return JSON.parse(value??'null');}catch{return null;}}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const strings=(v:unknown):string[]=>Array.isArray(v)?v.filter((s:unknown)=>typeof s==='string'&&s.length<60).slice(0,100):[];
function validRun(run:any):run is WorldRun{
  return !!run&&Number.isInteger(run.seed)&&finite(run.elapsed)&&run.elapsed>=0&&run.elapsed<604800&&Number.isInteger(run.rescues)&&run.rescues>=0&&run.rescues<10000&&Array.isArray(run.shapes)&&run.shapes.length===2&&run.shapes.every((s:Point[])=>!!sanitizeShape(s))&&Array.isArray(run.stiffness)&&run.stiffness.length===2&&run.stiffness.every(finite);
}
export function restoreWorldSave(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>){
  const save=freshWorldSave();let migrated=false;
  try{
    const raw=parse(storage.getItem(WORLD_SAVE_KEY));
    const legacy=storage.getItem('formdrive.v1'),old=parse(legacy);
    const settings=raw?.schema===2?raw:old;
    if(settings){save.sound=settings.sound===true;if(['auto','high','eco'].includes(settings.quality))save.quality=settings.quality;}
    if(raw?.schema===2){
      if(Number.isInteger(raw.level)&&raw.level>=0&&raw.level<WORLD_COUNT)save.level=raw.level;
      save.tutorial=raw.tutorial===true;
      if(raw.records&&typeof raw.records==='object')for(const [key,r] of Object.entries(raw.records) as [string,any][]){
        if(/^\d+$/.test(key)&&+key<WORLD_COUNT&&Number.isFinite(r?.time)&&r.time>0&&Number.isInteger(r?.rescues)&&r.rescues>=0){save.records[+key]={time:r.time,rescues:r.rescues,stars:Number.isInteger(r.stars)?clamp(r.stars,1,3):1,relics:Array.isArray(r.relics)?[...new Set(r.relics.filter((s:unknown)=>typeof s==='string'&&/^relic-[012]$/.test(s)))].slice(0,3) as string[]:[]};}
      }
      if(raw.runs&&typeof raw.runs==='object')for(const [key,run] of Object.entries(raw.runs))if(/^\d+$/.test(key)&&+key<WORLD_COUNT&&validRun(run))save.runs[+key]=run;
    }
    if(legacy!==null){storage.setItem(WORLD_SAVE_KEY,JSON.stringify(save));storage.removeItem('formdrive.v1');migrated=true;}
  }catch{/* Corrupt or unavailable storage cannot prevent a new game. */}
  return {save,migrated};
}
export function captureWorldRun(sim:WorldSimulation):WorldRun{
  const rounded=(n:number)=>Math.round(n*10000)/10000;
  return {seed:sim.level.seed,elapsed:sim.elapsed,rescues:sim.rescues,shapeChanges:sim.shapeChanges,checkpoint:sim.checkpoint.id,
    foundCamps:[...sim.foundCamps],collected:[...sim.collected],activatedRelays:[...sim.activatedRelays],latchedSwitches:[...sim.latchedSwitches],shapes:sim.shapes,stiffness:[...sim.stiffness],
    props:Object.fromEntries(sim.props.filter(p=>p.spec.movable).map(p=>{const a=p.body.translation(),q=p.body.rotation();return [p.spec.id,[a.x,a.y,a.z,q.x,q.y,q.z,q.w].map(rounded)];})),
    gates:Object.fromEntries(sim.gates.map(g=>[g.spec.id,g.amount])),basins:Object.fromEntries(sim.basinLevels),
    bridges:Object.fromEntries(sim.bridges.map(bridge=>{
      const spec=sim.level.bridges.find(b=>b.id===bridge.id)!,q=bridge.body.rotation(),co=Math.cos(spec.yaw/2),si=Math.sin(spec.yaw/2);
      const angle=2*Math.atan2(co*q.z+si*q.x,co*q.w+si*q.y);
      return [bridge.id,clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.32,.32)];
    }))};
}
/** Interrupted expeditions resume at the last discovered camp. Puzzle state
 * and the player's own wheels survive, without recording a rescue. */
export function restoreWorldRun(sim:WorldSimulation,run:WorldRun){
  if(!validRun(run)||run.seed!==sim.level.seed)return false;
  run.shapes.forEach((shape,axle)=>sim.requestShape(shape,axle));
  sim.elapsed=run.elapsed;sim.rescues=run.rescues;sim.shapeChanges=Number.isInteger(run.shapeChanges)?Math.max(0,run.shapeChanges):0;
  sim.stiffness=run.stiffness.map(s=>clamp(s,0,1));
  sim.collected=new Set(strings(run.collected).filter(id=>sim.level.caches.some(c=>c.id===id)));
  sim.foundCamps=new Set(strings(run.foundCamps).filter(id=>sim.level.camps.some(c=>c.id===id)));
  for(const id of strings(run.activatedRelays)){const relay=sim.level.relays.find(r=>r.id===id);if(relay&&!sim.activatedRelays.has(id)&&sim.availableCells>=relay.requires.length)sim.activatedRelays.add(id);}
  for(const id of sim.activatedRelays)sim.signals.add(id);
  sim.latchedSwitches=new Set(strings(run.latchedSwitches).filter(id=>sim.level.switches.some(s=>s.id===id)));for(const id of sim.latchedSwitches)sim.signals.add(id);
  if(sim.foundCamps.has(run.checkpoint))sim.checkpoint=sim.level.camps.find(c=>c.id===run.checkpoint)!;
  for(const prop of sim.props){const p=run.props?.[prop.spec.id];if(!prop.spec.movable||!Array.isArray(p)||p.length!==7||!p.every(finite)||Math.abs(p[0])>sim.level.extent+150||Math.abs(p[2])>sim.level.extent+150||p[1]<-30||p[1]>250)continue;
    const norm=Math.hypot(p[3],p[4],p[5],p[6]);if(norm<.8||norm>1.2)continue;
    sim.ensureTerrain(p[0],p[2],1);prop.body.setTranslation({x:p[0],y:p[1],z:p[2]},true);prop.body.setRotation({x:p[3]/norm,y:p[4]/norm,z:p[5]/norm,w:p[6]/norm},true);prop.body.setLinvel({x:0,y:0,z:0},true);prop.body.setAngvel({x:0,y:0,z:0},true);
  }
  for(const gate of sim.gates){const amount=run.gates?.[gate.spec.id];if(finite(amount)){gate.amount=clamp(amount,0,1);const p={x:gate.spec.x,y:gate.spec.y+(gate.spec.kind==='lift'?.25:gate.spec.height/2)+gate.amount*gate.spec.travel,z:gate.spec.z};gate.body.setTranslation(p,true);gate.body.setNextKinematicTranslation(p);}}
  // Restore the deck before the next physics step. Otherwise a saved weight on
  // a tilted bridge can resume underneath a deck reset to its initial angle.
  for(const bridge of sim.bridges){
    const angle=run.bridges?.[bridge.id];if(!finite(angle))continue;
    const spec=sim.level.bridges.find(b=>b.id===bridge.id)!,half=clamp(angle,-.32,.32)/2,co=Math.cos(spec.yaw/2),si=Math.sin(spec.yaw/2);
    bridge.body.setTranslation({x:spec.x,y:spec.y,z:spec.z},true);bridge.body.setRotation({x:si*Math.sin(half),y:si*Math.cos(half),z:co*Math.sin(half),w:co*Math.cos(half)},true);bridge.body.setLinvel({x:0,y:0,z:0},true);bridge.body.setAngvel({x:0,y:0,z:0},true);
  }
  for(const basin of sim.level.basins){const height=run.basins?.[basin.id];if(finite(height))sim.basinLevels.set(basin.id,clamp(height,Math.min(basin.level,basin.drainedLevel??basin.level),basin.level));}
  sim.rescue(false);sim.events=[];return true;
}
export function completedRecord(previous:WorldRecord|undefined,time:number,rescues:number,relics:string[]):WorldRecord{
  const found=[...new Set([...(previous?.relics??[]),...relics])];
  const stars=1+Number(rescues===0)+Number(relics.length===3);
  return {stars:Math.max(previous?.stars??0,stars),rescues:Math.min(previous?.rescues??Infinity,rescues),time:Math.min(previous?.time??Infinity,time),relics:found};
}
