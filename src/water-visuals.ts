import * as THREE from 'three';
import { groundAt, type Course, type Water } from './courses';
import { TRACK_BACK, TRACK_FRONT } from './landscape';
import { splashActivity } from './splash-activity';
import type { Simulation } from './physics';

export function waterMaterial(course: Course, water: Water, sky: THREE.Texture | null, eye: THREE.Vector3) {
  // A small bathymetry map colors shallows and locates foam at the bank. The
  // collision profile remains authoritative; the shader doesn't move the waterline.
  const width = 256, height = 96, data = new Uint8Array(width * height * 4);
  const depths = Array.from({ length: width }, (_, i) => groundAt(course, water.start + i / (width - 1) * (water.end - water.start)));
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const x = water.start + i / (width - 1) * (water.end - water.start), z = -33.9 + j / (height - 1) * 60;
    const d = Math.max(0, z - TRACK_FRONT, TRACK_BACK - z), t = Math.min(1, d / 10), blend = t * t * (3 - 2 * t);
    const land = .45 + Math.sin(x * .081 + z * .06) * .18 + Math.cos(x * .17 - z * .09) * .12;
    const bottom = depths[i] * (1 - blend) + land * blend;
    const depth = Math.max(0, Math.min(1, (water.level - bottom) / 5));
    const n = (j * width + i) * 4; data[n] = data[n + 1] = data[n + 2] = Math.round(depth * 255); data[n + 3] = 255;
  }
  const depthMap = new THREE.DataTexture(data, width, height); depthMap.minFilter = depthMap.magFilter = THREE.LinearFilter; depthMap.needsUpdate = true;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 }, eye: { value: eye }, sky: { value: sky }, bathymetry: { value: depthMap },
      bounds: { value: new THREE.Vector2(water.start, water.end) },
      colorDeep: { value: new THREE.Color(course.theme === 'alpine' ? '#075268' : '#015a60') },
      colorShallow: { value: new THREE.Color('#218a85') },
      wakes: { value: Array.from({ length: 4 }, () => new THREE.Vector4(-1000, 0, 0, 0)) }
    },
    vertexShader: `varying vec3 vWorld; varying vec2 vTrackUv; uniform float time;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.);
      world.y += .016*sin(world.x*.9+world.z*1.4+time*1.3)+.012*sin(world.x*2.4-world.z*.7-time*1.6);
      vTrackUv=uv; vWorld = world.xyz; gl_Position = projectionMatrix * viewMatrix * world;
    }`,
    fragmentShader: `varying vec3 vWorld; varying vec2 vTrackUv; uniform float time; uniform vec3 eye;
    uniform sampler2D sky; uniform sampler2D bathymetry; uniform vec2 bounds;
    uniform vec3 colorDeep; uniform vec3 colorShallow; uniform vec4 wakes[4];
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float waves(vec2 p){return noise(p*.45+vec2(time*.12,-time*.08))*.64+noise(p*1.3+vec2(-time*.18,time*.12))*.28+noise(p*3.6+time*.18)*.08;}
    void main(){
      // Unbent route coordinates keep bathymetry, banks and wakes aligned while
      // the world-space position is used for the eye and sky reflection.
      vec2 p=vec2(mix(bounds.x,bounds.y,vTrackUv.x),-33.9+(1.-vTrackUv.y)*60.); float h=waves(p), e=.08;
      vec3 n=normalize(vec3((h-waves(p+vec2(e,0)))*.75, e, (h-waves(p+vec2(0,e)))*.75));
      vec3 v=normalize(eye-vWorld), reflected=reflect(-v,n);
      vec2 env=vec2(atan(reflected.z,reflected.x)*.159154943+.5,asin(clamp(reflected.y,-1.,1.))*.318309886+.5);
      vec3 reflection=texture2D(sky,env,3.5).rgb; reflection=reflection/(1.+max(reflection.r,max(reflection.g,reflection.b)))*1.4;
      float fresnel=.035+.965*pow(1.-max(dot(n,v),0.),5.);
      float depth=texture2D(bathymetry,vec2((p.x-bounds.x)/(bounds.y-bounds.x),(p.y+33.9)/60.)).r*5.;
      vec3 water=mix(colorShallow,colorDeep,smoothstep(.1,2.8,depth))*(1.1+h*.17);
      // Wide, broken highlights from the sky and a soft sun lobe, never a sine checkerboard.
      vec3 halfSun=normalize(v+normalize(vec3(-.5,.9,.5)));
      float spec=pow(max(dot(n,halfSun),0.),95.);
      float glitter=smoothstep(.82,.94,noise(p*.6+vec2(time*.1,-time*.08)))*smoothstep(.5,.67,h);
      vec3 color=mix(water,reflection,clamp(fresnel*.9+.035,0.,.8))+vec3(spec*.35+glitter*.32);
      float shore=(1.-smoothstep(.03,.3,depth))*smoothstep(0.,.05,depth);
      float foam=shore*(.18+.5*noise(p*6.-time*.2));
      for(int i=0;i<4;i++){
        vec2 d=p-wakes[i].xy; float strength=wakes[i].z;
        float behind=1.-smoothstep(-.6,1.3,d.x);
        float spread=.75+max(0.,-d.x)*.13;
        float trail=exp(-max(0.,-d.x)*.25)*exp(-pow(abs(d.y)/spread,2.))*behind;
        float churn=smoothstep(.25,.73,noise(vec2(d.x*3.3+time*2.8,d.y*5.4)+h*2.));
        float arms=exp(-pow((abs(d.y)-.95-max(0.,-d.x)*.17)*4.,2.))*exp(-abs(d.x)*.22)*behind;
        foam+=strength*(trail*churn*.83+arms*.32);
      }
      color=mix(color,vec3(.89,.98,.98),clamp(foam,0.,.94));
      gl_FragColor=vec4(color,mix(.70,.94,smoothstep(0.,1.5,depth)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
  material.addEventListener('dispose', () => depthMap.dispose());
  return material;
}

const CAPACITY = 1100;
export class WaterSpray {
  readonly geometry = new THREE.BufferGeometry();
  readonly material: THREE.ShaderMaterial;
  readonly points: THREE.Points;
  private positions = new Float32Array(CAPACITY * 3);
  private renderPositions = new Float32Array(CAPACITY * 3);
  private velocity = new Float32Array(CAPACITY * 3);
  private life = new Float32Array(CAPACITY);
  private duration = new Float32Array(CAPACITY);
  private size = new Float32Array(CAPACITY);
  private opacity = new Float32Array(CAPACITY);
  private baseOpacity = new Float32Array(CAPACITY);
  private level = new Float32Array(CAPACITY);
  private foam = new Uint8Array(CAPACITY);
  private next = 0;
  private credit = new Float32Array(16);
  readonly strengths = [0, 0, 0, 0];
  activeCount = 0;

  constructor(scene: THREE.Scene) {
    this.positions.fill(-1000); this.renderPositions.fill(-1000);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.renderPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacity, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { pixels: { value: 700 } },
      vertexShader: `attribute float size; attribute float opacity; varying float alpha; uniform float pixels;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pixels/max(.1,-p.z),1.,48.);alpha=opacity;}`,
      fragmentShader: `varying float alpha;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
      gl_FragColor=vec4(.94,.99,1.,alpha*(1.-smoothstep(.18,1.,r)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
    });
    this.points = new THREE.Points(this.geometry, this.material); this.points.frustumCulled = false; this.points.renderOrder = 3; scene.add(this.points);
  }

  clear() { this.life.fill(0); this.positions.fill(-1000); this.renderPositions.fill(-1000); this.credit.fill(0); this.strengths.fill(0); this.geometry.attributes.position.needsUpdate = true; this.activeCount = 0; }

  update(sim: Simulation, dt: number, lanes: number[], viewX: number, project: (x: number, z: number) => { x: number; z: number } = (x, z) => ({ x, z })) {
    if (!sim.started) return;
    dt = Math.min(.1, dt);
    this.activeCount = 0;
    for (let i = 0; i < CAPACITY; i++) {
      if (this.life[i] <= 0) { this.positions[i * 3 + 1] = -1000; continue; }
      this.life[i] -= dt; this.activeCount++;
      const k = i * 3;
      if (!this.foam[i]) {
        this.velocity[k + 1] -= 7.2 * dt;
        for (let axis = 0; axis < 3; axis++) this.positions[k + axis] += this.velocity[k + axis] * dt;
        if (this.positions[k + 1] < this.level[i]) {
          this.foam[i] = 1; this.positions[k + 1] = this.level[i] + .035; this.size[i] *= 1.6;
          this.life[i] = this.duration[i] = .5 + Math.random() * .6;
        }
      } else {
        this.positions[k] += this.velocity[k] * dt * .12; this.positions[k + 2] += this.velocity[k + 2] * dt * .18; this.size[i] += dt * .25;
      }
      this.opacity[i] = Math.min(1, this.life[i] / this.duration[i] * 1.8) * (this.foam[i] ? .22 : this.baseOpacity[i]);
    }
    for (const car of sim.cars) {
      let total = 0;
      if (Math.abs(car.body.translation().x - viewX) < 28) for (const [axle, wheel] of car.wheels.entries()) {
        const p = wheel.translation(), water = sim.course.waters.find(w => p.x + 1.3 > w.start && p.x - 1.3 < w.end);
        if (!water) continue;
        const activity = splashActivity(car.hydro, { position: p, center: wheel.worldCom(), angle: wheel.rotation(), velocity: wheel.linvel(), omega: wheel.angvel() }, water);
        const strength = Math.min(1.7, Math.sqrt(activity.energy) * .23); total += strength;
        for (const side of [0, 1]) {
          const slot = car.id * 4 + axle * 2 + side;
          this.credit[slot] += dt * Math.min(140, strength * 135);
          while (this.credit[slot] >= 1) {
            this.credit[slot]--; const i = this.next++ % CAPACITY, k = i * 3, mist = Math.random() > .65;
            this.positions[k] = activity.x + (Math.random() - .5) * .25;
            this.positions[k + 1] = water.level + .055;
            this.positions[k + 2] = lanes[car.id] + (side ? -.97 : .97) + (Math.random() - .5) * .16;
            this.velocity[k] = activity.vx * .5 - Math.random() * strength * 1.2;
            const launch = Math.min(4.5, .5 + Math.hypot(activity.vx, activity.vy) * .55 + strength);
            this.velocity[k + 1] = launch * (.65 + Math.random() * .35);
            this.velocity[k + 2] = (side ? -1 : 1) * (.25 + Math.random() * strength * 1.2);
            this.level[i] = water.level; this.foam[i] = 0;
            this.size[i] = mist ? .15 + Math.random() * .12 : .025 + Math.random() * .055;
            this.life[i] = this.duration[i] = .5 + Math.random() * .8;
            this.opacity[i] = this.baseOpacity[i] = mist ? .28 : .85;
          }
        }
      }
      this.strengths[car.id] += (Math.min(1, total * .55) - this.strengths[car.id]) * (1 - Math.exp(-dt * 5));
    }
    for (let i = 0; i < CAPACITY; i++) {
      const k = i * 3;
      if (this.life[i] <= 0) { this.renderPositions[k + 1] = -1000; continue; }
      const p = project(this.positions[k], this.positions[k + 2]);
      this.renderPositions[k] = p.x; this.renderPositions[k + 1] = this.positions[k + 1]; this.renderPositions[k + 2] = p.z;
    }
    for (const name of ['position', 'size', 'opacity']) this.geometry.attributes[name].needsUpdate = true;
  }
}
