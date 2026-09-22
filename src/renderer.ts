import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundAt, type Course, type Segment, type Surface } from './courses';
import { AXLES, type Simulation, type Vehicle } from './physics';
import { STROKE_RADIUS, type Point } from './shapes';

const BASE = import.meta.env.BASE_URL;
const LANES = [1, -2.25, -5.5, -8.75];
const COLORS = [0xdbf18b, 0xf17850, 0x79cbd9, 0xa398ea];
type Quality = 'auto' | 'high' | 'eco';
interface CarVisual { root: THREE.Group; wheels: THREE.Group[]; revision: number; tag?: THREE.Sprite }
type TerrainMaterials = Record<Surface, THREE.MeshStandardMaterial>;
const temp = new THREE.Vector3();

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, segments = 8) {
  const delta = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), segments), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}
function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m;
}
function mergeRigidGroup(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.traverse(o => {
    if (o instanceof THREE.Mesh && !Array.isArray(o.material)) {
      const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
      const list = buckets.get(o.material) ?? []; list.push(g); buckets.set(o.material, list);
      o.geometry.dispose();
    }
  });
  group.clear();
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!geometry) continue;
    const m = new THREE.Mesh(geometry, material); m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
}
function terrainGeometry(segments: Segment[], z0: number, z1: number, sides = false) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const s of segments) {
    const i = positions.length / 3;
    if (sides) {
      positions.push(s.a.x, s.a.y, z1, s.b.x, s.b.y, z1, s.a.x, -10, z1, s.b.x, -10, z1);
      uvs.push(s.a.x / 5, s.a.y / 5, s.b.x / 5, s.b.y / 5, s.a.x / 5, -2, s.b.x / 5, -2);
    } else {
      positions.push(s.a.x, s.a.y, z0, s.a.x, s.a.y, z1, s.b.x, s.b.y, z0, s.b.x, s.b.y, z1);
      uvs.push(s.a.x / 5, z0 / 5, s.a.x / 5, z1 / 5, s.b.x / 5, z0 / 5, s.b.x / 5, z1 / 5);
    }
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(49, 1, .1, 150);
  terrain = new THREE.Group();
  cars: CarVisual[] = [];
  rocks: THREE.Object3D[] = [];
  waters: THREE.ShaderMaterial[] = [];
  beamMeshes: THREE.Mesh[] = [];
  sun = new THREE.DirectionalLight(0xffe3b0, 3.2);
  ambient = new THREE.HemisphereLight(0xd4e8ff, 0x6b5540, 2.1);
  mats!: TerrainMaterials;
  cliffMat!: THREE.MeshStandardMaterial;
  rockTemplate: THREE.Group | null = null;
  skyTexture: THREE.DataTexture | null = null;
  quality: Quality = 'auto';
  target = new THREE.Vector3();
  clock = 0;
  viewX = 2;
  private resizeObserver: ResizeObserver;
  private env: THREE.WebGLRenderTarget;
  private splashGeo = new THREE.BufferGeometry();
  private splashData = new Float32Array(150 * 3);
  private splashLife = new Float32Array(150);
  private splashVel = new Float32Array(150 * 3);
  private splashNext = 0;
  private dust: THREE.Points;
  private frames = 0;
  private average = 16;
  private pixelRatio = 1.5;

  constructor(public host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D-Rennstrecke');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(); this.env = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
    this.scene.environment = this.env.texture; this.scene.environmentIntensity = .35;
    this.scene.add(this.ambient, this.sun, this.sun.target, this.terrain);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: .5, far: 80 });
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .04;
    this.splashData.fill(-1000);
    this.splashGeo.setAttribute('position', new THREE.BufferAttribute(this.splashData, 3));
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d')!; const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); gradient.addColorStop(0, 'rgba(255,255,255,.7)'); gradient.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
    this.dust = new THREE.Points(this.splashGeo, new THREE.PointsMaterial({ color: 0xe3e6cf, size: .19, map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: .55 }));
    this.dust.frustumCulled = false; this.scene.add(this.dust);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
  }

  async load(onProgress: (p: number) => void) {
    const loader = new THREE.TextureLoader();
    let loaded = 0;
    const tex = async (id: string, file: string, srgb = false) => {
      const t = await loader.loadAsync(`${BASE}assets/${id}/${file}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      onProgress(++loaded / 8); return t;
    };
    const [rock, normal, rough, ground, groundNormal, groundRough, model, sky] = await Promise.all([
      tex('rock_face', 'color', true), tex('rock_face', 'normal'), tex('rock_face', 'roughness'),
      tex('rocky_terrain', 'color', true), tex('rocky_terrain', 'normal'), tex('rocky_terrain', 'roughness'),
      new GLTFLoader().loadAsync(`${BASE}assets/boulder.glb`).then(m => { onProgress(++loaded / 8); return m; }),
      new HDRLoader().loadAsync(`${BASE}assets/sky.hdr`).then(t => { onProgress(++loaded / 8); return t; })
    ]);
    sky.mapping = THREE.EquirectangularReflectionMapping; this.skyTexture = sky;
    this.env.dispose(); const pmrem = new THREE.PMREMGenerator(this.renderer); this.env = pmrem.fromEquirectangular(sky); pmrem.dispose();
    this.scene.environment = this.env.texture; this.scene.environmentIntensity = .55;
    this.cliffMat = new THREE.MeshStandardMaterial({ map: rock, normalMap: normal, roughnessMap: rough, roughness: .94, color: 0xcfa786, normalScale: new THREE.Vector2(1.3, 1.3), side: THREE.DoubleSide });
    const stone = new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, roughnessMap: groundRough, color: 0xb9ac90, roughness: .95, normalScale: new THREE.Vector2(.8, .8), side: THREE.DoubleSide });
    this.mats = {
      stone,
      road: stone.clone(),
      ice: new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, color: 0xc2e8ed, roughness: .13, metalness: .15, normalScale: new THREE.Vector2(.12, .12), side: THREE.DoubleSide }),
      mud: new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, color: 0x443024, roughness: .29, normalScale: new THREE.Vector2(.3, .3), side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8d6745, roughness: .85 })
    };
    this.mats.road.color.set(0xcbbca0);
    this.rockTemplate = model.scene;
    this.rockTemplate.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(this.rockTemplate); const center = bounds.getCenter(new THREE.Vector3());
    // Center the original scan and normalize its largest dimension for art-directed placement.
    const size = bounds.getSize(new THREE.Vector3());
    this.rockTemplate.position.sub(center); this.rockTemplate.scale.setScalar(1 / Math.max(size.x, size.y, size.z));
  }

  setQuality(q: Quality) {
    this.quality = q; this.pixelRatio = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'eco' ? 1 : Math.min(devicePixelRatio, 1.6);
    this.renderer.shadowMap.enabled = q !== 'eco'; this.resize();
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(w, h, false);
  }

  setCourse(sim: Simulation) {
    // Dispose per-course geometry while retaining the cached texture/material assets.
    const retained = new Set<THREE.Material>([this.cliffMat, ...Object.values(this.mats)]);
    const disposable = new Set<THREE.Material>();
    this.terrain.traverse(o => {
      if (o instanceof THREE.Mesh && !o.userData.shared) o.geometry.dispose();
      if (o instanceof THREE.Mesh && !o.userData.shared) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!retained.has(m)) disposable.add(m);
    });
    for (const m of disposable) { const map = (m as THREE.MeshStandardMaterial).map; if (map && (map as THREE.CanvasTexture).isCanvasTexture) map.dispose(); m.dispose(); }
    this.terrain.clear(); this.rocks = []; this.waters = []; this.beamMeshes = [];
    for (const car of this.cars) {
      for (const root of [car.root, ...car.wheels]) { this.disposeObject(root); this.scene.remove(root); }
      if (car.tag) { this.scene.remove(car.tag); car.tag.material.map?.dispose(); car.tag.material.dispose(); }
    }
    this.cars = [];
    const course = sim.course, alpine = course.theme === 'alpine', quarry = course.theme === 'quarry';
    this.scene.background = this.skyTexture ?? new THREE.Color(0xbacbca);
    this.scene.backgroundIntensity = .9;
    this.scene.fog = new THREE.FogExp2(alpine ? 0xafc7d6 : quarry ? 0xb6b7ac : 0xcfcbc0, .015);
    this.sun.color.set(alpine ? 0xe4efff : 0xffd5a0);
    this.mats.stone.color.set(alpine ? 0xcad5d6 : quarry ? 0xa0a39b : 0xcdb394);
    this.mats.road.color.set(alpine ? 0xe3e8e6 : quarry ? 0xaaaaa0 : 0xd4b891);
    this.cliffMat.color.set(alpine ? 0xa7b5bd : quarry ? 0x9b9e92 : 0xbc8a65);
    for (const surface of ['stone', 'ice', 'mud', 'road'] as Surface[]) {
      const parts = course.segments.filter(s => s.surface === surface);
      if (!parts.length) continue;
      const mesh = new THREE.Mesh(terrainGeometry(parts, -11, 3.2), this.mats[surface]); mesh.receiveShadow = true; this.terrain.add(mesh);
    }
    const cliff = new THREE.Mesh(terrainGeometry(course.segments, -11, 3.2, true), this.cliffMat); cliff.receiveShadow = true; this.terrain.add(cliff);
    const backCliff = new THREE.Mesh(terrainGeometry(course.segments, 0, -11, true), this.cliffMat); this.terrain.add(backCliff);
    this.addScenery(course);
    for (const w of course.waters) this.addWater(w.start, w.end, w.level, alpine);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3d4846, roughness: .58, metalness: .6 });
    for (const o of course.obstacles) {
      if (o.kind === 'beam') {
        for (let i = 0; i < sim.cars.length; i++) {
          const mesh = box(o.width, o.height, 2.5, this.mats.wood, o.x, o.y, LANES[i]); mesh.castShadow = true; mesh.receiveShadow = true;
          this.terrain.add(mesh); this.beamMeshes.push(mesh);
          const pivot = new THREE.Mesh(new THREE.ConeGeometry(.42, .65, 4), metal); pivot.position.set(o.x, -.32, LANES[i]); this.terrain.add(pivot);
        }
      } else if (o.kind === 'log') {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, 14.2, 16), this.cliffMat);
        mesh.rotation.x = Math.PI / 2; mesh.position.set(o.x, o.y, -3.9); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh);
      } else {
        const ceiling = box(o.width, o.height, 14.2, this.cliffMat, o.x, o.y, -3.9); ceiling.castShadow = true; ceiling.receiveShadow = true; this.terrain.add(ceiling);
        const clearance = o.y - o.height / 2;
        for (const z of [-10.8, 3]) { const pillar = box(.4, clearance, .4, metal, o.x + o.width / 2 - .2, clearance / 2, z); pillar.castShadow = true; this.terrain.add(pillar); }
        const warning = new THREE.MeshStandardMaterial({ color: 0xe6af45, roughness: .7 });
        // Mark the entrance and the clearance, visible before the roof hides it.
        this.terrain.add(box(.12, .14, 14.3, warning, o.x - o.width / 2 - .04, clearance + .08, -3.9));
      }
    }
    for (const car of sim.cars) this.cars.push(this.makeCar(car));
    this.addGate(course.length, 'ZIEL', true);
    this.viewX = 2; this.camera.position.set(-9, 10.4, 16); this.target.set(6, .5, -3.3); this.camera.lookAt(this.target);
  }

  addScenery(course: Course) {
    // Reuse one optimized photogrammetry mesh across the landscape.
    let seed = 27 + course.id * 71;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let x = -16; x < course.length + 25; x += 5 + random() * 5) {
      if (this.rockTemplate) {
        const r = new THREE.Group(); const scan = this.rockTemplate.clone(true);
        scan.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.shared = true; o.receiveShadow = true; o.castShadow = false; } });
        r.add(scan); const size = 7 + random() * 15;
        r.scale.set(size * (.6 + random()), size * (1 + random()), size);
        r.rotation.y = random() * Math.PI * 2;
        r.position.set(x, size * .23 - 2, -17 - random() * 12); this.terrain.add(r); this.rocks.push(r);
      }
      // Small scree on the verge, kept away from the drivable lanes.
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(.18 + random() * .4, 0), this.cliffMat);
      pebble.position.set(x + 2, .05, 2.85); pebble.scale.y = .5; pebble.rotation.set(random(), random(), random()); pebble.receiveShadow = true; this.terrain.add(pebble);
    }
    // Distant ridges form an unbroken horizon, with erosion-like layered noise.
    const ridge = new THREE.PlaneGeometry(course.length + 100, 60, 100, 14); ridge.rotateX(-Math.PI / 2);
    const verts = ridge.attributes.position;
    for (let i = 0; i < verts.count; i++) {
      const x = verts.getX(i), z = verts.getZ(i);
      const y = 5 + Math.sin(x * .075) * 5 + Math.cos(x * .19 + z * .13) * 3 + Math.sin(x * .61 + z * .24) * 1.2;
      verts.setY(i, y * Math.max(.2, 1 - Math.abs(z) / 45));
    }
    ridge.computeVertexNormals(); const m = new THREE.Mesh(ridge, this.cliffMat); m.position.set(course.length / 2, 1, -57); this.terrain.add(m);
    const edge: Point[] = [];
    for (let i = 0; i < verts.count; i++) if (verts.getZ(i) > 29.9) edge.push({ x: verts.getX(i) + course.length / 2, y: verts.getY(i) + 1 });
    edge.sort((a, b) => a.x - b.x);
    const skirt = edge.slice(1).map((b, i) => ({ a: edge[i], b, surface: 'stone' as const }));
    this.terrain.add(new THREE.Mesh(terrainGeometry(skirt, 0, -27, true), this.cliffMat));
    // Road marker posts and their narrow lane stripes provide scale and clear direction.
    const postMat = new THREE.MeshStandardMaterial({ color: 0xdce2ca, roughness: .55 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3d4840, roughness: .65 });
    const posts = new THREE.Group();
    for (let x = 0; x < course.length; x += 9) {
      const y = groundAt(course, x);
      if (y < -.3) continue;
      for (const z of [2.85, -10.5]) {
        posts.add(box(.075, .7, .075, darkMat, x, y + .35, z)); posts.add(box(.09, .12, .09, postMat, x, y + .59, z));
      }
    }
    mergeRigidGroup(posts); this.terrain.add(posts);
    const lines = new THREE.Group(); const paint = new THREE.MeshStandardMaterial({ color: 0xd5cdb3, roughness: 1, transparent: true, opacity: .36, depthWrite: false });
    for (const s of course.segments) {
      const dx = s.b.x - s.a.x;
      if (dx < .5 || s.a.y < -.15 || s.b.y < -.15) continue;
      for (const z of [-.62, -3.87, -7.12]) {
        const a = new THREE.Vector3(s.a.x, s.a.y + .012, z), b = new THREE.Vector3(s.b.x, s.b.y + .012, z);
        lines.add(cylinderBetween(a, b, .012, paint, 4));
      }
    }
    mergeRigidGroup(lines); this.terrain.add(lines);
  }

  addWater(start: number, end: number, y: number, alpine: boolean) {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, colorDeep: { value: new THREE.Color(alpine ? '#235c71' : '#1d6d67') }, colorShallow: { value: new THREE.Color('#a6d6c5') }, eye: { value: this.camera.position } },
      vertexShader: `varying vec3 vWorld; uniform float time; void main(){vec3 p=position; p.z+=sin(p.x*1.6+time*1.4)*.027+sin(p.y*2.3-time*.9)*.02; vec4 world=modelMatrix*vec4(p,1.); vWorld=world.xyz; gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `varying vec3 vWorld; uniform float time; uniform vec3 colorDeep; uniform vec3 colorShallow; uniform vec3 eye;
      void main(){vec2 p=vWorld.xz; float a=sin(p.x*5.3+p.y*3.8+time*2.); float b=sin(p.x*11.-p.y*7.-time*1.8); vec3 n=normalize(vec3(a*.07+b*.03,1.,cos(p.y*6.+time)*.1)); vec3 v=normalize(eye-vWorld); float fres=pow(1.-max(dot(n,v),0.),3.); vec3 sun=normalize(vec3(-.5,.9,.5)); float shine=pow(max(dot(reflect(-sun,n),v),0.),95.); float glint=pow(max(a*b,0.),8.); vec3 c=mix(colorDeep,colorShallow,fres*.65)+shine*.85+glint*.045; gl_FragColor=vec4(c,.77+fres*.18);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
    });
    const geo = new THREE.PlaneGeometry(end - start, 14.2, 32, 12); const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((start + end) / 2, y + .035, -3.9); mesh.renderOrder = 2;
    this.terrain.add(mesh); this.waters.push(material);
  }

  addGate(x: number, text: string, finish: boolean) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x303b37, metalness: .4, roughness: .65 });
    const group = new THREE.Group();
    for (const z of [3.05, -10.75]) group.add(box(.16, 4, .16, mat, x, 2, z));
    group.add(box(.18, .16, 14, mat, x, 4, -3.85));
    mergeRigidGroup(group); this.terrain.add(group);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = finish ? '#dceda3' : '#22362e'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = finish ? '#23362d' : '#e7edcf'; ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 512, 86);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(13, .95), new THREE.MeshStandardMaterial({ map: t, roughness: .8, side: THREE.DoubleSide }));
    mesh.rotation.y = Math.PI / 2; mesh.position.set(x, 3.65, -3.85); this.terrain.add(mesh);
    if (finish) {
      const finishGroup = new THREE.Group(); const black = new THREE.MeshStandardMaterial({ color: 0x26302c }), white = new THREE.MeshStandardMaterial({ color: 0xe2e3d5 });
      for (let i = 0; i < 28; i++) for (let j = 0; j < 2; j++) finishGroup.add(box(.45, .012, .5, (i + j) % 2 ? black : white, x + j * .45, .022, -10.5 + i * .5));
      mergeRigidGroup(finishGroup); this.terrain.add(finishGroup);
    }
  }

  makeCar(car: Vehicle): CarVisual {
    const group = new THREE.Group();
    const paint = new THREE.MeshStandardMaterial({ color: COLORS[car.id], metalness: .32, roughness: .31 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x384444, metalness: .82, roughness: .33 });
    const black = new THREE.MeshStandardMaterial({ color: 0x151c1d, metalness: .1, roughness: .76 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xa1adb0, metalness: .9, roughness: .23 });
    const light = new THREE.MeshStandardMaterial({ color: 0xffedc7, emissive: 0xffc568, emissiveIntensity: .45, roughness: .2 });
    group.add(box(2.42, .33, 1.35, paint, 0, -.02));
    group.add(box(2.2, .19, 1.26, black, 0, -.24));
    const nose = box(.65, .24, 1.2, paint, 1.06, .12); nose.rotation.z = -.13; group.add(nose);
    group.add(box(.62, .32, 1.1, metal, -1, .18));
    for (let i = 0; i < 6; i++) group.add(box(.04, .04, .85, black, -.9 + i * .07, .36));
    // Two seats, safety cage, headlamps, pontoons and functional exposed axles.
    for (const z of [-.4, .4]) {
      group.add(box(.5, .13, .4, black, -.05, .23, z));
      const seat = box(.13, .59, .42, black, -.28, .45, z); seat.rotation.z = .13; group.add(seat);
      for (const x of [-.64, .65]) group.add(cylinderBetween(new THREE.Vector3(x, .12, z * 1.6), new THREE.Vector3(x - .17, 1, z * 1.45), .045, metal));
      group.add(cylinderBetween(new THREE.Vector3(-.81, 1, z * 1.45), new THREE.Vector3(.48, 1, z * 1.45), .045, metal));
      group.add(cylinderBetween(new THREE.Vector3(-1.2, -.2, z * 1.95), new THREE.Vector3(1.2, -.2, z * 1.95), .11, black, 12));
      group.add(box(.14, .15, .25, light, 1.39, .16, z));
      for (const x of AXLES) {
        group.add(cylinderBetween(new THREE.Vector3(x, -.27, 0), new THREE.Vector3(x, -.39, z * 2.5), .05, metal));
        group.add(cylinderBetween(new THREE.Vector3(x * .75, .12, z * 1.5), new THREE.Vector3(x, -.36, z * 2.3), .05, chrome));
        const spring = new THREE.CatmullRomCurve3(Array.from({ length: 45 }, (_, i) => {
          const t = i / 44; return new THREE.Vector3(x * (.75 + t * .25) + Math.cos(t * Math.PI * 12) * .04, .12 - .48 * t, z * (1.5 + .8 * t) + Math.sin(t * Math.PI * 12) * .04);
        }));
        group.add(new THREE.Mesh(new THREE.TubeGeometry(spring, 44, .013, 4, false), paint));
      }
    }
    for (const x of [-.81, .48]) group.add(cylinderBetween(new THREE.Vector3(x, 1, -.58), new THREE.Vector3(x, 1, .58), .045, metal));
    group.add(box(.33, .11, .11, metal, .48, .93, 0));
    group.add(box(.28, .07, .07, light, .55, .94, 0));
    // Compact helmeted driver gives scale without obscuring the drawn wheels.
    const suit = new THREE.MeshStandardMaterial({ color: 0x343b39, roughness: .9 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(.18, 16, 12), paint); head.position.set(.02, .73, .38); group.add(head);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(.184, 16, 8, -.7, 1.4, .8, 1.1), black); visor.rotation.y = Math.PI / 2; visor.position.copy(head.position); group.add(visor);
    group.add(box(.28, .34, .3, suit, -.05, .42, .38));
    group.add(cylinderBetween(new THREE.Vector3(.04, .52, .4), new THREE.Vector3(.38, .42, .4), .06, suit));
    mergeRigidGroup(group); this.scene.add(group);
    const wheels = Array.from({ length: 4 }, () => { const g = new THREE.Group(); this.scene.add(g); return g; });
    let tag: THREE.Sprite | undefined;
    if (car.id === 0) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 72; const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#d9ef8b'; ctx.beginPath(); ctx.roundRect(18, 4, 92, 43, 20); ctx.fill(); ctx.beginPath(); ctx.moveTo(57, 47); ctx.lineTo(71, 47); ctx.lineTo(64, 59); ctx.fill(); ctx.fillStyle = '#223328'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DU', 64, 34);
      const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; tag = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false })); tag.scale.set(1.22, .68, 1); this.scene.add(tag);
    }
    return { root: group, wheels, revision: -1, tag };
  }

  wheelGeometry(g: THREE.Group, shape: Point[]) {
    this.disposeObject(g); g.clear();
    const rubber = new THREE.MeshStandardMaterial({ color: 0x171e1d, roughness: .78 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x8c9691, metalness: .8, roughness: .32 });
    // Linear interpolation preserves the same edges and open ends as the capsule colliders.
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < shape.length; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(shape[i - 1].x, shape[i - 1].y, 0), new THREE.Vector3(shape[i].x, shape[i].y, 0)));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, shape.length * 3, STROKE_RADIUS, 10, false), rubber); tube.castShadow = true; tube.receiveShadow = true; g.add(tube);
    for (const p of [shape[0], shape.at(-1)!]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(STROKE_RADIUS, 8, 6), rubber); cap.position.set(p.x, p.y, 0); g.add(cap); }
    for (let i = 0; i < 4; i++) {
      const p = shape[Math.floor(i * (shape.length - 1) / 4)];
      g.add(cylinderBetween(new THREE.Vector3(), new THREE.Vector3(p.x, p.y, 0), .025, rim, 6));
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .21, 16), rim); hub.rotation.x = Math.PI / 2; g.add(hub);
    mergeRigidGroup(g);
  }

  render(sim: Simulation, dt: number, menu = false) {
    this.clock += dt; this.frames++;
    this.average = this.average * .98 + dt * 1000 * .02;
    if (this.quality === 'auto' && this.frames % 180 === 0 && this.average > 25 && this.pixelRatio > 1) { this.pixelRatio = Math.max(1, this.pixelRatio - .15); this.resize(); }
    for (const car of sim.cars) {
      const visual = this.cars[car.id]; if (!visual) continue;
      const p = car.body.translation(); visual.root.position.set(p.x, p.y, LANES[car.id]); visual.root.rotation.z = car.body.rotation();
      if (visual.revision !== car.revision) {
        visual.wheels.forEach(w => this.wheelGeometry(w, car.shape)); visual.revision = car.revision;
      }
      visual.wheels.forEach((w, i) => { const body = car.wheels[i % 2], wp = body.translation(); w.position.set(wp.x, wp.y, LANES[car.id] + (i < 2 ? .97 : -.97)); w.rotation.z = body.rotation(); });
      if (visual.tag) visual.tag.position.set(p.x, p.y + 1.72, LANES[car.id]);
      if (sim.started && Math.abs(car.body.linvel().x) > .4 && this.frames % 3 === 0) {
        const wp = car.wheels[0].translation(); const j = this.splashNext++ % 150;
        this.splashLife[j] = .6 + Math.random() * .45;
        this.splashData[j * 3] = wp.x - .3; this.splashData[j * 3 + 1] = car.water ? -.02 : wp.y - .7; this.splashData[j * 3 + 2] = LANES[car.id] + 1;
        this.splashVel[j * 3] = -Math.random() * 1.5; this.splashVel[j * 3 + 1] = car.water ? 1.5 + Math.random() : .5; this.splashVel[j * 3 + 2] = Math.random() * .5;
      }
    }
    for (let i = 0; i < 150; i++) {
      if (this.splashLife[i] <= 0) { this.splashData[i * 3 + 1] = -1000; continue; }
      this.splashLife[i] -= dt; this.splashVel[i * 3 + 1] -= dt * 3;
      for (let a = 0; a < 3; a++) this.splashData[i * 3 + a] += this.splashVel[i * 3 + a] * dt;
    }
    this.splashGeo.attributes.position.needsUpdate = true;
    sim.beams.forEach((b, i) => { const mesh = this.beamMeshes[i]; if (mesh) { mesh.position.y = b.body.translation().y; mesh.rotation.z = b.body.rotation(); } });
    const player = sim.cars[0].body.translation();
    const factor = 1 - Math.exp(-dt * 4);
    this.viewX += (player.x - this.viewX) * factor;
    const y = Math.max(.2, player.y - .6);
    temp.set(this.viewX - (menu ? 9 : 7.8), y + (menu ? 9.2 : 10.7), menu ? 14.9 : 16.2);
    this.camera.position.lerp(temp, factor);
    temp.set(this.viewX + (menu ? 4.8 : 4), y + .45, -3.3); this.target.lerp(temp, factor); this.camera.lookAt(this.target);
    this.sun.position.set(this.viewX - 16, 25, 15); this.sun.target.position.set(this.viewX + 4, 0, -3);
    for (const rock of this.rocks) rock.visible = Math.abs(rock.position.x - this.viewX) < 78;
    for (const water of this.waters) water.uniforms.time.value = this.clock;
    this.renderer.render(this.scene, this.camera);
  }

  disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    for (const mat of materials) mat.dispose();
  }
}
