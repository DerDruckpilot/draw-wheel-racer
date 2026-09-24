import {BufferGeometry,BufferAttribute,CapsuleGeometry,SphereGeometry,Sphere,Vector3,DynamicDrawUsage} from 'three';
import {uniqueShapeEdges,spokeTips,STROKE_RADIUS,SPOKE_RADIUS,type Point} from './shapes';

const rim=new CapsuleGeometry(STROKE_RADIUS,1,3,7),spoke=new CapsuleGeometry(SPOKE_RADIUS,1,3,7),hub=new SphereGeometry(.14,10,8);
const origin={x:0,y:0};

/** Reuse GPU buffers as soft wheels flex. Capsule hemispheres retain their
 * actual radius; only the straight section changes length between endpoints. */
export function updateWheelGeometry(geometry:BufferGeometry,points:Point[]){
  const segments=[...[...uniqueShapeEdges(points)].map(([a,b])=>({a,b,template:rim})),...spokeTips(points).map(b=>({a:origin,b,template:spoke}))].filter(s=>Math.hypot(s.b.x-s.a.x,s.b.y-s.a.y)>.00001);
  const count=segments.length*rim.attributes.position.count+hub.attributes.position.count;
  const indexCount=segments.length*rim.index!.count+hub.index!.count;
  if(geometry.attributes.position?.count!==count){
    // Dispose the previous GPU allocations before replacing their attributes.
    geometry.dispose();
    geometry.setAttribute('position',new BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
    geometry.setAttribute('normal',new BufferAttribute(new Float32Array(count*3),3).setUsage(DynamicDrawUsage));
    const indices=new Uint32Array(indexCount);let vertex=0,offset=0;
    for(const template of [...segments.map(s=>s.template),hub]){for(let i=0;i<template.index!.count;i++)indices[offset++]=vertex+template.index!.getX(i);vertex+=template.attributes.position.count;}
    geometry.setIndex(new BufferAttribute(indices,1));geometry.boundingSphere=new Sphere(new Vector3(),1.5);
  }
  const position=geometry.attributes.position as BufferAttribute,normal=geometry.attributes.normal as BufferAttribute;let vertex=0;
  for(const {a,b,template} of segments){
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),sx=dx/length,sy=dy/length,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const p=template.attributes.position,n=template.attributes.normal;
    for(let i=0;i<p.count;i++,vertex++){
      const x=p.getX(i),y=p.getY(i)+Math.sign(p.getY(i))*(length-1)/2;
      position.setXYZ(vertex,mx+x*sy+y*sx,my-x*sx+y*sy,p.getZ(i));
      normal.setXYZ(vertex,n.getX(i)*sy+n.getY(i)*sx,-n.getX(i)*sx+n.getY(i)*sy,n.getZ(i));
    }
  }
  for(let i=0;i<hub.attributes.position.count;i++,vertex++){
    position.setXYZ(vertex,hub.attributes.position.getX(i),hub.attributes.position.getY(i),hub.attributes.position.getZ(i));
    normal.setXYZ(vertex,hub.attributes.normal.getX(i),hub.attributes.normal.getY(i),hub.attributes.normal.getZ(i));
  }
  position.needsUpdate=true;normal.needsUpdate=true;
}
