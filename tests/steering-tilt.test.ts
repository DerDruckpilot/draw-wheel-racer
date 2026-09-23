import test from 'node:test';
import assert from 'node:assert/strict';
import {TiltFilter,screenTilt} from '../src/tilt-controls';
import {initPhysics,Simulation} from '../src/physics';
import {createExpedition,type Course} from '../src/courses';
import {buildAdventure} from '../src/adventure-courses';
import {preset} from '../src/shapes';
await initPhysics();
function track(feature?:'sluice'|'countergate'):Course{
  const c:Course={...createExpedition(0),segments:[{a:{x:-20,y:0},b:{x:12,y:0},surface:'stone'}],obstacles:[],zones:[],waters:[],muds:[],mechanisms:[],masterRoutes:[],checkpoints:[2],length:80};let x=12;
  if(feature)buildAdventure(feature,c,x,(len,p,surface='stone')=>{for(let i=1;i<p.length;i++)c.segments.push({a:{x:x+p[i-1].x,y:p[i-1].y},b:{x:x+p[i].x,y:p[i].y},surface});x+=len;});
  c.length=x+45;c.segments.push({a:{x,y:0},b:{x:x+90,y:0},surface:'stone'});return c;
}
function run(sim:Simulation,seconds:number,control?:(sim:Simulation)=>void){sim.started=true;for(let i=0;i<seconds*120;i++){control?.(sim);sim.tick();}}
test('both landscape orientations map the same physical screen tilt to the same two controls',()=>{
  const outputs=[];for(const angle of [90,270]){const f=new TiltFilter();f.calibrate({angle,beta:0,gamma:0});for(let i=0;i<100;i++)f.update({angle,beta:angle===90?-20:20,gamma:0},1/60);outputs.push(f.weight);assert.ok(Math.abs(f.steer)<.001);}
  assert.ok(outputs.every(v=>v>.99));assert.ok(Math.abs(outputs[0]-outputs[1])<.001);
  const a=screenTilt({angle:90,beta:0,gamma:12}),b=screenTilt({angle:270,beta:0,gamma:-12});assert.ok(Math.abs(a.pitch-b.pitch)<.001);
});
test('calibration removes holding angle, dead zone suppresses jitter, and rotating the screen recenters',()=>{
  const f=new TiltFilter(),held={beta:8,gamma:42,angle:90};f.calibrate(held);
  for(let i=0;i<60;i++)f.update({...held,beta:8+Math.sin(i)*.5},1/60);
  assert.ok(Math.abs(f.weight)<.001&&Math.abs(f.steer)<.001);
  f.update({...held,beta:-20},.1);assert.ok(f.weight>0);f.update({...held,angle:270},.1);assert.equal(f.weight,0);assert.equal(f.steer,0);
});
test('soft wheels lose substantial loaded height while remaining stable and mass-conserving',()=>{
  const results=[];for(const stiffness of [1,0]){const sim=new Simulation(track(),1),v=sim.cars[0],mass=v.wheels[0].mass();v.flex.forEach(f=>f.stiffness=stiffness);run(sim,10);results.push(v.body.translation().y);if(!stiffness)assert.ok(v.flex.every(f=>f.amount>.5));assert.equal(v.wheels[0].mass(),mass);assert.ok(Math.abs(v.body.linvel().y)<.15);sim.dispose();}
  assert.ok(results[0]-results[1]>.4,`ride heights ${results}`);
});
test('full weight shift spans more than two chassis units without adding mass',()=>{
  const sim=new Simulation(track(),1),v=sim.cars[0],mass=v.body.mass();v.ballastTarget=-1;run(sim,1.2);const rear=v.body.localCom().x;v.ballastTarget=1;run(sim,1.5);assert.ok(v.body.localCom().x-rear>2.3);assert.equal(v.body.mass(),mass);sim.dispose();
});
test('a straight drive bypasses both sluice switches; choosing the side actually changes the water',()=>{
  const states=[];for(const side of [0,-.9,.9]){const sim=new Simulation(track('sluice'),1),v=sim.cars[0];v.drive=.6;
    run(sim,15,()=>v.lateral.input=Math.max(-1,Math.min(1,(side-v.lateral.offset)*3)));
    states.push({signals:[...sim.mechanics.signals],level:sim.course.waters[0].level,x:v.body.translation().x});assert.equal(v.resets,0);sim.dispose();}
  assert.deepEqual(states[0].signals,[]);assert.equal(states[0].level,-2.7);assert.ok(states[0].x>40);
  assert.equal(states[1].signals.length,1);assert.ok(states[1].level>-.02);assert.ok(states[1].x<states[0].x-5,'flooding changes the same wheel drawing’s progress');
  assert.ok(states[2].signals[0].endsWith('outflow'));
});
test('opposite shore controls can reverse a water decision and recovery restores the chosen state',()=>{
  const sim=new Simulation(track('sluice'),1),v=sim.cars[0],water=sim.course.waters[0];
  const press=(side:number)=>{v.checkpoint=18;v.lateral.checkpoint=side;sim.resetCar(0,false);v.brake=1;run(sim,10);};
  press(-.9);assert.ok(water.level>-.01);sim.mechanics.capture();
  // Reposition just the car to test an opposite input without restoring mechanics.
  v.lateral.offset=.9;sim.steering.sync();run(sim,11);assert.ok(water.level< -2.6);assert.ok(!sim.mechanics.signals.has(water.control!));
  sim.resetCar();assert.ok(water.level>-.01);assert.ok(sim.mechanics.signals.has(water.control!));sim.dispose();
});
test('steering avoids an offset rock through changed contacts and cannot enter its side',()=>{
  const positions=[];for(const steer of [0,1]){const c=track();c.obstacles.push({kind:'boulder',x:18,y:.85,width:1.5,height:1.7,lane:0,lateral:-.9,depth:.9,outline:[{x:-.75,y:-.85},{x:.75,y:-.85},{x:.65,y:.65},{x:0,y:.85},{x:-.7,y:.5}]});const sim=new Simulation(c,1),v=sim.cars[0];sim.requestShape(preset('compact'));v.drive=.8;v.lateral.input=steer;run(sim,14);positions.push(v.body.translation().x);assert.equal(v.resets,0);
    if(steer){assert.ok(v.lateral.offset>.95);const side=sim.steering.sides[0];side.x=v.body.translation().x;side.collider.setTranslation({x:side.x,y:.85});v.lateral.input=-1;v.body.setTranslation({x:side.x,y:1},true);v.body.setLinvel({x:1,y:0},true);sim.steering.tick(.1);assert.ok(v.lateral.offset>=side.z+side.depth/2+1.03);}
    sim.dispose();}
  assert.ok(positions[1]>positions[0]+8,`positions ${positions}`);
});
test('unselected loose stones retain floor collision instead of falling out of the world',()=>{
  const c=track();c.mechanisms=[{id:'rock',kind:'loose',x:10,y:1,width:1,height:1,lateral:-.9,depth:.8}];const sim=new Simulation(c,1),v=sim.cars[0];v.lateral.offset=1.05;sim.steering.sync();run(sim,5);assert.ok(sim.mechanics.machines[0].body.translation().y>.45);sim.dispose();
});

test('the rocky route bypasses the counterweight gate without activating its lever',()=>{
  const sim=new Simulation(track('countergate'),1),v=sim.cars[0];sim.requestShape(preset('grip'));v.drive=.65;
  run(sim,35,()=>{const side=v.body.translation().x>24?-.95:0;v.lateral.input=Math.max(-1,Math.min(1,(side-v.lateral.offset)*4));});
  assert.ok(v.body.translation().x>50);assert.equal(v.resets,0);assert.equal(sim.mechanics.signals.size,0);sim.dispose();
});
