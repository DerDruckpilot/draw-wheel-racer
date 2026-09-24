import {NodeIO} from '@gltf-transform/core';
import {Matrix4,Vector3} from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {writeFile} from 'node:fs/promises';

// Three short convex sections follow the actual imported body, including the
// lower bonnet and rear overhang. No collider extends above the visible roof.
export async function prepareVehicleCollision(){
  const doc=await new NodeIO().read('public/assets/offroad.glb'),triangles=[];
  for(const node of doc.getRoot().listNodes()){
    const mesh=node.getMesh();if(!mesh)continue;const matrix=new Matrix4().fromArray(node.getWorldMatrix());
    for(const primitive of mesh.listPrimitives()){
      const position=primitive.getAttribute('POSITION'),index=primitive.getIndices();
      const values=Array.from({length:position.getCount()},(_,i)=>new Vector3().fromArray(position.getElement(i,[])).applyMatrix4(matrix));
      for(let i=0;i<index.getCount();i+=3)triangles.push([values[index.getScalar(i)],values[index.getScalar(i+1)],values[index.getScalar(i+2)]]);
    }
  }
  const clip=(polygon,cut,keepRight)=>{
    const out=[];let a=polygon.at(-1),da=(a.x-cut)*(keepRight?1:-1);
    for(const b of polygon){const db=(b.x-cut)*(keepRight?1:-1);if((da>=0)!==(db>=0))out.push(a.clone().lerp(b,da/(da-db)));if(db>=0)out.push(b);a=b;da=db;}return out;
  };
  const parts=[];
  for(const [min,max] of [[-2,-.9],[-.9,.85],[.85,2]]){
    const points=new Map();
    for(const triangle of triangles){let polygon=clip(triangle,min,true);if(polygon.length)polygon=clip(polygon,max,false);for(const p of polygon)points.set(p.toArray().map(v=>Math.round(v*1e6)).join(','),p);}
    const hull=new ConvexGeometry([...points.values()]),position=hull.attributes.position;
    parts.push({positions:Array.from(position.array,v=>+v.toFixed(6)),indices:Array.from({length:position.count},(_,i)=>i)});hull.dispose();
  }
  await writeFile('public/assets/offroad-collision.json',JSON.stringify({source:'offroad.glb',method:'Three convex sections clipped from the rendered vehicle in world coordinates',parts}));
  console.log('Vehicle collision:',parts.map(p=>p.positions.length/9+' hull triangles').join(', '));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/prepare-vehicle-collision.mjs'))await prepareVehicleCollision();
