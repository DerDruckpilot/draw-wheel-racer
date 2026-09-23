import {bandCenter,inBand,groundGroup,propGroup,ROUTE_GROUPS} from './branching';
import RAPIER from '@dimforge/rapier2d-compat';
import type { Simulation, Vehicle } from './physics';
import type { MechanismSpec } from './mechanics-types';
import type { Segment, Water } from './courses';
import { clamp, shapeEdges, spokeTips, STROKE_RADIUS, SPOKE_RADIUS, type Point } from './shapes';
import { wheelHydro,waterForces,type HydroShape } from './hydrodynamics';

const DT=1/120;
export interface FlexState { stiffness:number; amount:number; nx:number; ny:number;load:number }
export const rigidWheel=():FlexState=>({stiffness:1,amount:0,nx:0,ny:1,load:0});
/** Bounded quasi-static elastic strain along the measured contact normal. */
export function deformPoint(p:Point,flex:FlexState):Point {
  const d=(p.x*flex.nx+p.y*flex.ny)*flex.amount;
  const spread=flex.amount*.22,normal=p.x*flex.nx+p.y*flex.ny;
  return {x:p.x*(1+spread)-(d+spread*normal)*flex.nx,y:p.y*(1+spread)-(d+spread*normal)*flex.ny,...(p.move?{move:true}: {})};
}
export interface Machine { spec:MechanismSpec; body:RAPIER.RigidBody; joint?:RAPIER.ImpulseJoint; pivot?:RAPIER.RigidBody; damage:number; broken:boolean; held:number; activated:boolean;hydro?:HydroShape }
export interface Soil { water:Water; nodes:Point[]; base:number[]; depths:number[]; segments:Segment[]; colliders:RAPIER.Collider[]; version:number }
type Pose={p:Point;a:number;v:Point;w:number};
type Memory={machines:{pose:Pose;damage:number;broken:boolean;held:number;activated:boolean}[];signals:string[];levels:number[];soils:number[][];routes:number[];health:number};
const pose=(body:RAPIER.RigidBody):Pose=>({p:body.translation(),a:body.rotation(),v:body.linvel(),w:body.angvel()});
const restore=(body:RAPIER.RigidBody,p:Pose)=>{body.setTranslation(p.p,true);body.setRotation(p.a,true);body.setLinvel(p.v,true);body.setAngvel(p.w,true);body.resetForces(true);body.resetTorques(true);};

/** Subdivide only deliberately soft patches. Adjacent cells share their nodes. */
export function prepareSoils(segments:Segment[],waters:Water[]):Soil[] {
  const soils:Soil[]=[];
  for(const water of waters.filter(w=>w.deform)){
    const out:Segment[]=[],nodes:Point[]=[],parts:Segment[]=[];
    for(const s of segments){
      if(s.b.x<=water.start || s.a.x>=water.end || s.surface!=='mud'||s.channel!==water.channel){out.push(s);continue;}
      const count=Math.max(1,Math.ceil((s.b.x-s.a.x)/.65));
      let a=nodes.at(-1);if(!a||Math.abs(a.x-s.a.x)>.001){a={...s.a};nodes.push(a);}
      for(let i=1;i<=count;i++){const b={x:s.a.x+(s.b.x-s.a.x)*i/count,y:s.a.y+(s.b.y-s.a.y)*i/count};const part={...s,a,b};out.push(part);parts.push(part);nodes.push(b);a=b;}
    }
    segments.splice(0,segments.length,...out);
    soils.push({water,nodes,base:nodes.map(n=>n.y),depths:nodes.map(()=>0),segments:parts,colliders:[],version:0});
  }
  return soils;
}

