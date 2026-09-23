import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { courseRunout, groundAt, type Course, type Obstacle, type Segment, type Surface, type Water } from './courses';
import { AXLES, type Simulation, type Vehicle } from './physics';
import { shapeEdges, spokeTips, SPOKE_RADIUS, STROKE_RADIUS, type Point } from './shapes';
import { bankHeight, landscapeData, TRACK_BACK, TRACK_FRONT } from './landscape';
import { waterMaterial, WaterSpray } from './water-visuals';
import { RouteLayout } from './route-layout';
import { archBands, archSection } from './structures';
import { terrainWarp } from './terrain-shape';

const BASE = import.meta.env.BASE_URL;
const LANES = [1, -2.25, -5.5, -8.75];

type Quality = 'auto' | 'high' | 'eco';
interface CarVisual { root: THREE.Group; wheels: THREE.Group[]; revisions: number[]; tag?: THREE.Sprite }
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
  const fine = segments.flatMap(s => {
    const count = Math.max(1, Math.ceil((s.b.x - s.a.x) / 2));
    const at = (t: number) => ({ x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t });
    return Array.from({ length: count }, (_, i) => ({ a: at(i / count), b: at((i + 1) / count) }));
  });
  const bands = sides ? [z0, z1] : [z0, -9, -6, -3, -1, .03, 1, 1.97, z1].filter((z, i, a) => (z >= z0 && z <= z1 && a.indexOf(z) === i)).sort((a, b) => a - b);
  for (const s of fine) for (let band = 1; band < bands.length; band++) {
    const z0 = bands[band - 1], z1 = bands[band];
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

function iceTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8cbbc7'; ctx.fillRect(0, 0, 512, 512);
  let seed = 8192;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // Frost flecks and branching fractures over a glossy, continuous ice sheet.
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = `rgba(231,253,255,${.03 + random() * .12})`;
    ctx.fillRect(random() * 512, random() * 512, 1 + random() * 6, 1 + random() * 3);
  }
  for (let j = 0; j < 22; j++) {
    let x = random() * 512, y = random() * 512, angle = random() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { angle += (random() - .5) * 1.5; x += Math.cos(angle) * (8 + random() * 30); y += Math.sin(angle) * (8 + random() * 30); ctx.lineTo(x, y); }
    ctx.strokeStyle = 'rgba(226,250,255,.44)'; ctx.lineWidth = 1 + random(); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  return texture;
}

