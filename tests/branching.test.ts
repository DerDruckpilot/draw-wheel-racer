import test from 'node:test';
import assert from 'node:assert/strict';
import {createCourse,createExpedition,EXPEDITION_COUNT,groundAt,type Course} from '../src/courses';
import {PATH_CENTERS,PATH_WIDTH,pathCenter,bandCenter,inBand} from '../src/branching';
import {branchTerrain,terrainHeight} from '../src/branch-terrain';
import {initPhysics,Simulation} from '../src/physics';
import {preset} from '../src/shapes';
import {waterHeight,waveVelocity} from '../src/waves';
import {assertJoinedGround} from './course-assertions';
import {hooks} from '../scripts/expedition-driver';
await initPhysics();
const run=(sim:Simulation,seconds:number,control?:()=>void)=>{sim.started=true;for(let i=0;i<seconds*120;i++){control?.();sim.tick();}};

test('expeditions offer curved, merging alternatives with real challenges and no sealed dead-end wall',()=>{
  for(let id=0;id<EXPEDITION_COUNT;id++){
    const c=createExpedition(id);assertJoinedGround(c);
    assert.ok(c.routes!.halfWidth>=9);assert.ok(c.routes!.forks.length>=4);
    assert.ok(c.routes!.forks.every(f=>f.paths.length>=2));
    for(const [i,fork] of c.routes!.forks.entries()){
      assert.equal(new Set(fork.paths.map(p=>p.features.join('/'))).size,fork.paths.length);
      assert.equal(groundAt(c,fork.decision),0);
      for(const p of fork.paths){
        assert.ok(Math.abs(pathCenter(p,fork.start))<1e-8&&Math.abs(pathCenter(p,fork.end))<1e-8);
        assert.ok(p.features.length>=2);
      }
      if(i)assert.ok(fork.start-c.routes!.forks[i-1].end<=8.001,'no empty wide plazas');
    }
    assert.ok(!c.obstacles.some(o=>o.deadEnd));assert.ok(c.waters.every(w=>!w.fall));
  }
});

function channels():Course{
  const c=createCourse(0,true);Object.assign(c,{segments:[{a:{x:-30,y:0},b:{x:12,y:0},surface:'stone'}],obstacles:[],zones:[],waters:[],muds:[],mechanisms:[],masterRoutes:[],checkpoints:[2],length:100,routes:{halfWidth:9.8,forks:[]}});
  for(const [channel,lateral] of PATH_CENTERS.entries()){
    const y=[-3,0,3][channel];c.segments.push({a:{x:12,y:0},b:{x:20,y},surface:'stone',lateral,channel,depth:PATH_WIDTH},{a:{x:20,y},b:{x:140,y},surface:'stone',lateral,channel,depth:PATH_WIDTH});
  }
  c.waters.push({start:20,end:100,level:0,deep:true,lateral:-7,depth:PATH_WIDTH,channel:0});
  return c;
}

test('selected ground and water affect the car while higher terrain in another arm does not',()=>{
  const heights:number[]=[];
  for(const lateral of PATH_CENTERS){
    const sim=new Simulation(channels(),1),car=sim.cars[0];car.checkpoint=35;car.lateral.checkpoint=lateral;sim.resetCar(0,false);car.brake=1;run(sim,4);
    heights.push(car.body.translation().y);
    assert.equal(car.water>.1,lateral===-7);assert.equal(car.resets,0);sim.dispose();
  }
  assert.ok(heights[0]<.7);assert.ok(heights[1]>.8&&heights[1]<1.4);assert.ok(heights[2]>3.8&&heights[2]<4.4);
});

test('loose obstacles rest on their own profile and cannot hit a neighboring rock spine',()=>{
  const c=channels();c.waters=[];
  for(const [channel,lateral] of PATH_CENTERS.entries())c.mechanisms!.push({id:'loose-'+channel,kind:'loose',x:35,y:5,width:1,height:1,lateral,depth:1,channel});
  c.segments.push({a:{x:25,y:8},b:{x:45,y:8},surface:'stone',lateral:3.5,depth:1.4,ridge:true});
  const sim=new Simulation(c,1);run(sim,4);
  for(const m of sim.mechanics.machines)assert.ok(Math.abs(m.body.translation().y-([-3,0,3][m.spec.channel!]+.5))<.08);
  sim.dispose();
});

test('sideways entry cannot enable a rock collider inside the chassis',()=>{
  const c=channels();c.waters=[];c.obstacles.push({kind:'boulder',x:32,y:0,width:8,height:5,lateral:0,depth:PATH_WIDTH,channel:1,lane:0,outline:[{x:-4,y:-1},{x:4,y:-1},{x:4,y:5},{x:-4,y:5}]});
  const sim=new Simulation(c,1),car=sim.cars[0];car.checkpoint=31;car.lateral.checkpoint=7;sim.resetCar(0,false);car.lateral.input=-1;
  for(const b of [car.body,...car.wheels,...car.carriers])b.lockTranslations(true,true);
  for(let i=0;i<240;i++){car.lateral.velocity=-3;sim.steering.tick(1/120);}
  assert.ok(car.lateral.offset>3.8);assert.ok(Number.isFinite(car.body.translation().y));sim.dispose();
});

test('recessed fill and drain plates keep their independent choice after branching',()=>{
  const c=createExpedition(16),w=c.waters.find(w=>w.control)!,plate=c.mechanisms!.find(m=>m.kind==='plate'&&m.signal===w.control)!;
  const sim=new Simulation(c,1),car=sim.cars[0];car.checkpoint=plate.x;car.lateral.checkpoint=plate.lateral!+.95;sim.resetCar(0,false);car.brake=1;run(sim,3);
  assert.ok(sim.mechanics.signals.has(w.control!));assert.ok(!sim.mechanics.signals.has(w.drainControl!));assert.ok(w.level>-2.7);assert.equal(car.resets,0);sim.dispose();
});

