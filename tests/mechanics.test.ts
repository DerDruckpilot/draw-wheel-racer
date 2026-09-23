import test from 'node:test';
import assert from 'node:assert/strict';
import { initPhysics, Simulation } from '../src/physics';
import { createExpedition, groundAt, type Course, type Feature } from '../src/courses';
import { buildAdventure, ADVENTURE_FEATURES } from '../src/adventure-courses';
import { fluidVelocity, waterForces, wheelHydro } from '../src/hydrodynamics';
import { preset } from '../src/shapes';
import { recordExpedition, restoreExpeditions } from '../src/expedition';
await initPhysics();

export function isolated(feature?:Feature):Course {
  const c:Course={...createExpedition(0),segments:[{a:{x:-12,y:0},b:{x:12,y:0},surface:'stone'}],obstacles:[],zones:[],waters:[],muds:[],mechanisms:[],masterRoutes:[],checkpoints:[2],length:60};let x=12;
  if(feature)buildAdventure(feature,c,x,(len,p,surface='stone')=>{for(let i=1;i<p.length;i++)c.segments.push({a:{x:x+p[i-1].x,y:p[i-1].y},b:{x:x+p[i].x,y:p[i].y},surface});x+=len;});
  c.length=x+12;c.segments.push({a:{x,y:0},b:{x:x+70,y:0},surface:'stone'});return c;
}
const run=(sim:Simulation,seconds:number)=>{sim.started=true;for(let i=0;i<seconds*120;i++)sim.tick();};
const finite=(sim:Simulation)=>{for(const car of sim.cars)for(const b of [car.body,...car.wheels])assert.ok([b.translation().x,b.translation().y,b.rotation(),b.linvel().x,b.linvel().y].every(Number.isFinite));};

test('all flooded caves provide an unobstructed remounting bay after the rear axle clears the roof',()=>{
  for(let id=0;id<22;id++){
    const c=createExpedition(id);
    for(const z of c.zones.filter(z=>z.kind==='tidalcave')){
      const roof=c.obstacles.find(o=>o.structure&&o.x>z.start&&o.x<z.end)!;
      const exit=c.segments.find(s=>s.a.x>roof.x+roof.width/2&&s.b.y-s.a.y>.7)!;
      assert.ok(exit.a.x-(roof.x+roof.width/2)>8,`${id}: insufficient exit bay`);
    }
  }
});

test('current acts on relative fluid velocity; eddies shelter and immersed waterfall flow points down',()=>{
  const water={start:-20,end:20,level:1,deep:true,current:{x:1,y:0}},shape=wheelHydro(preset('paddle'))[0];
  const pose={position:{x:0,y:0},center:{x:0,y:0},angle:0,velocity:{x:1,y:0},omega:0,invMass:.5,invInertia:1};
  const drifting=waterForces(shape,pose,water,1/120),still=waterForces(shape,{...pose,velocity:{x:0,y:0}},water,1/120);
  assert.ok(Math.abs(drifting.dragX)<1e-8);assert.ok(still.dragX>0);assert.ok(still.dragPower<=0);
  assert.ok(fluidVelocity({...water,eddies:[{x:0,radius:3,strength:.95}]},0).x<.1);
  assert.ok(fluidVelocity({...water,fall:{x:0,top:3,width:1}},0).y<-1);
});

test('vehicle weight latches a pressure plate, raises the real gate, and fills the basin gradually',()=>{
  const sim=new Simulation(isolated('sluice'),1),car=sim.cars[0],plate=sim.mechanics.machines.find(m=>m.spec.kind==='plate')!,gate=sim.mechanics.machines.find(m=>m.spec.kind==='gate')!;
  car.checkpoint=plate.spec.x;sim.resetCar(0,false);car.brake=1;run(sim,3);
  assert.ok(plate.activated);const low=sim.course.waters[0].level;assert.ok(low> -2.7 && low<-.5);
  run(sim,9);assert.ok(gate.body.translation().y>gate.spec.y+3.5);assert.ok(sim.course.waters[0].level>-.03);finite(sim);sim.dispose();
});

test('a weighted beam needs load on the opposing arm to unlock its gate',()=>{
  const sim=new Simulation(isolated('countergate'),1),lever=sim.mechanics.machines[0],car=sim.cars[0];run(sim,2);assert.equal(lever.activated,false);
  car.checkpoint=lever.spec.x+1.6;sim.resetCar(0,false);for(const b of [car.body,...car.wheels,...car.carriers]){const p=b.translation();b.setTranslation({x:p.x,y:p.y+2},true);}car.brake=1;run(sim,4);assert.ok(lever.activated);assert.ok(sim.mechanics.machines[1].body.translation().y>3);sim.dispose();
});

