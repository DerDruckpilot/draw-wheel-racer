import test from 'node:test';
import assert from 'node:assert/strict';
import {initWorldPhysics,WorldSimulation} from '../src/world-physics';
import {createWorldLevel,worldHeight,rotatedPoint,localCoordinates,basinWeight} from '../src/world-levels';
import {preset} from '../src/shapes';
import {worldAssets,flatWorld,runFor,placeProp,steerTo} from './world-helpers';
await initWorldPhysics();

test('two weighted plates must remain occupied, and a closing gate stops against the vehicle',()=>{
  const l=flatWorld();l.plates=[0,1].map(i=>({id:'plate-'+i,x:-10,y:.12,z:i*6,yaw:0,width:3,depth:3,threshold:7}));
  l.gates=[{id:'gate',x:8,y:0,z:0,yaw:Math.PI/2,width:5.2,height:3.8,requires:l.plates.map(p=>p.id),mode:'all',travel:4.8,delay:.1,kind:'gate'}];
  l.props=l.plates.map((p,i)=>({id:'crate-'+i,asset:'wooden_crate_01',x:p.x-5,y:0,z:p.z,scale:2.65,yaw:0,mass:10,movable:true}));
  const s=new WorldSimulation(l,worldAssets);placeProp(s.props[0],l.plates[0]);runFor(s,4);assert.ok(s.plates[0].active);assert.ok(s.gates[0].amount<.01,'one signal cannot open an AND gate');
  s.drive=.5;runFor(s,6);assert.ok(s.position.x<7,'the visible closed panel blocks driving through');s.drive=0;
  placeProp(s.props[1],l.plates[1]);runFor(s,4);assert.ok(s.gates[0].amount>.99);
  s.teleport({x:8,y:0,z:0},0);s.brake=1;runFor(s,1);placeProp(s.props[0],{x:-16,y:0,z:0});runFor(s,5);
  assert.ok(s.gates[0].amount>.2);assert.ok(s.gates[0].blocked,'closing gate must not cut through the roof');
  s.teleport({x:16,y:0,z:0},0);runFor(s,4);assert.ok(s.gates[0].amount<.01);s.dispose();
});

test('a found valve is deliberate and draining still requires sustained weight',()=>{
  const l=flatWorld();l.switches=[{id:'valve',x:1,y:0,z:2,yaw:0}];l.plates=[{id:'plate',x:8,y:.12,z:0,yaw:0,width:3,depth:3,threshold:7}];
  l.props=[{id:'box',asset:'wooden_crate_01',x:4,y:0,z:4,yaw:0,scale:2.65,mass:10,movable:true}];
  l.basins=[{id:'pool',x:30,z:0,rx:8,rz:7,angle:0,level:0,bottom:-2.4,material:'water',waves:.2,current:{x:0,z:0},controlledBy:'plate',requires:['valve'],drainedLevel:-1.8}];
  const s=new WorldSimulation(l,worldAssets);runFor(s,1);assert.equal(s.latchedSwitches.size,0,'driving near a valve is not operating it');
  placeProp(s.props[0],l.plates[0]);runFor(s,4);assert.equal(s.basinLevels.get('pool'),0);
  assert.ok(s.interact());runFor(s,7);assert.ok(s.basinLevels.get('pool')!<-1.7);
  placeProp(s.props[0],{x:4,y:0,z:4});runFor(s,6);assert.ok(s.basinLevels.get('pool')!>-.9,'water rises again when the weight is removed');s.dispose();
});

test('real cars can push and park the supplied crates on authored pressure plates',()=>{
  for(const id of [0,1,3,6,12,18,20]){
    const l=createWorldLevel(id),s=new WorldSimulation(l,worldAssets),p=l.plates[0],crate=s.props.find(o=>o.spec.movable&&Math.hypot(o.spec.x-p.x,o.spec.z-p.z)<6)!;
    // A low bumper pushes a human-scale crate. Oversized wheels can straddle
    // it; the live axle sliders are part of preparing the vehicle for the job.
    s.setWheelSize(0,.65);s.setWheelSize(1,.65);
    const start=rotatedPoint(p,p.yaw,-9,.2);start.y=worldHeight(l,start.x,start.z);s.teleport(start,p.yaw);runFor(s,2);s.drive=.3;
    for(let i=0;i<1500&&localCoordinates(p,crate.body.translation().x,crate.body.translation().z).x<-.15;i++)s.tick();
    assert.ok(localCoordinates(p,crate.body.translation().x,crate.body.translation().z).x>-.4,`${id}: crate can reach the plate`);
    s.drive=0;s.brake=1;runFor(s,.2);s.brake=0;s.drive=-.22;runFor(s,2.5);s.drive=0;runFor(s,2);
    assert.ok(s.plates[0].active,`${id}: parked weight keeps its signal without the car`);s.dispose();
  }
});

