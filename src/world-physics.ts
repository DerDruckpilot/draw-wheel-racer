import RAPIER from '@dimforge/rapier3d-compat';
import {Euler,Quaternion,Vector3} from 'three';
import {clamp,preset,radiusOf,sanitizeShape,uniqueShapeEdges,spokeTips,STROKE_RADIUS,SPOKE_RADIUS,type Point} from './shapes';
import {wheelMassProperties} from './wheel-geometry';
import {applyWheelFluid} from './world-fluid';
import {gateFrame,bridgeFrame,LIFT_DEPTH} from './world-mechanisms';
import {worldHeight,groundType,basinWeight,basinCoordinates,dist,makeTerrainTile,WORLD_TILE,smooth} from './world-levels';
import type {WorldLevel,WorldProp,AssetCollisions,Plate,Gate,V3,TerrainTile,Basin,Camp,Cache} from './world-types';

export const WORLD_DT=1/90;
export const WHEEL_POSITIONS=[[-1.28,-.25,-1.02],[-1.28,-.25,1.02],[1.28,-.25,-1.02],[1.28,-.25,1.02]] as const;
const ZERO={x:0,y:0,z:0},IDENTITY={x:0,y:0,z:0,w:1},UP=new Vector3(0,1,0);
const CAR_GROUP=0x00020005,WORLD_GROUP=0x00010006,PROP_GROUP=0x00040007;
const v=(p:{x:number;y:number;z:number})=>new Vector3(p.x,p.y,p.z);
const q=(r:{x:number;y:number;z:number;w:number})=>new Quaternion(r.x,r.y,r.z,r.w);
export interface Wheel3D {body:RAPIER.RigidBody;carrier:RAPIER.RigidBody;knuckle:RAPIER.RigidBody;steer?:RAPIER.RevoluteImpulseJoint;motor:RAPIER.RevoluteImpulseJoint;axle:number;points:Point[];colliders:RAPIER.Collider[];revision:number;compression:number;spin:number;load:number;contactDirection:V3;contactPoint?:V3;massShape?:Point[]}
export interface PhysicalProp {spec:WorldProp;body:RAPIER.RigidBody;initial:V3;initialRotation:{x:number;y:number;z:number;w:number};collider:RAPIER.Collider}
export interface PhysicalPlate {spec:Plate;body:RAPIER.RigidBody;collider:RAPIER.Collider;mass:number;active:boolean;qualify:number;loads:Map<number,number>;sleepingLoads:Map<number,number>}
export interface PhysicalGate {spec:Gate;body:RAPIER.RigidBody;collider:RAPIER.Collider;amount:number;held:number;blocked:boolean}
export interface PhysicalBridge {id:string;body:RAPIER.RigidBody;length:number;width:number;counterweight:number}
export interface WorldEvent {kind:'camp'|'cache'|'relay'|'switch'|'goal'|'finish';id:string}
let initialized:Promise<void>|undefined;
export function initWorldPhysics(){return initialized??=RAPIER.init();}
export function waterSurface(b:Basin,x:number,z:number,time:number,level=b.level){
  const r=basinWeight(b,x,z),shore=1-smooth((r-.55)/.48),a=b.waves*shore;
  const phase=x*.58+z*.24-time*2.2;
  const height=level+a*(Math.sin(phase)*.56+Math.sin(x*.24-z*.62-time*1.74+1.3)*.29+Math.sin(x*.91+z*.41-time*3.1)*.15);
  return {height,vx:b.current.x+a*.9*Math.cos(phase),vz:b.current.z+a*.6*Math.cos(phase),vy:-a*1.3*Math.cos(phase)};
}
export function radarReading(level:WorldLevel,p:V3,forward:V3){
  const dx=level.goal.x-p.x,dz=level.goal.z-p.z,d=Math.hypot(dx,dz);
  const bearing=Math.atan2(dz,dx)-Math.atan2(forward.z,forward.x);
  const angle=Math.round(Math.atan2(Math.sin(bearing),Math.cos(bearing))/(Math.PI/6))*(Math.PI/6);
  const band=d<25?'unter 25 m':`${Math.floor(d/25)*25}–${Math.floor(d/25)*25+25} m`;
  return {angle,band};
}

