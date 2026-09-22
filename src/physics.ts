import RAPIER from '@dimforge/rapier2d-compat';
import type { Course, Obstacle } from './courses';
import { groundAt, surfaceFriction, zoneAt } from './courses';
import { clamp, preset, radiusOf, sanitizeShape, shapeLength, STROKE_RADIUS, type Point, type ShapeName } from './shapes';

export const FIXED_DT = 1 / 120;
export const AXLES = [-1.28, 1.28];
export const DRIVE_TORQUE = 58;
const AXLE_Y = -.25;
export interface Vehicle {
  id: number; body: RAPIER.RigidBody; wheels: RAPIER.RigidBody[]; carriers: RAPIER.RigidBody[]; joints: RAPIER.ImpulseJoint[];
  shape: Point[]; revision: number; checkpoint: number; resets: number; finished: boolean; finishTime: number;
  water: number; lastX: number; stuck: number; aiTimer: number; desiredShape: Point[] | null;
  changeCooldown: number; buoyancy: number; drive: number; aiShape: ShapeName;
}
export interface Beam { body: RAPIER.RigidBody; obstacle: Obstacle; lane: number }
let initialized: Promise<void> | undefined;
export function initPhysics() { return initialized ??= RAPIER.init(); }

export class Simulation {
  world: RAPIER.World;
  cars: Vehicle[] = [];
  beams: Beam[] = [];
  elapsed = 0;
  started = false;
  ai = true;
  constructor(public course: Course, carCount = 4) {
    this.world = new RAPIER.World({ x: 0, y: -9.81 });
    this.world.timestep = FIXED_DT;
    this.world.numSolverIterations = 8;
    for (const s of course.segments) {
      // A vertical profile edge has no polygon area. Its wall is already the side
      // of the adjacent solid terrain polygon, so no degenerate hull is created.
      if (Math.abs(s.b.x - s.a.x) < .0001) continue;
      const pts = new Float32Array([s.a.x, s.a.y, s.b.x, s.b.y, s.b.x, -12, s.a.x, -12]);
      const desc = RAPIER.ColliderDesc.convexHull(pts);
      if (desc) this.world.createCollider(desc.setFriction(surfaceFriction[s.surface]).setRestitution(0).setCollisionGroups(0x0001ffff));
    }
    for (let i = 0; i < carCount; i++) this.cars.push(this.createCar(i));
    for (const o of course.obstacles) {
      if (o.kind === 'beam') {
        for (let i = 0; i < carCount; i++) {
          const pivot = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(o.x, o.y));
          const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(o.x, o.y).setAngularDamping(.9));
          this.world.createCollider(RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2).setMass(5).setFriction(1.1).setCollisionGroups(((32 << i) << 16) | 1 | (2 << i)), body);
          const joint = this.world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), pivot, body, true) as RAPIER.RevoluteImpulseJoint;
          joint.setLimits(-.2, .2);
          this.beams.push({ body, obstacle: o, lane: i });
        }
      } else {
        const desc = o.kind === 'log' ? RAPIER.ColliderDesc.ball(o.width / 2) : RAPIER.ColliderDesc.cuboid(o.width / 2, o.height / 2);
        this.world.createCollider(desc.setTranslation(o.x, o.y).setFriction(.9).setCollisionGroups(0x0001ffff));
      }
    }
    // Allow the starting suspension-free rigid assembly to settle before the countdown.
    for (let i = 0; i < 90; i++) this.world.step();
  }

  createCar(id: number): Vehicle {
    const x = 2 - id * .14;
    const group = ((2 << id) << 16) | 1 | (32 << id);
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, 1.48).setLinearDamping(.045).setAngularDamping(1.6).setCcdEnabled(true));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.15, .27).setMass(7.5).setFriction(.35).setCollisionGroups(group), body);
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
    const car: Vehicle = { id, body, wheels, carriers, joints, shape: preset('round'), revision: 0, checkpoint: 2, resets: 0, finished: false, finishTime: 0, water: 0, lastX: x, stuck: 0, aiTimer: id * .4, desiredShape: null, changeCooldown: 0, buoyancy: 0, drive: 1, aiShape: 'round' };
    this.replaceColliders(car);
    return car;
  }

  replaceColliders(car: Vehicle) {
    const group = ((2 << car.id) << 16) | 1 | (32 << car.id);
    const length = shapeLength(car.shape);
    for (const w of car.wheels) {
      const previousOmega = w.angvel();
      const previousInertia = w.principalInertia();
      while (w.numColliders()) this.world.removeCollider(w.collider(0), true);
      this.world.createCollider(RAPIER.ColliderDesc.ball(.15).setMass(.24).setFriction(.8).setCollisionGroups(group), w);
      for (let i = 1; i < car.shape.length; i++) {
        const a = car.shape[i - 1], b = car.shape[i];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
        if (len < .005) continue;
        const desc = RAPIER.ColliderDesc.capsule(len / 2, STROKE_RADIUS)
          .setTranslation((a.x + b.x) / 2, (a.y + b.y) / 2).setRotation(Math.atan2(dy, dx) - Math.PI / 2)
          .setMass(len * .26).setFriction(1.15).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(.015).setCollisionGroups(group);
        this.world.createCollider(desc, w);
      }
      // A minimal rigid spoke is both visible and physical; density is intentionally low.
      for (let spoke = 0; spoke < 4; spoke++) {
        const tip = car.shape[Math.floor(spoke * (car.shape.length - 1) / 4)];
        const distance = Math.hypot(tip.x, tip.y);
        if (distance > .2) this.world.createCollider(RAPIER.ColliderDesc.capsule(distance / 2, .025).setTranslation(tip.x / 2, tip.y / 2).setRotation(Math.atan2(tip.y, tip.x) - Math.PI / 2).setMass(.035 * distance).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setCollisionGroups(group), w);
      }
      w.recomputeMassPropertiesFromColliders();
      // Never introduce rotational kinetic energy just by replacing a shape.
      const inertia = w.principalInertia();
      const omega = previousInertia > 0 && inertia > 0 ? previousOmega * Math.min(1, Math.sqrt(previousInertia / inertia)) : previousOmega;
      w.setAngvel(clamp(omega, -20, 20), true);
    }
    car.revision++;
    if (!Number.isFinite(length)) throw new Error('Invalid wheel geometry');
  }

  requestShape(points: Point[], id = 0) {
    const shape = sanitizeShape(points);
    if (!shape) return false;
    this.cars[id].desiredShape = shape;
    if (!this.started) { this.cars[id].changeCooldown = 0; this.applyPending(this.cars[id]); }
    return true;
  }

  applyPending(car: Vehicle) {
    if (!car.desiredShape || car.changeCooldown > 0) return;
    const newRadius = radiusOf(car.desiredShape), oldRadius = radiusOf(car.shape);
    let lift = 0;
    if (newRadius > oldRadius) {
      for (const w of car.wheels) {
        const pos = w.translation(), rot = w.rotation(), co = Math.cos(rot), si = Math.sin(rot);
        for (const p of car.desiredShape) {
          const px = pos.x + p.x * co - p.y * si, py = pos.y + p.x * si + p.y * co;
          lift = Math.max(lift, groundAt(this.course, px) + STROKE_RADIUS + .02 - py);
        }
      }
      // Check the full cage and both wheels, including the rear wheel while
      // leaving a low roof. The old chassis-center check grew wheels too early.
      const shift = Math.min(lift, .65), bodyPos = car.body.translation(), angle = car.body.rotation();
      const co = Math.cos(angle), si = Math.sin(angle);
      const cage = { x: bodyPos.x - .05 * co - .6 * si, y: bodyPos.y - .05 * si + .6 * co + shift };
      for (const roof of this.course.obstacles.filter(o => o.kind === 'ceiling')) {
        const overlaps = (x: number, y: number, hx: number, hy: number) =>
          Math.abs(x - roof.x) < hx + roof.width / 2 + .02 && Math.abs(y - roof.y) < hy + roof.height / 2 + .02;
        if (overlaps(cage.x, cage.y, Math.abs(co) * .675 + Math.abs(si) * .415, Math.abs(si) * .675 + Math.abs(co) * .415)) return;
        if (car.wheels.some(w => overlaps(w.translation().x, w.translation().y + shift, newRadius, newRadius))) return;
      }
    }
    car.shape = car.desiredShape; car.desiredShape = null;
    this.replaceColliders(car);
    if (lift > 0) {
      for (const b of [car.body, ...car.wheels, ...car.carriers]) {
        const p = b.translation(); b.setTranslation({ x: p.x, y: p.y + Math.min(lift, .65) }, true);
        const v = b.linvel(); b.setLinvel({ x: v.x, y: Math.min(v.y, 0) }, true);
      }
    }
    car.changeCooldown = .3;
  }

  resetCar(id = 0, countReset = true) {
    const car = this.cars[id];
    const x = car.checkpoint, r = radiusOf(car.shape);
    const y = Math.max(0, groundAt(this.course, x)) + r - AXLE_Y + .1;
    car.body.setTranslation({ x, y }, true); car.body.setRotation(0, true);
    car.body.setLinvel({ x: 0, y: 0 }, true); car.body.setAngvel(0, true);
    car.wheels.forEach((w, i) => {
      w.setTranslation({ x: x + AXLES[i], y: y + AXLE_Y }, true); w.setRotation(0, true);
      w.setLinvel({ x: 0, y: 0 }, true); w.setAngvel(0, true);
      const carrier = car.carriers[i]; carrier.setTranslation({ x: x + AXLES[i], y: y + AXLE_Y }, true); carrier.setRotation(0, true); carrier.setLinvel({ x: 0, y: 0 }, true); carrier.setAngvel(0, true);
    });
    car.stuck = 0;
    if (countReset) car.resets++;
  }

  tick() {
    if (!this.started) return;
    this.elapsed += FIXED_DT;
    for (const car of this.cars) {
      car.changeCooldown = Math.max(0, car.changeCooldown - FIXED_DT);
      this.applyPending(car);
      const p = car.body.translation();
      car.body.resetForces(true); car.body.resetTorques(true);
      for (const w of car.wheels) { w.resetForces(true); w.resetTorques(true); }
      if (p.y < -7 || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { this.resetCar(car.id); continue; }
      if (!car.finished && p.x >= this.course.length) { car.finished = true; car.finishTime = this.elapsed; }
      for (const cp of this.course.checkpoints) if (p.x > cp + 3 && cp > car.checkpoint) car.checkpoint = cp;
      const zone = zoneAt(this.course, p.x);
      if (car.id && this.ai) {
        car.aiTimer -= FIXED_DT;
        if (car.aiTimer <= 0) {
          const ahead = zoneAt(this.course, p.x + 4);
          const shape = ahead?.kind === 'tunnel' ? 'compact' : ahead?.kind === 'steps' ? 'claw' : ahead?.kind === 'lake' && p.x < ahead.end - 4.5 ? 'paddle' : 'round';
          if (shape !== car.aiShape) { car.desiredShape = preset(shape); car.aiShape = shape; }
          car.aiTimer = .45 + car.id * .12;
        }
      }
      const water = this.course.waters.find(w => p.x > w.start && p.x < w.end);
      car.water = water ? clamp(water.level - (p.y - .65), 0, 1) : 0;
      car.buoyancy = 0;
      if (water) this.applyWater(car, water.level);
      if (zone?.kind === 'mud') {
        const v = car.body.linvel();
        car.body.addForce({ x: -v.x * Math.abs(v.x) * .7, y: 0 }, true);
      }
      const throttle = car.finished ? 0 : car.drive;
      const speed = (car.water > .3 ? 8.5 : 6.5) - car.id * .18;
      for (const w of car.wheels) {
        const rel = w.angvel() - car.body.angvel();
        // High starting torque lifts an irregular wheel onto its next contact.
        // The unchanged target speed still limits the smooth wheel's top speed.
        const torque = clamp((-speed - rel) * 12, -DRIVE_TORQUE, 24) * throttle;
        w.addTorque(torque, true);
        car.body.addTorque(-torque, true);
      }
      // Rolling resistance dissipates motion, without prescribing forward velocity.
      if (!water && Math.abs(car.body.linvel().x) > .02) car.body.addForce({ x: -car.body.linvel().x * .22, y: 0 }, true);
      const delta = Math.abs(p.x - car.lastX);
      car.stuck = delta < .0005 && !car.finished ? car.stuck + FIXED_DT : Math.max(0, car.stuck - FIXED_DT * .3);
      car.lastX = p.x;
      if (car.id && car.stuck > 7) this.resetCar(car.id);
    }
    this.world.step();
  }

  applyWater(car: Vehicle, level: number) {
    const body = car.body, angle = body.rotation(), co = Math.cos(angle), si = Math.sin(angle);
    const pos = body.translation(), vel = body.linvel();
    // Six pontoons sample displaced volume. Their separated lift also supplies roll-restoring torque.
    for (let i = 0; i < 6; i++) {
      const lx = -1.05 + i * .42, ly = -.25;
      const rx = lx * co - ly * si, ry = lx * si + ly * co;
      const submerged = clamp((level - (pos.y + ry) + .22) / .44, 0, 1);
      const localVy = vel.y + body.angvel() * rx;
      const lift = clamp(submerged * 35 - localVy * submerged * 8, -20, 60);
      const localVx = vel.x - body.angvel() * ry;
      body.addForceAtPoint({ x: -(localVx * Math.abs(localVx) * 1.1 + localVx * .4) * submerged, y: lift }, { x: pos.x + rx, y: pos.y + ry }, true);
      car.buoyancy += submerged * 35;
    }
    for (const w of car.wheels) {
      const wp = w.translation(), r = w.rotation(), c = Math.cos(r), s = Math.sin(r), velocity = w.linvel(), omega = w.angvel();
      for (let i = 1; i < car.shape.length; i++) {
        const a = car.shape[i - 1], b = car.shape[i], length = Math.hypot(b.x - a.x, b.y - a.y);
        const lx = (a.x + b.x) / 2, ly = (a.y + b.y) / 2;
        const rx = lx * c - ly * s, ry = lx * s + ly * c;
        const depth = clamp((level - wp.y - ry + STROKE_RADIUS) / (2 * STROKE_RADIUS), 0, 1);
        if (!depth || length < .001) continue;
        const tx = ((b.x - a.x) * c - (b.y - a.y) * s) / length;
        const ty = ((b.x - a.x) * s + (b.y - a.y) * c) / length;
        const nx = -ty, ny = tx;
        const vx = velocity.x - omega * ry, vy = velocity.y + omega * rx;
        const normal = vx * nx + vy * ny, tangent = vx * tx + vy * ty;
        // Broadside pressure propels paddles; the smooth rim has little skin
        // friction and cannot behave like an equally effective paddle wheel.
        const pressure = -normal * Math.abs(normal) * length * depth * 3.2;
        const skin = -tangent * Math.abs(tangent) * length * depth * .008;
        w.addForceAtPoint({ x: clamp(nx * pressure + tx * skin, -35, 35), y: clamp(ny * pressure + ty * skin + length * depth * 2, -35, 35) }, { x: wp.x + rx, y: wp.y + ry }, true);
      }
    }
  }

  get ranking() { return [...this.cars].sort((a, b) => a.finished && b.finished ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.body.translation().x - a.body.translation().x); }
  dispose() { this.world.free(); }
}
