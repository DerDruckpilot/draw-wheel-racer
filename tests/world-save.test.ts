import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {initWorldPhysics,WorldSimulation} from '../src/world-physics';
import {createWorldLevel} from '../src/world-levels';
import {preset} from '../src/shapes';
import {captureWorldRun,restoreWorldRun,restoreWorldSave,freshWorldSave,completedRecord,WORLD_SAVE_KEY} from '../src/world-save';
import {worldAssets,flatWorld,runFor,placeProp} from './world-helpers';
await initWorldPhysics();
function storage(values:Record<string,string>){const map=new Map(Object.entries(values));return {getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};}
test('a run restores independent wheels, discovered camps, moved objects and puzzle choices',()=>{
  const level=createWorldLevel(5),first=new WorldSimulation(level,worldAssets),camp=level.camps[0];
  first.requestShape([{x:-1.15,y:0},{x:1.15,y:0}],0);first.requestShape(preset('compact'),1);first.stiffness=[.1,.85];
  first.foundCamps.add(camp.id);first.checkpoint=camp;first.collected.add('cell-0');first.activatedRelays.add('relay-0');first.latchedSwitches.add('lift-control');first.elapsed=134.5;first.rescues=2;
  const prop=first.props.find(p=>p.spec.movable)!;prop.body.setTranslation({x:prop.initial.x+2,y:prop.initial.y,z:prop.initial.z-1},true);
  const run=JSON.parse(JSON.stringify(captureWorldRun(first))),second=new WorldSimulation(createWorldLevel(5),worldAssets);
  assert.ok(restoreWorldRun(second,run));assert.deepEqual(second.shapes,first.shapes);assert.deepEqual(second.stiffness,[.1,.85]);assert.equal(second.checkpoint.id,camp.id);assert.equal(second.rescues,2);assert.equal(second.elapsed,134.5);assert.ok(second.latchedSwitches.has('lift-control'));assert.ok(second.activatedRelays.has('relay-0'));
  assert.ok(Math.abs(second.props.find(p=>p.spec.id===prop.spec.id)!.body.translation().x-prop.body.translation().x)<.001);assert.ok(Math.abs(second.position.x-camp.x)<.001);assert.equal(second.events.length,0);first.dispose();second.dispose();
});
test('corrupt legacy data cannot destroy a valid current save and malformed records are bounded',()=>{
  const raw={...freshWorldSave(),level:4,sound:true,records:{4:{time:40,rescues:0,stars:'broken',relics:['relic-0','relic-0','relic-99']},999:{time:4,rescues:0,stars:3}}};
  const store=storage({[WORLD_SAVE_KEY]:JSON.stringify(raw),'formdrive.v1':'{broken'}),result=restoreWorldSave(store);
  assert.equal(result.save.level,4);assert.equal(result.save.sound,true);assert.equal(result.save.records[4].stars,1);assert.deepEqual(result.save.records[4].relics,['relic-0']);assert.equal(result.save.records[999],undefined);assert.equal(store.getItem('formdrive.v1'),null);
  assert.doesNotThrow(()=>restoreWorldSave({getItem:()=>{throw Error('denied');},setItem:()=>{},removeItem:()=>{}}));
});
test('restoring cannot grant unknown checkpoints, unearned power or invalid object poses',()=>{
  const s=new WorldSimulation(createWorldLevel(5),worldAssets),run=captureWorldRun(s),prop=s.props.find(p=>p.spec.movable)!;
  run.checkpoint='camp-999';run.foundCamps=['camp-999'];run.collected=[];run.activatedRelays=['relay-0'];run.latchedSwitches=['unknown'];run.props[prop.spec.id]=[Infinity,0,0,0,0,0,0];
  assert.ok(restoreWorldRun(s,run));assert.equal(s.checkpoint.id,'start');assert.equal(s.activatedRelays.size,0);assert.equal(s.latchedSwitches.size,0);assert.ok(Number.isFinite(prop.body.translation().x));
  assert.equal(restoreWorldRun(s,{...run,seed:run.seed+1}),false);s.dispose();
});
test('relic and no-rescue stars remain optional and best records are retained',()=>{
  const first=completedRecord(undefined,480,3,[]);assert.equal(first.stars,1);
  const second=completedRecord(first,550,0,['relic-0','relic-1','relic-2']);assert.equal(second.stars,3);assert.equal(second.time,480);assert.equal(second.rescues,0);
});

test('a saved counterweight resumes on the tilted bridge instead of underneath it',()=>{
  const level=flatWorld();level.start.x=-30;
  const bridge={id:'weighted-deck',x:0,y:4,z:0,yaw:.64,length:17,width:5.4,angle:.28,counterweight:27};
  level.bridges=[bridge];level.props=[{id:'weight',asset:'wooden_crate_01',x:-20,y:0,z:0,yaw:0,scale:2.65,mass:14,movable:true}];
  const first=new WorldSimulation(level,worldAssets),q=new Quaternion().copy(first.bridges[0].body.rotation());
  const point=new Vector3(-5,.2,0).applyQuaternion(q).add(new Vector3(bridge.x,bridge.y,bridge.z));
  placeProp(first.props[0],point,q);runFor(first,4);
  const saved=JSON.parse(JSON.stringify(captureWorldRun(first))),second=new WorldSimulation(level,worldAssets);
  assert.ok(saved.bridges[bridge.id]>.25,'the weight really tilts the physical deck');
  const rotation=first.bridges[0].body.rotation();first.bridges[0].body.setRotation({x:-rotation.x,y:-rotation.y,z:-rotation.z,w:-rotation.w},true);
  assert.ok(Math.abs(captureWorldRun(first).bridges![bridge.id]-saved.bridges[bridge.id])<.00001,'equivalent quaternion signs must preserve the same hinge angle');
  assert.ok(restoreWorldRun(second,saved));
  assert.ok(new Quaternion().copy(first.bridges[0].body.rotation()).angleTo(new Quaternion().copy(second.bridges[0].body.rotation()))<.005);
  const before={...second.props[0].body.translation()};runFor(second,1);
  const after=second.props[0].body.translation(),relative=new Vector3(after.x,after.y,after.z).sub(new Vector3(bridge.x,bridge.y,bridge.z)).applyQuaternion(new Quaternion().copy(second.bridges[0].body.rotation()).invert());
  assert.ok(relative.y>.16,'the crate stays above the deck after the solver resumes');
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y,after.z-before.z)<.5,'restoring cannot launch the weight away');
  first.dispose();second.dispose();
});
