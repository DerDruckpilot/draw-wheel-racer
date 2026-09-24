import test from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {initWorldPhysics,WorldSimulation} from '../src/world-physics';
import {createWorldLevel,worldHeight,rotatedPoint,localCoordinates,dist} from '../src/world-levels';
import {preset} from '../src/shapes';
import {worldAssets,flatWorld,runFor,steerTo} from './world-helpers';
import {WheelTrails} from '../src/wheel-trails';
await initWorldPhysics();

test('low natural vaults stop large wheels while compact wheels can drive through',()=>{
  for(const id of [0,11])for(const kind of ['round','compact'] as const){
    const level=createWorldLevel(id),roof=level.props.find(p=>p.anchored&&p.asset==='rock_09'&&Math.abs(p.pitch??1)<.1)!;
    const sim=new WorldSimulation(level,worldAssets,[preset(kind),preset(kind)]),start=rotatedPoint(roof,roof.yaw,-3,0),exit=rotatedPoint(roof,roof.yaw,12,0);
    sim.teleport({...start,y:worldHeight(level,start.x,start.z)},roof.yaw);runFor(sim,1);sim.drive=.5;
    let lateral=0;runFor(sim,16,()=>{steerTo(sim,exit.x,exit.z);const p=localCoordinates(roof,sim.position.x,sim.position.z);if(p.x>-3&&p.x<6)lateral=Math.max(lateral,Math.abs(p.z));});
    const p=localCoordinates(roof,sim.position.x,sim.position.z);
    if(kind==='round')assert.ok(p.x<0,`${id}: large wheels cannot simply force the roof aside`);
    else{assert.ok(p.x>8,`${id}: compact wheels reach the far side`);assert.ok(lateral<.8,'the solution actually passes through the opening rather than driving around it');}
    sim.dispose();
  }
});

test('thin straight bars have enough axle torque to lift and propel the vehicle',()=>{
  const line=[{x:-1.15,y:0},{x:1.15,y:0}],sim=new WorldSimulation(flatWorld(),worldAssets,[line,line]);runFor(sim,1);
  let low=Infinity,high=-Infinity;const start={...sim.position};sim.drive=.6;
  runFor(sim,8,()=>{low=Math.min(low,sim.position.y);high=Math.max(high,sim.position.y);});
  assert.ok(high-low>.8,'the long lever can raise the loaded chassis');assert.ok(dist(start,sim.position)>7,'bars are usable wheels, not stalled ornaments');assert.ok(Number.isFinite(sim.signedSpeed));sim.dispose();
});

test('full vehicles gain real paddle propulsion without flipping in cross waves',()=>{
  const distances=[];
  for(const kind of ['round','paddle'] as const){
    const level=flatWorld();level.basins=[{id:'lake',x:0,z:0,rx:80,rz:50,angle:0,level:.2,bottom:-3,material:'water',waves:.25,current:{x:0,z:0}}];
    const sim=new WorldSimulation(level,worldAssets,[preset(kind),preset(kind)]);runFor(sim,3);const start=sim.position.x;let upright=1;sim.drive=.8;
    runFor(sim,10,()=>{upright=Math.min(upright,new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(sim.body.rotation())).y);});
    distances.push(sim.position.x-start);assert.ok(upright>.85,'powered paddling remains stable in waves');sim.dispose();
  }
  assert.ok(distances[1]>distances[0]*3,'paddle geometry changes the achievable crossing speed');
});

test('hidden camps give compact wheels a clear and stable place to resume',()=>{
  for(const id of [0,5,11,12,18,20]){
    const level=createWorldLevel(id),sim=new WorldSimulation(level,worldAssets,[preset('compact'),preset('compact')]);
    for(const camp of level.camps){
      sim.world.intersectionsWithShape({x:camp.x,y:camp.y+.7,z:camp.z},{x:0,y:0,z:0,w:1},new RAPIER.Ball(1.15),other=>{
        assert.ok(!sim.props.some(p=>p.collider.handle===other.handle&&!p.spec.movable),`${id}/${camp.id}: a late scenery pass cannot place a rock in the rescue clearing`);return true;
      });
      sim.checkpoint=camp;sim.rescue(false);runFor(sim,2);
      assert.ok(dist(sim.position,camp)<1.5,`${id}/${camp.id}: the camp does not throw the car off its clearing`);
      assert.ok(new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(sim.body.rotation())).y>.9);
      for(let i=0;i<sim.body.numColliders();i++)sim.world.contactPairsWith(sim.body.collider(i),other=>{
        if(!sim.props.some(p=>p.collider.handle===other.handle))return;
        sim.world.contactPair(sim.body.collider(i),other,m=>assert.equal(m.numSolverContacts(),0,`${id}/${camp.id}: decoration must not trap the chassis`));
      });
    }
    sim.dispose();
  }
});

test('optional relics remain outside solid scenery, including completed cave vaults',()=>{
  for(const id of [0,7,12,20]){
    const level=createWorldLevel(id),sim=new WorldSimulation(level,worldAssets);
    for(const relic of level.caches.filter(c=>c.kind==='relic'))sim.world.intersectionsWithShape(relic,{x:0,y:0,z:0,w:1},new RAPIER.Ball(.4),other=>{
      const prop=sim.props.find(p=>p.collider.handle===other.handle);
      assert.ok(!prop||prop.spec.movable,`${id}/${relic.id}: the reward is inside ${prop?.spec.asset}`);return true;
    });
    sim.dispose();
  }
});

test('recent tracks come from loaded ground contacts, never from wheels turning in the air',()=>{
  const sim=new WorldSimulation(flatWorld(),worldAssets),trails=new WheelTrails();sim.drive=.5;
  runFor(sim,4,()=>trails.update(sim));assert.ok(trails.mesh.count>30,'driving leaves a recognizable recent trail');
  const count=trails.mesh.count;sim.teleport({x:sim.position.x,y:12,z:sim.position.z},0);sim.drive=.5;
  runFor(sim,.4,()=>trails.update(sim));assert.equal(trails.mesh.count,count,'airborne motion cannot paint distant terrain');
  trails.clear();assert.equal(trails.mesh.count,0);sim.dispose();trails.mesh.geometry.dispose();(trails.mesh.material as any).dispose();trails.mesh.dispose();
});
