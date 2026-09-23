import {assertJoinedGround} from './course-assertions';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createExpedition,EXPEDITION_COUNT,groundAt,NEW_FEATURES,type Course} from '../src/courses';
import {structureMesh} from '../src/structure-mesh';
import {buildChallenge} from '../src/challenges';
import {initPhysics,Simulation} from '../src/physics';
import {preset,type Point} from '../src/shapes';
import {cross,hooks} from '../scripts/expedition-driver';
await initPhysics();

function challenge(feature:Parameters<typeof buildChallenge>[0]):Course {
 const c=createExpedition(0);c.routes=undefined;c.mechanisms=[];c.masterRoutes=[];c.zones=[];c.obstacles=[];c.waters=[];c.muds=[];c.checkpoints=[2];
 c.segments=[{a:{x:-12,y:0},b:{x:12,y:0},surface:'stone'}];let x=12;
 buildChallenge(feature,c,12,(len,p,surface='stone')=>{for(let i=1;i<p.length;i++)c.segments.push({a:{x:x+p[i-1].x,y:p[i-1].y},b:{x:x+p[i].x,y:p[i].y},surface});x+=len;});
 c.length=x;c.segments.push({a:{x,y:0},b:{x:x+40,y:0},surface:'stone'});return c;
}

test('every passage is an oriented, watertight solid with no missing portal or shoulder faces',()=>{
 const styles=new Set();
 for(let id=0;id<EXPEDITION_COUNT;id++)for(const o of createExpedition(id).obstacles.filter(o=>o.structure)){
  styles.add(o.structure);const {positions:p,indices}=structureMesh(createExpedition(id),o),edges=new Map<string,number>();let volume=0;
  assert.ok(p.every(Number.isFinite));
  const half=p.length/2;for(let j=1;j<half;j+=3)assert.ok(p[j+half]>p[j],`${id}/${o.structure}: inverted shell`);
  for(let i=0;i<indices.length;i+=3){
   const vs=indices.slice(i,i+3);
   for(let j=0;j<3;j++){const a=vs[j],b=vs[(j+1)%3],k=`${Math.min(a,b)}/${Math.max(a,b)}`;edges.set(k,(edges.get(k)??0)+1);}
   const [a,b,c]=vs.map(j=>p.slice(j*3,j*3+3));
   volume+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]);
  }
  assert.ok([...edges.values()].every(n=>n===2),`${id}/${o.structure}: open or non-manifold edge`);
  assert.ok(volume>0,`${id}/${o.structure}: reversed winding`);
 }
 assert.deepEqual([...styles].sort(),['arch','bridge','cave']);
});

test('frozen ground belongs to winter expeditions and old collectible clutter is absent',()=>{
 for(let id=0;id<EXPEDITION_COUNT;id++){
  const c=createExpedition(id);assert.equal(c.caches!.length,0);
  if(id===12)continue;
  assert.ok(c.features.length>=6);if(id<16)assert.ok(c.features.some(f=>['notch','rubblegate','squeeze'].includes(f)));
  if(c.segments.some(s=>s.surface==='ice'))assert.equal(c.theme,'alpine');
  for(const cp of c.checkpoints)assert.equal(groundAt(c,cp),0);
  assertJoinedGround(c);
 }
 const used=new Set(Array.from({length:EXPEDITION_COUNT},(_,id)=>createExpedition(id)).filter(c=>c.id!==12).flatMap(c=>c.features));
 assert.equal(NEW_FEATURES.length,12);for(const f of NEW_FEATURES)assert.ok(used.has(f));
});

test('long rock slots reject large circles, teeth and the open hooks from the feedback; a small drawing passes',()=>{
 for(const [name,shape,pass] of [['ring',preset('round'),false],['teeth',preset('grip'),false],['hooks',hooks,false],['small',preset('compact'),true]] as [string,Point[],boolean][]){
  const sim=new Simulation(challenge('notch'),1),v=sim.cars[0];sim.requestShape(shape);sim.started=true;v.drive=.8;
  for(let i=0;i<120*24&&!v.finished;i++)sim.tick();
  assert.equal(v.finished,pass,name);assert.equal(v.resets,0);sim.dispose();
 }
});

test('a high escarpment reverses the size requirement: a compact rim stalls, a drawn lever climbs',()=>{
 for(const [shape,pass] of [[preset('compact'),false],[preset('round'),false],[cross,true]] as [Point[],boolean][]){
  const sim=new Simulation(challenge('escarpment'),1),v=sim.cars[0];sim.requestShape(shape);sim.started=true;v.drive=.8;
  for(let i=0;i<120*38&&!v.finished;i++)sim.tick();
  assert.equal(v.finished,pass);assert.equal(v.resets,0);sim.dispose();
 }
});

test('a wheel-size transition has room to clear the roof before meeting the next wall',()=>{
 const c=challenge('rubblegate'),roof=c.obstacles[0];
 const wall=c.segments.find(s=>s.b.y-s.a.y>1)!;
 assert.ok(wall.a.x-(roof.x+roof.width/2)>5);
});
