import {Vector3} from 'three';
import {clamp} from './shapes';

type Pose={position:Vector3;heading:number;speed:number;upright:number};
export type CameraTrace=(anchor:Vector3,candidate:Vector3)=>number;
const UP=new Vector3(0,1,0);
const wrap=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
/** A suspended chase boom: the focus rejects chassis bob, the heading has a
 * crawl deadband and obstruction recovery is deliberately slower than entry.
 * No per-frame left/right shoulder search can override the chosen orbit. */
export class ChaseCamera {
  position=new Vector3();target=new Vector3();focus=new Vector3();heading=0;
  private ready=false;private boom=12.7;private lowHold=0;private lowBlend=0;
  reset(){this.ready=false;}
  update(pose:Pose,yaw:number,pitch:number,dt:number,snap:boolean,manual:boolean,height:(x:number,z:number)=>number,trace:CameraTrace){
    dt=clamp(dt,0,.1);snap||=!this.ready;this.ready=true;
    const p=pose.position,speed=Math.abs(pose.speed),diff=wrap(pose.heading-this.heading);
    if(snap){this.heading=pose.heading;this.focus.copy(p);this.lowHold=0;this.lowBlend=0;}
    else{
      // Yaw from a near-vertical chassis is ill-defined; don't spin the view.
      const deadband=speed<.65?.24:speed<1.5?.10:.025;
      if(pose.upright>.28&&Math.abs(diff)>deadband)this.heading+=Math.sign(diff)*(Math.abs(diff)-deadband)*(1-Math.exp(-dt*(speed<1.5?.9:2.2)));
      this.focus.x+=(p.x-this.focus.x)*(1-Math.exp(-dt*5));this.focus.z+=(p.z-this.focus.z)*(1-Math.exp(-dt*5));
      this.focus.y+=(p.y-this.focus.y)*(1-Math.exp(-dt*2));
      // Follow a real drop, but ignore the short up/down stroke of odd wheels.
      this.focus.y=clamp(this.focus.y,p.y-.8,p.y+.8);
    }
    const forward=new Vector3(Math.cos(this.heading),0,-Math.sin(this.heading)),side=new Vector3(-forward.z,0,forward.x);
    const horizontal=forward.clone().multiplyScalar(-9.5).addScaledVector(side,5.5).normalize().applyAxisAngle(UP,yaw);
    const anchor=p.clone().add(new Vector3(0,.22,0));
    const destination=(angle:number,length:number)=>{
      const result=this.focus.clone().addScaledVector(horizontal,length*Math.cos(angle));result.y+=length*Math.sin(angle);
      result.y=Math.max(result.y,height(result.x,result.z)+.7);return result;
    };
    const regular=destination(pitch,12.7),clearance=trace(anchor,regular);
    if(clearance<3.6&&trace(anchor,destination(.18,6.4))>clearance+1.3)this.lowHold=1.1;
    else if(clearance>6.2)this.lowHold=Math.max(0,this.lowHold-dt);
    this.lowBlend+=((this.lowHold>0?1:0)-this.lowBlend)*(snap?1:1-Math.exp(-dt*2));
    const desired=destination(pitch+(.18-pitch)*this.lowBlend,12.7-6.3*this.lowBlend),delta=desired.clone().sub(anchor),length=delta.length();delta.normalize();
    const allowed=Math.max(.65,Math.min(length,trace(anchor,desired)-.09));
    if(snap||manual)this.boom=allowed;
    else if(allowed<this.boom)this.boom=allowed;
    else this.boom+=(allowed-this.boom)*(1-Math.exp(-dt*.85));
    const safe=anchor.clone().addScaledVector(delta,this.boom);
    this.position.lerp(safe,snap||manual?1:1-Math.exp(-dt*4));
    // Keep the camera outside geometry during fast vehicle translations too.
    const current=this.position.clone().sub(anchor),distance=current.length(),limit=trace(anchor,this.position);
    if(distance>limit-.06)this.position.copy(anchor).addScaledVector(current.normalize(),Math.max(.6,limit-.06));
    this.target.copy(this.focus).addScaledVector(forward,.9);this.target.y+=.45;
    return {position:this.position,target:this.target};
  }
}
