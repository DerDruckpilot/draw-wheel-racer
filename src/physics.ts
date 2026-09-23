import { inBand,groundGroup,propGroup,ROUTE_GROUPS,RIDGE_GROUP } from './branching';
import {waterHeight} from './waves';
import RAPIER from '@dimforge/rapier2d-compat';
import type { Course, Obstacle, Water } from './courses';
import { courseRunout, groundAt, suggestedShape, surfaceFriction, zoneAt } from './courses';
import { clamp, preset, radiusOf, sanitizeShape, shapeEdges, spokeTips, SPOKE_RADIUS, STROKE_RADIUS, type Point, type ShapeName } from './shapes';
import { HULL_HYDRO, MUD_MEDIUM, waterForces, wheelHydro, wheelMassProperties, type HydroShape } from './hydrodynamics';
import { roofOutline } from './structures';
import { Mechanics, prepareSoils, rigidWheel, type FlexState } from './mechanics';
import { Steering,centeredSteering,type LateralState } from './steering';

export const FIXED_DT = 1 / 120;
export const AXLES = [-1.28, 1.28];
export const DRIVE_TORQUE = 1200;
export const TYRE_FRICTION = .34;
const AXLE_Y = -.25;
export interface Vehicle {
  lateral:LateralState; flex:FlexState[]; ballast:number; ballastTarget:number;
  id: number; body: RAPIER.RigidBody; wheels: RAPIER.RigidBody[]; carriers: RAPIER.RigidBody[]; joints: RAPIER.ImpulseJoint[];
  shapes: Point[][]; hydros: HydroShape[][]; radialTravels: number[]; desiredShapes: (Point[] | null)[]; axleRevisions: number[];
  shape: Point[]; revision: number; checkpoint: number; resets: number; finished: boolean; finishTime: number;
  water: number; mud: number; lastX: number; stuck: number; aiTimer: number; desiredShape: Point[] | null;
  changeCooldown: number; buoyancy: number; drive: number; brake: number; motorDirection: number; shapeChanges: number; aiShape: ShapeName;
  hydro: HydroShape[]; motorTorques: number[]; motorIntegrals: number[]; radialTravel: number; motorCut: boolean; displacedVolume: number; waterThrust: number; waterDragPower: number;
}
export interface Beam { body: RAPIER.RigidBody; obstacle: Obstacle; lane: number }
let initialized: Promise<void> | undefined;
export function initPhysics() { return initialized ??= RAPIER.init(); }