export class Mechanics {
  machines:Machine[]=[];
  signals=new Set<string>();
  routeProgress:number[];
  cargo?:{body:RAPIER.RigidBody;health:number;lastVelocity:Point;lastOmega:number};
  private memory!:Memory;
  private frame=0;
  constructor(private sim:Simulation,public soils:Soil[]){
    this.routeProgress=(sim.course.masterRoutes??[]).map(()=>0);
    for(const spec of sim.course.mechanisms??[])this.machines.push(this.createMachine(spec));
    if(sim.course.freight){
      const car=sim.cars[0],p=car.body.translation();
      const body=sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x-.3,p.y+1.04).setCcdEnabled(true).setAngularDamping(.3));
      sim.world.createCollider(RAPIER.ColliderDesc.roundCuboid(.43,.29,.045).setMass(sim.course.freight.mass).setFriction(.7).setCollisionGroups(0x00020021|ROUTE_GROUPS),body);
      const jd=RAPIER.JointData.prismatic({x:-.3,y:1.04},{x:0,y:0},{x:1,y:0});jd.limitsEnabled=true;jd.limits=[-.32,.32];
      const j=sim.world.createImpulseJoint(jd,car.body,body,true) as RAPIER.PrismaticImpulseJoint;j.setContactsEnabled(false);j.configureMotorModel(RAPIER.MotorModel.ForceBased);j.configureMotorPosition(0,95,12);
      this.cargo={body,health:100,lastVelocity:{x:0,y:0},lastOmega:0};
    }
  }
  private createMachine(spec:MechanismSpec):Machine {
    const world=this.sim.world,kind=spec.kind;
    const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spec.x,spec.y).setCcdEnabled(true).setAngularDamping(.4));
    const desc=kind==='loose'?RAPIER.ColliderDesc.ball(spec.width/2):RAPIER.ColliderDesc.cuboid(spec.width/2,spec.height/2);
    const control=kind==='plate'||kind==='counterweight';
    // Recessed controls move into their socket. They must neither strike the
    // terrain underneath nor the adjacent control at the same longitudinal x.
    const groups=spec.channel!==undefined?(propGroup(spec.channel)<<16)|(control?2:3|groundGroup(spec.channel)|propGroup(spec.channel)):control?0x00200002:0x00210023;
    desc.setMass(kind==='gate'?9:kind==='counterweight'?4:kind==='loose'?1.5:2).setFriction(kind==='breakice'?.018:.8).setRestitution(.015).setCollisionGroups(groups);
    if(kind==='counterweight')desc.setMassProperties(4,{x:-1.8,y:-.05},15);
    const collider=world.createCollider(desc,body);
    if(spec.lateral!==undefined)this.sim.steering.sides.push({collider,z:spec.lateral,depth:spec.depth??1,x:spec.x,y:spec.y,width:spec.width,height:spec.height,tyresOnly:kind==='plate'||kind==='counterweight'});
    const m:Machine={spec,body,damage:0,broken:false,held:0,activated:false};
    if(kind==='breakice'||kind==='fragile'){
      const x=spec.width/2,y=spec.height/2;
      m.hydro={rings:[[{x:-x,y:-y},{x,y:-y},{x,y},{x:-x,y}]],width:2.6,dragX:.6,dragY:1.2,linearX:1,linearY:8,skin:.01};
      if(kind==='breakice')body.collider(0).setMass(spec.width*spec.height*2.6*18*.44);
    }
    if(kind!=='loose'){
      m.pivot=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x,spec.y+(kind==='swing'?spec.height/2:0)));
      this.attach(m);
    }
    return m;
  }
  private attach(m:Machine){
    const s=m.spec,k=s.kind;
    if(k==='counterweight'||k==='swing'){
      const j=this.sim.world.createImpulseJoint(RAPIER.JointData.revolute({x:0,y:0},{x:0,y:k==='swing'?s.height/2:0}),m.pivot!,m.body,true) as RAPIER.RevoluteImpulseJoint;
      j.setLimits(k==='swing'?-.04:-.16,k==='swing'?1.55:.16);j.configureMotorModel(RAPIER.MotorModel.ForceBased);
      if(k==='swing')j.configureMotorPosition(0,2,1.2);m.joint=j;
    }else{
      const jd=RAPIER.JointData.prismatic({x:0,y:0},{x:0,y:0},{x:0,y:1});jd.limitsEnabled=true;jd.limits=k==='gate'?[0,s.travel??4.5]:[-.32,0];
      const j=this.sim.world.createImpulseJoint(jd,m.pivot!,m.body,true) as RAPIER.PrismaticImpulseJoint;
      j.configureMotorModel(RAPIER.MotorModel.ForceBased);j.configureMotorPosition(0,k==='gate'?700:k==='plate'?380:500,k==='gate'?80:22);m.joint=j;
    }
    m.joint.setContactsEnabled(false);
  }
  private load(body:RAPIER.RigidBody){
    let load=0,nx=0,ny=1,biggest=0;
    for(let i=0;i<body.numColliders();i++){
      const a=body.collider(i);
      this.sim.world.contactPairsWith(a,b=>this.sim.world.contactPair(a,b,m=>{
        let impulse=0;for(let j=0;j<m.numContacts();j++)impulse+=m.contactImpulse(j);
        load+=impulse/DT;
        if(impulse>biggest){const n=m.normal();nx=n.x;ny=n.y;biggest=impulse;}
      }));
    }
    return {load,nx,ny};
  }
  beforeStep(){
    for(const m of this.machines){
      if(m.hydro){
        m.body.resetForces(true);m.body.resetTorques(true);
        const b=m.body,p=b.translation(),w=this.sim.course.waters.find(w=>inBand(w,m.spec.lateral??0,0,p.x)&&p.x>w.start&&p.x<w.end);
        if(w){w.sampleLateral=m.spec.lateral??0;const f=waterForces(m.hydro,{position:p,center:b.worldCom(),angle:b.rotation(),velocity:b.linvel(),omega:b.angvel(),invMass:b.invMass(),invInertia:b.invPrincipalInertia()},w,DT);b.addForce({x:f.x,y:f.y},true);b.addTorque(f.torque,true);}
      }
      if(m.spec.kind==='gate'){
        const open=this.signals.has(m.spec.signal!);
        (m.joint as RAPIER.PrismaticImpulseJoint).configureMotorPosition(open?m.spec.travel??4.5:0,700,80);m.activated=open;
      }
    }
    for(const w of this.sim.course.waters){
      const draining=!!w.drainControl&&this.signals.has(w.drainControl);
      if(draining||w.control&&this.signals.has(w.control)){const target=draining?w.drainLevel??-1:w.targetLevel??0;w.level+=clamp(target-w.level,-.32*DT,.32*DT);}
    }
    for(const car of this.sim.cars){
      const delta=clamp(car.ballastTarget-car.ballast,-DT*2.1,DT*2.1);
      if(Math.abs(delta)>.00001){car.ballast+=delta;car.body.collider(0).setMassProperties(7.5,{x:.18+car.ballast*1.3,y:-.12},6.8);car.body.recomputeMassPropertiesFromColliders();}
    }
  }
  afterStep(){
    this.frame++;
    for(const m of this.machines){
      const kind=m.spec.kind;
      if(kind==='plate'||kind==='counterweight'){
        const pressed=kind==='plate'?m.spec.y-m.body.translation().y>.08:m.body.rotation()<-.055;
        // The ratchet also accepts repeated paddle strokes. Requiring one
        // uninterrupted press made a submerged plate impossible with open rims.
        m.held=pressed?m.held+DT:Math.max(0,m.held-DT*.4);
        if(m.held>.22&&m.spec.signal&&!m.activated){for(const signal of m.spec.clears??[])this.signals.delete(signal);this.signals.add(m.spec.signal);m.activated=true;}
        if(m.held===0)m.activated=false;
      }else if((kind==='fragile'||kind==='breakice')&&!m.broken){
        const load=this.load(m.body).load;
        m.damage=clamp(m.damage+clamp(load-25,0,180)/(m.spec.strength??60)*DT*.26,0,1);
        if(m.damage>=1){m.broken=true;this.sim.world.removeImpulseJoint(m.joint!,true);m.joint=undefined;}
      }
    }
    if(this.frame%4===0)for(const car of this.sim.cars){this.flex(car);this.deformSoil(car);}
    const p=this.sim.cars[0].body.translation();
    (this.sim.course.masterRoutes??[]).forEach((r,i)=>{
      const mark=r.marks[this.routeProgress[i]];
      if((r.lateral===undefined||Math.abs(this.sim.cars[0].lateral.offset-bandCenter(r,p.x))<2)&&mark&&Math.hypot(p.x-mark.x,p.y-mark.y)<mark.radius&&Math.abs(this.sim.cars[0].body.linvel().y)<3.8)this.routeProgress[i]++;
    });
    if(this.cargo){
      const c=this.cargo,v=c.body.linvel(),omega=this.sim.cars[0].body.angvel();
      // A gravity-corrected velocity jump measures an impact, not ordinary
      // acceleration or elapsed time. Caps prevent a numerical outlier killing it.
      const shock=Math.hypot(v.x-c.lastVelocity.x,v.y-c.lastVelocity.y+9.81*DT);
      c.health=Math.max(0,c.health-Math.max(0,shock-1.45)*8-Math.max(0,Math.abs(omega-c.lastOmega)-1.3)*3);
      c.lastVelocity={...v};c.lastOmega=omega;
    }
  }
  private flex(car:Vehicle){
    for(const [i,w] of car.wheels.entries()){
      const f=car.flex[i];if(f.stiffness===1&&f.amount<.0001)continue;
      const oldNx=f.nx,oldNy=f.ny;
      const {load,nx,ny}=this.load(w),co=Math.cos(w.rotation()),si=Math.sin(w.rotation());
      if(load>1){f.nx=nx*co+ny*si;f.ny=-nx*si+ny*co;}
      f.load=f.load*.65+clamp(load,0,180)*.35;
      const target=Math.pow(1-f.stiffness,1.25)*clamp(f.load/65,0,.62);
      const old=f.amount;f.amount+=clamp((target-old)*.13,-.016,.009);
      if(Math.abs(f.amount-old)<.0002&&Math.abs(f.nx*f.ny-oldNx*oldNy)+Math.abs(f.nx*f.nx-oldNx*oldNx)<.001)continue;
      const edges=shapeEdges(car.shapes[i]);let idx=1;
      const update=(a:Point,b:Point,r:number)=>{
        const col=w.collider(idx++),dx=b.x-a.x,dy=b.y-a.y;
        col.setShape(new RAPIER.Capsule(Math.hypot(dx,dy)/2,r));col.setTranslationWrtParent({x:(a.x+b.x)/2,y:(a.y+b.y)/2});col.setRotationWrtParent(Math.atan2(dy,dx)-Math.PI/2);
      };
      for(const [a,b] of edges)if(Math.hypot(b.x-a.x,b.y-a.y)>.0001)update(deformPoint(a,f),deformPoint(b,f),STROKE_RADIUS);
      for(const tip of spokeTips(car.shapes[i]))if(Math.hypot(tip.x,tip.y)>.2)update({x:0,y:0},deformPoint(tip,f),SPOKE_RADIUS);
      car.hydros[i]=wheelHydro(car.shapes[i]).map(h=>({...h,rings:h.rings.map(r=>r.map(p=>deformPoint(p,f)))}));
    }
  }
  private deformSoil(car:Vehicle){
    for(const soil of this.soils){
      if(!inBand(soil.water,car.lateral.offset,0,car.body.translation().x))continue;
      let dirty=false;
      for(const w of car.wheels){
        const p=w.translation();if(p.x<soil.water.start-1||p.x>soil.water.end+1)continue;
        const load=this.load(w).load;if(load<8)continue;
        // Actual support breadth spreads the same load. Slip additionally shears
        // the soil; small, highly loaded contacts sink faster than wide rims.
        let left=Infinity,right=-Infinity;
        for(let j=0;j<w.numColliders();j++){const col=w.collider(j);this.sim.world.contactPairsWith(col,b=>this.sim.world.contactPair(col,b,m=>{for(let k=0;k<m.numSolverContacts();k++){const q=m.solverContactPoint(k);if(q){left=Math.min(left,q.x);right=Math.max(right,q.x);}}}));}
        const breadth=clamp(right-left,.18,1.5),slip=Math.abs(w.angvel()*.75-car.body.linvel().x);
        for(let j=1;j<soil.nodes.length-1;j++){
          const n=soil.nodes[j],weight=Math.exp(-(((n.x-p.x)/(.45+breadth*.3))**2));
          const add=Math.min(.0018,Math.max(0,Math.min(load,180)/breadth-22)*.000004*(1+Math.min(5,slip)*.35))*weight;
          const depth=Math.min(.48,soil.depths[j]+add);if(depth-soil.depths[j]>.00001){soil.depths[j]=depth;n.y=soil.base[j]-depth;dirty=true;}
        }
      }
      if(dirty){this.updateSoilColliders(soil);soil.version++;}
    }
  }
  private updateSoilColliders(soil:Soil){
    soil.segments.forEach((s,i)=>soil.colliders[i].setShape(new RAPIER.ConvexPolygon(new Float32Array([s.a.x,s.a.y,s.b.x,s.b.y,s.b.x,-12,s.a.x,-12]),false)));
  }
  get mastered(){return (this.sim.course.masterRoutes??[]).filter((r,i)=>this.routeProgress[i]===r.marks.length).map(r=>r.id);}
  capture(){
    this.memory={machines:this.machines.map(m=>({pose:pose(m.body),damage:m.damage,broken:m.broken,held:m.held,activated:m.activated})),signals:[...this.signals],levels:this.sim.course.waters.map(w=>w.level),soils:this.soils.map(s=>s.depths.slice()),routes:this.routeProgress.slice(),health:this.cargo?.health??100};
  }
  reset(){
    if(!this.memory)return;
    this.machines.forEach((m,i)=>{const s=this.memory.machines[i];restore(m.body,s.pose);if(m.broken&&!s.broken)this.attach(m);if(!m.broken&&s.broken&&m.joint){this.sim.world.removeImpulseJoint(m.joint,true);m.joint=undefined;}m.damage=s.damage;m.broken=s.broken;m.held=s.held;m.activated=s.activated;});
    this.signals=new Set(this.memory.signals);this.routeProgress=this.memory.routes.slice();
    this.sim.course.waters.forEach((w,i)=>w.level=this.memory.levels[i]);
    this.soils.forEach((s,i)=>{s.depths=this.memory.soils[i].slice();s.nodes.forEach((n,j)=>n.y=s.base[j]-s.depths[j]);this.updateSoilColliders(s);s.version++;});
    if(this.cargo){const p=this.sim.cars[0].body.translation();restore(this.cargo.body,{p:{x:p.x-.3,y:p.y+1.04},a:0,v:{x:0,y:0},w:0});this.cargo.health=Math.max(1,this.memory.health);this.cargo.lastVelocity={x:0,y:0};this.cargo.lastOmega=0;}
  }
  snapshot(){return {signals:[...this.signals],machines:this.machines.map(m=>({id:m.spec.id,kind:m.spec.kind,x:m.body.translation().x,y:m.body.translation().y,angle:m.body.rotation(),damage:m.damage,broken:m.broken,activated:m.activated})),waterLevels:this.sim.course.waters.map(w=>w.level),soilDepth:this.soils.map(s=>Math.max(0,...s.depths)),routes:this.routeProgress,mastered:this.mastered,freight:this.cargo?.health??null};}
}