test('a driver can explore a bending arm, reverse to its junction and choose the other arm',()=>{
  const c=createExpedition(0),fork=c.routes!.forks[0],first=fork.paths[0],other=fork.paths[1];
  const sim=new Simulation(c,1),car=sim.cars[0];sim.requestShape(hooks);car.drive=.5;sim.started=true;
  const steer=(p:typeof first)=>{
    car.lateral.input=Math.max(-1,Math.min(1,(pathCenter(p,car.body.translation().x+Math.sign(car.body.linvel().x||1)*1.5)-car.lateral.offset)*3))*Math.sign(car.body.linvel().x||1);
    // The return crosses a dome uphill. Use the same available weight control
    // as the player, rather than assuming a reverse pedal alone climbs it.
    car.ballastTarget=Math.max(-1,Math.min(1,car.body.rotation()*1.3+car.body.angvel()*.35));
  };
  for(let i=0;i<120*30&&car.body.translation().x<fork.start+27;i++){steer(first);sim.tick();}
  assert.ok(car.body.translation().x>fork.start+25);assert.ok(car.lateral.offset<-4);
  car.drive=-.6;
  for(let i=0;i<120*45&&car.body.translation().x>fork.start-3;i++){steer(first);sim.tick();}
  assert.ok(car.body.translation().x<fork.start-2,'the entry remains accessible in reverse');
  car.drive=.5;
  for(let i=0;i<120*30&&car.body.translation().x<fork.start+26;i++){steer(other);sim.tick();}
  assert.ok(car.lateral.offset>4);assert.ok(car.body.translation().x>fork.start+25);assert.equal(car.resets,0);sim.dispose();
});

test('wave height is bounded, fades into the shore and orbital flow decays with depth',()=>{
  const w={start:0,end:40,level:0,deep:true,waves:{amplitude:.35,wavelength:6.6,period:2.35,phase:0},time:0};
  for(let t=0;t<7;t+=.1){w.time=t;assert.equal(waterHeight(w,0),0);assert.equal(waterHeight(w,40),0);for(let x=0;x<40;x+=.2)assert.ok(Math.abs(waterHeight(w,x))<=.536);}
  const top=waveVelocity(w,15,0),bottom=waveVelocity(w,15,-3);assert.ok(Math.hypot(bottom.x,bottom.y)<Math.hypot(top.x,top.y)*.1);
});

test('curved water and road edges share coordinates, and transverse waves fade before the mesh boundary',()=>{
  const c=createExpedition(17),w=c.waters.find(w=>w.waves)!;
  let across=0;
  for(let x=w.start+4;x<w.end-4;x+=1.1){
    const center=bandCenter(w,x);
    assert.ok(inBand(w,center,0,x));assert.ok(!inBand(w,center+4,0,x));
    for(let time=0;time<5;time+=.3){
      w.time=time;
      assert.ok(Math.abs(waterHeight(w,x,center+w.depth!/2+.8)-w.level)<1e-8);
      across=Math.max(across,Math.abs(waterHeight(w,x,center-1)-waterHeight(w,x,center+1)));
    }
  }
  assert.ok(across>.12,'wave crests do not move the entire channel in phase');
  const path=c.routes!.forks[0].paths[0],s=c.segments.find(s=>s.curve===path.curve&&s.a.x>path.curve.start+22)!;
  const data=branchTerrain(c,[s]);assert.ok(data.positions.every(Number.isFinite));
  assert.ok(Math.abs(data.positions[2]-1-(bandCenter(s,s.a.x)-PATH_WIDTH/2))<1e-8);
  const dryX=c.routes!.forks[0].decision;assert.equal(terrainHeight(c,dryX,0),0);
});

test('waves create real pitching and active weight compensation reduces it while swimming',()=>{
  const results:{rms:number;max:number}[]=[];
  for(const mode of ['flat','waves','balanced']){
    const c=createCourse(0,true);Object.assign(c,{segments:[{a:{x:-100,y:-8},b:{x:500,y:-8},surface:'stone'}],length:400,checkpoints:[2],mechanisms:[],masterRoutes:[],obstacles:[],muds:[],zones:[],waters:[{start:-80,end:400,level:0,deep:true,...(mode==='flat'?{}:{waves:{amplitude:.35,wavelength:6.6,period:2.35,phase:0}})}]});
    const sim=new Simulation(c,1),car=sim.cars[0];sim.requestShape(preset('paddle'));for(const b of [car.body,...car.wheels,...car.carriers]){const p=b.translation();b.setTranslation({x:p.x,y:p.y+8},true);}sim.started=true;car.drive=.5;let sum=0,max=0;
    for(let i=0;i<120*24;i++){const pitch=car.body.rotation();car.ballastTarget=mode==='balanced'?Math.max(-1,Math.min(1,pitch*1.3+car.body.angvel()*.35)):0;sim.tick();if(i>480){sum+=pitch*pitch;max=Math.max(max,Math.abs(pitch));}}
    results.push({rms:Math.sqrt(sum/2400),max});assert.equal(car.resets,0);assert.ok(car.body.translation().x>15);sim.dispose();
  }
  assert.ok(results[1].rms>results[0].rms*5);assert.ok(results[1].max>.3);
  assert.ok(results[2].rms<results[1].rms*.85);assert.ok(results[2].max<results[1].max*.8);
});