export class Simulation {
  mechanics:Mechanics;
  steering:Steering;
  world: RAPIER.World;
  cars: Vehicle[] = [];
  beams: Beam[] = [];
  elapsed = 0;
  started = false;
  ai = true;
  collected = new Set<number>();
  constructor(public course: Course, carCount = 4, private initialShapes: Point[][] = [preset('round'), preset('round')]) {
    this.world = new RAPIER.World({ x: 0, y: -9.81 });
    this.world.timestep = FIXED_DT;
    this.world.numSolverIterations = 8;
    this.steering=new Steering(this);
    const soils=prepareSoils(course.segments,course.muds??[]);
    for (const s of course.segments) {
      // A vertical profile edge has no polygon area. Its wall is already the side
      // of the adjacent solid terrain polygon, so no degenerate hull is created.
      if (Math.abs(s.b.x - s.a.x) < .0001) continue;
      const pts = new Float32Array([s.a.x, s.a.y, s.b.x, s.b.y, s.b.x, -12, s.a.x, -12]);
      const desc = RAPIER.ColliderDesc.convexHull(pts);
      if (desc) {
        const collider=this.world.createCollider(desc.setFriction(surfaceFriction[s.surface]).setRestitution(0).setCollisionGroups(s.ridge?(RIDGE_GROUP<<16)|2:(groundGroup(s.channel)<<16)|(s.channel===undefined?0xffff:2|propGroup(s.channel))));
        if(s.lateral!==undefined)this.steering.sides.push({collider,z:s.lateral,depth:s.depth!,x:(s.a.x+s.b.x)/2,y:(Math.max(s.a.y,s.b.y)-12)/2,width:s.b.x-s.a.x,height:Math.max(s.a.y,s.b.y)+12,support:!s.ridge,fixedCoordinates:true});
        for(const soil of soils){const i=soil.segments.indexOf(s);if(i>=0)soil.colliders[i]=collider;}
      }
    }
    for (let i = 0; i < carCount; i++) this.cars.push(this.createCar(i));
    for (const o of course.obstacles) {
      if (o.kind === 'boulder') {
        const desc = RAPIER.ColliderDesc.convexHull(new Float32Array(o.outline!.flatMap(p => [p.x, p.y])));
        if (desc) {const collider=this.world.createCollider(desc.setTranslation(o.x, o.y).setFriction(1.15).setCollisionGroups((propGroup(o.channel) << 16) | (2 << o.lane!)));if(o.lateral!==undefined){const lo=Math.min(...o.outline!.map(p=>p.y)),hi=Math.max(...o.outline!.map(p=>p.y));this.steering.sides.push({collider,z:o.lateral,depth:o.depth??.9,x:o.x,y:o.y+(lo+hi)/2,width:o.width,height:hi-lo,fixedCoordinates:true});}}
      } else if (o.kind === 'beam' || o.kind === 'roller') {
        for (let i = 0; i < carCount; i++) {
          const pivot = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(o.x, o.y));
          const roller = o.kind === 'roller';
          const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(o.x, o.y).setAngularDamping(roller ? .035 : .9));
          const desc = roller ? RAPIER.ColliderDesc.ball(o.width / 2) : RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2);
          // A drum intersects the static floor visually; only the car contacts
          // its circumference. Its fixed bearing allows rotation, not translation.
          const collider=this.world.createCollider(desc.setMass(roller ? 3 : 5).setFriction(1.1).setCollisionGroups((propGroup(o.channel) << 16) | (roller ? 0 : groundGroup(o.channel)) | (2 << i)), body);
          if(o.lateral!==undefined)this.steering.sides.push({collider,z:o.lateral,depth:o.depth!,x:o.x,y:o.y,width:o.width,height:o.height});
          const joint = this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), pivot, body, true) as RAPIER.RevoluteImpulseJoint;
          if (!roller) joint.setLimits(-(o.tilt ?? .2), o.tilt ?? .2);
          this.beams.push({ body, obstacle: o, lane: i });
        }
      } else {
        const desc = o.kind === 'log' ? RAPIER.ColliderDesc.ball(o.width / 2) : o.structure ? RAPIER.ColliderDesc.convexHull(new Float32Array(roofOutline(o).flatMap(p => [p.x, p.y])))! : RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2);
        const collider=this.world.createCollider(desc.setTranslation(o.x, o.y).setFriction(.9).setCollisionGroups(o.channel===undefined&&o.lateral===undefined?0x0001ffff:(propGroup(o.channel)<<16)|2));
        if(o.lateral!==undefined)this.steering.sides.push({collider,z:o.lateral,depth:o.depth!,x:o.x,y:o.y,width:o.width,height:o.height});
      }
    }
    for (const s of courseRunout(course)) {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid((s.b.x - s.a.x) / 2, 6)
        .setTranslation((s.a.x + s.b.x) / 2, s.a.y - 6).setFriction(surfaceFriction.stone).setCollisionGroups(0x0001ffff));
    }
    this.mechanics=new Mechanics(this,soils);
    this.steering.sync();
    // Settle the suspension before the countdown.
    for (let i = 0; i < 90; i++) this.world.step();
    this.mechanics.capture();
  }

  createCar(id: number): Vehicle {
    const x = 2 - id * .14;
    const group = ((2 << id) << 16) | 1 | (32 << id) | ROUTE_GROUPS;
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.48).setLinearDamping(.045).setAngularDamping(1.6).setCcdEnabled(true));
    // Low engine/underframe ballast and longitudinal mass distribution.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.15, .27).setMassProperties(7.5, { x: .18, y: -.12 }, 6.8).setFriction(.35).setCollisionGroups(group), body);
    this.world.createCollider(RAPIER.ColliderDesc.roundCuboid(.62, .36, .055).setTranslation(-.05, .6).setMass(.5).setFriction(.5).setCollisionGroups(group), body);
    const wheels: RAPIER.RigidBody[] = [];
    const carriers: RAPIER.RigidBody[] = [];
    const joints: RAPIER.ImpulseJoint[] = [];
    for (const a of AXLES) {
      const carrier = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x + a, 1.48 + AXLE_Y).setAdditionalMassProperties(.15, { x: 0, y: 0 }, .05));
      const suspension = RAPIER.JointData.prismatic({ x: a, y: AXLE_Y }, { x: 0, y: 0 }, { x: 0, y: 1 });
      suspension.limitsEnabled = true; suspension.limits = [-.2, .22];
      const spring = this.world.createImpulseJoint(suspension, body, carrier, true) as RAPIER.PrismaticImpulseJoint;
      spring.configureMotorModel(RAPIER.MotorModel.ForceBased); spring.configureMotorPosition(0, 470, 28);
      const w = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x + a, 1.48 + AXLE_Y).setAngularDamping(.035).setCcdEnabled(true));
      const joint = this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), carrier, w, true);
      joint.setContactsEnabled(false);
      wheels.push(w); carriers.push(carrier); joints.push(joint, spring);
    }
    const car: Vehicle = { lateral:centeredSteering(),flex:[rigidWheel(),rigidWheel()],ballast:0,ballastTarget:0,id, body, wheels, carriers, joints, shapes: this.initialShapes.map(s => s.slice()), hydros: [[], []], radialTravels: [0, 0], desiredShapes: [null, null], axleRevisions: [0, 0], shape: this.initialShapes[0], revision: 0, checkpoint: 2, resets: 0, finished: false, finishTime: 0, water: 0, mud: 0, lastX: x, stuck: 0, aiTimer: id * .4, desiredShape: null, changeCooldown: 0, buoyancy: 0, drive: courseDrive(this.course), brake: 0, motorDirection: 1, shapeChanges: 0, aiShape: 'round', hydro: [], motorTorques: [0, 0], motorIntegrals: [0, 0], radialTravel: 0, motorCut: false, displacedVolume: 0, waterThrust: 0, waterDragPower: 0 };
    this.replaceColliders(car);
    return car;
  }

  replaceColliders(car: Vehicle, changed = [0, 1]) {
    const group = ((2 << car.id) << 16) | 1 | (32 << car.id) | ROUTE_GROUPS;
    car.shape = car.shapes[0];
    for (const [index, w] of car.wheels.entries()) {
      if (!changed.includes(index)) continue;
      car.flex[index].amount=0;car.flex[index].load=0;
      const shape = car.shapes[index];
      car.hydros[index] = wheelHydro(shape);
      const properties = wheelMassProperties(shape);
      const supports = Array.from({ length: 48 }, (_, i) => {
        const a = i * Math.PI / 24;
        return Math.max(.15, ...shape.map(p => p.x * Math.cos(a) + p.y * Math.sin(a) + STROKE_RADIUS));
      });
      car.radialTravels[index] = Math.max(...supports) - Math.min(...supports);
      car.motorIntegrals[index] = 0;
      const previousOmega = w.angvel();
      const previousInertia = w.principalInertia();
      while (w.numColliders()) this.world.removeCollider(w.collider(0), true);
      this.world.createCollider(RAPIER.ColliderDesc.ball(.15).setMass(0).setFriction(TYRE_FRICTION).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setCollisionGroups(group), w);
      for (const [a, b] of shapeEdges(shape)) {
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (len < .0001) continue;
        const desc = RAPIER.ColliderDesc.capsule(len / 2, STROKE_RADIUS)
          .setTranslation((a.x + b.x) / 2, (a.y + b.y) / 2).setRotation(Math.atan2(dy, dx) - Math.PI / 2)
          .setMass(0).setFriction(TYRE_FRICTION).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.005).setCollisionGroups(group);
        this.world.createCollider(desc, w);
      }
      // A minimal rigid spoke is both visible and physical; density is intentionally low.
      for (const tip of spokeTips(shape)) {
        const distance = Math.hypot(tip.x, tip.y);
        if (distance > .2) this.world.createCollider(RAPIER.ColliderDesc.capsule(distance / 2, SPOKE_RADIUS).setTranslation(tip.x / 2, tip.y / 2).setRotation(Math.atan2(tip.y, tip.x) - Math.PI / 2).setMass(0).setFriction(TYRE_FRICTION).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setCollisionGroups(group), w);
      }
      // Area moments of the welded contour include holes and eccentricity.
      // Extra input samples and retracing a rim no longer add phantom mass.
      w.setAdditionalMassProperties(properties.mass, properties.center, properties.inertia, true);
      w.recomputeMassPropertiesFromColliders();
      // Never introduce rotational kinetic energy just by replacing a shape.
      const inertia = w.principalInertia();
      const omega = previousInertia > 0 && inertia > 0 ? previousOmega * Math.min(1, Math.sqrt(previousInertia / inertia)) : previousOmega;
      w.setAngvel(clamp(omega, -20, 20), true);
      car.axleRevisions[index]++;
    }
    car.revision++;
    car.hydro = car.hydros[0]; car.radialTravel = Math.max(...car.radialTravels);
  }

  requestShape(points: Point[], id = 0, axle?: number) {
    const shape = sanitizeShape(points);
    if (!shape) return false;
    // Reject a numerically invalid contour before replacing a working wheel.
    try { wheelHydro(shape); } catch { return false; }
    if (axle !== undefined && axle !== 0 && axle !== 1) return false;
    for (const index of axle === undefined ? [0, 1] : [axle]) this.cars[id].desiredShapes[index] = shape;
    if (!this.started) { this.cars[id].changeCooldown = 0; this.applyPending(this.cars[id]); }
    return true;
  }

  applyPending(car: Vehicle) {
    if (car.desiredShape) { car.desiredShapes = [car.desiredShape, car.desiredShape]; car.desiredShape = null; }
    if (!car.desiredShapes.some(Boolean) || car.changeCooldown > 0) return;
    const next = car.desiredShapes.map((shape, i) => shape ?? car.shapes[i]);
    const newRadius = Math.max(...next.map(radiusOf));
    let lift = 0;
    if (next.some((shape, i) => radiusOf(shape) > radiusOf(car.shapes[i]))) {
      for (const [i, w] of car.wheels.entries()) {
        const pos = w.translation(), rot = w.rotation(), co = Math.cos(rot), si = Math.sin(rot);
        for (const p of next[i]) {
          const px = pos.x + p.x * co - p.y * si, py = pos.y + p.x * si + p.y * co;
          lift = Math.max(lift, groundAt(this.course, px,car.lateral.offset) + STROKE_RADIUS + .02 - py);
        }
      }
      // Check the full cage and both wheels, including the rear wheel while
      // leaving a low roof. The old chassis-center check grew wheels too early.
      const shift = lift, bodyPos = car.body.translation(), angle = car.body.rotation();
      const co = Math.cos(angle), si = Math.sin(angle);
      const cage = { x: bodyPos.x - .05 * co - .6 * si, y: bodyPos.y - .05 * si + .6 * co + shift };
      for (const roof of this.course.obstacles.filter(o => (o.kind === 'ceiling'||o.kind==='platform')&&inBand(o,car.lateral.offset,1))) {
        const overlaps = (x: number, y: number, hx: number, hy: number) =>
          Math.abs(x - roof.x) < hx + roof.width / 2 + .02 && Math.abs(y - roof.y) < hy + roof.height / 2 + .02;
        if (overlaps(cage.x, cage.y, Math.abs(co) * .675 + Math.abs(si) * .415, Math.abs(si) * .675 + Math.abs(co) * .415)) return;
        if (car.wheels.some(w => overlaps(w.translation().x, w.translation().y + shift, newRadius, newRadius))) return;
        const cargo=car.id===0?this.mechanics?.cargo:undefined;
        if(cargo){const cp=cargo.body.translation();if(overlaps(cp.x,cp.y+shift,.48*Math.abs(co)+.34*Math.abs(si),.48*Math.abs(si)+.34*Math.abs(co)))return;}
      }
    }
    const changed = car.desiredShapes.flatMap((s, i) => s ? [i] : []);
    car.shapes = next; car.desiredShapes = [null, null];
    this.replaceColliders(car, changed);
    if (this.started) car.shapeChanges++;
    if (lift > 0) {
      const cargo=car.id===0?this.mechanics?.cargo:undefined;
      for (const b of [car.body, ...car.wheels, ...car.carriers,...(cargo?[cargo.body]:[])]) {
        const p = b.translation(); b.setTranslation({ x: p.x, y: p.y + lift }, true);
        const v = b.linvel(); b.setLinvel({ x: v.x, y: Math.min(v.y, 0) }, true);
      }
    }
    car.changeCooldown = .3;
  }

  resetCar(id = 0, countReset = true) {
    const car = this.cars[id];
    const x = car.checkpoint, r = Math.max(...car.shapes.map(radiusOf));
    const y = Math.max(0, groundAt(this.course, x,car.lateral.checkpoint)) + r - AXLE_Y + .1;
    car.body.setTranslation({ x, y }, true); car.body.setRotation(0, true);
    car.body.setLinvel({ x: 0, y: 0 }, true); car.body.setAngvel(0, true);
    car.wheels.forEach((w, i) => {
      w.setTranslation({ x: x + AXLES[i], y: y + AXLE_Y }, true); w.setRotation(0, true);
      w.setLinvel({ x: 0, y: 0 }, true); w.setAngvel(0, true);
      const carrier = car.carriers[i]; carrier.setTranslation({ x: x + AXLES[i], y: y + AXLE_Y }, true); carrier.setRotation(0, true); carrier.setLinvel({ x: 0, y: 0 }, true); carrier.setAngvel(0, true);
    });
    car.stuck = 0;
    car.lateral.offset=car.lateral.checkpoint;car.lateral.velocity=0;car.lateral.heading=0;this.steering.sync();
    car.lastX = x;
    car.motorTorques.fill(0);
    car.motorIntegrals.fill(0);
    car.motorCut = false;
    if (countReset) car.resets++;
    if(id===0)this.mechanics?.reset();
  }

  tick() {
    if (!this.started) return;
    this.elapsed += FIXED_DT;
    for(const w of this.course.waters)w.time=this.elapsed;
    this.steering.tick(FIXED_DT);
    this.mechanics.beforeStep();
    let checkpointChanged=false;
    for (const car of this.cars) {
      car.changeCooldown = Math.max(0, car.changeCooldown - FIXED_DT);
      this.applyPending(car);
      const p = car.body.translation();
      car.body.resetForces(true); car.body.resetTorques(true);
      for (const w of car.wheels) { w.resetForces(true); w.resetTorques(true); }
      if (p.y < -7 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { this.resetCar(car.id); continue; }
      if (car.id === 0) this.collectCaches(car);
      const cargoAlive=(this.mechanics.cargo?.health??100)>0;
      if (!car.finished && p.x >= this.course.length && cargoAlive) { car.finished = true; car.finishTime = this.elapsed; }
      for (const cp of this.course.checkpoints) if (p.x > cp + 3 && cp > car.checkpoint && cargoAlive) {car.checkpoint = cp;car.lateral.checkpoint=0;if(car.id===0)checkpointChanged=true;}
      const zone = zoneAt(this.course, p.x,car.lateral.offset);
      if (car.id && this.ai) {
        car.aiTimer -= FIXED_DT;
        if (car.aiTimer <= 0) {
          // Keep paddling until the rear axle has reached the shallow shore.
          // Looking ahead alone changed to a smooth ring while still afloat.
          const ahead = zone?.kind === 'lake' || zone?.kind === 'ford' ? zone : zoneAt(this.course, p.x + 4);
          const shape = suggestedShape(ahead, p.x);
          if (shape !== car.aiShape) { car.desiredShape = preset(shape); car.aiShape = shape; }
          car.aiTimer = .45 + car.id * .12;
        }
      }
      const water = this.course.waters.find(w => inBand(w,car.lateral.offset) && p.x + 2.7 > w.start && p.x - 2.7 < w.end);
      car.water = water ? clamp(waterHeight(water,p.x) - (p.y - .65), 0, 1) : 0;
      car.buoyancy = 0; car.displacedVolume = 0; car.waterThrust = 0; car.waterDragPower = 0;
      if (water) this.applyWater(car, water);
      const mud = this.course.muds?.find(w => inBand(w,car.lateral.offset) && p.x + 2.7 > w.start && p.x - 2.7 < w.end);
      car.mud = mud ? clamp(mud.level - (p.y - 1.2), 0, 1) : 0;
      if (mud) this.applyWater(car, mud, true);
      // Each axle has its own speed regulator and full stall torque. An airborne
      // front axle reaching its speed limit cannot starve the loaded rear axle.
      // A steep land pitch does not reduce motor demand. The driver manages
      // balance with the pedals; only the floating hull retains a soft limiter.
      const direction = car.drive < 0 ? -1 : 1;
      if (direction !== car.motorDirection) { car.motorIntegrals.fill(0); car.motorTorques.fill(0); car.motorCut = false; car.motorDirection = direction; }
      const pitch = Math.atan2(Math.sin(car.body.rotation()), Math.cos(car.body.rotation())) * direction;
      const afloat = clamp(car.water * 3, 0, 1);
      const pitchRate = car.body.angvel() * direction;
      // Pitch on land is controlled by the driver. Even a steep, stationary
      // lever must receive engine torque; a world-angle cutoff caused deadlocks.
      const marineControl = clamp((1.05 - pitch - Math.max(0, pitchRate) * .3) / .35, 0, 1);
      const wheelieControl = (1 - afloat) + marineControl * afloat;
      car.motorCut = afloat > .9 && marineControl < .01;
      const demand = car.finished || car.brake > 0 ? 0 : clamp(Math.abs(car.drive), 0, 1);
      const throttle = demand > .01 ? wheelieControl : 0;
      const cruiseSpeed = (6.5 - car.id * .18) / (1 + car.radialTravel * 1.6 * (1 - afloat));
      // Crawl gearing trades wheel speed for control during an actual climb,
      // while retaining the full stall torque. This prevents launching over a
      // crest after a loaded rear wheel finally gets past its edge.
      const gearing = 1 + Math.max(0, pitch - .25) * 2.8 * (1 - afloat);
      const speed = cruiseSpeed / gearing;
      for (const [index, w] of car.wheels.entries()) {
        const rel = w.angvel() - car.body.angvel();
        // A marine throttle map keeps the already balanced paddle thrust gentle;
        // on land the low gear supplies substantially more peak axle torque.
        const torqueLimit = DRIVE_TORQUE + (96 - DRIVE_TORQUE) * afloat;
        // The pedal sets wheel speed, not stall torque: delicate crawling still
        // has the full low-gear torque available. Reverse mirrors the drivetrain.
        const error = -speed * demand - rel * direction;
        // A bounded load integrator supplies full torque even in crawling gear.
        // Low proportional gain avoids exciting the tiny inertia of a thin line.
        // Discard stored demand as soon as the axle is released or power is cut.
        if (error > -.3 || throttle < .05) car.motorIntegrals[index] = 0;
        else car.motorIntegrals[index] = clamp(car.motorIntegrals[index] + error * 600 * FIXED_DT, -torqueLimit, 0);
        const gain = (28 - afloat * 10) * Math.min(gearing, 1.6);
        const target = clamp(error * gain + car.motorIntegrals[index] * (1 - afloat), -torqueLimit, 36) * throttle * direction;
        // Finite torque rise prevents a newly mounted/immersed paddle from
        // delivering a one-frame hammer blow. Reaction torque is conserved.
        const rise = (12000 - afloat * 11640) * FIXED_DT;
        // Release torque promptly when a tooth clears the edge. Smoothing both
        // directions left stored throttle pushing the chassis into a backflip.
        const release = (7200 - afloat * 6840) * FIXED_DT;
        let torque = car.motorTorques[index] += clamp(target - car.motorTorques[index], direction > 0 ? -rise : -release, direction > 0 ? release : rise);
        if (car.brake > 0) {
          // A brake removes relative angular momentum through equal/opposite
          // axle torques. No velocity clamping or artificial grip on ice.
          const effectiveInertia = 1 / Math.max(.001, w.invPrincipalInertia() + car.body.invPrincipalInertia());
          torque = clamp(-rel * effectiveInertia / FIXED_DT * .7, -120, 120) * clamp(car.brake, 0, 1);
          car.motorTorques[index] = 0; car.motorIntegrals[index] = 0;
        }
        w.addTorque(torque, true);
        car.body.addTorque(-torque, true);
      }
      // Rolling resistance dissipates motion, without prescribing forward velocity.
      if (!water && Math.abs(car.body.linvel().x) > .02) car.body.addForce({ x: -car.body.linvel().x * .22, y: 0 }, true);
      const delta = Math.abs(p.x - car.lastX);
      car.stuck = delta < .0005 && !car.finished && demand > .1 ? car.stuck + FIXED_DT : Math.max(0, car.stuck - FIXED_DT * .3);
      car.lastX = p.x;
      if (car.id && car.stuck > 7) this.resetCar(car.id);
    }
    this.world.step();
    this.mechanics.afterStep();
    if(checkpointChanged)this.mechanics.capture();
  }

  applyWater(car: Vehicle, water: Water, mud = false) {
    for (const body of [car.body, ...car.wheels]) {
      const pose = { position: body.translation(), center: body.worldCom(), angle: body.rotation(), velocity: body.linvel(), omega: body.angvel(), invMass: body.invMass(), invInertia: body.invPrincipalInertia() };
      for (const shape of body === car.body ? HULL_HYDRO : car.hydros[car.wheels.indexOf(body)]) {
        const force = waterForces(shape, pose, water, FIXED_DT, mud ? MUD_MEDIUM : undefined);
        body.addForce({ x: force.x, y: force.y }, true); body.addTorque(force.torque, true);
        car.buoyancy += force.buoyancy; car.displacedVolume += force.volume; car.waterDragPower += force.dragPower;
        if (body !== car.body) car.waterThrust += force.dragX;
      }
    }
  }

  collectCaches(car: Vehicle) {
    for (const [id, cache] of (this.course.caches ?? []).entries()) {
      if (this.collected.has(id)) continue;
      const p = car.body.translation(), a = car.body.rotation(), dx = cache.x - p.x, dy = cache.y - p.y;
      const x = dx * Math.cos(a) + dy * Math.sin(a), y = -dx * Math.sin(a) + dy * Math.cos(a);
      let contact = (Math.abs(x) <= 1.4 && Math.abs(y) <= .52) || (Math.abs(x + .05) <= .925 && Math.abs(y - .6) <= .665);
      for (const [axle, w] of car.wheels.entries()) {
        const wp = w.translation(), wx = cache.x - wp.x, wy = cache.y - wp.y;
        if (contact || Math.hypot(wx, wy) > 1.65) continue;
        const angle = w.rotation(), q = { x: wx * Math.cos(angle) + wy * Math.sin(angle), y: -wx * Math.sin(angle) + wy * Math.cos(angle) };
        contact = Math.hypot(q.x, q.y) <= .4;
        for (const [u, v] of shapeEdges(car.shapes[axle])) {
          if (contact) break;
          const sx = v.x - u.x, sy = v.y - u.y;
          const t = clamp(((q.x - u.x) * sx + (q.y - u.y) * sy) / Math.max(.000001, sx * sx + sy * sy), 0, 1);
          contact = Math.hypot(q.x - u.x - t * sx, q.y - u.y - t * sy) <= STROKE_RADIUS + .25;
        }
      }
      if (contact) this.collected.add(id);
    }
  }

  get ranking() { return [...this.cars].sort((a, b) => a.finished && b.finished ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.body.translation().x - a.body.translation().x); }
  dispose() { this.world.free(); }
}

const courseDrive = (course: Course) => course.expedition ? 0 : 1;