test('fragile surfaces warn through accumulating damage, fall under load, and restore at the checkpoint',()=>{
  const sim=new Simulation(isolated('fragilepath'),1),m=sim.mechanics.machines[1],car=sim.cars[0];car.checkpoint=m.spec.x;sim.resetCar(0,false);car.brake=1;
  run(sim,2);assert.ok(m.damage>0 && m.damage<1,`warning damage ${m.damage}`);run(sim,25);assert.ok(m.broken);assert.ok(m.body.translation().y<m.spec.y-.3);
  sim.resetCar();assert.equal(m.broken,false);assert.equal(m.damage,0);assert.ok(m.joint);finite(sim);sim.dispose();
});

test('soft soil changes the physical support profile under loaded slipping tyres and resets coherently',()=>{
  const sim=new Simulation(isolated('softground'),1),car=sim.cars[0],soil=sim.mechanics.soils[0];car.checkpoint=27;sim.requestShape(preset('paddle'));sim.resetCar(0,false);car.drive=.8;
  run(sim,16);const depth=Math.max(...soil.depths);assert.ok(depth>.01&&depth<=.48,`depth ${depth}`);assert.ok(soil.nodes.some((p,i)=>p.y<soil.base[i]-.01));finite(sim);
  sim.resetCar();assert.equal(Math.max(...soil.depths),0);assert.equal(groundAt(sim.course,27),-.65);sim.dispose();
});

test('soft wheel strain follows contact load, changes actual colliders, and keeps mass constant',()=>{
  const sim=new Simulation(isolated(),1),car=sim.cars[0],wheel=car.wheels[0],mass=wheel.mass();car.flex[0].stiffness=0;car.brake=1;
  run(sim,2);assert.ok(car.flex[0].amount>.02);assert.equal(car.flex[1].amount,0);assert.ok(Math.abs(wheel.mass()-mass)<.0001);
  for(const b of [car.body,...car.carriers,...car.wheels]){const p=b.translation();b.setTranslation({x:p.x,y:p.y+10},true);b.lockTranslations(true,true);}run(sim,2);assert.ok(car.flex[0].amount<.002);finite(sim);sim.dispose();
});

test('ballast changes the center of mass gradually without changing vehicle mass',()=>{
  const sim=new Simulation(isolated(),1),car=sim.cars[0],mass=car.body.mass(),initial=car.body.localCom().x;
  car.ballastTarget=1;run(sim,.5);assert.ok(car.ballast>0&&car.ballast<1);run(sim,1);assert.ok(car.body.localCom().x>initial+.4);assert.equal(car.body.mass(),mass);car.ballastTarget=-1;run(sim,3);assert.ok(car.body.localCom().x<initial-.4);sim.dispose();
});

test('the lower alternative bypasses master marks; ordered upper-route completion earns a persistent award',()=>{
  const c=isolated('highroute'),sim=new Simulation(c,1),car=sim.cars[0],route=c.masterRoutes![0];
  // Passing the same horizontal positions below the ledges earns nothing.
  for(const mark of route.marks){car.body.setTranslation({x:mark.x,y:-.4},true);sim.mechanics.afterStep();}assert.equal(sim.mechanics.mastered.length,0);
  for(const mark of route.marks){car.body.setTranslation(mark,true);car.body.setLinvel({x:0,y:0},true);sim.mechanics.afterStep();}assert.deepEqual(sim.mechanics.mastered,[route.id]);
  const record=recordExpedition(undefined,1,0,0,{masterRoutes:sim.mechanics.mastered,freightDelivered:false});assert.deepEqual(restoreExpeditions({19:record})[19].masterRoutes,[route.id]);
  sim.resetCar();assert.equal(sim.mechanics.mastered.length,0);sim.dispose();
});

test('freight is a physical moving load; hard impact causes damage and recovery restores the saved cargo',()=>{
  const c=isolated();c.freight={mass:1.7,name:'Messgeräte'};c.length=200;
  const sim=new Simulation(c,1),car=sim.cars[0],cargo=sim.mechanics.cargo!;car.drive=.6;run(sim,5);assert.ok(cargo.health>98);assert.ok(cargo.body.mass()>1);
  cargo.body.setLinvel({x:0,y:-12},true);run(sim,.2);assert.ok(cargo.health<98);sim.resetCar();assert.equal(cargo.health,100);
  cargo.health=0;car.body.setTranslation({x:201,y:2},true);run(sim,1/120);assert.equal(car.finished,false);sim.dispose();
});