test('every authored sluice requires draining and has a drivable exit from its exposed supply',()=>{
  for(const id of [2,7,14,18]){
    const l=createWorldLevel(id),s=new WorldSimulation(l,worldAssets,[preset('paddle'),preset('paddle')]);
    const b=l.basins.find(b=>b.controlledBy==='drain')!,cache=l.caches.find(c=>c.id==='submerged-cell')!;
    s.teleport({x:cache.x,y:b.level,z:cache.z},0);runFor(s,8);
    assert.ok(!s.collected.has(cache.id),`${id}: waves cannot grant the underwater supply without draining`);
    const plate=l.plates.find(p=>p.id==='drain')!,crate=s.props.find(p=>p.spec.movable&&Math.hypot(p.spec.x-plate.x,p.spec.z-plate.z)<6)!;
    placeProp(crate,plate);const valve=l.switches.find(v=>v.id==='drain-valve')!;
    s.teleport({...valve,x:valve.x-2.2},0);s.brake=1;runFor(s,3);assert.ok(s.interact(),`${id}: drain control must be reachable at ${JSON.stringify(s.position)} with speed ${s.signedSpeed}`);runFor(s,12);
    assert.ok(s.basinLevels.get(b.id)!<cache.y-.2,`${id}: the weighted, opened sluice exposes the crate`);
    const exit={x:b.x+Math.cos(b.angle)*b.accessSide!*b.rx*1.35,z:b.z+Math.sin(b.angle)*b.accessSide!*b.rx*1.35};
    s.teleport({x:cache.x,y:worldHeight(l,cache.x,cache.z),z:cache.z},-Math.atan2(exit.z-cache.z,exit.x-cache.x));runFor(s,3);
    assert.ok(s.collected.has(cache.id),`${id}: the exposed supply can be collected`);
    s.requestShape(preset('round'),0);s.requestShape(preset('round'),1);runFor(s,.4);s.drive=.5;s.weightTarget=.4;
    let escaped=false;for(let n=0;n<2700;n++){steerTo(s,exit.x,exit.z);s.tick();if(basinWeight(b,s.position.x,s.position.z)>1.16&&s.position.y>b.level){escaped=true;break;}}
    assert.ok(escaped,`${id}: a collected supply must not strand the car in the empty basin`);s.dispose();
  }
});

test('every freight lift can carry the car to its required supply cache',()=>{
  for(const id of [5,13,19]){
    const l=createWorldLevel(id),s=new WorldSimulation(l,worldAssets),g=s.gates.find(g=>g.spec.kind==='lift')!,p=l.plates.find(p=>p.id==='lift-weight')!;
    const crate=s.props.find(o=>o.spec.movable&&Math.hypot(o.spec.x-p.x,o.spec.z-p.z)<6)!;placeProp(crate,p);runFor(s,3);assert.equal(g.amount,0,'the platform waits for the driver');
    s.teleport({x:g.spec.x,y:g.spec.y+.48,z:g.spec.z},-Math.PI/2);runFor(s,2);assert.ok(s.interact(),'the platform control is reachable');runFor(s,10);
    assert.ok(g.amount>.99);assert.ok(s.position.y>g.spec.y+5.5);
    s.drive=.22;runFor(s,8);assert.ok(s.collected.has('high-cell'),`${id}: the landing and supply cache are reachable`);s.dispose();
  }
});

test('cars can park the supplied counterweights and reach every raised island, while unweighted driving fails',()=>{
  for(const id of [1,8,10])for(const loaded of [false,true]){
    const l=createWorldLevel(id),s=new WorldSimulation(l,worldAssets,loaded?[preset('grip'),preset('compact')]:undefined),b=l.bridges[0],crate=s.props.find(p=>p.spec.id==='balance-ballast')!;
    if(loaded){
      s.teleport({x:crate.spec.x-3.9,y:worldHeight(l,crate.spec.x-3.9,crate.spec.z),z:crate.spec.z},0);runFor(s,2);s.drive=.6;s.weightTarget=.3;
      for(let n=0;n<3600&&crate.body.translation().x<b.x-6.95;n++){
        // Start with a low front bumper, then lift it for the sloping apron.
        // This is a physical use of the new size control, not a crate teleport.
        if(crate.body.translation().x>b.x-9)s.setWheelSize(1,1.4);
        steerTo(s,s.position.x+5,crate.spec.z);s.tick();
      }
      s.drive=0;s.brake=1;runFor(s,.2);s.brake=0;s.drive=-.3;runFor(s,3);s.drive=0;runFor(s,2);
      assert.ok(crate.body.translation().x-crate.initial.x>4.8,`${id}: the supplied weight must be physically pushable onto the deck`);
      s.setWheelSize(0,1);s.setWheelSize(1,1);s.requestShape(preset('round'),0);s.requestShape(preset('round'),1);runFor(s,.5);
    }
    else placeProp(crate,{x:b.x-18,y:worldHeight(l,b.x-18,b.z-12),z:b.z-12});
    // Only the vehicle is repositioned to the approach lane; the parked cargo
    // and its actual load on the deck remain exactly where driving left them.
    s.teleport({x:b.x-11,y:worldHeight(l,b.x-11,b.z),z:b.z+.7},0);runFor(s,3);s.drive=.28;s.weightTarget=-.5;
    runFor(s,26,()=>steerTo(s,s.position.x+4,b.z+.6));
    s.requestShape(preset('grip'),1);s.drive=.35;s.weightTarget=.6;runFor(s,8,()=>steerTo(s,s.position.x+4,b.z+.6));
    if(!loaded)assert.ok(!s.collected.has('balance-cell'),`${id}: driving the same approach without the parked weight must not collect the raised supply`);
    else assert.ok(s.collected.has('balance-cell'),`${id}: counterweight holds the bridge and the front tread clears the landing`);
    s.dispose();
  }
});
