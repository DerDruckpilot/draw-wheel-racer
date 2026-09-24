import {Vector3, Quaternion} from 'three';
import {wheelHydro} from './wheel-geometry';
import {clamp, type Point} from './shapes';
import type {Basin, V3} from './world-types';

export interface FluidBody {
  translation():V3; rotation():{x:number;y:number;z:number;w:number}; worldCom():V3;
  velocityAtPoint(point:V3):V3; angvel?():V3; mass():number;
  effectiveWorldInvInertia():{m11:number;m12:number;m13:number;m22:number;m23:number;m33:number};
  addForce(force:V3,wake:boolean):void; addTorque(torque:V3,wake:boolean):void;
}
export interface FluidSample {height:number;vx:number;vy:number;vz:number;wet:boolean}
export type FluidSurface=(point:V3)=>FluidSample;
const vector=(p:V3)=>new Vector3(p.x,p.y,p.z);

// Retaining the polygon union means drawing a stroke twice does not create
// twice the displaced volume, thrust or damping. Holes remain open water.
const contourCache=new WeakMap<Point[],{rings:Point[][];width:number}[]>();
function contours(shape:Point[]){
  let cached=contourCache.get(shape);if(cached)return cached;
  cached=wheelHydro(shape).map(part=>({width:part.width,rings:part.rings.map(ring=>ring.flatMap((a,i)=>{
    const b=ring[(i+1)%ring.length],n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/.18));
    return Array.from({length:n},(_,j)=>({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n}));
  }))}));
  contourCache.set(shape,cached);return cached;
}

export function applyWheelFluid(body:FluidBody,shape:Point[],compression:number,contactDirection:V3,material:Basin['material'],surface:FluidSurface,dt:number){
  const rotation=new Quaternion().copy(body.rotation()),origin=vector(body.translation()),center=vector(body.worldCom());
  // A rigid body's point velocity is analytic. Crossing the WASM boundary for
  // every face of four intricate drawings otherwise dominates water physics.
  const angular=body.angvel?.(),linear=angular?body.velocityAtPoint(center):undefined;
  const down=vector(contactDirection).applyQuaternion(rotation.clone().invert());down.z=0;down.normalize();
  const deform=(p:Point)=>{
    const along=Math.max(0,p.x*down.x+p.y*down.y),t=clamp(along/.8,0,1),d=compression*t*t*(3-2*t);
    return {x:p.x-down.x*d,y:p.y-down.y*d};
  };
  const world=(p:Point)=>new Vector3(p.x,p.y,0).applyQuaternion(rotation).add(origin);
  const drag=new Vector3(),torque=new Vector3(),buoyancy=new Vector3(),buoyancyTorque=new Vector3();
  let power=0,volume=0,waterlineSpeed=0,waterline:V3|undefined;
  const mud=material==='mud',density=mud?62:57;
  for(const part of contours(shape))for(const source of part.rings){
    const ring=source.map(deform),positions=ring.map(world),values=positions.map(p=>surface(p));
    const wet:Point[]=[];
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length,a=ring[i],b=ring[j],sa=values[i],sb=values[j];
      const da=sa.wet?sa.height-positions[i].y:-1,db=sb.wet?sb.height-positions[j].y:-1;
      if(da>=0)wet.push(a);
      if((da>=0)!==(db>=0)){
        const t=da/(da-db);wet.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
      }
      if(da<0&&db<0)continue;
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1e-7)continue;
      let lo=0,hi=1;
      if(da<0)lo=da/(da-db);if(db<0)hi=da/(da-db);
      const t=(lo+hi)*.5,point=positions[i].clone().lerp(positions[j],t);
      const water={height:sa.height+(sb.height-sa.height)*t,vx:sa.vx+(sb.vx-sa.vx)*t,vy:sa.vy+(sb.vy-sa.vy)*t,vz:sa.vz+(sb.vz-sa.vz)*t};
      const arm=point.clone().sub(center);
      const relative=angular?new Vector3(linear!.x+angular.y*arm.z-angular.z*arm.y,linear!.y+angular.z*arm.x-angular.x*arm.z,linear!.z+angular.x*arm.y-angular.y*arm.x):vector(body.velocityAtPoint(point));
      relative.x-=water.vx;relative.y-=water.vy;relative.z-=water.vz;
      const normal=new Vector3(dy/length,-dx/length,0).applyQuaternion(rotation),vn=relative.dot(normal);
      const area=length*(hi-lo)*part.width;
      // Only a windward face receives pressure. Skin friction also resists
      // transverse motion, but a smooth spinning ring has little paddle area.
      const force=normal.multiplyScalar(-.5*(mud?210:75)*area*Math.max(0,vn)*vn);
      force.addScaledVector(relative,-(mud?8:.16)*area);
      drag.add(force);torque.add(arm.cross(force));power+=force.dot(relative);
      if(Math.min(Math.abs(da),Math.abs(db))<.18&&relative.length()>waterlineSpeed){waterlineSpeed=relative.length();waterline={x:point.x,y:water.height,z:point.z};}
    }
    // Signed polygon moments preserve holes and concave shapes after clipping.
    let area2=0,mx=0,my=0;
    for(let i=0;i<wet.length;i++){
      const a=wet[i],b=wet[(i+1)%wet.length],cross=a.x*b.y-b.x*a.y;
      area2+=cross;mx+=(a.x+b.x)*cross;my+=(a.y+b.y)*cross;
    }
    if(Math.abs(area2)>1e-9){
      const displaced=area2*.5*part.width,point=world({x:mx/(3*area2),y:my/(3*area2)}),force=new Vector3(0,displaced*density*9.81,0);
      volume+=displaced;buoyancy.add(force);buoyancyTorque.add(point.sub(center).cross(force));
    }
  }
  // An implicit scale for the complete drag wrench prevents many tiny contour
  // faces from injecting energy or flipping the car on a fast water entry.
  const inv=body.effectiveWorldInvInertia(),t=torque;
  const angularWork=t.x*(inv.m11*t.x+inv.m12*t.y+inv.m13*t.z)+t.y*(inv.m12*t.x+inv.m22*t.y+inv.m23*t.z)+t.z*(inv.m13*t.x+inv.m23*t.y+inv.m33*t.z);
  const q=drag.lengthSq()/Math.max(.01,body.mass())+angularWork;
  const damping=1/(1+dt*q/Math.max(1e-8,-power));
  body.addForce(drag.multiplyScalar(damping).add(buoyancy),true);
  body.addTorque(torque.multiplyScalar(damping).add(buoyancyTorque),true);
  return {volume,waterlineSpeed,waterline};
}
