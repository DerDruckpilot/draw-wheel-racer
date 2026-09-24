import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,BufferGeometry} from 'three';
import {ChaseCamera} from '../src/chase-camera';
import {WorldSimulation,initWorldPhysics} from '../src/world-physics';
import {worldAssets,flatWorld,runFor} from './world-helpers';
import {updateWheelGeometry} from '../src/wheel-mesh';
import {wheelStrokeCore,WHEEL_WIDTH} from '../src/wheel-profile';
await initWorldPhysics();

test('loaded tyres turn tightly in both directions, forward and reverse',()=>{
  for(const drive of [-.35,.35])for(const steering of [-.85,.85]){
    const sim=new WorldSimulation(flatWorld(),worldAssets);sim.setWheelSize(0,.55);sim.setWheelSize(1,.55);runFor(sim,1);sim.drive=drive;runFor(sim,2);sim.steering=steering;
    let heading=sim.heading,angle=0,distance=0,p={...sim.position};
    runFor(sim,7,()=>{angle+=Math.atan2(Math.sin(sim.heading-heading),Math.cos(sim.heading-heading));heading=sim.heading;distance+=Math.hypot(sim.position.x-p.x,sim.position.z-p.z);p={...sim.position};});
    assert.equal(Math.sign(angle),Math.sign(drive*steering));assert.ok(distance/Math.abs(angle)<5.3,'crawl radius stays below 5.3 world units');assert.ok(Math.abs(angle)>1.5);sim.dispose();
  }
});

test('broad strokes preserve their drawing outline and form closed contact solids',()=>{
  const geometry=new BufferGeometry();updateWheelGeometry(geometry,[{x:-1,y:0},{x:1,y:0}]);geometry.computeBoundingBox();
  const box=geometry.boundingBox!;assert.ok(Math.abs(box.max.z-box.min.z-WHEEL_WIDTH)<.001);assert.ok(box.max.y<.15&&box.min.y>-.15,'depth is not thicker ink in the drawing plane');
  const {vertices,indices}=wheelStrokeCore(1),edges=new Map<string,number>();
  for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const key=[indices[i+j],indices[i+(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}
  assert.ok([...edges.values()].every(n=>n===2),'the extruded contact solid has no missing caps');assert.ok([...vertices].every(Number.isFinite));geometry.dispose();
});

test('uneven cross ruts stay controllable, while a severe overturn is not auto-corrected',()=>{
  const level=flatWorld();level.features=[{id:'ruts',kind:'washout',x:10,y:0,z:0,yaw:0,length:28,width:7,height:.45,phase:1.3}];
  const sim=new WorldSimulation(level,worldAssets);runFor(sim,1);sim.drive=.4;let up=1;
  runFor(sim,10,()=>{up=Math.min(up,new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(sim.body.rotation())).y);});
  assert.ok(sim.position.x>12,'the car crosses the uneven patch');assert.ok(up>.72,'moderate cross ruts cannot immediately throw the car onto its side');assert.equal(sim.rescues,0);
  sim.drive=0;sim.teleport({x:60,y:2.5,z:0},0);const center=new Vector3().copy(sim.position),roll=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),2.65);
  for(const body of sim.carBodies){body.setTranslation(new Vector3().copy(body.translation()).sub(center).applyQuaternion(roll).add(center),true);body.setRotation(roll.clone().multiply(new Quaternion().copy(body.rotation())),true);}
  runFor(sim,4);assert.ok(new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(sim.body.rotation())).y<.2,'there is no invisible upright lock or automatic righting');sim.dispose();
});

test('remounting many separate strokes as a ring rebuilds topology even at the same vertex count',()=>{
  const strokes=Array.from({length:28},(_,i)=>[.73,1.03].map((r,j)=>({x:Math.cos((i+.17)/28*Math.PI*2)*r,y:Math.sin((i+.17)/28*Math.PI*2)*r,...(j===0&&i?{move:true as const}:{})}))).flat();
  const ring=Array.from({length:45},(_,i)=>({x:Math.cos((i+.17)/44*Math.PI*2)*.9,y:Math.sin((i+.17)/44*Math.PI*2)*.9}));
  const reused=new BufferGeometry(),fresh=new BufferGeometry();updateWheelGeometry(reused,strokes);const count=reused.attributes.position.count;
  updateWheelGeometry(reused,ring);updateWheelGeometry(fresh,ring);
  assert.equal(fresh.attributes.position.count,count,'the regression needs two different topologies with identical vertex counts');
  assert.deepEqual(reused.index!.array,fresh.index!.array);assert.deepEqual(reused.attributes.position.array,fresh.attributes.position.array);
  assert.deepEqual(reused.attributes.normal.array,fresh.attributes.normal.array);reused.dispose();fresh.dispose();
});

const clear=(a:Vector3,b:Vector3)=>a.distanceTo(b);
test('crawl camera filters chassis bob and steering corrections without reversing its view',()=>{
  const rig=new ChaseCamera(),heights:number[]=[],headings:number[]=[];let previous=new Vector3(),maximumStep=0;
  for(let i=0;i<300;i++){
    const t=i/60,p=new Vector3(0,1.7+Math.sin(t*14)*.28,0);
    const frame=rig.update({position:p,heading:Math.sin(t*9)*.14,speed:Math.sin(t*4)*.4,upright:1},0,.53,1/60,false,false,()=>0,clear);
    if(i>60){heights.push(frame.position.y);headings.push(rig.heading);maximumStep=Math.max(maximumStep,previous.distanceTo(frame.position));}previous.copy(frame.position);
  }
  assert.ok(Math.max(...heights)-Math.min(...heights)<.16,'short vertical strokes are not copied by the camera');assert.ok(Math.max(...headings)-Math.min(...headings)<.005,'small reverse/crawl corrections keep a steady heading');assert.ok(maximumStep<.035);
});

test('camera recovers gradually from obstructions and keeps manual orbit immediate',()=>{
  const rig=new ChaseCamera(),pose={position:new Vector3(0,1.7,0),heading:0,speed:0,upright:1};
  rig.update(pose,0,.53,1/60,true,false,()=>0,clear);
  for(let i=0;i<70;i++)rig.update(pose,0,.53,1/60,false,false,()=>0,(a,b)=>Math.min(clear(a,b),5));
  const near=rig.position.clone();rig.update(pose,0,.53,1/60,false,false,()=>0,clear);assert.ok(rig.position.distanceTo(near)<.03,'unblocking cannot instantly extend the boom');
  for(let i=0;i<300;i++)rig.update(pose,0,.53,1/60,false,false,()=>0,clear);
  const before=rig.position.clone();rig.update(pose,Math.PI,.53,1/60,false,true,()=>0,clear);assert.ok(rig.position.distanceTo(before)>18,'a deliberate orbit is not delayed by the crawl smoothing');
});
