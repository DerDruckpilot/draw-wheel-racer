import {branchTerrain} from './branch-terrain';
import {inBand} from './branching';
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
import { archSection } from './structures';
import { structureMesh } from './structure-mesh';
import { terrainWarp } from './terrain-shape';
import { MechanicsView } from './mechanics-visuals';

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
  ctx.fillStyle = '#a7b5bd'; ctx.fillRect(0, 0, 512, 512);
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
  mechanicsView?:MechanicsView;
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
  private roofRay=new THREE.Raycaster();
  private ghostMat=new THREE.MeshBasicMaterial({color:0xddebc3,transparent:true,opacity:.2,depthWrite:false,depthTest:true,depthFunc:THREE.GreaterDepth});
  sun = new THREE.DirectionalLight(0xffe3b0, 3.2);
  ambient = new THREE.HemisphereLight(0xd4e8ff, 0x6b5540, 2.1);
  mats!: TerrainMaterials;
  cliffMat!: THREE.MeshStandardMaterial;
  rockTemplate: THREE.Group | null = null;
  private winterRocks={value:0};
  vehicleTemplate!: THREE.Group;
  skyTexture: THREE.DataTexture | null = null;
  quality: Quality = 'auto';
  target = new THREE.Vector3();
  clock = 0;
  roadHalfWidth=2.2;
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
      ice: new THREE.MeshPhysicalMaterial({ map: iceTexture(), color: 0x9baeb9, roughness: .28, metalness: .02, clearcoat: .65, clearcoatRoughness: .18, envMapIntensity: .55, side: THREE.DoubleSide }),
      mud: new THREE.MeshStandardMaterial({ map: ground, normalMap: groundNormal, color: 0xb3a28a, roughness: .75, normalScale: new THREE.Vector2(.3, .3), side: THREE.DoubleSide }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8d6745, roughness: .85 })
    };
    this.mats.road.color.set(0xcbbca0);
    for(const mat of [this.mats.stone,this.mats.road,this.cliffMat]){
      const winter={value:0};mat.userData.winter=winter;
      mat.onBeforeCompile=shader=>{shader.uniforms.winter=winter;shader.fragmentShader='uniform float winter;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.53,.59,.64)+diffuseColor.rgb*.25,winter);');};
      mat.customProgramCacheKey=()=> 'winter-terrain';
    }
    const scan=model.scene;scan.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(scan),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
    scan.position.sub(center);
    scan.traverse(o=>{if(o instanceof THREE.Mesh){for(const mat of Array.isArray(o.material)?o.material:[o.material]){
      const material=mat as THREE.MeshStandardMaterial;material.color.multiplyScalar(.86);
      material.onBeforeCompile=shader=>{shader.uniforms.winter=this.winterRocks;
        shader.vertexShader='varying vec3 snowNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsnowNormal=normalize(mat3(modelMatrix)*normal);');
        shader.fragmentShader='varying vec3 snowNormal;uniform float winter;\n'+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.78,.83),winter*smoothstep(.2,.75,snowNormal.y)*.88);');};
      material.customProgramCacheKey=()=> 'scan-snow';
    }}});
    this.rockTemplate=new THREE.Group();this.rockTemplate.add(scan);this.rockTemplate.scale.setScalar(1/Math.max(size.x,size.y,size.z));
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
    this.mechanicsView?.dispose();
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
    this.roadHalfWidth=course.routes?.halfWidth??2.2;
    this.layout = new RouteLayout(course);this.winterRocks.value=alpine?1:0;
    this.snapNextFrame = true; this.lastResets = 0;
    this.scene.background = this.skyTexture ?? new THREE.Color(0xbacbca);
    this.scene.backgroundIntensity = .9;
    this.scene.fog = new THREE.FogExp2(alpine ? 0xafc7d6 : quarry ? 0xb6b7ac : 0xcfcbc0, .015);
    this.sun.color.set(alpine ? 0xe4efff : 0xffd5a0);
    this.mats.stone.color.set(alpine ? 0xcad5d6 : quarry ? 0xa0a39b : 0xcdb394);
    this.mats.road.color.copy(this.mats.stone.color);
    for(const mat of [this.mats.stone,this.mats.road,this.cliffMat]){mat.userData.winter.value=alpine?1:0;}
    this.cliffMat.color.set(alpine ? 0xe0e6e9 : quarry ? 0xc3c1b6 : 0xe5d3b6);
    const completeGround = [...course.segments, ...courseRunout(course)];
    for (const surface of ['stone', 'ice', 'mud', 'road'] as Surface[]) {
      const parts = completeGround.filter(s => s.surface === surface && !s.ridge && !sim.mechanics.soils.some(soil=>soil.segments.includes(s)));
      if (!parts.length) continue;
      let geometry:THREE.BufferGeometry;
      if(course.routes){const data=branchTerrain(course,parts);geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geometry.setIndex(data.indices);for(const group of data.groups)geometry.addGroup(group.start,group.count,group.material);geometry.computeVertexNormals();}else geometry=terrainGeometry(parts,TRACK_BACK,TRACK_FRONT);
      const mesh = new THREE.Mesh(geometry, course.routes?[this.mats[surface],this.rockMaterial(course)]:this.mats[surface]); mesh.receiveShadow = true; this.terrain.add(mesh);
    }
    for(const fork of course.routes?.forks??[])for(const z of [-3.5,3.5]){
      const parts=course.segments.filter(s=>s.ridge&&s.lateral===z&&s.a.x>=fork.start-.01&&s.b.x<=fork.end+.01),data=branchTerrain(course,parts),geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));geometry.setIndex(data.indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,this.rockMaterial(course));mesh.receiveShadow=true;mesh.castShadow=true;this.terrain.add(mesh);this.roofs.push({x:(fork.start+fork.end)/2,width:fork.end-fork.start,mesh});
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
          positions.push(p.x * scale, p.y * scale, z*(o.depth?o.depth/2.8:1)); uvs.push((o.x + p.x) / 3, (p.y + z) / 3);
        }
        for (let band = 0; band < 3; band++) for (let j = 0; j < shape.length; j++) {
          const a = band * shape.length + j, b = band * shape.length + (j + 1) % shape.length;
          indices.push(a, b, a + shape.length, b, b + shape.length, a + shape.length);
        }
        for (let j = 1; j < shape.length - 1; j++) { indices.push(0, j + 1, j); const k = shape.length * 3; indices.push(k, k + j, k + j + 1); }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
        const faceted = geometry.toNonIndexed(); geometry.dispose(); faceted.computeVertexNormals();
        const mesh = new THREE.Mesh(faceted, this.rockMaterial(course)); mesh.position.set(o.x, o.y, LANES[o.lane!]+(o.lateral??0)); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh); if(o.deadEnd)this.roofs.push({x:o.x,width:o.width,mesh});
      } else if (o.kind === 'beam' || o.kind === 'roller') {
        for (let i = 0; i < sim.cars.length; i++) {
          const group = new THREE.Group(); group.userData.moving = true;
          if (o.kind === 'roller') {
            const drum = new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, o.depth??2.6, 24), metal); drum.rotation.x = Math.PI / 2; group.add(drum);
            for (let j = 0; j < 8; j++) {
              const a = j / 8 * Math.PI * 2, stripe = box(.035, .09, (o.depth??2.6)+.01, this.mats.wood, Math.cos(a) * o.width / 2, Math.sin(a) * o.width / 2);
              stripe.rotation.z = a; group.add(stripe);
            }
            const axle = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 3, 10), metal); axle.rotation.x = Math.PI / 2; group.add(axle);
          } else {
            group.add(box(o.width, o.height, o.depth??2.5, this.mats.wood));
            for (const z of [-1, 1]) group.add(box(o.width, .055, .1, metal, 0, o.height / 2 + .01, z*((o.depth??2.5)/2-.2)));
          }
          mergeRigidGroup(group); group.position.set(o.x, o.y, LANES[i]+(o.lateral??0));
          this.terrain.add(group); this.beamMeshes.push(group);
          const pivot = new THREE.Mesh(new THREE.ConeGeometry(.32, .65, 4), metal); pivot.position.set(o.x, o.y - .4, LANES[i]+(o.lateral??0)); this.terrain.add(pivot);
        }
      } else if (o.kind === 'platform') {
        const geometry=new THREE.BoxGeometry(o.width,o.height,o.depth??3.3,4,1,4),v=geometry.attributes.position;
        for(let i=0;i<v.count;i++){const z=v.getZ(i),x=v.getX(i);if(Math.abs(z)>1.06){v.setZ(i,z+Math.sin(o.x+x*2.4)*.16);v.setX(i,x+Math.sin(o.x+z*3)*.13);}}geometry.computeVertexNormals();
        const platform=new THREE.Mesh(geometry,this.cliffMat);platform.position.set(o.x,o.y,1+(o.lateral??0));platform.castShadow=true;platform.receiveShadow=true;this.terrain.add(platform);
        const floor=groundAt(course,o.x,o.lateral??0),height=Math.max(.2,o.y-o.height/2-floor);
        for(const z of [-.6,2.6]){const pier=new THREE.Mesh(new THREE.CylinderGeometry(.27,.55,height,7),this.cliffMat);pier.position.set(o.x,floor+height/2-.03,z+(o.lateral??0));pier.castShadow=true;this.terrain.add(pier);}
      } else if (o.kind === 'log') {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(o.width / 2, o.width / 2, o.depth??TRACK_FRONT - TRACK_BACK + .5, 16), this.cliffMat);
        mesh.rotation.x = Math.PI / 2; mesh.position.set(o.x, o.y, 1+(o.lateral??0)); mesh.castShadow = true; mesh.receiveShadow = true; this.terrain.add(mesh);
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
    this.addGate(course.length, 'ZIEL', !course.expedition);
    if (course.expedition) this.addExpeditionMarkers(course);
    this.bendLandscape();
    this.mechanicsView=new MechanicsView(sim,this.layout,this.cliffMat,this.mats.wood,this.mats.ice,this.mats.mud,this.rockTemplate);this.scene.add(this.mechanicsView.root);
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
        r.add(scan); const size = 5 + random() * 11;
        r.scale.set(size * (.6 + random()), size * (.8 + random() * .6), size);
        r.rotation.y = random() * Math.PI * 2;
        r.position.set(x, 0, -(course.routes?15:7) - random() * 13);
        const bottom=new THREE.Box3().setFromObject(r).min.y;r.position.y=bankHeight(x,groundAt(course,x,-7),r.position.z,this.roadHalfWidth)-bottom-.4;this.terrain.add(r); this.rocks.push(r);
      }
      // Small scree on the verge, kept away from the drivable lanes.
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(.18 + random() * .4, 0), this.cliffMat);
      pebble.position.set(x + 2, Math.max(-2, groundAt(course, x + 2,7)) + .05, this.roadHalfWidth+.6); pebble.scale.y = .5; pebble.rotation.set(random(), random(), random()); pebble.receiveShadow = true; this.terrain.add(pebble);
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
      for (const z of [1+this.roadHalfWidth-.35,1-this.roadHalfWidth+.25]) {
        const y=groundAt(course,x,z-1);if(y<-.3)continue;
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
    // A grounded expedition camp: supply crates and a warm lantern, no open cone.
    const timber=new THREE.MeshStandardMaterial({color:0x70634d,roughness:.95});
    const camp=new THREE.Group();
    for(const [x,z,w,h] of [[course.length+4,-4,1.2,.8],[course.length+5.2,-4.4,.8,.55]]){
      const y=bankHeight(x,groundAt(course,x),z);
      camp.add(box(w,h,.85,timber,x,y+h/2,z));
      for(const d of [-.32,.32])camp.add(box(.06,h+.03,.89,metal,x+d,y+h/2,z));
    }
    const x=course.length+3,z=-3,y=bankHeight(x,groundAt(course,x),z);
    camp.add(box(.055,2.5,.055,metal,x,y+1.25,z));
    const lamp=new THREE.MeshStandardMaterial({color:0xffd79c,emissive:0xffc168,emissiveIntensity:.8});
    camp.add(box(.22,.3,.22,lamp,x,y+2.25,z));
    camp.add(box(.35,.07,.35,metal,x,y+2.44,z));
    mergeRigidGroup(camp);this.terrain.add(camp);
  }

  rockMaterial(course:Course){
    const material=this.cliffMat.clone(); material.side=THREE.FrontSide; material.normalMap=null; material.roughnessMap=null;
    // World-space stone grain follows every face without stretching vertical walls.
    material.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 stonePosition; varying vec3 stoneNormal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstonePosition=position;stoneNormal=normal;');
      shader.fragmentShader='varying vec3 stonePosition; varying vec3 stoneNormal;\n'+shader.fragmentShader.replace('#include <map_fragment>',`vec3 weights=pow(abs(normalize(stoneNormal)),vec3(4.0)); weights/=max(.001,weights.x+weights.y+weights.z);
      vec3 grain=texture2D(map,stonePosition.yz*.26).rgb*weights.x+texture2D(map,stonePosition.xz*.26).rgb*weights.y+texture2D(map,stonePosition.xy*.26).rgb*weights.z;
      grain=mix(vec3(dot(grain,vec3(.2126,.7152,.0722))),grain,.22);
      diffuseColor.rgb*=grain;${course.theme==='alpine'?'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.74,.80,.85),smoothstep(.2,.8,stoneNormal.y)*.88);':''}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 rx=cross(sy,normal),ry=cross(normal,sx);float det=dot(sx,rx);
      float relief=dot(grain,vec3(.333));vec3 grad=sign(det)*(dFdx(relief)*rx+dFdy(relief)*ry);
      normal=normalize(max(.000001,abs(det))*normal-.12*grad);`);
    };
    material.customProgramCacheKey=()=> 'sealed-stone-triplanar-'+course.theme;
    return material;
  }

  addRockStructure(course: Course, o: Obstacle) {
    const data = structureMesh(course, o), geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.positions.flatMap((_,i,a)=>i%3===0?[a[i]/3,a[i+2]/3]:[]),2));
    geometry.setIndex(data.indices); geometry.computeVertexNormals();
    const material=this.rockMaterial(course);
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.passage=true;mesh.castShadow=true;mesh.receiveShadow=true;this.terrain.add(mesh);
    this.roofs.push({x:o.x,width:o.width,mesh});
    if(o.structure==='bridge'){
      const masonry=new THREE.Group(),stone=this.cliffMat.clone();stone.color.copy(material.color);
      for(const side of [-1,1])for(let z=-(course.routes?3.5:7);z<(course.routes?3.5:7);z+=.7){
        const base=bankHeight(o.x,groundAt(course,o.x,o.lateral??0),z+1),top=archSection(o,z,base).top;
        if(top<base+.1)continue;
        const block=box(.28,.26,.67,stone,o.x+side*(o.width/2-.17),top+.13,z+1+(o.lateral??0));block.rotation.y=Math.sin(z*3)*.04;masonry.add(block);
      }
      mergeRigidGroup(masonry);this.terrain.add(masonry);
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
        const natural = terrainWarp(position.x, position.y, position.z,this.roadHalfWidth);
        const p = this.layout.point(natural.x, natural.z); position.x = p.x; position.y = natural.y; position.z = p.z;
        position.applyMatrix4(inverse); attribute.setXYZ(i, position.x, position.y, position.z);
      }
      attribute.needsUpdate = true; object.geometry.computeVertexNormals(); object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
    });
    for (const rock of this.rocks) {
      rock.userData.trackX = rock.position.x;
      const q = terrainWarp(rock.position.x, rock.position.y, rock.position.z,this.roadHalfWidth);
      const p = this.layout.point(q.x, q.z); rock.position.y = q.y; rock.position.x = p.x; rock.position.z = p.z; rock.rotation.y += p.yaw;
    }
  }

  addWater(course: Course, water: Water, mud = false) {
    const { start, end, level: y } = water;
    const material = waterMaterial(course, water, this.skyTexture, this.camera.position, mud);
    // Water continues into the banks; opaque land occludes it at the natural
    // shoreline, instead of ending in a rectangular cut at the front lane.
    const depth=water.depth===undefined?60:water.depth+1.4;
    const geo = new THREE.PlaneGeometry(end - start, depth,water.waves?Math.ceil((end-start)/.35):32, 16); const mesh = new THREE.Mesh(geo, material);
    mesh.rotation.x = -Math.PI / 2; mesh.position.set((start + end) / 2, y + .035, water.lateral===undefined?-3.9:1+water.lateral); mesh.renderOrder = 2;
    this.terrain.add(mesh); this.waters.push(material);
    material.userData={water,mesh,initialLevel:y};
  }

  addGate(x: number, text: string, finish: boolean) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x303b37, metalness: .4, roughness: .65 });
    const group = new THREE.Group();
    for (const z of [1+this.roadHalfWidth-.15,1-this.roadHalfWidth+.15]) group.add(box(.16, 4, .16, mat, x, 2, z));
    group.add(box(.18, .16, this.roadHalfWidth*2-.3, mat, x, 4, 1));
    mergeRigidGroup(group); this.terrain.add(group);
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = finish ? '#dceda3' : '#22362e'; ctx.fillRect(0, 0, 1024, 128); ctx.fillStyle = finish ? '#23362d' : '#e7edcf'; ctx.font = 'bold 78px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 512, 86);
    const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.8, .6), new THREE.MeshStandardMaterial({ map: t, roughness: .8, side: THREE.FrontSide }));
    mesh.name='goal-front';mesh.rotation.y = -Math.PI / 2; mesh.position.set(x-.11, 3.65, 1); this.terrain.add(mesh);
    const reverse=mesh.clone();reverse.name='goal-back';reverse.geometry=mesh.geometry.clone();reverse.rotation.y=Math.PI/2;reverse.position.x=x+.11;this.terrain.add(reverse);
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
    const ghost=this.vehicleTemplate.clone(true);ghost.userData.occlusionOutline=true;ghost.visible=false;
    ghost.traverse(o=>{if(o instanceof THREE.Mesh){o.material=this.ghostMat;o.castShadow=false;o.receiveShadow=false;o.renderOrder=8;}});group.add(ghost);
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
    for(const child of [...g.children])if(child instanceof THREE.Mesh){const ghost=child.clone();ghost.material=this.ghostMat;ghost.castShadow=false;ghost.receiveShadow=false;ghost.renderOrder=8;ghost.userData.sharedWheel=true;ghost.userData.occlusionOutline=true;ghost.visible=false;g.add(ghost);}
  }

  render(sim: Simulation, dt: number, menu = false) {
    if (sim.started || menu) this.clock += dt;
    this.frames++;
    this.average = this.average * .98 + dt * 1000 * .02;
    if (this.quality === 'auto' && this.frames % 180 === 0 && this.average > 25 && this.pixelRatio > 1) { this.pixelRatio = Math.max(1, this.pixelRatio - .15); this.resize(); }
    for (const car of sim.cars) {
      const visual = this.cars[car.id]; if (!visual) continue;
      const p = car.body.translation(), spatial = this.layout.point(p.x, LANES[car.id]+car.lateral.offset); visual.root.position.set(spatial.x, p.y, spatial.z); visual.root.rotation.set(0, spatial.yaw-car.lateral.heading, car.body.rotation(), 'YXZ');
      for (let axle = 0; axle < 2; axle++) if (visual.revisions[axle] !== car.axleRevisions[axle]) {
        this.wheelGeometry(visual.wheels[axle], car.shapes[axle]);
        const opposite = visual.wheels[axle + 2]; opposite.clear();
        for (const child of visual.wheels[axle].children) {
          const copy = child.clone(); copy.userData.sharedWheel = true; opposite.add(copy);
        }
        visual.revisions[axle] = car.axleRevisions[axle];
      }
      visual.wheels.forEach((w, i) => { const body = car.wheels[i % 2], wp = body.translation(), point = this.layout.point(wp.x, LANES[car.id]+car.lateral.offset+(wp.x-p.x)*Math.sin(car.lateral.heading) + (i < 2 ? .97 : -.97)); w.position.set(point.x, wp.y, point.z); w.rotation.set(0, point.yaw-car.lateral.heading, body.rotation(), 'YXZ'); });
      visual.wheels.forEach((wheel,i)=>{const f=car.flex[i%2],a=f.amount,nx=f.nx,ny=f.ny,b=a*.22;for(const child of wheel.children){child.matrixAutoUpdate=false;child.matrix.set(1+b-(a+b)*nx*nx,-(a+b)*nx*ny,0,0,-(a+b)*nx*ny,1+b-(a+b)*ny*ny,0,0,0,0,1,0,0,0,0,1);}});
      if (visual.tag) { visual.tag.visible = sim.cars.length > 1; visual.tag.position.set(spatial.x, p.y + 1.72, spatial.z); }
    }
    this.advanceEffects(sim, dt);
    this.mechanicsView?.update(this.clock);
    this.cacheMeshes.forEach((mesh, id) => { const cache = sim.course.caches![id], p = this.layout.point(cache.x, LANES[0]); mesh.position.set(p.x, cache.y, p.z); mesh.visible = !sim.collected.has(id); mesh.rotation.y = this.clock * .45; });
    this.checkpointFlags.forEach(flag => flag.mesh.material.color.set(flag.x <= sim.cars[0].checkpoint ? 0xd9ee8e : 0xe2a252));
    sim.beams.forEach((b, i) => { const mesh = this.beamMeshes[i]; if (mesh) { const bp = b.body.translation(), p = this.layout.point(bp.x, LANES[b.lane]+(b.obstacle.lateral??0)); mesh.position.set(p.x, bp.y, p.z); mesh.rotation.set(0, p.yaw, b.body.rotation(), 'YXZ'); } });
    const player = sim.cars[0].body.translation();

    if (sim.cars[0].resets !== this.lastResets) { this.snapNextFrame = true; this.lastResets = sim.cars[0].resets; }
    const factor = this.snapNextFrame ? 1 : 1 - Math.exp(-dt * 4); this.snapNextFrame = false;
    this.viewX += (player.x - this.viewX) * factor;
    const y = Math.max(.2, player.y - .6);
    const wide=!!sim.course.routes;
    const cameraPoint = this.layout.point(this.viewX - (wide?5:3.5), (wide?22:16)+sim.cars[0].lateral.offset*(wide?.85:.45)), targetPoint = this.layout.point(this.viewX + (wide?5:3.2), sim.cars[0].lateral.offset*(wide?.85:.65));
    temp.set(cameraPoint.x, y + (wide?16:8), cameraPoint.z);
    this.camera.position.lerp(temp, factor);
    temp.set(targetPoint.x, y - 1.15, targetPoint.z); this.target.lerp(temp, factor); this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
    // Preserve the solid scenery. A fine vehicle silhouette supplies orientation
    // only while the car is hidden inside a passage, without deleting rock faces.
    const candidates=this.roofs.filter(r=>Math.abs(player.x-r.x)<r.width/2+1.2);
    let hidden=false;
    if(candidates.length){
      const at=this.layout.point(player.x,1+sim.cars[0].lateral.offset);temp.set(at.x,player.y+.3,at.z).sub(this.camera.position);
      this.roofRay.far=Math.max(.1,temp.length()-.4);this.roofRay.set(this.camera.position,temp.normalize());
      hidden=this.roofRay.intersectObjects(candidates.map(r=>r.mesh),false).length>0;
    }
    this.scene.traverse(o=>{if(o.userData.occlusionOutline)o.visible=hidden;});
    const sun = this.layout.point(this.viewX - 16, 15), sunTarget = this.layout.point(this.viewX + 4, -3);
    this.sun.position.set(sun.x, 25, sun.z); this.sun.target.position.set(sunTarget.x, 0, sunTarget.z);
    for (const rock of this.rocks) rock.visible = Math.abs(rock.userData.trackX - this.viewX) < 78;
    for (const water of this.waters) {
      water.uniforms.time.value = sim.elapsed;
      const fluid=water.userData.water as Water,delta=fluid.level-water.userData.initialLevel;
      water.userData.mesh.position.y=fluid.level+.035;water.uniforms.levelDelta.value=delta;
      const soil=sim.mechanics.soils.find(s=>s.water===fluid);
      if(soil && water.userData.soilVersion!==soil.version){
        const map=water.uniforms.rutMap.value as THREE.DataTexture,data=map.image.data as Uint8Array;
        for(let j=0;j<64;j++){const x=fluid.start+(fluid.end-fluid.start)*j/63;let nearest=0;for(let k=1;k<soil.nodes.length;k++)if(Math.abs(soil.nodes[k].x-x)<Math.abs(soil.nodes[nearest].x-x))nearest=k;data[j]=Math.round(soil.depths[nearest]/.48*255);}
        map.needsUpdate=true;water.userData.soilVersion=soil.version;
      }
      for (const car of sim.cars) {
        const wake = water.uniforms.wakes.value[car.id] as THREE.Vector4;
        const p = car.body.translation(), strength = (water.uniforms.mud.value ? this.mudSpray : this.spray).strengths[car.id];
        wake.set(p.x, LANES[car.id]+car.lateral.offset, strength, car.body.linvel().x);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  advanceEffects(sim: Simulation, dt: number) {
    this.spray.update(sim, dt, LANES.map((z,i)=>z+(sim.cars[i]?.lateral.offset??0)), sim.cars[0].body.translation().x, (x, z) => this.layout.point(x, z));
    this.mudSpray.update(sim, dt, LANES.map((z,i)=>z+(sim.cars[i]?.lateral.offset??0)), sim.cars[0].body.translation().x, (x, z) => this.layout.point(x, z));
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
    root.traverse(o => { if ((o instanceof THREE.Mesh || o instanceof THREE.LineSegments) && !o.userData.sharedVehicle && !o.userData.sharedWheel) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
    for (const mat of materials) mat.dispose();
  }
}
