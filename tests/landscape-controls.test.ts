import {assertJoinedGround} from './course-assertions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics, Simulation, DRIVE_TORQUE} from '../src/physics.ts';
import {createExpedition, groundAt} from '../src/courses.ts';
import {sanitizeShape, shapeEdges, shapeLength, preset, restoreShape} from '../src/shapes.ts';
import {wheelHydro, wheelMassProperties} from '../src/hydrodynamics.ts';
import {terrainWarp} from '../src/terrain-shape.ts';
await initPhysics();
const separate = [{x:-1,y:0},{x:-.5,y:0},{x:.5,y:.6,move:true as const},{x:1,y:.6}];

test('separate strokes never gain a phantom rubber connector and remain stable on remount',()=>{
  let shape=sanitizeShape(separate)!;
  assert.equal([...shapeEdges(shape)].length,2);assert.equal(shapeLength(shape),1);
  for(let i=0;i<12;i++)shape=sanitizeShape(restoreShape(JSON.parse(JSON.stringify(shape)))!)!;
  assert.deepEqual(shape,separate);
  const connected=separate.map(({x,y})=>({x,y}));
  assert.ok(wheelMassProperties(connected).mass>wheelMassProperties(shape).mass+.15);
  assert.ok(wheelHydro(shape)[0].rings.length>=2);
});

test('mounting the front draft changes only the front physical axle and its water contour',()=>{
  const sim=new Simulation(createExpedition(0),1),v=sim.cars[0];
  const rearMass=v.wheels[0].mass(),rearRevision=v.axleRevisions[0],rearShape=v.shapes[0],rearHydro=v.hydros[0];
  v.wheels[0].setAngvel(-1.5,true);
  assert.equal(sim.requestShape(separate,0,1),true);
  assert.equal(v.axleRevisions[0],rearRevision);assert.equal(v.wheels[0].mass(),rearMass);
  assert.equal(v.wheels[0].angvel(),-1.5);assert.equal(v.shapes[0],rearShape);assert.equal(v.hydros[0],rearHydro);
  assert.notEqual(v.hydros[0],v.hydros[1]);assert.deepEqual(v.shapes[1],separate);
  assert.equal(sim.requestShape(preset('round'),0,7),false);
  sim.started=true;v.drive=.7;for(let i=0;i<360;i++)sim.tick();
  assert.ok(Number.isFinite(v.body.translation().x));assert.equal(v.resets,0);sim.dispose();
});

test('a stalled axle receives full low-gear torque even with the body pitched steeply',()=>{
  const sim=new Simulation(createExpedition(0),1),v=sim.cars[0];
  // An anchored drivetrain bench isolates engine capacity from available grip.
  for(const b of [v.body,...v.carriers,...v.wheels]){const p=b.translation();b.setTranslation({x:p.x,y:p.y+15},true);b.lockTranslations(true,true);}
  v.body.setRotation(1.13,true);v.body.lockRotations(true,true);v.wheels[0].lockRotations(true,true);
  v.drive=.8;sim.started=true;let rearPeak=0;
  for(let i=0;i<240;i++){sim.tick();rearPeak=Math.max(rearPeak,Math.abs(v.motorTorques[0]));}
  assert.ok(rearPeak>1100 && rearPeak<=DRIVE_TORQUE);assert.equal(v.motorCut,false);
  assert.ok(Math.abs(v.wheels[1].angvel())>.5,'the free front axle turns independently');sim.dispose();
});

test('expedition jump gaps have continuous physical walls and a deep rocky floor',()=>{
  const c=createExpedition(12),gap=c.zones.find(z=>z.kind==='gap')!;
  assertJoinedGround(c);
  assert.ok(groundAt(c,gap.start+11,gap.lateral)<-3);assert.ok(groundAt(c,gap.start+11)>-7);
  assert.ok(groundAt(c,gap.start+10,gap.lateral)>1);
});

test('natural ledges remain exact at wheel contacts and have slanted, uneven exposed edges',()=>{
  for(const x of [12,40,73,129])for(const z of [.03,1.97])assert.deepEqual(terrainWarp(x,2,z),{x,y:2,z});
  const p=terrainWarp(40,2,-7),q=terrainWarp(40,2,5);
  assert.ok(Math.abs(p.x-q.x)>.5);assert.notEqual(p.y,q.y);
  for(let x=0;x<100;x++)assert.ok(terrainWarp(x+1,0,-7).x>terrainWarp(x,0,-7).x,'warp never folds terrain back on itself');
});
