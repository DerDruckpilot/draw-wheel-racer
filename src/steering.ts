import type RAPIER from '@dimforge/rapier2d-compat';
import type { Simulation } from './physics';
import { radiusOf,clamp } from './shapes';
import { groundAt,zoneAt } from './courses';
import {inBand} from './branching';

export interface LateralState { offset:number;velocity:number;input:number;heading:number;checkpoint:number }
export const centeredSteering=():LateralState=>({offset:0,velocity:0,input:0,heading:0,checkpoint:0});
export interface SideCollider { collider:RAPIER.Collider;z:number;depth:number;x:number;y:number;width:number;height:number;tyresOnly?:boolean;support?:boolean;fixedCoordinates?:boolean;active?:boolean;mask?:number }
/** A bounded transverse degree of freedom, coupled to the Rapier profile contacts.
 * Side-entry is swept before enabling a longitudinal collider, so steering cannot
 * teleport through a rock. Elevation and drawn-wheel contacts remain in Rapier. */
export class Steering {
  sides:SideCollider[]=[];
  constructor(private sim:Simulation){}
  overlaps(side:SideCollider,offset:number){
    return side.support?Math.abs(offset-side.z)<=side.depth/2:side.tyresOnly?[-.97,.97].some(z=>Math.abs(offset+z-side.z)<side.depth/2+.13):Math.abs(offset-side.z)<side.depth/2+1.04;
  }
  sync(){if(this.sim.cars.length!==1)return;for(const side of this.sides){side.mask??=side.collider.collisionGroups();if(!side.fixedCoordinates){const p=side.collider.translation();side.x=p.x;side.y=p.y;}const active=this.overlaps(side,this.sim.cars[0].lateral.offset);if(active!==side.active){side.collider.setCollisionGroups(active?side.mask:side.mask&~2);side.active=active;}}}
  tick(dt:number){
    if(!this.sim.course.expedition||this.sim.cars.length!==1)return;
    const car=this.sim.cars[0],s=car.lateral,p=car.body.translation(),v=car.body.linvel();
    const zone=zoneAt(this.sim.course,p.x,s.offset),ice=zone?.kind==='ice'||zone?.kind==='iceclimb'||zone?.kind==='glacier',wet=car.water>.15;
    const grounded=car.wheels.some(w=>w.translation().y-radiusOf(car.shapes[car.wheels.indexOf(w)])<groundAt(this.sim.course,w.translation().x,s.offset)+.25);
    // Steering needs travel and traction. Airborne cars retain transverse momentum.
    const speed=clamp(Math.abs(v.x),0,5),target=s.input*speed*.65*(v.x<-.05?-1:1);
    const grip=ice?.28:wet?.8:grounded?5.5:.08;
    s.velocity+=clamp((target-s.velocity)*3,-grip,grip)*dt;
    s.velocity*=Math.exp(-dt*(grounded||wet?.28:.04));
    let next=s.offset+s.velocity*dt;
    const wide=!!this.sim.course.routes;
    const roof=this.sim.course.obstacles.find(o=>o.kind==='ceiling'&&inBand(o,s.offset)&&Math.abs(p.x-o.x)<o.width/2+(wide?7:4));
    const limit=roof?.30+(wide?1.5:.75)*clamp((Math.abs(p.x-roof.x)-roof.width/2)/(wide?7:4),0,1):(this.sim.course.routes?.halfWidth??2.2)-1.15;
    const center=roof?.lateral??0;
    if(Math.abs(next-center)>limit){next=clamp(next,center-limit,center+limit);s.velocity=0;}
    for(const side of this.sides){
      if(side.support||side.tyresOnly||!this.overlaps(side,next)||this.overlaps(side,s.offset))continue;
      const bottom=Math.min(p.y-.3,...car.wheels.map((w,i)=>w.translation().y-radiusOf(car.shapes[i])));
      const top=Math.max(p.y+1,...car.wheels.map((w,i)=>w.translation().y+radiusOf(car.shapes[i])));
      if(Math.abs(p.x-side.x)<side.width/2+2.55&&bottom<side.y+side.height/2-.03&&top>side.y-side.height/2){next=s.offset;s.velocity=0;}
    }
    s.offset=next;s.heading=Math.atan2(s.velocity,Math.max(.6,Math.abs(v.x)))*Math.sign(v.x||1)*.55;
    this.sync();
  }
}
