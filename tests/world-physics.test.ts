import test from 'node:test';
import assert from 'node:assert/strict';
import {initWorldPhysics,WorldSimulation,WORLD_DT,radarReading,waterSurface} from '../src/world-physics';
import {createWorldLevel,WORLD_COUNT,worldHeight} from '../src/world-levels';
import {preset} from '../src/shapes';
import {restoreWorldSave,WORLD_SAVE_KEY} from '../src/world-save';
import type {WorldLevel} from '../src/world-types';
import {worldAssets,flatWorld,runFor} from './world-helpers';
await initWorldPhysics();
function flat():WorldLevel{
  const level=createWorldLevel(0);return {...level,start:{x:0,y:0,z:0},heading:0,goal:{x:100,y:0,z:100},extent:500,hills:[],courts:[],features:[],basins:[],props:[],plates:[],gates:[],bridges:[],caches:[],camps:[],relays:[],goalRequires:[],trails:[{points:[{x:-500,y:0,z:0},{x:500,y:0,z:0}],width:1000,rugged:0}]};
}
function run(sim:WorldSimulation,seconds:number){sim.started=true;for(let i=0;i<seconds/WORLD_DT;i++)sim.tick();}

test('the vehicle physically turns freely through more than 180 degrees',()=>{
  const sim=new WorldSimulation(flat(),worldAssets);sim.drive=.65;run(sim,3);const before=sim.position.x;
  sim.steering=.9;let maxZ=0,angle=0,heading=sim.heading;
  runFor(sim,10,()=>{maxZ=Math.max(maxZ,Math.abs(sim.position.z));angle+=Math.atan2(Math.sin(sim.heading-heading),Math.cos(sim.heading-heading));heading=sim.heading;});
  // A tighter turning circle can return near its starting Z after ten seconds.
  // Check the travelled arc, not an arbitrary final point on that circle.
  assert.ok(maxZ>8,'real transverse displacement');assert.ok(angle>Math.PI,'heading is not clamped to the road');assert.ok(before>7);assert.ok(sim.body.rotation().w!==1);sim.dispose();
});
test('a pressure gate stays open only while a heavy object remains in contact',()=>{
  const level=flat();level.plates=[{id:'weight',x:8,y:.12,z:0,yaw:0,width:3,depth:3,threshold:7}];
  level.gates=[{id:'door',x:15,y:0,z:0,yaw:0,width:5.2,height:3.8,requires:['weight'],mode:'all',travel:4.8,delay:.1,kind:'gate'}];
  level.props=[{id:'box',asset:'wooden_crate_01',x:5,y:1,z:0,scale:1.6,yaw:0,mass:10,movable:true}];
  const sim=new WorldSimulation(level,worldAssets),box=sim.props[0].body;
  box.setTranslation({x:8,y:6,z:0},true);run(sim,.15);assert.equal(sim.plates[0].active,false,'hovering is not weight');
  run(sim,4);assert.ok(sim.plates[0].mass>=10);assert.ok(sim.gates[0].amount>.9);
  box.setTranslation({x:4,y:1,z:5},true);run(sim,4);assert.equal(sim.plates[0].active,false);assert.ok(sim.gates[0].amount<.01);sim.dispose();
});
test('rescue uses only a discovered camp and preserves puzzle objects and finds',()=>{
  const level=flat();level.camps=[{id:'hidden',x:0,y:0,z:12,yaw:1.2}];level.caches=[{id:'cell',x:0,y:1,z:12,kind:'cell'}];
  level.props=[{id:'box',asset:'wooden_crate_01',x:3,y:1,z:14,scale:1.6,yaw:0,mass:10,movable:true}];
  const sim=new WorldSimulation(level,worldAssets);sim.drive=.5;run(sim,4);assert.equal(sim.checkpoint.id,'start');
  sim.teleport({x:0,y:0,z:12},1.2);run(sim,.1);assert.equal(sim.checkpoint.id,'hidden');assert.ok(sim.collected.has('cell'));
  sim.props[0].body.setTranslation({x:5,y:1,z:15},true);sim.teleport({x:30,y:0,z:-18},0);sim.rescue();assert.ok(Math.abs(sim.position.z-12)<.01);assert.ok(Math.abs(sim.heading-1.2)<.01);assert.equal(sim.rescues,1);assert.equal(sim.props[0].body.translation().x,5);assert.ok(sim.collected.has('cell'));sim.dispose();
});
test('coarse radar discloses only a direction sector and a distance band',()=>{
  const level=flat();const reading=radarReading(level,{x:0,y:1,z:0},{x:1,y:0,z:0});assert.deepEqual(Object.keys(reading).sort(),['angle','band']);assert.equal(reading.band,'125–150 m');assert.equal(reading.angle,Math.PI/3);
});
test('all rebuilt levels have independent exploration, discoverable camps and purposeful cells',()=>{
  const hashes=new Set<string>();for(let id=0;id<WORLD_COUNT;id++){
    const l=createWorldLevel(id);hashes.add(JSON.stringify(l.trails));assert.ok(l.camps.length>=2);assert.ok(l.trails.length>=9);assert.ok(l.goalRequires.length>=2);
    for(const relay of l.relays)for(const cell of relay.requires)assert.ok(l.caches.some(c=>c.id===cell));
    for(const camp of l.camps)assert.ok(Number.isFinite(worldHeight(l,camp.x,camp.z)));
    for(const cache of l.caches)assert.ok(cache.y>=worldHeight(l,cache.x,cache.z)-1.5,`${id}: buried ${cache.id}`);
    assert.equal(l.caches.filter(c=>c.kind==='relic').length,3);
  }assert.equal(hashes.size,WORLD_COUNT);
});
test('waves fade into banks instead of moving exposed water edges',()=>{
  const b={id:'water',x:0,z:0,rx:10,rz:8,angle:0,level:0,bottom:-2,material:'water' as const,waves:.3,current:{x:0,z:0}};
  assert.equal(waterSurface(b,11,0,1).height,0);const a=waterSurface(b,2,1,1).height,c=waterSurface(b,2,-3,1).height;assert.ok(Math.abs(a-c)>.02);
});
test('ice leaves a much longer braking distance than dry ground',()=>{
  const results=[];
  for(const ice of [false,true]){
    const level=flatWorld();if(ice)level.basins=[{id:'ice',x:0,z:0,rx:80,rz:80,angle:0,level:0,bottom:-1,material:'ice',waves:0,current:{x:0,z:0}}];
    const sim=new WorldSimulation(level,worldAssets);runFor(sim,1);const start=sim.position.x;
    for(const body of sim.carBodies)body.setLinvel({x:5,y:0,z:0},true);
    for(const wheel of sim.wheels)wheel.body.setAngvel({x:0,y:0,z:-5/.82},true);
    sim.brake=1;runFor(sim,3);results.push({distance:sim.position.x-start,speed:sim.signedSpeed});sim.dispose();
  }
  assert.ok(results[0].speed<.1,'the brake stops the car on dry ground');
  assert.ok(results[1].distance>results[0].distance*2.5,'locked wheels slide visibly further on ice');
  assert.ok(results[1].speed>2,'ice cannot behave like the ordinary road');
});
test('live wheel sizing changes real ground clearance and mass without editing the drawing',()=>{
  const sim=new WorldSimulation(flatWorld(),worldAssets),original=JSON.stringify(sim.shapes);
  sim.brake=1;runFor(sim,2);const fullHeight=sim.position.y,fullMass=sim.wheels[0].body.mass();
  sim.setWheelSize(0,.5);sim.setWheelSize(1,.5);runFor(sim,3);
  assert.ok(fullHeight-sim.position.y>.25,'smaller colliders lower the chassis onto the actual ground');
  assert.ok(Math.abs(sim.wheels[0].body.mass()/fullMass-.125)<.0001,'uniform volume sets physical mass');
  const smallHeight=sim.position.y;sim.setWheelSize(0,1.35);sim.setWheelSize(1,1.35);runFor(sim,4);
  assert.ok(sim.position.y-smallHeight>.5,'growing mounted wheels lifts against the ground');
  assert.ok(Math.abs(sim.signedSpeed)<.5,'resizing at rest must not launch the vehicle');
  assert.equal(JSON.stringify(sim.shapes),original);assert.equal(sim.rescues,0);
  sim.setWheelSize(0,.6);runFor(sim,2);assert.equal(sim.wheelSizes[1],1.35);assert.ok(Math.abs(sim.wheelSizes[0]-.6)<1e-6,'axles resize independently');
  sim.dispose();
});
test('retracing cannot add physical grip pieces or mass',()=>{
  const line=[{x:-1.1,y:.2},{x:1.1,y:-.2}],sim=new WorldSimulation(flatWorld(),worldAssets,[line,line]);
  const counts=sim.wheels.map(w=>w.colliders.length),mass=sim.wheels[0].body.mass();
  for(const axle of [0,1])sim.requestShape([...line,{...line[1],move:true as const},line[0]],axle);
  assert.deepEqual(sim.wheels.map(w=>w.colliders.length),counts);assert.ok(Math.abs(sim.wheels[0].body.mass()-mass)<1e-5);
  sim.dispose();
});
test('wheel support follows the actual inclined mesh even when mesh contacts are merged',()=>{
  const level=flatWorld();level.trails[0].points=[{x:-500,y:-60,z:0},{x:500,y:60,z:0}];
  const sim=new WorldSimulation(level,worldAssets);sim.brake=1;runFor(sim,2);
  for(const wheel of sim.wheels){
    assert.ok(wheel.contactPoint,'mesh support retains its physical contact point');
    assert.ok(Math.abs(wheel.contactPoint.y-sim.surfaceHeight(wheel.contactPoint.x,wheel.contactPoint.z))<.04);
    assert.ok(wheel.contactDirection.y<-.95);
  }
  assert.ok(sim.wheels.reduce((n,w)=>n+w.contactDirection.x,0)/4>.04,'support tilts with the slope rather than staying vertically downward');sim.dispose();
});
test('version two discards incompatible progress but keeps settings',()=>{
  const map=new Map([['formdrive.v1',JSON.stringify({level:19,expeditions:{19:{completed:true}},sound:true,quality:'high'})]]);
  const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const result=restoreWorldSave(storage);assert.equal(result.migrated,true);assert.equal(result.save.level,0);assert.deepEqual(result.save.records,{});assert.equal(result.save.sound,true);assert.equal(result.save.quality,'high');assert.equal(map.has('formdrive.v1'),false);assert.ok(map.has(WORLD_SAVE_KEY));assert.equal(restoreWorldSave(storage).migrated,false);
});