export class GameRenderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, 1, .1, 150);
  terrain = new THREE.Group();
  cars: CarVisual[] = [];
  rocks: THREE.Object3D[] = [];
  waters: THREE.ShaderMaterial[] = [];
  beamMeshes: THREE.Group[] = [];
  cacheMeshes: THREE.Group[] = [];
  checkpointFlags: { x: number; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> }[] = [];
  roofs: { x: number; width: number; mesh: THREE.Mesh }[] = [];
  layout!: RouteLayout;
  snapNextFrame = true;
  private lastResets = 0;
  sun = new THREE.DirectionalLight(0xffe3b0, 3.2);
  ambient = new THREE.HemisphereLight(0xd4e8ff, 0x6b5540, 2.1);
  mats!: TerrainMaterials;
  cliffMat!: THREE.MeshStandardMaterial;
  rockTemplate: THREE.Group | null = null;
  vehicleTemplate!: THREE.Group;
  skyTexture: THREE.DataTexture | null = null;
  quality: Quality = 'auto';
  target = new THREE.Vector3();
  clock = 0;
  viewX = 2;
  private resizeObserver: ResizeObserver;
  private env: THREE.WebGLRenderTarget;
  readonly spray: WaterSpray;
  readonly mudSpray: WaterSpray;
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
    this.renderer.domElement.setAttribute('aria-label', '3D-Expedition');
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment(); this.env = pmrem.fromScene(room, .04); room.dispose(); pmrem.dispose();
    this.scene.environment = this.env.texture; this.scene.environmentIntensity = .35;
    this.scene.add(this.ambient, this.sun, this.sun.target, this.terrain);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: .5, far: 80 });
    this.sun.shadow.bias = -.0003; this.sun.shadow.normalBias = .04;
    this.spray = new WaterSpray(this.scene); this.mudSpray = new WaterSpray(this.scene, true);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
  }

  async load(onProgress: (p: number) => void) {
    const loader = new THREE.TextureLoader();
    let loaded = 0;
    const tex = async (id: string, file: string, srgb = false) => {
      const t = await loader.loadAsync(`${BASE}assets/${id}/${file}.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      onProgress(++loaded / 9); return t;
    };
    const [rock, normal, rough, ground, groundNormal, groundRough, model, sky, vehicle] = await Promise.all([
      tex('rock_face', 'color', true), tex('rock_face', 'normal'), tex('rock_face', 'roughness'),
      tex('rocky_terrain', 'color', true), tex('rocky_terrain', 'normal'), tex('rocky_terrain', 'roughness'),
      new GLTFLoader().loadAsync(`${BASE}assets/boulder.glb`).then(m => { onProgress(++loaded / 9); return m; }),
      new HDRLoader().loadAsync(`${BASE}assets/sky.hdr`).then(t => { onProgress(++loaded / 9); return t; }),
      new GLTFLoader().loadAsync(`${BASE}assets/offroad.glb`).then(m => { onProgress(++loaded / 9); return m; })
    ]);
    this.vehicleTemplate = vehicle.scene;
    this.vehicleTemplate.traverse(o => { if (o instanceof THREE.Mesh) {
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
      o.castShadow = true; o.receiveShadow = true; o.userData.sharedVehicle = true;
    } });
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.generateMipmaps = true; sky.minFilter = THREE.LinearMipmapLinearFilter;
    this.skyTexture = sky;
    this.env.dispose(); const pmrem = new THREE.PMREMGenerator(this.renderer); this.env = pmrem.fromEquirectangular(sky); pmrem.dispose();
    this.scene.environment = this.env.texture; this.scene.environmentIntensity = .55;
    this.cliffMat = new THREE.MeshStandardMaterial({ map: rock, normalMap: normal, roughnessMap: rough, roughness: .94, color: 0xcfa786, normalScale: new THREE.Vector2(1.3, 1.3), side: THREE.DoubleSide });
    const stone = new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, roughnessMap: groundRough, color: 0xb9ac90, roughness: .95, normalScale: new THREE.Vector2(.8, .8), side: THREE.DoubleSide });
    this.mats = {
      stone,
      road: stone.clone(),
      ice: new THREE.MeshPhysicalMaterial({ map: iceTexture(), color: 0xc1edf9, roughness: .16, metalness: .12, clearcoat: 1, clearcoatRoughness: .08, envMapIntensity: 1.1, side: THREE.DoubleSide }),
      mud: new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, color: 0xb3a28a, roughness: .75, normalScale: new THREE.Vector2(.3, .3), side: THREE.DoubleSide }),
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
    this.spray.material.uniforms.pixels.value = h * this.pixelRatio;
    this.mudSpray.material.uniforms.pixels.value = h * this.pixelRatio;
  }

  setCourse(sim: Simulation) {
    // Dispose per-course geometry while retaining the cached texture/material assets.
    const retained = new Set<THREE.Material>([this.cliffMat, ...Object.values(this.mats)]);
    const disposable = new Set<THREE.Material>();
    this.terrain.traverse(o => {
      if (o instanceof THREE.Mesh && !o.userData.shared) o.geometry.dispose();
      if (o instanceof THREE.Mesh && (!o.userData.shared || o.userData.ownedMaterial)) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (!retained.has(m)) disposable.add(m);
    });
    for (const m of disposable) { const map = (m as THREE.MeshStandardMaterial).map; if (map && (map as THREE.CanvasTexture).isCanvasTexture) map.dispose(); m.dispose(); }
    this.terrain.clear(); this.rocks = []; this.waters = []; this.beamMeshes = []; this.cacheMeshes = []; this.checkpointFlags = []; this.roofs = [];
    this.spray.clear(); this.mudSpray.clear();
    for (const car of this.cars) {
      for (const root of [car.root, ...car.wheels]) { this.disposeObject(root); this.scene.remove(root); }
      if (car.tag) { this.scene.remove(car.tag); car.tag.material.map?.dispose(); car.tag.material.dispose(); }
    }
    this.cars = [];
    const course = sim.course, alpine = course.theme === 'alpine', quarry = course.theme === 'quarry';
    this.layout = new RouteLayout(course);
    this.snapNextFrame = true; this.lastResets = 0;
    this.scene.background = this.skyTexture ?? new THREE.Color(0xbacbca);
    this.scene.backgroundIntensity = .9;
    this.scene.fog = new THREE.FogExp2(alpine ? 0xafc7d6 : quarry ? 0xb6b7ac : 0xcfcbc0, .015);
    this.sun.color.set(alpine ? 0xe4efff : 0xffd5a0);
    this.mats.stone.color.set(alpine ? 0xcad5d6 : quarry ? 0xa0a39b : 0xcdb394);
    this.mats.road.color.copy(this.mats.stone.color);
    this.cliffMat.color.set(alpine ? 0xa7b5bd : quarry ? 0x9b9e92 : 0xbc8a65);
    const completeGround = [...course.segments, ...courseRunout(course)];
    for (const surface of ['stone', 'ice', 'mud', 'road'] as Surface[]) {
      const parts = completeGround.filter(s => s.surface === surface);
      if (!parts.length) continue;
      const mesh = new THREE.Mesh(terrainGeometry(parts, TRACK_BACK, TRACK_FRONT), this.mats[surface]); mesh.receiveShadow = true; this.terrain.add(mesh);
    }
    for (const front of [true, false]) {
      const data = landscapeData(course, front), geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
      geometry.setIndex(data.indices); geometry.computeVertexNormals();
      const bank = new THREE.Mesh(geometry, this.mats.stone); bank.receiveShadow = true; this.terrain.add(bank);
    }
    this.addScenery(course);
    for (const w of course.waters) this.addWater(course, w);
    for (const mud of course.muds ?? []) this.addWater(course, mud, true);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3d4846, roughness: .58, metalness: .6 });
    for (const o of course.obstacles) {
      if (o.kind === 'boulder') {
        // The center of each rock has exactly the physical convex outline at
        // both wheel tracks. Only the exposed sides taper into chipped facets.
        const shape = o.outline!, positions: number[] = [], indices: number[] = [], uvs: number[] = [];
        for (const [z, scale] of [[-1.39, .65], [-1.06, 1], [1.06, 1], [1.4, .72]]) for (const p of shape) {
          positions.push(p.x * scale, p.y * scale, z); uvs.push((o.x + p.x) / 3, (p.y + z) / 3);
        }
        for (let band = 0; band < 3; band++) for (let j = 0; j < shape.length; j++) {
          const a = band * shape.length + j, b = band * shape.length + (j + 1) % shape.length;
          indices.push(a, b, a + shape.length, b, b + shape.length, a + shape.length);
        }
        for (let j = 1; j < shape.length - 1; j++) { indices.push(0, j + 1, j); const k = shape.length * 3; indices.push(k, k + j, k + j + 1); }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
        const faceted = geometry.toNonIndexed(); geometry.dispose(); faceted.computeVertexNormals();
        const mesh = new THREE.Mesh(faceted, this.cliffMat); mesh.position.set(o.x, o.y, LANES[o.lane!]); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh);
      } else if (o.kind === 'beam' || o.kind === 'roller') {
        for (let i = 0; i < sim.cars.length; i++) {
          const group = new THREE.Group(); group.userData.moving = true;
          if (o.kind === 'roller') {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, 2.6, 24), metal); drum.rotation.x = Math.PI / 2; group.add(drum);
            for (let j = 0; j < 8; j++) {
              const a = j / 8 * Math.PI * 2, stripe = box(.035, .09, 2.61, this.mats.wood, Math.cos(a) * o.width / 2, Math.sin(a) * o.width / 2);
              stripe.rotation.z = a; group.add(stripe);
            }
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 3, 10), metal); axle.rotation.x = Math.PI / 2; group.add(axle);
          } else {
            group.add(box(o.width, o.height, 2.5, this.mats.wood));
            for (const z of [-1.05, 1.05]) group.add(box(o.width, .055, .1, metal, 0, o.height / 2 + .01, z));
          }
          mergeRigidGroup(group); group.position.set(o.x, o.y, LANES[i]);
          this.terrain.add(group); this.beamMeshes.push(group);
          const pivot = new THREE.Mesh(new THREE.ConeGeometry(.32, .65, 4), metal); pivot.position.set(o.x, o.y - .4, LANES[i]); this.terrain.add(pivot);
        }
      } else if (o.kind === 'log') {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, TRACK_FRONT - TRACK_BACK + .5, 16), this.cliffMat);
        mesh.rotation.x = Math.PI / 2; mesh.position.set(o.x, o.y, 1); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh);
      } else {
        if (o.structure) { this.addRockStructure(course, o); continue; }
        const depth = course.expedition ? 4.4 : 14.2, center = course.expedition ? 1 : -3.9;
        const roofMaterial = this.cliffMat.clone();
        const ceiling = box(o.width, o.height, depth, roofMaterial, o.x, o.y, center); ceiling.castShadow = true; ceiling.receiveShadow = true; this.terrain.add(ceiling);
        this.roofs.push({ x: o.x, width: o.width, mesh: ceiling });
        const clearance = o.y - o.height / 2;
        for (const z of course.expedition ? [-1.2, 3.2] : [-10.8, 3]) { const pillar = box(.4, clearance, .4, course.expedition ? this.cliffMat : metal, o.x + o.width / 2 - .2, clearance / 2, z); pillar.castShadow = true; this.terrain.add(pillar); }
        const warning = new THREE.MeshStandardMaterial({ color: 0xe6af45, roughness: .7 });
        // Mark the entrance and the clearance, visible before the roof hides it.
        this.terrain.add(box(.12, .14, depth + .1, warning, o.x - o.width / 2 - .04, clearance + .08, center));
      }
    }
    for (const car of sim.cars) this.cars.push(this.makeCar(car));
    this.addGate(course.length, course.expedition ? 'ZIELLAGER' : 'ZIEL', !course.expedition);
    if (course.expedition) this.addExpeditionMarkers(course);
    this.bendLandscape();
    for (const roof of this.roofs) {
      const material = roof.mesh.material as THREE.MeshStandardMaterial;
      const uniforms = { center: { value: new THREE.Vector2() }, radius: { value: 0 }, aspect: { value: 1 } };
      material.userData.cutaway = uniforms; material.transparent = true; material.depthWrite = false;
      // Only a soft window around the vehicle becomes translucent. The complete
      // hillside remains present instead of vanishing along a planar half-cut.
      material.onBeforeCompile = shader => {
        shader.uniforms.cutCenter = uniforms.center; shader.uniforms.cutRadius = uniforms.radius; shader.uniforms.cutAspect = uniforms.aspect;
        shader.vertexShader = 'varying vec4 vRockClip;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRockClip = gl_Position;');
        shader.fragmentShader = 'varying vec4 vRockClip; uniform vec2 cutCenter; uniform float cutRadius; uniform float cutAspect;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', 'float aperture = smoothstep(cutRadius*.35, max(.001,cutRadius), length((vRockClip.xy/vRockClip.w-cutCenter)*vec2(cutAspect,1.0))); diffuseColor.a *= mix(1.0,.08+.92*aperture,step(.1,cutRadius));\n#include <opaque_fragment>');
      };
      material.customProgramCacheKey = () => 'local-rock-window-v2';
    }
    this.viewX = 2; this.camera.position.set(-8, 11, 18); this.target.set(4, 0, -.5); this.camera.lookAt(this.target);
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
        r.position.set(x, size * .23 - 2, -8 - random() * 12); this.terrain.add(r); this.rocks.push(r);
      }
      // Small scree on the verge, kept away from the drivable lanes.
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(.18 + random() * .4, 0), this.cliffMat);
      pebble.position.set(x + 2, Math.max(-2, groundAt(course, x + 2)) + .05, 2.85); pebble.scale.y = .5; pebble.rotation.set(random(), random(), random()); pebble.receiveShadow = true; this.terrain.add(pebble);
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
      for (const z of [TRACK_FRONT - .35, TRACK_BACK + .25]) {
        posts.add(box(.075, .7, .075, darkMat, x, y + .35, z)); posts.add(box(.09, .12, .09, postMat, x, y + .59, z));
      }
    }
    mergeRigidGroup(posts); this.terrain.add(posts);
    if (course.expedition) return;
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

  addExpeditionMarkers(course: Course) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x394640, roughness: .5, metalness: .65 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xf4b863, roughness: .5, emissive: 0xad601b, emissiveIntensity: .3 });
    for (const p of course.caches ?? []) {
      const group = new THREE.Group(); group.userData.moving = true;
      group.add(box(.56, .42, .48, orange));
      for (const x of [-.2, .2]) group.add(box(.055, .45, .51, metal, x));
      group.add(box(.18, .08, .025, metal, 0, .03, .25));
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(.44, .025, 6, 24), orange); group.add(hoop);
      mergeRigidGroup(group); group.position.set(p.x, p.y, LANES[0]);
      this.terrain.add(group); this.cacheMeshes.push(group);
    }
    for (const cp of course.checkpoints.slice(1)) {
      const x = cp + 3, y = groundAt(course, x);
      this.terrain.add(box(.055, 2.6, .055, metal, x, y + 1.3, -1.1));
      const material = new THREE.MeshStandardMaterial({ color: 0xe2a252, roughness: .8, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(.85, .46), material);
      flag.position.set(x + .42, y + 2.25, -1.1); this.terrain.add(flag); this.checkpointFlags.push({ x: cp, mesh: flag });
    }
    // Shelter sits outside the driving line; reaching it ends the expedition.
    const canvas = new THREE.MeshStandardMaterial({ color: 0x687752, roughness: 1 });
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.2, 4, 1, true), canvas);
    tent.rotation.y = Math.PI / 4; tent.scale.z = 1.4; tent.position.set(course.length + 4, 1.1, -4); tent.castShadow = true; this.terrain.add(tent);
  }

  addRockStructure(course: Course, o: Obstacle) {
    const style = o.structure!, bands = archBands(style), base = groundAt(course, o.x);
    const material = this.cliffMat.clone(); material.side = THREE.DoubleSide;
    if (style === 'bridge') material.color.set(0xd2c4a5);
    else material.color.multiplyScalar(1.18);
    material.normalScale.set(.7, .7);
    const vertex = (t: number, z: number, top: boolean) => {
            const shoulder = Math.max(0, Math.abs(z) - 1.35);
            const jagged = style === 'bridge' ? 0 : Math.sin(z * 2.1 + t * 9 + o.x) * Math.min(1.2, shoulder * .16);
            const spread = 1 + Math.min(1.6, Math.max(0, Math.abs(z) - 2.7) * .18);
            const s = o.x + (t - .5) * o.width * spread + jagged;
            const foot = bankHeight(s, groundAt(course, s), 1 + z);
            const shape = archSection(o, z, Math.abs(z) <= 1.35 ? base : foot);
            const crest = style === 'bridge' ? 0 : Math.sin(t * Math.PI) * (style === 'cave' ? 1.8 : .4) * Math.max(0, 1 - shoulder / (bands.at(-1)! - 1.35));
            return [s, top ? shape.top + crest : shape.bottom, 1 + z];
          };
    for (const near of [false, true]) {
      const positions: number[] = [], uvs: number[] = [];
      const quad = (a: number[], b: number[], c: number[], d: number[]) => {
        const normal = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]));
        const face = Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z)) ? 'top' : Math.abs(normal.x) > Math.abs(normal.z) ? 'end' : 'side';
        for (const p of [a, b, c, a, c, d]) { positions.push(...p); uvs.push((face === 'end' ? p[2] : p[0]) / 2.3, (face === 'top' ? p[2] : p[1]) / 2.3); }
      };
      for (let j = 1; j < bands.length; j++) {
        if ((bands[j - 1] >= 0) !== near) continue;
        const gap = 0, za = bands[j - 1] + gap, zb = bands[j] - gap;
        for (let k = 0; k < 4; k++) {
          const t0 = k / 4, t1 = (k + 1) / 4;

          const a = vertex(t0, za, false), b = vertex(t1, za, false), c = vertex(t1, zb, false), d = vertex(t0, zb, false);
          const e = vertex(t0, za, true), f = vertex(t1, za, true), g = vertex(t1, zb, true), h = vertex(t0, zb, true);
          quad(a, d, c, b); quad(e, f, g, h);
          if (k === 0) quad(a, e, h, d); if (k === 3) quad(b, c, g, f);
          if (j === 1) quad(a, b, f, e);
          if (j === bands.length - 1) quad(d, h, g, c);
        }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, near ? material.clone() : material); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh);
      if (near) this.roofs.push({ x: o.x, width: o.width, mesh });
    }
    // Sloping earth/rock aprons bury the vertical end faces on both sides of
    // the opening. Only the playable mouth stays exposed; the shoulders merge
    // into surrounding land along AND across the route.
    for (const side of [-1, 1]) {
      const positions: number[] = [], uvs: number[] = [];
      const zs = [1.4, ...bands.filter(z => z > 1.4)];
      const vertexAt = (end: number, z: number, t: number) => {
        const wall = vertex(end < 0 ? 0 : 1, z * side, true);
        const run = (style === 'bridge' ? 3 : 5) + Math.min(7, z * .6);
        const x = wall[0] + end * run * t;
        const floor = bankHeight(x, groundAt(course, x), wall[2]) - .07;
        const blend = t * t * (3 - 2 * t);
        return [x, wall[1] * (1 - blend) + floor * blend, wall[2]];
      };
      for (const end of [-1, 1]) for (let j = 1; j < zs.length; j++) for (let k = 0; k < 6; k++) {
        const a = vertexAt(end, zs[j-1], k/6), b = vertexAt(end, zs[j], k/6), c = vertexAt(end, zs[j], (k+1)/6), d = vertexAt(end, zs[j-1], (k+1)/6);
        for (const p of [a,b,c,a,c,d]) {positions.push(...p);uvs.push(p[0]/4,p[2]/4);}
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
      const apronMaterial = (style === 'bridge' ? this.mats.stone : material).clone();
      const mesh = new THREE.Mesh(geometry,apronMaterial);mesh.castShadow=true;mesh.receiveShadow=true;this.terrain.add(mesh);
      if(side>0)this.roofs.push({x:o.x,width:o.width+2,mesh});
    }
    const edge = bands.at(-1)!;
    if (style === 'bridge') {
      // Stone parapets and abutments connect the cross-route bridge to its banks.
      const masonry = new THREE.Group();
      for (const x of [o.x - o.width / 2 + .18, o.x + o.width / 2 - .18]) for (let z = -edge; z < edge; z += .9) {
        const h = .45 + .1 * Math.sin(z * 2.7 + x);
        masonry.add(box(.36, h, .84, material, x, archSection(o, z, bankHeight(x, groundAt(course, x), z + 1)).top + h / 2, z + 1));
      }
      mergeRigidGroup(masonry); this.terrain.add(masonry);
    }
    // Irregular shoulders sink into the banks instead of stopping at a plate edge.
    for (const side of [-1, 1]) for (let j = 0; j < 3; j++) {
      if (!this.rockTemplate) continue;
      const rock = new THREE.Group(), scan = this.rockTemplate.clone(true);
      const bounds = new THREE.Box3().setFromObject(scan), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      scan.position.sub(center);
      scan.traverse(object => { if (object instanceof THREE.Mesh) { object.userData.shared = true; object.castShadow = true; object.receiveShadow = true; } });
      rock.add(scan);
      const height = side > 0 ? 1.4 : style === 'cave' ? 4.2 : 2.6;
      rock.position.set(o.x + (j - 1) * o.width * .32, base + height * .18, 1 + side * (style === 'cave' ? 4.6 : 3.8));
      rock.scale.set(Math.max(2.5, o.width * .42) / size.x, height / size.y, 3.4 / size.z); rock.rotation.y = j * .71 + o.x;
      this.terrain.add(rock); this.rocks.push(rock);
    }
    if (style !== 'bridge' && this.rockTemplate) {
      // Scanned, fractured stones break up the portal silhouette. Their lower
      // edges remain above the exact clearance inside the wheel corridor.
      for (const end of [-1, 1]) for (const z of [-3.7, -1.2, 0, 1.2, 3.7]) {
        const scan = this.rockTemplate.clone(true), rock = new THREE.Group();
        const bounds = new THREE.Box3().setFromObject(scan), size = bounds.getSize(new THREE.Vector3());
        scan.position.sub(bounds.getCenter(new THREE.Vector3()));
        scan.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.userData.shared = true; object.userData.ownedMaterial = true;
          object.material = (object.material as THREE.MeshStandardMaterial).clone(); object.castShadow = true; object.receiveShadow = true;
          if (z >= 0) this.roofs.push({ x: o.x, width: o.width + 1.4, mesh: object });
        });
        rock.add(scan);
        const crown = Math.abs(z) < 2, height = crown ? 1.05 : 2.1;
        rock.position.set(o.x + end * o.width / 2, crown ? o.y - o.height / 2 + .64 : base + .75, 1 + z);
        rock.scale.set(1.35 / size.x, height / size.y, (crown ? 1.45 : 1.8) / size.z);
        rock.rotation.y = Math.sin(z + o.x) * .12;
        this.terrain.add(rock); this.rocks.push(rock);
      }
    }
  }

  bendLandscape() {
    this.terrain.updateMatrixWorld(true);
    const position = new THREE.Vector3();
    this.terrain.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.shared) return;
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent.userData.moving) return;
      const inverse = object.matrixWorld.clone().invert(), attribute = object.geometry.attributes.position;
      for (let i = 0; i < attribute.count; i++) {
        position.fromBufferAttribute(attribute, i).applyMatrix4(object.matrixWorld);
        const natural = terrainWarp(position.x, position.y, position.z);
        const p = this.layout.point(natural.x, natural.z); position.x = p.x; position.y = natural.y; position.z = p.z;
        position.applyMatrix4(inverse); attribute.setXYZ(i, position.x, position.y, position.z);
      }
      attribute.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
    });
    for (const rock of this.rocks) {
      rock.userData.trackX = rock.position.x;
      const q = terrainWarp(rock.position.x, rock.position.y, rock.position.z);
      const p = this.layout.point(q.x, q.z); rock.position.y = q.y; rock.position.x = p.x; rock.position.z = p.z; rock.rotation.y += p.yaw;
    }
  }

  addWater(course: Course, water: Water, mud = false) {
    const { start, end, level: y } = water;
    const material = waterMaterial(course, water, this.skyTexture, this.camera.position, mud);
    // Water continues into the banks; opaque land occludes it at the natural
    // shoreline, instead of ending in a rectangular cut at the front lane.
    const geo = new THREE.PlaneGeometry(end - start, 60, 32, 20); const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((start + end) / 2, y + .035, -3.9); mesh.renderOrder = 2;
    this.terrain.add(mesh); this.waters.push(material);
  }

  addGate(x: number, text: string, finish: boolean) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x303b37, metalness: .4, roughness: .65 });
    const group = new THREE.Group();
    for (const z of [TRACK_FRONT - .15, TRACK_BACK + .15]) group.add(box(.16, 4, .16, mat, x, 2, z));
    group.add(box(.18, .16, 4.1, mat, x, 4, 1));
    mergeRigidGroup(group); this.terrain.add(group);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = finish ? '#dceda3' : '#22362e'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = finish ? '#23362d' : '#e7edcf'; ctx.font = 'bold 58px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 512, 86);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, .6), new THREE.MeshStandardMaterial({ map: t, roughness: .8, side: THREE.DoubleSide }));
    mesh.rotation.y = Math.PI / 2; mesh.position.set(x, 3.65, 1); this.terrain.add(mesh);
    if (finish) {
      const finishGroup = new THREE.Group(); const black = new THREE.MeshStandardMaterial({ color: 0x26302c }), white = new THREE.MeshStandardMaterial({ color: 0xe2e3d5 });
      for (let i = 0; i < 28; i++) for (let j = 0; j < 2; j++) finishGroup.add(box(.45, .012, .5, (i + j) % 2 ? black : white, x + j * .45, .022, -10.5 + i * .5));
      mergeRigidGroup(finishGroup); this.terrain.add(finishGroup);
    }
  }

  makeCar(car: Vehicle): CarVisual {
    const group = new THREE.Group(); group.add(this.vehicleTemplate.clone(true));
    // The imported body keeps its detailed PBR maps. Only the drawn wheels and
    // visible axle connections are generated by the game.
    const metal = new THREE.MeshStandardMaterial({ color: 0x46514b, metalness: .7, roughness: .4 });
    for (const x of AXLES) group.add(cylinderBetween(new THREE.Vector3(x, -.25, -.97), new THREE.Vector3(x, -.25, .97), .07, metal));
    this.scene.add(group);
    const wheels = Array.from({ length: 4 }, () => { const g = new THREE.Group(); this.scene.add(g); return g; });
    return { root: group, wheels, revisions: [-1, -1] };
  }

  wheelGeometry(g: THREE.Group, shape: Point[]) {
    this.disposeObject(g); g.clear();
    const rubber = new THREE.MeshStandardMaterial({ color: 0x171e1d, roughness: .78 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x8c9691, metalness: .8, roughness: .32 });
    // Each straight edge and rounded joint matches a physical capsule. A
    // globally sampled TubeGeometry used to cut across short corners.
    for (const [a, b] of shapeEdges(shape)) g.add(cylinderBetween(new THREE.Vector3(a.x, a.y, 0), new THREE.Vector3(b.x, b.y, 0), STROKE_RADIUS, rubber, 10));
    for (const p of shape) { const cap = new THREE.Mesh(new THREE.SphereGeometry(STROKE_RADIUS, 10, 6), rubber); cap.position.set(p.x, p.y, 0); g.add(cap); }
    for (const p of spokeTips(shape)) {
      g.add(cylinderBetween(new THREE.Vector3(), new THREE.Vector3(p.x, p.y, 0), SPOKE_RADIUS, rim, 6));
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.145, .145, .21, 16), rim); hub.rotation.x = Math.PI / 2; g.add(hub);
    mergeRigidGroup(g);
  }

  render(sim: Simulation, dt: number, menu = false) {
    if (sim.started || menu) this.clock += dt;
    this.frames++;
    this.average = this.average * .98 + dt * 1000 * .02;
    if (this.quality === 'auto' && this.frames % 180 === 0 && this.average > 25 && this.pixelRatio > 1) { this.pixelRatio = Math.max(1, this.pixelRatio - .15); this.resize(); }
    for (const car of sim.cars) {
      const visual = this.cars[car.id]; if (!visual) continue;
      const p = car.body.translation(), spatial = this.layout.point(p.x, LANES[car.id]); visual.root.position.set(spatial.x, p.y, spatial.z); visual.root.rotation.set(0, spatial.yaw, car.body.rotation(), 'YXZ');
      for (let axle = 0; axle < 2; axle++) if (visual.revisions[axle] !== car.axleRevisions[axle]) {
        this.wheelGeometry(visual.wheels[axle], car.shapes[axle]);
        const opposite = visual.wheels[axle + 2]; opposite.clear();
        for (const child of visual.wheels[axle].children) {
          const copy = child.clone(); copy.userData.sharedWheel = true; opposite.add(copy);
        }
        visual.revisions[axle] = car.axleRevisions[axle];
      }
      visual.wheels.forEach((w, i) => { const body = car.wheels[i % 2], wp = body.translation(), point = this.layout.point(wp.x, LANES[car.id] + (i < 2 ? .97 : -.97)); w.position.set(point.x, wp.y, point.z); w.rotation.set(0, point.yaw, body.rotation(), 'YXZ'); });
      if (visual.tag) { visual.tag.visible = sim.cars.length > 1; visual.tag.position.set(spatial.x, p.y + 1.72, spatial.z); }
    }
    this.advanceEffects(sim, dt);
    this.cacheMeshes.forEach((mesh, id) => { const cache = sim.course.caches![id], p = this.layout.point(cache.x, LANES[0]); mesh.position.set(p.x, cache.y, p.z); mesh.visible = !sim.collected.has(id); mesh.rotation.y = this.clock * .45; });
    this.checkpointFlags.forEach(flag => flag.mesh.material.color.set(flag.x <= sim.cars[0].checkpoint ? 0xd9ee8e : 0xe2a252));
    sim.beams.forEach((b, i) => { const mesh = this.beamMeshes[i]; if (mesh) { const bp = b.body.translation(), p = this.layout.point(bp.x, LANES[b.lane]); mesh.position.set(p.x, bp.y, p.z); mesh.rotation.set(0, p.yaw, b.body.rotation(), 'YXZ'); } });
    const player = sim.cars[0].body.translation();

    if (sim.cars[0].resets !== this.lastResets) { this.snapNextFrame = true; this.lastResets = sim.cars[0].resets; }
    const factor = this.snapNextFrame ? 1 : 1 - Math.exp(-dt * 4); this.snapNextFrame = false;
    this.viewX += (player.x - this.viewX) * factor;
    const y = Math.max(.2, player.y - .6);
    const cameraPoint = this.layout.point(this.viewX - 3.5, 16), targetPoint = this.layout.point(this.viewX + 3.2, 0);
    temp.set(cameraPoint.x, y + 8, cameraPoint.z);
    this.camera.position.lerp(temp, factor);
    temp.set(targetPoint.x, y - 1.15, targetPoint.z); this.target.lerp(temp, factor); this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    const apertureCenter = this.layout.point(player.x, 1);
    temp.set(apertureCenter.x, player.y + .1, apertureCenter.z).project(this.camera);
    for (const roof of this.roofs) {
      const uniforms = (roof.mesh.material as THREE.MeshStandardMaterial).userData.cutaway;
      const cutaway = sim.course.expedition && Math.abs(player.x - roof.x) < roof.width / 2 + .6;
      uniforms.center.value.set(temp.x, temp.y); uniforms.aspect.value = this.camera.aspect; uniforms.radius.value = cutaway ? .65 : 0;
    }
    const sun = this.layout.point(this.viewX - 16, 15), sunTarget = this.layout.point(this.viewX + 4, -3);
    this.sun.position.set(sun.x, 25, sun.z); this.sun.target.position.set(sunTarget.x, 0, sunTarget.z);
    for (const rock of this.rocks) rock.visible = Math.abs(rock.userData.trackX - this.viewX) < 78;
    for (const water of this.waters) {
      water.uniforms.time.value = this.clock;
      for (const car of sim.cars) {
        const wake = water.uniforms.wakes.value[car.id] as THREE.Vector4;
        const p = car.body.translation(), strength = (water.uniforms.mud.value ? this.mudSpray : this.spray).strengths[car.id];
        wake.set(p.x, LANES[car.id], strength, car.body.linvel().x);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  advanceEffects(sim: Simulation, dt: number) {
    this.spray.update(sim, dt, LANES, sim.cars[0].body.translation().x, (x, z) => this.layout.point(x, z));
    this.mudSpray.update(sim, dt, LANES, sim.cars[0].body.translation().x, (x, z) => this.layout.point(x, z));
  }

  playerFraming() {
    const p = new THREE.Vector3(); let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const root of [this.cars[0].root, ...this.cars[0].wheels]) root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        p.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(this.camera);
        const x = (p.x + 1) / 2, y = (1 - p.y) / 2;
        left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    });
    return { left, right, top, bottom };
  }

  disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse(o => { if (o instanceof THREE.Mesh && !o.userData.sharedVehicle && !o.userData.sharedWheel) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    for (const mat of materials) mat.dispose();
  }
}