export class WorldSimulation {
  readonly world:RAPIER.World;
  body:RAPIER.RigidBody;
  wheels:Wheel3D[]=[];carBodies:RAPIER.RigidBody[]=[];
  props:PhysicalProp[]=[];plates:PhysicalPlate[]=[];gates:PhysicalGate[]=[];bridges:PhysicalBridge[]=[];
  tiles=new Map<string,{tile:TerrainTile;colliders:RAPIER.Collider[]}>();
  shapes:Point[][];shapeRevisions=[0,0];stiffness=[1,1];pending:(Point[]|null)[]=[null,null];
  drive=0;brake=0;steering=0;steerAngle=0;weight=0;weightTarget=0;water=0;mud=0;
  started=false;finished=false;elapsed=0;rescues=0;shapeChanges=0;finishTime=0;
  checkpoint:Camp;foundCamps=new Set<string>();collected=new Set<string>();activatedRelays=new Set<string>();latchedSwitches=new Set<string>();signals=new Set<string>();events:WorldEvent[]=[];
  basinLevels=new Map<string,number>();sprayPoints:{p:V3;velocity:V3;strength:number;mud:boolean}[]=[];
  private ticks=0;private mountCooldown=0;private engineSpeed=0;private goalInRange=false;
  private plateContacts=new Map<number,number>();
  private wheelOwners=new Map<number,Wheel3D>();private contactEvents=new RAPIER.EventQueue(true);
  private plateOwners=new Map<number,PhysicalPlate>();
  constructor(public level:WorldLevel,private assets:AssetCollisions,shapes:Point[][]=[preset('round'),preset('round')]){
    this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=WORLD_DT;this.world.numSolverIterations=10;
    this.shapes=shapes.map(s=>sanitizeShape(s)??preset('round'));
    this.checkpoint={id:'start',...level.start,yaw:level.heading};
    this.ensureTerrain(level.start.x,level.start.z,2);
    for(const p of [...level.props,...level.plates,...level.gates,...level.camps,...level.bridges])this.ensureTile(Math.floor(p.x/WORLD_TILE),Math.floor(p.z/WORLD_TILE));
    for(const spec of level.props)this.createProp(spec);
    for(const spec of level.plates){
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x,spec.y,spec.z).setRotation(new Quaternion().setFromAxisAngle(UP,spec.yaw)));
      const collider=this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(spec.width/2-.025,.015,spec.depth/2-.025,.025).setFriction(.85).setCollisionGroups(WORLD_GROUP).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.01),body);
      const plate={spec,body,collider,mass:0,active:false,qualify:0,loads:new Map<number,number>(),sleepingLoads:new Map<number,number>()};this.plates.push(plate);this.plateOwners.set(collider.handle,plate);
    }
    for(const spec of level.gates){
      for(const part of gateFrame(spec))this.world.createCollider(RAPIER.ColliderDesc.cuboid(part.size.x/2,part.size.y/2,part.size.z/2).setTranslation(part.position.x,part.position.y,part.position.z).setRotation(new Quaternion().setFromAxisAngle(UP,part.yaw)).setFriction(.6).setCollisionGroups(WORLD_GROUP));
      const lift=spec.kind==='lift',body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spec.x,spec.y+(lift?.25:spec.height/2),spec.z).setRotation(new Quaternion().setFromAxisAngle(UP,spec.yaw)));
      const gateAsset=assets.large_iron_gate;
      const bounds=[0,1,2].map(axis=>Math.max(...gateAsset.positions.filter((_,i)=>i%3===axis))-Math.min(...gateAsset.positions.filter((_,i)=>i%3===axis)));
      const vertices=Float32Array.from(gateAsset.positions,(value,i)=>value*[spec.width/bounds[0],spec.height/bounds[1],.44/bounds[2]][i%3]);
      const shape=lift?RAPIER.ColliderDesc.cuboid(spec.width/2,.22,LIFT_DEPTH/2):RAPIER.ColliderDesc.trimesh(vertices,new Uint32Array(gateAsset.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
      const collider=this.world.createCollider(shape.setFriction(.85).setCollisionGroups(WORLD_GROUP),body);
      this.gates.push({spec,body,collider,amount:0,held:0,blocked:false});
    }
    for(const spec of level.bridges){
      for(const part of bridgeFrame(spec,(x,z)=>worldHeight(level,x,z)))this.world.createCollider(RAPIER.ColliderDesc.cuboid(part.size.x/2,part.size.y/2,part.size.z/2).setTranslation(part.position.x,part.position.y,part.position.z).setRotation(new Quaternion().setFromAxisAngle(UP,part.yaw)).setCollisionGroups(WORLD_GROUP));
      const rotation=new Quaternion().setFromAxisAngle(UP,spec.yaw),anchor=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(spec.x,spec.y,spec.z).setRotation(rotation));
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(spec.x,spec.y,spec.z).setRotation(rotation).setAngularDamping(1.4).setCcdEnabled(true));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(spec.length/2,.16,spec.width/2).setMass(12).setFriction(.9).setCollisionGroups(PROP_GROUP),body);
      // The fixed ballast is a real, visible mass below one end. Driving over
      // the fulcrum or placing another object changes the actual gravitational
      // torque; there is no scripted tilt based on the player's progress.
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(.8,.3,spec.width*.32).setTranslation(-spec.length*.32,-.48,0).setMass(spec.counterweight).setFriction(.75).setCollisionGroups(PROP_GROUP),body);
      const joint=this.world.createImpulseJoint(RAPIER.JointData.revolute(ZERO,ZERO,{x:0,y:0,z:1}),anchor,body,true) as RAPIER.RevoluteImpulseJoint;joint.setLimits(-.32,.32);joint.setContactsEnabled(false);
      body.setRotation(rotation.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),spec.angle)),true);
      this.bridges.push({id:spec.id,body,length:spec.length,width:spec.width,counterweight:spec.counterweight});
    }
    const y=level.start.y+1.7,rotation=new Quaternion().setFromAxisAngle(UP,level.heading);
    this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(level.start.x,y,level.start.z).setRotation(rotation).setLinearDamping(.05).setAngularDamping(.7).setCcdEnabled(true));
    for(let i=0;i<3;i++){
      const desc=RAPIER.ColliderDesc.convexHull(new Float32Array(assets['vehicle-part-'+i].positions));
      if(!desc)throw Error('Invalid vehicle collision geometry');
      this.world.createCollider(desc.setMass(0).setFriction(.45).setCollisionGroups(CAR_GROUP),this.body);
    }
    this.body.setAdditionalMassProperties(27,{x:0,y:-.32,z:0},{x:17,y:33,z:31},IDENTITY,true);this.carBodies.push(this.body);
    for(const [index,anchor] of WHEEL_POSITIONS.entries()){
      const position=new Vector3(...anchor).applyQuaternion(rotation).add(new Vector3(level.start.x,y,level.start.z));
      const carrier=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation).setAdditionalMassProperties(.18,ZERO,{x:.035,y:.035,z:.035},IDENTITY));
      const suspension=RAPIER.JointData.prismatic({x:anchor[0],y:anchor[1],z:anchor[2]},ZERO,{x:0,y:1,z:0});suspension.limitsEnabled=true;suspension.limits=[-.25,.28];
      const spring=this.world.createImpulseJoint(suspension,this.body,carrier,true) as RAPIER.PrismaticImpulseJoint;spring.configureMotorModel(RAPIER.MotorModel.ForceBased);spring.configureMotorPosition(0,660,45);spring.setContactsEnabled(false);
      let knuckle=carrier,steer:RAPIER.RevoluteImpulseJoint|undefined;
      if(index>=2){
        knuckle=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation).setAdditionalMassProperties(.18,ZERO,{x:.035,y:.035,z:.035},IDENTITY));
        steer=this.world.createImpulseJoint(RAPIER.JointData.revolute(ZERO,ZERO,{x:0,y:1,z:0}),carrier,knuckle,true) as RAPIER.RevoluteImpulseJoint;
        steer.setContactsEnabled(false);steer.setLimits(-.72,.72);steer.configureMotorModel(RAPIER.MotorModel.ForceBased);steer.configureMotorPosition(0,350,30);this.carBodies.push(knuckle);
      }
      const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).setRotation(rotation).setAngularDamping(.045).setCcdEnabled(true));
      const motor=this.world.createImpulseJoint(RAPIER.JointData.revolute(ZERO,ZERO,{x:0,y:0,z:1}),knuckle,body,true) as RAPIER.RevoluteImpulseJoint;motor.setContactsEnabled(false);
      motor.configureMotorModel(RAPIER.MotorModel.ForceBased);motor.setMotorMaxForce(600);
      const wheel:Wheel3D={body,carrier,knuckle,steer,motor,axle:index<2?0:1,points:[],colliders:[],revision:0,compression:0,spin:0,load:0,contactDirection:{x:0,y:-1,z:0}};this.wheels.push(wheel);this.carBodies.push(carrier,body);this.rebuildWheel(wheel);
    }
    for(const [i,w] of this.wheels.entries())for(const c of w.colliders)this.plateContacts.set(c.handle,8.2);
    for(let i=0;i<this.body.numColliders();i++)this.plateContacts.set(this.body.collider(i).handle,27);
    for(const p of this.props)if(p.spec.movable)this.plateContacts.set(p.collider.handle,p.spec.mass);
    for(const b of level.basins)this.basinLevels.set(b.id,b.level);
    for(let i=0;i<100;i++)this.world.step();
  }
  get position(){return this.body.translation();}
  get forward(){return new Vector3(1,0,0).applyQuaternion(q(this.body.rotation()));}
  get signedSpeed(){return v(this.body.linvel()).dot(this.forward);}
  get heading(){const f=this.forward;return -Math.atan2(f.z,f.x);}
  get radar(){return radarReading(this.level,this.position,this.forward);}
  get availableCells(){return this.level.caches.filter(c=>c.kind==='cell'&&this.collected.has(c.id)).length-this.level.relays.filter(r=>this.activatedRelays.has(r.id)).reduce((n,r)=>n+r.requires.length,0);}
  get nearbySwitch(){return this.level.switches.find(s=>{
    if(!s.toggle&&this.latchedSwitches.has(s.id))return false;
    const gate=s.gate?this.gates.find(g=>g.spec.id===s.gate):undefined;
    return dist(s,this.position)<(gate?4.9:3.6)&&Math.abs(this.position.y-s.y-(gate?gate.amount*gate.spec.travel:0))<2.8;
  });}
  interact(){const s=this.nearbySwitch;if(!s||Math.abs(this.signedSpeed)>1)return false;if(s.toggle&&this.latchedSwitches.has(s.id)){this.latchedSwitches.delete(s.id);this.signals.delete(s.id);}else{this.latchedSwitches.add(s.id);this.signals.add(s.id);}this.events.push({kind:'switch',id:s.id});return true;}
  ensureTile(tx:number,tz:number){
    const key=tx+','+tz;if(this.tiles.has(key))return this.tiles.get(key)!.tile;
    const tile=makeTerrainTile(this.level,tx,tz),colliders:RAPIER.Collider[]=[];
    for(const [material,indices] of Object.entries(tile.groups))if(indices.length){
      const friction=material==='ice'?.035:material==='mud'?.24:material==='soil'?.8:material==='gravel'?.74:this.level.biome==='glacier'?.28:.68;
      colliders.push(this.world.createCollider(RAPIER.ColliderDesc.trimesh(tile.positions,indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(friction).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setCollisionGroups(WORLD_GROUP)));
    }
    this.tiles.set(key,{tile,colliders});return tile;
  }
  ensureTerrain(x:number,z:number,radius=2){const tx=Math.floor(x/WORLD_TILE),tz=Math.floor(z/WORLD_TILE);for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)this.ensureTile(tx+dx,tz+dz);}
  private streamTerrain(){
    const position=this.position;this.ensureTerrain(position.x,position.z,2);
    for(const prop of this.props)if(prop.spec.movable&&!prop.body.isSleeping()){const p=prop.body.translation();this.ensureTerrain(p.x,p.z,1);}
    if(this.tiles.size<256||this.ticks%180!==0)return;
    const protectedTiles=new Set<string>();
    for(const body of [...this.props.filter(p=>p.spec.movable).map(p=>p.body),...this.bridges.map(b=>b.body)]){
      const p=body.translation(),tx=Math.floor(p.x/WORLD_TILE),tz=Math.floor(p.z/WORLD_TILE);
      for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)protectedTiles.add(`${tx+x},${tz+z}`);
    }
    const tx=Math.floor(position.x/WORLD_TILE),tz=Math.floor(position.z/WORLD_TILE);
    for(const [key,tile] of this.tiles){const [x,z]=key.split(',').map(Number);if(Math.max(Math.abs(x-tx),Math.abs(z-tz))<=8||protectedTiles.has(key))continue;for(const collider of tile.colliders)this.world.removeCollider(collider,false);this.tiles.delete(key);}
  }
  surfaceHeight(x:number,z:number){
    const ix=Math.floor(x),iz=Math.floor(z),tx=Math.floor(ix/WORLD_TILE),tz=Math.floor(iz/WORLD_TILE),tile=this.ensureTile(tx,tz),index=(iz-tz*WORLD_TILE)*(WORLD_TILE+1)+ix-tx*WORLD_TILE;
    const heights=[index,index+1,index+WORLD_TILE+1,index+WORLD_TILE+2].map(i=>tile.positions[i*3+1]),u=x-ix,v=z-iz;
    return u+v<=1?heights[0]+u*(heights[1]-heights[0])+v*(heights[2]-heights[0]):heights[3]+(1-u)*(heights[2]-heights[3])+(1-v)*(heights[1]-heights[3]);
  }
  private createProp(spec:WorldProp){
    const asset=this.assets[spec.asset];if(!asset)throw Error('Missing collision mesh: '+spec.asset);
    const rot=new Quaternion().setFromEuler(new Euler(spec.pitch??0,spec.yaw,spec.roll??0,'YXZ'));
    const scale=new Vector3(spec.stretch?.x??1,spec.stretch?.y??1,spec.stretch?.z??1).multiplyScalar(spec.scale);
    let minY=Infinity;const sample=new Vector3();for(let i=0;i<asset.positions.length;i+=3){sample.fromArray(asset.positions,i).multiply(scale).applyQuaternion(rot);minY=Math.min(minY,sample.y);}
    if(!spec.anchored)spec.y=worldHeight(this.level,spec.x,spec.z)-minY+(spec.movable?.05:-Math.min(spec.foliage?.045:.24,spec.scale*.05));
    if(spec.foliage)return;
    const vertices=Float32Array.from(asset.positions,(n,i)=>n*scale.getComponent(i%3));
    const body=this.world.createRigidBody((spec.movable?RAPIER.RigidBodyDesc.dynamic():RAPIER.RigidBodyDesc.fixed()).setTranslation(spec.x,spec.y,spec.z).setRotation(rot).setLinearDamping(.14).setAngularDamping(.27).setCcdEnabled(spec.movable));
    const desc=spec.movable?RAPIER.ColliderDesc.convexHull(vertices):RAPIER.ColliderDesc.trimesh(vertices,new Uint32Array(asset.indices),RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES);
    if(!desc)throw Error('Invalid asset geometry: '+spec.asset);
    if(spec.friction!==undefined)desc.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    const collider=this.world.createCollider(desc.setMass(spec.movable?spec.mass:0).setFriction(spec.friction??(spec.asset==='barrel_03'?.45:.74)).setCollisionGroups(PROP_GROUP),body);
    this.props.push({spec,body,collider,initial:{x:spec.x,y:spec.y,z:spec.z},initialRotation:{x:rot.x,y:rot.y,z:rot.z,w:rot.w}});
  }
  private rebuildWheel(wheel:Wheel3D){
    const base=this.shapes[wheel.axle],down=v(wheel.contactDirection).applyQuaternion(q(wheel.body.rotation()).invert());down.z=0;down.normalize();
    wheel.points=base.map(p=>{
      const along=Math.max(0,p.x*down.x+p.y*down.y),amount=wheel.compression*smooth(along/.8);
      return {...p,x:p.x-down.x*amount,y:p.y-down.y*amount};
    });
    let slot=0;
    const add=(desc:RAPIER.ColliderDesc)=>{
      const existing=wheel.colliders[slot++];
      // Deformation updates the same physical pieces instead of destroying
      // hundreds of collider handles and their contact registrations each time.
      if(existing){existing.setShape(desc.shape);existing.setTranslationWrtParent(desc.translation);existing.setRotationWrtParent(desc.rotation);return;}
      const c=this.world.createCollider(desc.setMass(0).setFriction(.42).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.008).setCollisionGroups(CAR_GROUP).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(.1),wheel.body);
      wheel.colliders.push(c);this.plateContacts.set(c.handle,8.2);this.wheelOwners.set(c.handle,wheel);
    };
    add(RAPIER.ColliderDesc.ball(.14));
    const edge=(a:Point,b:Point,r:number)=>{const delta=new Vector3(b.x-a.x,b.y-a.y,0),length=delta.length();if(length<.0001)return;add(RAPIER.ColliderDesc.capsule(length/2,r).setTranslation((a.x+b.x)/2,(a.y+b.y)/2,0).setRotation(new Quaternion().setFromUnitVectors(UP,delta.divideScalar(length))));};
    for(const [a,b] of uniqueShapeEdges(wheel.points))edge(a,b,STROKE_RADIUS);
    for(const tip of spokeTips(wheel.points))edge({x:0,y:0},tip,SPOKE_RADIUS);
    for(const c of wheel.colliders.splice(slot)){this.plateContacts.delete(c.handle);this.wheelOwners.delete(c.handle);this.world.removeCollider(c,true);}
    if(wheel.massShape!==base){
      const mass=wheelMassProperties(base);wheel.body.setAdditionalMassProperties(mass.mass,{x:mass.center.x,y:mass.center.y,z:0},{x:mass.inertia*.5+mass.mass*.004,y:mass.inertia*.5+mass.mass*.004,z:mass.inertia},IDENTITY,true);
      wheel.massShape=base;wheel.body.recomputeMassPropertiesFromColliders();
    }
    wheel.revision++;
  }
  requestShape(points:Point[],axle:number){const shape=sanitizeShape(points);if(!shape||(axle!==0&&axle!==1))return false;this.pending[axle]=shape;if(!this.started)this.mountPending();return true;}
  private mountPending(){
    if((this.mountCooldown>0&&this.started)||!this.pending.some(Boolean))return;
    // Mounting changes colliders at their actual axles; no teleport through roofs
    // and no chassis lift is granted by drawing a larger wheel.
    for(let axle=0;axle<2;axle++)if(this.pending[axle]){
      this.shapes[axle]=this.pending[axle]!;this.pending[axle]=null;this.shapeRevisions[axle]++;
      for(const w of this.wheels.filter(w=>w.axle===axle)){w.compression=0;this.rebuildWheel(w);}
      if(this.started)this.shapeChanges++;
    }
    this.mountCooldown=.35;
  }
  resetObjects(){
    // A local reset recovers puzzle props without undoing collected cells/relays.
    const position=this.position;
    for(const prop of this.props)if(prop.spec.movable&&(dist(position,prop.initial)<27||dist(position,prop.body.translation())<27)){
      prop.body.setTranslation(prop.initial,true);prop.body.setRotation(prop.initialRotation,true);prop.body.setLinvel(ZERO,true);prop.body.setAngvel(ZERO,true);
    }
  }
  rescue(count=true){this.teleport(this.checkpoint,this.checkpoint.yaw);if(count)this.rescues++;}
  teleport(position:V3,heading:number){
    this.ensureTerrain(position.x,position.z,2);
    const rotation=new Quaternion().setFromAxisAngle(UP,heading),height=position.y+Math.max(...this.shapes.map(radiusOf))+.65;
    this.body.setTranslation({x:position.x,y:height,z:position.z},true);this.body.setRotation(rotation,true);
    this.body.setLinvel(ZERO,true);this.body.setAngvel(ZERO,true);
    this.wheels.forEach((w,i)=>{
      const p=new Vector3(...WHEEL_POSITIONS[i]).applyQuaternion(rotation).add(new Vector3(position.x,height,position.z));
      for(const body of new Set([w.body,w.carrier,w.knuckle])){body.setTranslation(p,true);body.setRotation(rotation,true);body.setLinvel(ZERO,true);body.setAngvel(ZERO,true);}
      w.compression=0;w.load=0;w.contactPoint=undefined;w.contactDirection={x:0,y:-1,z:0};this.rebuildWheel(w);
    });
    this.steerAngle=0;this.drive=0;this.brake=0;this.weight=0;this.engineSpeed=0;
  }
  private applyFluid(body:RAPIER.RigidBody,point:Vector3,area:number,volume:number,normal?:Vector3){
    for(const b of this.level.basins){
      if(b.material==='ice'||basinWeight(b,point.x,point.z)>1.02)continue;
      const mud=b.material==='mud',level=this.basinLevels.get(b.id)!,surface=waterSurface(b,point.x,point.z,this.elapsed,level),wet=clamp((surface.height-point.y+.11)/.22,0,1);if(wet<=0)continue;
      const velocity=v(body.velocityAtPoint(point)),relative=velocity.clone().sub(new Vector3(surface.vx,surface.vy,surface.vz)),speed=relative.length();
      let force:Vector3;
      if(normal){const vn=relative.dot(normal);force=normal.clone().multiplyScalar(-.5*(mud?210:75)*area*wet*vn*Math.abs(vn));force.addScaledVector(relative,-(mud?8:.16)*area*wet);}
      else force=relative.multiplyScalar(-(mud?18:1.5)*area*wet*(1+speed*.32));
      force.y+=volume*(mud?62:57)*9.81*wet;
      const maxForce=body.mass()*30;if(force.length()>maxForce)force.setLength(maxForce);
      body.addForceAtPoint(force,point,true);
      if(this.ticks%6===0&&normal&&speed>.7&&Math.abs(point.y-surface.height)<.6)this.sprayPoints.push({p:{x:point.x,y:surface.height+.03,z:point.z},velocity:{x:velocity.x*.2,y:Math.min(3.5,.4+speed*.4),z:velocity.z*.2},strength:Math.min(1,area*speed*4),mud});
      return {wet,mud};
    }
    return null;
  }
  private fluids(){
    this.water=0;this.mud=0;
    const rotation=q(this.body.rotation()),position=v(this.position);
    for(const x of [-.92,.92])for(const z of [-.56,.56]){
      const point=new Vector3(x,-.28,z).applyQuaternion(rotation).add(position);
      const state=this.applyFluid(this.body,point,.26,.17);
      if(state){if(state.mud)this.mud+=state.wet/4;else this.water+=state.wet/4;}
    }
    for(const wheel of this.wheels){
      const p=wheel.body.translation();
      for(const basin of this.level.basins){
        if(basin.material==='ice'||basinWeight(basin,p.x,p.z)>1.28||p.y>(this.basinLevels.get(basin.id)!+basin.waves+1.4))continue;
        const state=applyWheelFluid(wheel.body,this.shapes[wheel.axle],wheel.compression,wheel.contactDirection,basin.material,point=>({...waterSurface(basin,point.x,point.z,this.elapsed,this.basinLevels.get(basin.id)!),wet:basinWeight(basin,point.x,point.z)<1.06}),WORLD_DT);
        if(this.ticks%6===0&&state.waterline&&state.waterlineSpeed>.7){
          const velocity=wheel.body.velocityAtPoint(state.waterline);
          this.sprayPoints.push({p:state.waterline,velocity:{x:velocity.x*.25,y:Math.min(4,.5+state.waterlineSpeed*.4),z:velocity.z*.25},strength:Math.min(1,state.waterlineSpeed*.3),mud:basin.material==='mud'});
        }
        if(state.volume>0)break;
      }
    }
    for(const prop of this.props)if(prop.spec.movable&&!prop.body.isSleeping()&&dist(prop.body.translation(),this.position)<35){
      const p=v(prop.body.translation()),r=prop.spec.scale*.35;
      this.applyFluid(prop.body,p,Math.PI*r*r*.45,prop.spec.asset==='barrel_03'?prop.spec.mass/40:prop.spec.mass/110);
    }
  }
  private mechanisms(){
    this.signals.clear();for(const id of [...this.activatedRelays,...this.latchedSwitches])this.signals.add(id);
    for(const plate of this.plates){
      const bodies=new Map<number,number>();
      this.world.contactPairsWith(plate.collider,other=>{
        const mass=this.plateContacts.get(other.handle),parent=other.parent();if(!mass||!parent)return;
        let touching=false;this.world.contactPair(plate.collider,other,manifold=>{if(manifold.numSolverContacts()>0)touching=true;});
        if(touching){
          const load=plate.loads.get(parent.handle)??(parent.isSleeping()?plate.sleepingLoads.get(parent.handle)??mass:0);
          bodies.set(parent.handle,load);if(load>0)plate.sleepingLoads.set(parent.handle,load);
        }
      });
      for(const key of plate.sleepingLoads.keys())if(!bodies.has(key))plate.sleepingLoads.delete(key);
      const measured=[...bodies.values()].reduce((a,b)=>a+b,0);plate.mass+=(measured-plate.mass)*.32;
      plate.qualify=clamp(plate.qualify+(plate.mass>=plate.spec.threshold*(plate.active?.88:1)?WORLD_DT:-2*WORLD_DT),0,.15);plate.active=plate.qualify>=.12;
      if(plate.active)this.signals.add(plate.spec.id);
    }
    for(const gate of this.gates){
      const spec=gate.spec,wanted=spec.mode==='all'?spec.requires.every(id=>this.signals.has(id)):spec.requires.some(id=>this.signals.has(id));
      if(wanted)gate.held=spec.delay;else gate.held=Math.max(0,gate.held-WORLD_DT);
      const target=wanted||gate.held>0?1:0,rate=spec.kind==='lift'?.13:.35;
      let next=gate.amount+clamp(target-gate.amount,-rate*WORLD_DT,rate*WORLD_DT);
      const newY=spec.y+(spec.kind==='lift'?.25:spec.height/2)+next*spec.travel;
      gate.blocked=false;
      if(next<gate.amount&&spec.kind!=='lift'){
        // Gates stop against bodies instead of passing through or crushing them.
        this.world.intersectionsWithShape({x:spec.x,y:newY,z:spec.z},gate.body.rotation(),gate.collider.shape,other=>{if(other.parent()?.isDynamic()){gate.blocked=true;return false;}return true;},undefined,0x00010006);
        if(gate.blocked)next=gate.amount;
      }
      gate.amount=next;gate.body.setNextKinematicTranslation({x:spec.x,y:spec.y+(spec.kind==='lift'?.25:spec.height/2)+next*spec.travel,z:spec.z});
    }
    for(const basin of this.level.basins)if(basin.controlledBy){
      const target=this.signals.has(basin.controlledBy)&&(basin.requires??[]).every(id=>this.signals.has(id))?basin.drainedLevel!:basin.level,current=this.basinLevels.get(basin.id)!;
      this.basinLevels.set(basin.id,current+clamp(target-current,-.32*WORLD_DT,.18*WORLD_DT));
    }
  }
  private discover(){
    const position=this.position;
    for(const camp of this.level.camps)if(dist(camp,position)<2.5&&Math.abs(position.y-camp.y)<3){
      if(this.checkpoint.id!==camp.id){this.checkpoint=camp;this.foundCamps.add(camp.id);this.events.push({kind:'camp',id:camp.id});}
    }
    for(const cache of this.level.caches)if(!this.collected.has(cache.id)&&dist(cache,position)<1.8&&Math.abs(cache.y-position.y)<1.4){
      this.collected.add(cache.id);this.events.push({kind:'cache',id:cache.id});
    }
    for(const relay of this.level.relays)if(!this.activatedRelays.has(relay.id)&&dist(relay,position)<3.5&&Math.abs(position.y-relay.y)<3&&this.availableCells>=relay.requires.length){this.activatedRelays.add(relay.id);this.signals.add(relay.id);this.events.push({kind:'relay',id:relay.id});}
    const goalDistance=dist(position,this.level.goal),goalReady=this.level.goalRequires.every(id=>this.signals.has(id));
    const nearGoal=goalDistance<6&&Math.abs(position.y-this.level.goal.y)<3;
    if(nearGoal&&!goalReady&&!this.goalInRange)this.events.push({kind:'goal',id:'goal'});
    this.goalInRange=nearGoal;
    if(goalDistance<3&&nearGoal&&goalReady){this.finished=true;this.finishTime=this.elapsed;this.events.push({kind:'finish',id:'goal'});}
  }
  tick(){
    if(!this.started||this.finished)return;
    this.ticks++;this.elapsed+=WORLD_DT;this.mountCooldown=Math.max(0,this.mountCooldown-WORLD_DT);this.mountPending();
    const position=this.position;if(this.ticks%20===0)this.streamTerrain();
    for(const body of [...this.carBodies,...this.props.filter(p=>p.spec.movable).map(p=>p.body)]){body.resetForces(false);body.resetTorques(false);}
    this.weight+=(clamp(this.weightTarget,-1,1)-this.weight)*.09;
    this.body.setAdditionalMassProperties(27,{x:this.weight*.8,y:-.32,z:0},{x:17,y:33,z:31},IDENTITY,false);
    this.steerAngle+=(clamp(this.steering,-1,1)*.65-this.steerAngle)*.085;
    this.engineSpeed+=clamp(-this.drive*6.6-this.engineSpeed,-11*WORLD_DT,11*WORLD_DT);
    for(const w of this.wheels){
      w.steer?.configureMotorPosition(this.steerAngle,350,30);
      const axis=new Vector3(0,0,1).applyQuaternion(q(w.knuckle.rotation())),omega=v(w.body.angvel()).sub(v(w.knuckle.angvel())).dot(axis);
      w.spin=omega;
      const desired=this.brake?0:this.engineSpeed,drag=this.brake?650:Math.abs(this.drive)>.01?900:0;
      // The joint solver applies equal-and-opposite motor impulses implicitly.
      // This stays stable for a single thin bar with very little inertia, while
      // retaining enough axle torque to lift the chassis at a long lever arm.
      w.motor.setMotorMaxForce(drag?600:0);w.motor.configureMotorVelocity(desired,drag);
      const target=(1-this.stiffness[w.axle])*.4*clamp(w.load/100,0,1);
      if(this.ticks%7===0&&(Math.abs(w.compression-target)>.015||(w.compression>.01&&Math.abs(omega)>.15))){w.compression+=(target-w.compression)*.6;this.rebuildWheel(w);}
    }
    this.mechanisms();this.fluids();this.world.step(this.contactEvents);this.readWheelLoads();this.discover();
    if(!Number.isFinite(this.position.y)||this.position.y<-35)this.rescue();
  }
  private readWheelLoads(){
    const forces=new Map<Wheel3D,number>(),largest=new Map<Wheel3D,number>();
    for(const wheel of this.wheels)wheel.contactPoint=undefined;
    for(const plate of this.plates)plate.loads.clear();
    this.contactEvents.drainContactForceEvents(event=>{
      const a=event.collider1(),b=event.collider2(),plate=this.plateOwners.get(a)??this.plateOwners.get(b);
      if(plate){const other=this.world.getCollider(plate.collider.handle===a?b:a),parent=other?.parent();if(parent&&this.plateContacts.has(other.handle))plate.loads.set(parent.handle,(plate.loads.get(parent.handle)??0)+Math.abs(event.totalForce().y)/9.81);}
      const wheel=this.wheelOwners.get(a)??this.wheelOwners.get(b);if(!wheel)return;
      const force=event.totalForceMagnitude();forces.set(wheel,(forces.get(wheel)??0)+force);
      if(force>(largest.get(wheel)??0)){
        const colliderA=this.world.getCollider(a),colliderB=this.world.getCollider(b);let nearest=Infinity,contactPoint:V3|undefined;
        this.world.contactPair(colliderA,colliderB,(manifold,flipped)=>{
          // Mesh contacts may be merged by Rapier's internal-edge correction;
          // their force is reported even when the temporary solver list is
          // empty. The persistent local contact points still identify support.
          for(let i=0;i<manifold.numContacts();i++){
            const separation=manifold.contactDist(i);if(separation>Math.min(.025,nearest))continue;
            const local=manifold.localContactPoint1(i);if(!local)continue;
            const first=flipped?colliderB:colliderA;
            contactPoint=v(local).applyQuaternion(q(first.rotation())).add(v(first.translation()));nearest=separation;
          }
        });
        if(contactPoint){largest.set(wheel,force);wheel.contactPoint=contactPoint;const contact=v(contactPoint).sub(v(wheel.body.translation()));if(contact.lengthSq()>.005)wheel.contactDirection=contact.normalize();}
      }
    });
    for(const wheel of this.wheels)wheel.load+=((forces.get(wheel)??0)-wheel.load)*.22;
  }
  snapshot(){return {position:this.position,rotation:this.body.rotation(),speed:this.signedSpeed,heading:this.heading,elapsed:this.elapsed,water:this.water,mud:this.mud,shapes:this.shapes,stiffness:this.stiffness,weight:this.weight,checkpoint:this.checkpoint.id,camps:[...this.foundCamps],collected:[...this.collected],activatedRelays:[...this.activatedRelays],latchedSwitches:[...this.latchedSwitches],nearbySwitch:this.nearbySwitch?.id,availableCells:this.availableCells,signals:[...this.signals],plates:this.plates.map(p=>({id:p.spec.id,mass:p.mass,active:p.active})),gates:this.gates.map(g=>({id:g.spec.id,amount:g.amount,blocked:g.blocked})),basins:[...this.basinLevels],rescues:this.rescues,finished:this.finished,radar:this.radar};}
  dispose(){this.contactEvents.free();this.world.free();}
}
