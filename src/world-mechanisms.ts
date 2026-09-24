import type {Gate,Bridge,V3} from './world-types';

export interface MechanismPart {position:V3;size:V3;yaw:number}
export const LIFT_DEPTH=6.4;
export const PLATE_EMBED=.025;
/** Both the renderer and physics consume these exact dimensions. */
export function gateFrame(spec:Gate):MechanismPart[]{
  const parts:MechanismPart[]=[],height=spec.height+spec.travel;
  const add=(x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
    const c=Math.cos(spec.yaw),s=Math.sin(spec.yaw);
    parts.push({position:{x:spec.x+c*x+s*z,y:spec.y+y,z:spec.z-s*x+c*z},size:{x:sx,y:sy,z:sz},yaw:spec.yaw});
  };
  for(const side of [-1,1])for(const z of spec.kind==='lift'?[-LIFT_DEPTH/2-.2,LIFT_DEPTH/2+.2]:[0]){
    add(side*(spec.width/2+.2),height/2,z,.18,height,.22);
    add(side*(spec.width/2+.2),.06,z,.56,.12,.66);
  }
  for(const z of spec.kind==='lift'?[-LIFT_DEPTH/2-.2,LIFT_DEPTH/2+.2]:[0])add(0,height,z,spec.width+.58,.2,.26);
  return parts;
}
export function bridgeFrame(spec:Bridge,height:(x:number,z:number)=>number):MechanismPart[]{
  return [-1,1].map(side=>{
    const localZ=side*(spec.width/2+.3),x=spec.x+Math.sin(spec.yaw)*localZ,z=spec.z+Math.cos(spec.yaw)*localZ,bottom=height(x,z),h=Math.max(.5,spec.y-bottom);
    return {position:{x,y:spec.y-h/2,z},size:{x:.5,y:h,z:.5},yaw:spec.yaw};
  });
}
