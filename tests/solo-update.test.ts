import test from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics, Simulation} from '../src/physics.ts';
import {createExpedition, EXPEDITION_COUNT, groundAt, suggestedShape, zoneAt} from '../src/courses.ts';
import {MUD_MEDIUM, waterForces, wheelHydro} from '../src/hydrodynamics.ts';
import {recordExpedition,restoreExpeditions} from '../src/expedition.ts';
import {preset} from '../src/shapes.ts';
import {archBands,archSection,structureExtent} from '../src/structures.ts';
import {TRACK_FRONT,TRACK_BACK} from '../src/landscape.ts';
await initPhysics();

test('mud resistance dissipates energy, varies with immersion and never acts above the surface',()=>{
 const clay={start:-20,end:20,level:0,deep:false},pose={position:{x:0,y:.4},center:{x:0,y:.4},angle:.28,velocity:{x:1.8,y:-.2},omega:-2.3,invMass:1/2,invInertia:1};
 for(const name of ['round','paddle'] as const){
  const shape=wheelHydro(preset(name))[0],f=waterForces(shape,pose,clay,1/120,MUD_MEDIUM),wet=waterForces(shape,pose,clay,1/120);
  assert.ok(f.dragPower<0 && Math.abs(f.dragPower)>Math.abs(wet.dragPower)*2);
  const air=waterForces(shape,{...pose,position:{x:0,y:4},center:{x:0,y:4}},clay,1/120,MUD_MEDIUM);assert.equal(air.dragPower,0);assert.equal(air.volume,0);
  const next=waterForces(shape,{...pose,position:{x:0,y:.401},center:{x:0,y:.401}},clay,1/120,MUD_MEDIUM);assert.ok(Math.abs(next.dragPower-f.dragPower)<2);
 }
});

test('deep clay slows smooth tyres significantly and exposed lugs can move material',()=>{
 const results:number[]=[];
 for(const [name,muddy] of [['round',false],['round',true],['paddle',true],['compact',true]] as const){
  const c=createExpedition(0);c.segments=[{a:{x:-50,y:-.62},b:{x:400,y:-.62},surface:muddy?'mud':'stone'}];c.obstacles=[];c.waters=[];c.zones=[];c.length=300;c.muds=muddy?[{start:-30,end:200,level:-.02,deep:false}]:[];
  const sim=new Simulation(c,1),v=sim.cars[0];sim.requestShape(preset(name));sim.started=true;v.drive=.8;
  for(let i=0;i<120*12;i++)sim.tick();results.push(v.body.translation().x-2);assert.ok(Math.abs(v.body.rotation())<.5);assert.equal(v.resets,0);sim.dispose();
 }
 console.log('12s progress: dry ring / clay ring / paddle / small ring',results);
 assert.ok(results[1]<results[0]*.4);assert.ok(results[2]>results[1]*2);assert.ok(results[3]<results[1]*.35);
});

test('solo corridor and structure shoulders merge into land, with exact clearance at wheel tracks',()=>{
 assert.ok(TRACK_FRONT-TRACK_BACK<4.5);
 for(const style of ['bridge','cave','arch'] as const){
  const o={x:50,y:2.2,width:5,height:.4,kind:'ceiling' as const,structure:style};
  const edge=structureExtent(style);assert.equal(archBands(style).at(-1),edge);
  const foot=archSection(o,edge,.4);assert.ok(foot.top<.4 && foot.bottom<.4);
  const middle=archSection(o,(edge+4.5)/2,.4);assert.ok(middle.top<archSection(o,4,.4).top && middle.top>foot.top);
  for(const z of [-.97,.97])assert.equal(archSection(o,z,.4).bottom,2);
 }
 for(const id of [0,8,13,15])assert.ok(createExpedition(id).obstacles.filter(o=>o.kind==='boulder').every(o=>o.lane===0));
});

test('expert routes preserve legacy IDs, author six new hazards and provide grounded recovery points',()=>{
 const saved=recordExpedition(undefined,0,3,3);assert.deepEqual(restoreExpeditions({0:saved,13:saved,15:saved,16:saved}),{0:saved,13:saved,15:saved});
 assert.equal(EXPEDITION_COUNT,16);assert.equal(createExpedition(12).name,'Testgelände');
 const found=new Set<string>();
 for(const id of [13,14,15]){
  const c=createExpedition(id);assert.deepEqual(c,createExpedition(id));assert.ok(c.difficulty>=5);assert.equal(c.caches!.length,3);
  c.features.forEach(f=>found.add(f));
  for(const cp of c.checkpoints)assert.equal(groundAt(c,cp),0);
  for(let i=1;i<c.segments.length;i++)assert.deepEqual(c.segments[i].a,c.segments[i-1].b);
 }
 for(const f of ['talus','mudpit','squeeze','stairfall','icegully','logjam'])assert.ok(found.has(f));
});

test('expert needle-eye requires a change of wheel size; oversized rims cannot pass the roof',()=>{
 const distances:number[]=[];
 for(const name of ['grip','compact'] as const){
  const c=createExpedition(13),roof=c.obstacles.find(o=>o.structure)!;
  const sim=new Simulation(c,1),v=sim.cars[0];sim.requestShape(preset(name));v.checkpoint=roof.x-4;sim.resetCar(0,false);sim.started=true;v.drive=.7;
  for(let i=0;i<120*6;i++)sim.tick();distances.push(v.body.translation().x-roof.x);assert.equal(v.resets,0);sim.dispose();
 }
 console.log('needle-eye grip/compact exit',distances);assert.ok(distances[0]<0);assert.ok(distances[1]>3);
});
