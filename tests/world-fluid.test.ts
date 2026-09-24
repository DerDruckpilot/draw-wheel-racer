import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion,Euler} from 'three';
import {applyWheelFluid,type FluidBody,type FluidSurface} from '../src/world-fluid';
import {preset,type Point} from '../src/shapes';

function measure(shape:Point[],linear:Vector3,omega:Vector3,height=0,rotation=new Quaternion(),size=1){
  const force=new Vector3(),torque=new Vector3(),origin=new Vector3(0,height,0);
  const body:FluidBody={translation:()=>origin,rotation:()=>rotation,worldCom:()=>origin,mass:()=>8,angvel:()=>omega,effectiveWorldInvInertia:()=>({m11:.35,m12:0,m13:0,m22:.35,m23:0,m33:.35}),velocityAtPoint:p=>omega.clone().cross(new Vector3(p.x,p.y-height,p.z)).add(linear),addForce:f=>{force.add(f);},addTorque:t=>{torque.add(t);}};
  const result=applyWheelFluid(body,shape,'water',()=>({height:0,vx:0,vy:0,vz:0,wet:true}),1/90,size);
  return {...result,force,torque};
}
test('3D fluid drag removes energy even at high spin and when the wheel is banked',()=>{
  for(const shape of [preset('round'),preset('paddle'),preset('claw'),[{x:-1.1,y:0},{x:1.1,y:0}]])for(const angle of [0,.35,1.1])for(const spin of [-35,0,35]){
    const rotation=new Quaternion().setFromEuler(new Euler(angle,.4,.2)),linear=new Vector3(3,-2,1.7),omega=new Vector3(0,0,spin).applyQuaternion(rotation),rest=measure(shape,new Vector3(),new Vector3(),-.2,rotation),moving=measure(shape,linear,omega,-.2,rotation);
    const force=moving.force.sub(rest.force),torque=moving.torque.sub(rest.torque),power=force.dot(linear)+torque.dot(omega),dt=1/90;
    assert.ok(moving.volume>=-1e-8&&Number.isFinite(power));assert.ok(power<=1e-6,'no propulsion in still water without an energy source');
    assert.ok(dt*power+.5*dt*dt*(force.lengthSq()/8+torque.lengthSq()*.35)<=1e-6,'drag integration cannot inject kinetic energy');
  }
});
test('wheel size scales displaced volume and buoyancy, including stroke thickness',()=>{
  for(const shape of [preset('round'),preset('paddle'),[{x:-1.1,y:0},{x:1.1,y:0}]]){
    const full=measure(shape,new Vector3(),new Vector3(),-3),half=measure(shape,new Vector3(),new Vector3(),-3,new Quaternion(),.5);
    assert.ok(Math.abs(half.volume/full.volume-.125)<1e-6);
    assert.ok(Math.abs(half.force.y/full.force.y-.125)<1e-6);
  }
});
test('retracing a stroke does not double displaced water or propulsion',()=>{
  const line=[{x:-1.1,y:.1},{x:1.1,y:-.1}],twice=[...line,{...line[0],move:true as const},line[1]];
  const a=measure(line,new Vector3(1,0,.4),new Vector3(0,0,-7)),b=measure(twice,new Vector3(1,0,.4),new Vector3(0,0,-7));
  assert.ok(Math.abs(a.volume-b.volume)<1e-8);assert.ok(a.force.distanceTo(b.force)<1e-6);assert.ok(a.torque.distanceTo(b.torque)<1e-6);
});
test('paddles displace water while a smooth spinning ring supplies little thrust',()=>{
  const round=measure(preset('round'),new Vector3(),new Vector3(0,0,-6)),paddle=measure(preset('paddle'),new Vector3(),new Vector3(0,0,-6));
  assert.ok(Math.abs(paddle.force.x)>Math.abs(round.force.x)*5);assert.ok(paddle.force.x>1);
  const slightlyRaised=measure(preset('paddle'),new Vector3(),new Vector3(0,0,-6),.001);
  assert.ok(Math.abs(paddle.force.x-slightlyRaised.force.x)<.5,'small geometric changes have continuous force effects');
});