test('six new expeditions cover every new mechanic, keep continuous ground and safe recovery aprons',()=>{
  const used=new Set<string>();for(let id=16;id<22;id++){const c=createExpedition(id);c.features.forEach(f=>used.add(f));assert.deepEqual(c,createExpedition(id));for(let i=1;i<c.segments.length;i++)assert.deepEqual(c.segments[i].a,c.segments[i-1].b);for(const cp of c.checkpoints)assert.equal(groundAt(c,cp),0);}
  for(const f of ADVENTURE_FEATURES)assert.ok(used.has(f),f);assert.ok(createExpedition(20).freight);assert.ok(createExpedition(21).waters.some(w=>w.control));
});

test('both master-route alternatives have a reproducible physical solution, not just reachable trigger volumes',()=>{
  for(const [feature,speed] of [['highroute',1],['precisionjump',.8]] as const){
    const sim=new Simulation(isolated(feature),1),car=sim.cars[0];sim.requestShape(preset('grip'));car.drive=speed;sim.started=true;
    for(let i=0;i<120*75&&!car.finished;i++)sim.tick();
    assert.equal(car.finished,true,feature);assert.equal(sim.mechanics.mastered.length,1,feature);assert.equal(car.resets,0);sim.dispose();
  }
});

test('an ice sheet floats at the waterline and develops visible damage under a stopped vehicle',()=>{
  const sim=new Simulation(isolated('thinice'),1),car=sim.cars[0];car.checkpoint=20;sim.resetCar(0,false);car.brake=1;run(sim,4);
  assert.ok(sim.mechanics.machines.some(m=>m.damage>.05));assert.ok(sim.mechanics.machines.every(m=>m.body.translation().y>-1.2));finite(sim);sim.dispose();
});

test('throttle and brake allow opposite pitch corrections while airborne',()=>{
  const angles:number[]=[];
  for(const brake of [false,true]){const sim=new Simulation(isolated(),1),v=sim.cars[0];for(const b of [v.body,...v.carriers,...v.wheels]){const p=b.translation();b.setTranslation({x:p.x,y:p.y+10},true);}v.wheels.forEach(w=>w.setAngvel(-2,true));v.drive=brake?0:1;v.brake=brake?1:0;run(sim,.2);angles.push(v.body.rotation());sim.dispose();}
  assert.ok(angles[0]>angles[1]+.015,`pitch corrections ${angles}`);
});

test('the waterworks has independent filling and draining controls, and their state is saved together',()=>{
  const sim=new Simulation(isolated('waterworks'),1),w=sim.course.waters[0];assert.ok(w.drainControl);assert.equal(sim.mechanics.machines.filter(m=>m.spec.kind==='gate').length,2);
  sim.mechanics.signals.add(w.control!);run(sim,9);assert.ok(w.level>-.02);sim.mechanics.capture();
  sim.mechanics.signals.add(w.drainControl!);run(sim,4);assert.ok(Math.abs(w.level+1.02)<.01);
  sim.resetCar();assert.ok(w.level>-.02);assert.equal(sim.mechanics.signals.has(w.drainControl!),false);sim.dispose();
});

test('soft unpowered rims settle without generating sustained propulsion or runaway bounce',()=>{
  const sim=new Simulation(isolated(),1),v=sim.cars[0];v.flex.forEach(f=>f.stiffness=0);run(sim,8);const p=v.body.translation();run(sim,18);
  assert.ok(Math.abs(v.body.translation().x-p.x)<.4);assert.ok(Math.abs(v.body.linvel().y)<.15);assert.ok(Math.abs(v.body.angvel())<.15);finite(sim);sim.dispose();
});

test('remounting includes cargo headroom and lifts the load with the vehicle when the bay is clear',()=>{
  const c=isolated('freightpass');c.freight={mass:1.7,name:'Messgeräte'};const sim=new Simulation(c,1),v=sim.cars[0];sim.requestShape(preset('compact'));v.checkpoint=22;sim.resetCar(0,false);const old=v.revision;sim.started=true;sim.requestShape(preset('round'));run(sim,1);
  assert.equal(v.revision,old);assert.ok(v.desiredShapes.some(Boolean));v.checkpoint=34;sim.resetCar(0,false);run(sim,1);assert.ok(v.revision>old);assert.ok(sim.mechanics.cargo!.health>99);sim.dispose();
});
