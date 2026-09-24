import {BufferGeometry,Float32BufferAttribute} from 'three';
import {STROKE_RADIUS} from './shapes';

// Axle depth is independent of the pen's XY outline. Rounded shoulders keep
// the broad tread from catching on triangle seams while preserving open holes.
export const WHEEL_WIDTH=.42;
export const WHEEL_BEVEL=.024;
export const WHEEL_WET_WIDTH=WHEEL_WIDTH-WHEEL_BEVEL*.8;
const RING=18;
function contour(length:number,radius:number){
  return Array.from({length:RING},(_,i)=>{
    const upper=i<9,angle=(upper?i:i-9)*Math.PI/8+(upper?0:Math.PI);
    return {x:Math.cos(angle)*radius,y:(upper?1:-1)*length/2+Math.sin(angle)*radius};
  });
}
function indices(layers:number){
  const result:number[]=[];
  for(let layer=0;layer<layers-1;layer++)for(let i=0;i<RING;i++){
    const a=layer*RING+i,b=layer*RING+(i+1)%RING,c=b+RING,d=a+RING;result.push(a,b,c,a,c,d);
  }
  for(let i=1;i<RING-1;i++){result.push(0,i+1,i);const top=(layers-1)*RING;result.push(top,top+i,top+i+1);}
  return new Uint32Array(result);
}
const coreIndices=indices(2);
export function wheelStrokeCore(length:number,size=1){
  const vertices=new Float32Array(RING*6),ring=contour(length,STROKE_RADIUS-WHEEL_BEVEL);
  for(let layer=0;layer<2;layer++)ring.forEach((p,i)=>vertices.set([p.x*size,p.y*size,(layer?1:-1)*(WHEEL_WIDTH/2-WHEEL_BEVEL)*size],(layer*RING+i)*3));
  return {vertices,indices:coreIndices,border:WHEEL_BEVEL*size};
}
export function wheelStrokeTemplate(){
  const positions:number[]=[],normals:number[]=[];
  // Six shoulder rings approximate the same rounded convex contact solid.
  const layers=[[-1,Math.PI/2],[-1,Math.PI/4],[-1,0],[1,0],[1,Math.PI/4],[1,Math.PI/2]];
  for(const [side,angle] of layers){
    const radius=STROKE_RADIUS-WHEEL_BEVEL+Math.cos(angle)*WHEEL_BEVEL;
    contour(1,radius).forEach((p,i)=>{
      const radial=(i<9?i:i-9)*Math.PI/8+(i<9?0:Math.PI);
      positions.push(p.x,p.y,side*(WHEEL_WIDTH/2-WHEEL_BEVEL+Math.sin(angle)*WHEEL_BEVEL));
      normals.push(Math.cos(radial)*Math.cos(angle),Math.sin(radial)*Math.cos(angle),side*Math.sin(angle));
    });
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));geometry.setIndex(Array.from(indices(layers.length)));return geometry;
}
