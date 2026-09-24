import test from 'node:test';
import assert from 'node:assert/strict';
import {TiltFilter,screenTilt} from '../src/tilt-controls';
import {sanitizeShape,restoreShape,shapeEdges,shapeLength,MAX_SHAPE_POINTS,MAX_INPUT_POINTS,preset,spokeTips} from '../src/shapes';
import {wheelHydro,wheelMassProperties} from '../src/wheel-geometry';
const separate=[{x:-1,y:0},{x:-.5,y:0},{x:.5,y:.6,move:true as const},{x:1,y:.6}];

test('long intricate drawings retain their tail within a bounded mobile geometry budget',()=>{
  const points=Array.from({length:MAX_INPUT_POINTS},(_,i)=>{const angle=i*.043,radius=.25+.9*i/(MAX_INPUT_POINTS-1);return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};});
  const shape=sanitizeShape(points)!;assert.ok(shape&&shape.length<=MAX_SHAPE_POINTS&&shape.length>128);assert.deepEqual(shape.at(-1),points.at(-1));
  assert.ok(shapeLength(shape)>22);assert.deepEqual(sanitizeShape(shape),shape);assert.deepEqual(restoreShape(JSON.parse(JSON.stringify(shape))),shape);
});
test('crossing or retraced strokes retain physical mass and do not gain redundant support spokes',()=>{
  for(const line of [[{x:-1.1,y:.1},{x:1.1,y:-.1}],[{x:-.9,y:.4},{x:.9,y:.4}]]){
    const twice=[...line,{...line[0],move:true as const},line[1]],a=wheelMassProperties(line),b=wheelMassProperties(twice);
    assert.ok(Math.abs(a.mass-b.mass)<1e-9);assert.ok(Math.abs(a.inertia-b.inertia)<1e-9);assert.deepEqual(spokeTips(line),spokeTips(twice));
  }
});
test('invalid stored geometry is rejected and disconnected strokes stay disconnected',()=>{
  assert.equal(restoreShape([{x:NaN,y:1},{x:1,y:0}]),null);assert.equal(sanitizeShape([{x:0,y:0},{x:Infinity,y:0}]),null);
  assert.equal(restoreShape([{x:0,y:0},{x:4,y:0}]),null);assert.ok(wheelHydro(preset('round'))[0].rings.length>=2,'the ring keeps its open center');
});

test('lowering the screen-right edge shifts weight right in both landscape orientations',()=>{
  // At 90° the physical portrait top is on the left; lifting it (beta > 0)
  // lowers screen-right. The signs reverse with the phone turned the other way.
  const outputs=[];for(const angle of [90,270]){const f=new TiltFilter();f.calibrate({angle,beta:0,gamma:0});for(let i=0;i<100;i++)f.update({angle,beta:angle===90?20:-20,gamma:0},1/60);outputs.push(f.weight);assert.ok(Math.abs(f.steer)<.001);}
  assert.ok(outputs.every(v=>v>.99));assert.ok(Math.abs(outputs[0]-outputs[1])<.001);
  const a=screenTilt({angle:90,beta:0,gamma:-12}),b=screenTilt({angle:270,beta:0,gamma:12});assert.ok(Math.abs(a.pitch-b.pitch)<.001);assert.ok(a.pitch>11,'lifting the far screen edge tilts toward the near side');
});
test('calibration removes holding angle, dead zone suppresses jitter, and rotating the screen recenters',()=>{
  const f=new TiltFilter(),held={beta:8,gamma:42,angle:90};f.calibrate(held);
  for(let i=0;i<60;i++)f.update({...held,beta:8+Math.sin(i)*.5},1/60);
  assert.ok(Math.abs(f.weight)<.001&&Math.abs(f.steer)<.001);
  f.update({...held,beta:28},.1);assert.ok(f.weight>0);f.update({...held,angle:270},.1);assert.equal(f.weight,0);assert.equal(f.steer,0);
});
test('separate strokes never gain a phantom rubber connector and remain stable on remount',()=>{
  let shape=sanitizeShape(separate)!;
  assert.equal([...shapeEdges(shape)].length,2);assert.equal(shapeLength(shape),1);
  for(let i=0;i<12;i++)shape=sanitizeShape(restoreShape(JSON.parse(JSON.stringify(shape)))!)!;
  assert.deepEqual(shape,separate);
  const connected=separate.map(({x,y})=>({x,y}));
  assert.ok(wheelMassProperties(connected).mass>wheelMassProperties(shape).mass+.15);
  assert.ok(wheelHydro(shape)[0].rings.length>=2);
});
