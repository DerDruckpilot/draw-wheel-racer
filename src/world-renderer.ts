import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {HDRLoader} from 'three/addons/loaders/HDRLoader.js';
import {clamp} from './shapes';
import {updateWheelGeometry} from './wheel-mesh';
import {WheelTrails} from './wheel-trails';
import {worldHeight,basinWeight,groundType,WORLD_TILE} from './world-levels';
import {waterSurface,type WorldSimulation,type Wheel3D} from './world-physics';
import {naturalTerrain} from './terrain-material';
import {landscapeMaterial,type SurfaceMaps} from './world-materials';
import {worldWaterMaterial} from './world-water';
import {gateFrame,bridgeFrame,LIFT_DEPTH} from './world-mechanisms';
import type {AssetInfo,AssetCollisions,Ground,Basin,V3,WorldProp,Biome} from './world-types';

const BASE=import.meta.env.BASE_URL;
const UP=new THREE.Vector3(0,1,0);
const vector=(p:V3)=>new THREE.Vector3(p.x,p.y,p.z);
const quaternion=(q:{x:number;y:number;z:number;w:number})=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
type Quality='auto'|'high'|'eco';
function label(text:string,color='#e7eed7'){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;const c=canvas.getContext('2d')!;
  c.clearRect(0,0,256,80);c.fillStyle='#253b35';c.fillRect(2,8,252,62);c.fillStyle=color;c.font='600 29px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(text,128,40);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:true}));sprite.scale.set(2.5,.78,1);return sprite;
}
function box(w:number,h:number,d:number,material:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
export class WorldRenderer {
  readonly renderer:THREE.WebGLRenderer;readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(49,1,.12,165);
  readonly models=new Map<string,THREE.Group>();readonly collisions:AssetCollisions={};manifest:AssetInfo[]=[];
  readonly root=new THREE.Group();readonly sun=new THREE.DirectionalLight(0xffe5c5,3.1);readonly light=new THREE.HemisphereLight(0xd8ebfa,0x685849,2.3);
  private vehicle!:THREE.Group;private tiles=new Map<string,THREE.Mesh>();private wheelMeshes:THREE.Mesh[]=[];private wheelRevision=[-1,-1,-1,-1];
  private propMeshes=new Map<string,THREE.Object3D>();private gateMeshes=new Map<string,THREE.Group>();private plateMeshes=new Map<string,THREE.Group>();private bridgeMeshes=new Map<string,THREE.Group>();
  private cacheMeshes=new Map<string,THREE.Group>();private campMeshes=new Map<string,THREE.Group>();private relayLights=new Map<string,THREE.Mesh>();
  private waterMeshes:{basin:Basin;mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>}[]=[];
  private materials:THREE.MeshStandardMaterial[]=[];private biomeMaterials=new Map<string,THREE.MeshStandardMaterial>();
  private groundMaterials=new Map<Biome,THREE.MeshStandardMaterial>();
  private scenery:{mesh:THREE.InstancedMesh;center:THREE.Vector3;range:number}[]=[];
  private skyTexture!:THREE.Texture;
  private trails=new WheelTrails();
  private windTime={value:0};private focusPosition={value:new THREE.Vector3()};
  private worldMaterials=new Set<THREE.Material>();
  private signalLights:{signal:string;mesh:THREE.Mesh<THREE.SphereGeometry,THREE.MeshStandardMaterial>}[]=[];
  private metal=new THREE.MeshStandardMaterial({color:0x33433e,roughness:.68,metalness:.65});
  private rubber=new THREE.MeshStandardMaterial({color:0x102923,roughness:.9});
  private brass=new THREE.MeshStandardMaterial({color:0xa8904c,metalness:.72,roughness:.4});
  private lamp=new THREE.MeshStandardMaterial({color:0xd7ea9a,emissive:0xb2ce64,emissiveIntensity:.8});
  private quality:Quality='auto';private frame=0;private average=16;private pixelRatio=1.4;private adaptiveClock=0;private shadowTier=0;private cameraHeading=0;private cameraTarget=new THREE.Vector3();private dirty=true;
  private particles:THREE.Points;private particlePositions=new Float32Array(1800*3);private particleColors=new Float32Array(1800*3);private particleOpacity=new Float32Array(1800);private particleSizes=new Float32Array(1800);private dustBudget=[0,0,0,0];
  private particleData:{p:THREE.Vector3;v:THREE.Vector3;life:number;total:number;mud:boolean;dust:boolean;size:number;color?:number[]}[]=[];
  private resizeObserver:ResizeObserver;snapNextFrame=true;private lastRescues=-1;private goal!:THREE.Group;
  constructor(private host:HTMLElement){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','Frei befahrbare 3D-Welt');
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.5,far:90});this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.055;
    this.scene.add(this.root,this.sun,this.sun.target,this.light,this.trails.mesh);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3));geometry.setAttribute('color',new THREE.BufferAttribute(this.particleColors,3));geometry.setAttribute('particleOpacity',new THREE.BufferAttribute(this.particleOpacity,1));geometry.setAttribute('particleSize',new THREE.BufferAttribute(this.particleSizes,1));geometry.setDrawRange(0,0);
    const sprayMaterial=new THREE.PointsMaterial({size:.13,vertexColors:true,transparent:true,opacity:.76,depthWrite:false});
    sprayMaterial.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float particleOpacity;attribute float particleSize;varying float dropletAlpha;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ndropletAlpha=particleOpacity;').replace('gl_PointSize = size;','gl_PointSize = size*particleSize;');
      shader.fragmentShader='varying float dropletAlpha;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 droplet=gl_PointCoord-vec2(.5);
        float edge=1.-smoothstep(.055,.25,dot(droplet,droplet));
        diffuseColor.a*=edge*dropletAlpha;
        if(diffuseColor.a<.015)discard;
      `);
    };
    this.particles=new THREE.Points(geometry,sprayMaterial);this.particles.frustumCulled=false;this.scene.add(this.particles);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();
  }
  async load(progress:(value:number)=>void){
    const manifest=await fetch(`${BASE}assets/world/manifest.json`).then(r=>r.json()) as AssetInfo[];this.manifest=manifest;
    let completed=0;const complete=()=>progress(++completed/(manifest.length+11));
    const compressed=new KTX2Loader().setTranscoderPath(`${BASE}assets/basis/`).setWorkerLimit(2).detectSupport(this.renderer);
    const loader=new GLTFLoader().setKTX2Loader(compressed);
    await Promise.all(manifest.map(async item=>{
      const [gltf,geometry]=await Promise.all([loader.loadAsync(`${BASE}assets/world/${item.glb}`),fetch(`${BASE}assets/world/${item.id}.collision.json`).then(r=>r.json())]);
      gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.4;if(/grass|fern|nettle|shrub|rooibos|pine|quiver_tree|tree_small/.test(item.id))this.foliageMaterial(m,/grass|fern|nettle|shrub|rooibos/.test(item.id));}}}});
      this.models.set(item.id,gltf.scene);this.collisions[item.id]=geometry;complete();
    }));
    const textureLoader=compressed;
    const surfaceMaps=new Map<string,SurfaceMaps>();
    for(const id of ['sandy_gravel','leaves_forest_ground','snow_02','brown_mud_03','brown_mud_rocks_01','aerial_rocks_02','aerial_ground_rock','rock_face_03','grass_ground']){
      const [map,normalMap,roughnessMap]=await Promise.all(['color','normal','roughness'].map(async key=>{const t=await textureLoader.loadAsync(`${BASE}assets/world/${id}/${key}.ktx2`);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(key==='color')t.colorSpace=THREE.SRGBColorSpace;return t;}));
      const material=new THREE.MeshStandardMaterial({map,normalMap,roughnessMap,roughness:.94,vertexColors:true,normalScale:new THREE.Vector2(.6,.6)});naturalTerrain(material);this.biomeMaterials.set(id,material);complete();
      surfaceMaps.set(id,{color:map,normal:normalMap,roughness:roughnessMap});
    }
    for(const biome of ['canyon','forest','glacier','quarry','coast'] as Biome[]){
      const soil=biome==='glacier'?'snow_02':biome==='forest'?'leaves_forest_ground':biome==='coast'?'sandy_gravel':'brown_mud_rocks_01';
      const cliff=biome==='forest'||biome==='coast'?'aerial_rocks_02':'rock_face_03';
      this.groundMaterials.set(biome,landscapeMaterial(surfaceMaps.get(soil)!,surfaceMaps.get(cliff)!,surfaceMaps.get('grass_ground')!,surfaceMaps.get('aerial_ground_rock')!.color,biome));
    }
    const [car,sky,carCollision]=await Promise.all([loader.loadAsync(`${BASE}assets/offroad.glb`),new HDRLoader().loadAsync(`${BASE}assets/sky.hdr`),fetch(`${BASE}assets/offroad-collision.json`).then(r=>r.json())]);
    carCollision.parts.forEach((part:AssetCollisions[string],i:number)=>{this.collisions['vehicle-part-'+i]=part;});
    this.models.set('vehicle',car.scene);car.scene.traverse(o=>{if(o instanceof THREE.Mesh){if(!o.geometry.attributes.normal)o.geometry.computeVertexNormals();o.castShadow=true;o.receiveShadow=true;}});complete();
    this.skyTexture=sky;sky.mapping=THREE.EquirectangularReflectionMapping;const pmrem=new THREE.PMREMGenerator(this.renderer);const env=pmrem.fromEquirectangular(sky);this.scene.environment=env.texture;this.scene.environmentIntensity=.6;this.scene.background=sky;this.scene.backgroundBlurriness=.13;pmrem.dispose();complete();compressed.dispose();
  }
  private foliageMaterial(material:THREE.MeshStandardMaterial,wind=true){
    const leaves=material.alphaTest>0||material.transparent;
    if(material.alphaTest>0)material.side=THREE.DoubleSide;material.alphaToCoverage=true;
    material.onBeforeCompile=shader=>{
      shader.uniforms.vegetationTime=this.windTime;shader.uniforms.vehicleFocus=this.focusPosition;
      shader.vertexShader='uniform float vegetationTime;varying vec3 plantPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 origin=instanceMatrix[3].xyz;
          float bend=pow(max(0.,position.y+.5),2.);
          transformed.x+=sin(vegetationTime*1.1+origin.x*.43+origin.z*.21)*bend*${wind?'.028':'.004'};
          transformed.z+=sin(vegetationTime*.8+origin.z*.32)*bend*${wind?'.019':'.003'};
          plantPosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;
        #else
          plantPosition=(modelMatrix*vec4(transformed,1.)).xyz;
        #endif
      `);
      if(leaves)shader.fragmentShader='varying vec3 plantPosition;uniform vec3 vehicleFocus;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
        vec3 viewPath=cameraPosition-vehicleFocus;
        float along=dot(plantPosition-vehicleFocus,viewPath)/max(.01,dot(viewPath,viewPath));
        float distanceToPath=length(plantPosition-(vehicleFocus+viewPath*along));
        float viewRadius=mix(1.3,3.2,clamp(along,0.,1.));
        float occlusion=(1.-smoothstep(viewRadius,viewRadius+1.,distanceToPath))*smoothstep(.04,.16,along)*(1.-smoothstep(1.,1.12,along));
        float nearCamera=smoothstep(2.8,5.2,length(plantPosition-cameraPosition));
        diffuseColor.a*=(1.-occlusion*.96)*nearCamera;
        if(occlusion>.75||nearCamera<.08)discard;
        #include <alphatest_fragment>
      `);
    };
    material.customProgramCacheKey=()=> 'world-plants-4-'+wind+'-'+leaves;
  }
  setQuality(quality:Quality){this.quality=quality;this.average=16;this.adaptiveClock=0;this.shadowTier=0;this.pixelRatio=quality==='eco'?1:quality==='high'?Math.min(2,devicePixelRatio):1.4;this.renderer.shadowMap.enabled=quality!=='eco';this.setShadowResolution(1536);this.resize();}
  private setShadowResolution(size:number){
    if(this.sun.shadow.mapSize.x===size)return;
    this.sun.shadow.map?.dispose();this.sun.shadow.mapPass?.dispose();this.sun.shadow.map=this.sun.shadow.mapPass=null;
    this.sun.shadow.mapSize.set(size,size);this.sun.shadow.needsUpdate=true;
  }
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setPixelRatio(this.pixelRatio);this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.setViewOffset(w,h,0,h*.1,w,h);this.camera.updateProjectionMatrix();this.dirty=true;}
  needsFrame(sim:WorldSimulation){return this.dirty||this.snapNextFrame||this.lastRescues!==sim.rescues||sim.wheels.some((wheel,i)=>wheel.revision!==this.wheelRevision[i]);}
  private model(id:string,scale:number){const mesh=this.models.get(id)!.clone(true);mesh.scale.setScalar(scale);return mesh;}
  setWorld(sim:WorldSimulation){
    // Shared asset geometries/materials remain cached; generated world meshes do not.
    this.root.traverse(o=>{
      if(o instanceof THREE.Mesh&&o.userData.generated)o.geometry.dispose();
      if(o instanceof THREE.InstancedMesh)o.dispose();
      if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}
    });
    for(const material of this.worldMaterials)material.dispose();this.worldMaterials.clear();
    this.root.clear();this.tiles.clear();this.propMeshes.clear();this.gateMeshes.clear();this.plateMeshes.clear();this.bridgeMeshes.clear();this.cacheMeshes.clear();this.campMeshes.clear();this.relayLights.clear();this.waterMeshes=[];this.particleData=[];this.dustBudget.fill(0);this.scenery=[];this.signalLights=[];this.trails.clear();
    const biome=sim.level.biome;
    this.scene.fog=new THREE.Fog(biome==='glacier'?0xbac7ce:biome==='forest'?0x8a9d85:0xafa99a,38,72);
    this.scene.background=this.scene.fog.color.clone();
    const ground=this.groundMaterials.get(biome)!;
    const ice=new THREE.MeshPhysicalMaterial({color:0x9fbec7,roughness:.17,metalness:.07,clearcoat:1,vertexColors:true,envMapIntensity:1});
    this.worldMaterials.add(ice);
    this.materials=[ground,this.groundMaterials.get('forest')!,ice,this.biomeMaterials.get('brown_mud_03')!,this.groundMaterials.get('coast')!];
    this.vehicle=this.models.get('vehicle')!.clone(true);this.root.add(this.vehicle);
    this.wheelMeshes=sim.wheels.map(()=>{const mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.rubber);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.generated=true;this.root.add(mesh);return mesh;});this.wheelRevision.fill(-1);
    // Static imported models are instanced per spatial chunk, not cloned for every rock.
    const groups=new Map<string,WorldProp[]>();
    for(const prop of sim.level.props){
      if(prop.movable){const object=this.model(prop.asset,prop.scale);if(prop.stretch)object.scale.multiply(vector(prop.stretch));this.propMeshes.set(prop.id,object);this.root.add(object);continue;}
      const key=prop.asset+':'+Math.floor(prop.x/48)+','+Math.floor(prop.z/48);const list=groups.get(key)??[];list.push(prop);groups.set(key,list);
    }
    const matrix=new THREE.Matrix4();
    for(const props of groups.values()){
      this.models.get(props[0].asset)!.traverse(o=>{if(o instanceof THREE.Mesh){
        const mesh=new THREE.InstancedMesh(o.geometry,o.material,props.length);mesh.castShadow=!props[0].foliage;mesh.receiveShadow=true;
        props.forEach((p,i)=>{const scale=new THREE.Vector3(p.stretch?.x??1,p.stretch?.y??1,p.stretch?.z??1).multiplyScalar(p.scale);matrix.compose(vector(p),new THREE.Quaternion().setFromEuler(new THREE.Euler(p.pitch??0,p.yaw,p.roll??0,'YXZ')),scale);mesh.setMatrixAt(i,matrix);});mesh.computeBoundingSphere();this.root.add(mesh);
        mesh.userData.castsShadow=!props[0].foliage;this.scenery.push({mesh,center:mesh.boundingSphere!.center.clone(),range:props[0].foliage?62:96});
      }});
    }
    for(const plate of sim.plates){
      const group=new THREE.Group(),base=box(plate.spec.width,.05,plate.spec.depth,this.metal);base.userData.generated=true;group.add(base);
      const inset=box(plate.spec.width-.16,.02,plate.spec.depth-.16,this.brass);inset.position.y=.03;inset.userData.generated=true;group.add(inset);
      group.position.copy(vector(plate.spec));group.rotation.y=plate.spec.yaw;this.root.add(group);this.plateMeshes.set(plate.spec.id,group);
    }
    for(const gate of sim.gates){
      const spec=gate.spec,group=new THREE.Group(),lift=spec.kind==='lift';
      if(lift){
        const panel=box(spec.width,.32,LIFT_DEPTH,this.metal);panel.position.y=-.06;panel.userData.generated=true;group.add(panel);
        const deck=this.model('wooden_deck',1),size=this.manifest.find(a=>a.id==='wooden_deck')!.size;deck.scale.set(spec.width/size[0],.12/size[1],LIFT_DEPTH/size[2]);deck.position.y=.16;group.add(deck);
      }
      else{const model=this.model('large_iron_gate',1),size=this.manifest.find(a=>a.id==='large_iron_gate')!.size;model.scale.set(spec.width/size[0],spec.height/size[1],.44/size[2]);group.add(model);}
      this.root.add(group);this.gateMeshes.set(spec.id,group);
      for(const part of gateFrame(spec)){const mesh=box(part.size.x,part.size.y,part.size.z,this.metal);mesh.position.copy(vector(part.position));mesh.rotation.y=part.yaw;mesh.userData.generated=true;this.root.add(mesh);}
      for(const [i,id] of spec.requires.entries()){
        const control=sim.level.plates.find(p=>p.id===id)??sim.level.switches.find(p=>p.id===id);
        if(control){const a=vector(control),b=vector(spec);a.y+=.15;b.y+=.15;const points=Array.from({length:25},(_,i)=>{const p=a.clone().lerp(b,i/24);p.y=worldHeight(sim.level,p.x,p.z)+.05;return p;});const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,.025,4,false);const wire=new THREE.Mesh(geometry,this.brass);wire.userData.generated=true;this.root.add(wire);}
        const light=new THREE.Mesh(new THREE.SphereGeometry(.11,10,6),this.lamp.clone()),localX=-spec.width/2-.22;
        light.position.set(spec.x+Math.cos(spec.yaw)*localX,spec.y+1.6+i*.35,spec.z-Math.sin(spec.yaw)*localX);light.userData.generated=true;this.worldMaterials.add(light.material);this.signalLights.push({signal:id,mesh:light});this.root.add(light);
      }
    }
    for(const bridge of sim.bridges){
      const group=new THREE.Group(),size=this.manifest.find(a=>a.id==='wooden_deck')!.size;
      const backing=box(bridge.length,.24,bridge.width,this.metal);backing.position.y=-.04;backing.userData.generated=true;group.add(backing);
      const segments=Math.ceil(bridge.length/3.4),length=bridge.length/segments;
      for(let i=0;i<segments;i++){
        const deck=this.model('wooden_deck',1);deck.scale.set(length/size[0],.26/size[1],bridge.width/size[2]);deck.position.set(-bridge.length/2+(i+.5)*length,.06,0);group.add(deck);
      }
      const ballast=box(1.6,.6,bridge.width*.64,this.metal);ballast.position.set(-bridge.length*.32,-.48,0);ballast.userData.generated=true;group.add(ballast);
      this.bridgeMeshes.set(bridge.id,group);this.root.add(group);
      const spec=sim.level.bridges.find(b=>b.id===bridge.id)!;
      for(const part of bridgeFrame(spec,(x,z)=>worldHeight(sim.level,x,z))){const stand=box(part.size.x,part.size.y,part.size.z,this.metal);stand.position.copy(vector(part.position));stand.rotation.y=part.yaw;stand.userData.generated=true;this.root.add(stand);}
    }
    for(const camp of sim.level.camps){
      const group=new THREE.Group();group.position.copy(vector(camp));
      const beacon=box(.09,2.6,.09,this.metal);beacon.position.y=1.3;beacon.userData.generated=true;group.add(beacon);
      const sign=label('LAGER');sign.position.y=2.5;group.add(sign);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.13,10,6),this.lamp);lamp.position.y=2.85;lamp.userData.generated=true;group.add(lamp);
      this.campMeshes.set(camp.id,group);this.root.add(group);
    }
    for(const cache of sim.level.caches){
      const group=new THREE.Group();group.position.copy(vector(cache));
      const model=this.model(cache.kind==='cell'?'old_military_crate':'wooden_crate_01',cache.kind==='cell'?.7:.65);group.add(model);
      const light=new THREE.Mesh(new THREE.SphereGeometry(.08,8,5),cache.kind==='cell'?this.lamp:this.brass);light.position.y=.24;light.userData.generated=true;group.add(light);this.cacheMeshes.set(cache.id,group);this.root.add(group);
    }
    for(const relay of sim.level.relays){const light=new THREE.Mesh(new THREE.SphereGeometry(.12,10,6),this.brass.clone());this.worldMaterials.add(light.material);light.position.set(relay.x,relay.y+2,relay.z);light.userData.generated=true;this.relayLights.set(relay.id,light);this.root.add(light);}
    for(const control of sim.level.switches){
      const light=new THREE.Mesh(new THREE.SphereGeometry(.09,10,6),this.lamp.clone());light.userData.generated=true;this.worldMaterials.add(light.material);this.signalLights.push({signal:control.id,mesh:light});
      const gate=control.gate?sim.gates.find(g=>g.spec.id===control.gate):undefined;
      if(gate){const group=this.gateMeshes.get(gate.spec.id)!,valve=this.model('industrial_valve',1);valve.position.set(control.x-gate.spec.x,.75,control.z-gate.spec.z);group.add(valve);light.position.copy(valve.position).add(new THREE.Vector3(0,.6,0));group.add(light);}
      else{light.position.set(control.x,control.y+1.65,control.z);this.root.add(light);}
    }
    this.goal=new THREE.Group();this.goal.position.copy(vector(sim.level.goal));
    const labelMesh=label('ZIELLAGER');labelMesh.position.y=3.5;this.goal.add(labelMesh);
    for(const side of [-1,1]){const pole=box(.14,3.3,.14,this.metal);pole.position.set(0,1.65,side*2);pole.userData.generated=true;this.goal.add(pole);}
    for(const [i,signal] of sim.level.goalRequires.entries()){
      const light=new THREE.Mesh(new THREE.SphereGeometry(.12,10,6),this.lamp.clone());light.position.set(0,2.9,(i-(sim.level.goalRequires.length-1)/2)*.45);light.userData.generated=true;this.worldMaterials.add(light.material);this.signalLights.push({signal,mesh:light});this.goal.add(light);
    }
    this.root.add(this.goal);
    for(const basin of sim.level.basins)if(basin.material!=='ice')this.addWater(sim,basin);
    this.snapNextFrame=true;this.lastRescues=sim.rescues;this.cameraHeading=sim.heading;
    this.updateTerrain(sim,true);
  }
  private updateTerrain(sim:WorldSimulation,force=false){
    const p=sim.position,tx=Math.floor(p.x/WORLD_TILE),tz=Math.floor(p.z/WORLD_TILE),radius=4;
    for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
      const key=(tx+dx)+','+(tz+dz);if(this.tiles.has(key))continue;
      const tile=sim.ensureTile(tx+dx,tz+dz),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(tile.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(tile.normals,3));g.setAttribute('uv',new THREE.BufferAttribute(tile.uv,2));g.setAttribute('color',new THREE.BufferAttribute(tile.colors,3));g.setAttribute('groundCover',new THREE.BufferAttribute(tile.cover,1));
      const indices:number[]=[];for(const [index,name] of ['stone','soil','ice','mud','gravel'].entries()){const values=tile.groups[name as Ground];if(values.length)g.addGroup(indices.length,values.length,index);indices.push(...values);}g.setIndex(indices);
      const mesh=new THREE.Mesh(g,this.materials);mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.generated=true;this.tiles.set(key,mesh);this.root.add(mesh);
    }
    for(const [key,mesh] of this.tiles){const [x,z]=key.split(',').map(Number);mesh.visible=Math.abs(x-tx)<=4&&Math.abs(z-tz)<=4;if(Math.abs(x-tx)>7||Math.abs(z-tz)>7){mesh.geometry.dispose();this.root.remove(mesh);this.tiles.delete(key);}}
  }
  private addWater(sim:WorldSimulation,basin:Basin){
    const positions:number[]=[],uv:number[]=[],indices:number[]=[];const n=42,extent=1.24;
    const co=Math.cos(basin.angle),si=Math.sin(basin.angle);
    const point=(u:number,v:number)=>{const x=(u*2-1)*basin.rx*extent,z=(v*2-1)*basin.rz*extent;return {x:basin.x+co*x-si*z,z:basin.z+si*x+co*z};};
    for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const p=point(x/n,z/n);positions.push(p.x,basin.level,p.z);uv.push(x/n,z/n);}
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2);}
    const resolution=144,data=new Uint8Array(resolution*resolution*4);
    for(let z=0;z<resolution;z++)for(let x=0;x<resolution;x++){
      const p=point(x/(resolution-1),z/(resolution-1)),depth=basin.level-sim.surfaceHeight(p.x,p.z),i=(z*resolution+x)*4;
      data[i]=data[i+1]=data[i+2]=Math.round(clamp((depth+8)/16,0,1)*255);data[i+3]=255;
    }
    const bathymetry=new THREE.DataTexture(data,resolution,resolution);bathymetry.minFilter=bathymetry.magFilter=THREE.LinearFilter;bathymetry.needsUpdate=true;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
    const mud=this.biomeMaterials.get('brown_mud_03')!;
    const material=worldWaterMaterial(basin,bathymetry,this.skyTexture,this.camera.position,{color:mud.map!,normal:mud.normalMap!});this.worldMaterials.add(material);
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.generated=true;this.root.add(mesh);this.waterMeshes.push({basin,mesh});
  }
  private updateWheels(sim:WorldSimulation){
    for(const [i,wheel] of sim.wheels.entries()){
      const mesh=this.wheelMeshes[i];mesh.position.copy(vector(wheel.body.translation()));mesh.quaternion.copy(quaternion(wheel.body.rotation()));
      if(this.wheelRevision[i]===wheel.revision)continue;this.wheelRevision[i]=wheel.revision;
      updateWheelGeometry(mesh.geometry,wheel.points);
    }
  }
  private effects(sim:WorldSimulation,dt:number){
    for(const event of sim.sprayPoints.splice(0))for(let i=0;i<Math.ceil(event.strength*5);i++){
      if(this.particleData.length>=1800)break;const p=vector(event.p),velocity=vector(event.velocity);velocity.x+=(Math.random()-.5)*1.7;velocity.z+=(Math.random()-.5)*1.7;velocity.y+=Math.random()*.8;const life=event.mud?.7:1.1;this.particleData.push({p,v:velocity,life,total:life,mud:event.mud,dust:false,size:1});
    }
    for(const [index,wheel] of sim.wheels.entries()){
      const contact=wheel.contactPoint;if(!contact||wheel.load<18)continue;
      if(Math.abs(contact.y-sim.surfaceHeight(contact.x,contact.z))>.16||groundType(sim.level,contact.x,contact.z)==='ice')continue;
      if(sim.level.basins.some(b=>basinWeight(b,contact.x,contact.z)<1.04&&(sim.basinLevels.get(b.id)??b.level)>contact.y-.04))continue;
      const velocity=wheel.body.velocityAtPoint(contact),slip=Math.hypot(velocity.x,velocity.z),rate=clamp((Math.abs(sim.signedSpeed)-.6)*.8+(slip-.6)*1.8,0,8);
      this.dustBudget[index]+=rate*dt;
      while(this.dustBudget[index]>=1&&this.particleData.length<1800){
        this.dustBudget[index]--;const life=1.1+Math.random()*.5,p=vector(contact);p.y+=.06;
        this.particleData.push({p,v:new THREE.Vector3(velocity.x*.12+(Math.random()-.5)*.4,.25+Math.min(.6,slip*.12),velocity.z*.12+(Math.random()-.5)*.4),life,total:life,mud:false,dust:true,size:2.5+Math.random()*2,color:sim.level.biome==='glacier'?[.67,.71,.73]:sim.level.biome==='forest'?[.25,.21,.15]:[.47,.37,.25]});
      }
    }
    this.particleData=this.particleData.filter(p=>p.life>0);
    this.particleData.forEach((particle,i)=>{
      particle.life-=dt;const age=clamp(1-particle.life/particle.total,0,1);
      if(particle.dust){particle.v.multiplyScalar(Math.exp(-dt*1.2));particle.v.x+=dt*.18;particle.v.y+=dt*.12;}else particle.v.y-=dt*7.5;
      particle.p.addScaledVector(particle.v,dt);particle.p.toArray(this.particlePositions,i*3);this.particleColors.set(particle.color??(particle.mud?[.31,.22,.13]:[.72,.86,.86]),i*3);
      this.particleOpacity[i]=particle.dust?Math.min(1,age*6)*(1-age)*.25:Math.min(1,Math.max(0,particle.life)*3);this.particleSizes[i]=particle.size*(particle.dust?1+age*1.8:1);
    });
    this.particles.geometry.attributes.position.needsUpdate=true;this.particles.geometry.attributes.color.needsUpdate=true;this.particles.geometry.attributes.particleOpacity.needsUpdate=true;this.particles.geometry.attributes.particleSize.needsUpdate=true;this.particles.geometry.setDrawRange(0,this.particleData.length);
  }
  render(sim:WorldSimulation,dt:number){
    this.dirty=false;
    this.frame++;this.windTime.value=sim.elapsed;if(this.snapNextFrame||this.lastRescues!==sim.rescues||this.frame%20===0)this.updateTerrain(sim);
    this.vehicle.position.copy(vector(sim.position));this.vehicle.quaternion.copy(quaternion(sim.body.rotation()));this.updateWheels(sim);
    this.focusPosition.value.copy(this.vehicle.position).add(new THREE.Vector3(0,.4,0));
    if(this.frame%10===0||this.snapNextFrame)for(const batch of this.scenery){const distance=batch.center.distanceTo(this.vehicle.position);batch.mesh.visible=distance<batch.range;batch.mesh.castShadow=!!batch.mesh.userData.castsShadow&&distance<(this.shadowTier?40:58);}
    for(const prop of sim.props)if(prop.spec.movable){const mesh=this.propMeshes.get(prop.spec.id)!;mesh.position.copy(vector(prop.body.translation()));mesh.quaternion.copy(quaternion(prop.body.rotation()));mesh.visible=mesh.position.distanceTo(this.vehicle.position)<85;}
    for(const gate of sim.gates){const mesh=this.gateMeshes.get(gate.spec.id)!;mesh.position.copy(vector(gate.body.translation()));mesh.quaternion.copy(quaternion(gate.body.rotation()));}
    for(const plate of sim.plates){const mesh=this.plateMeshes.get(plate.spec.id)!;mesh.children[1].position.y=plate.active?.018:.03;}
    for(const bridge of sim.bridges){const mesh=this.bridgeMeshes.get(bridge.id)!;mesh.position.copy(vector(bridge.body.translation()));mesh.quaternion.copy(quaternion(bridge.body.rotation()));}
    for(const [id,mesh] of this.cacheMeshes)mesh.visible=!sim.collected.has(id);
    for(const [id,mesh] of this.campMeshes){mesh.visible=mesh.position.distanceTo(this.vehicle.position)<30;(mesh.children[1] as THREE.Sprite).material.opacity=sim.foundCamps.has(id)?1:.86;}
    for(const [id,mesh] of this.relayLights){const mat=mesh.material as THREE.MeshStandardMaterial;mat.color.setHex(sim.signals.has(id)?0xd8ef99:0x7e562b);mat.emissive.setHex(sim.signals.has(id)?0x9ab84f:0);}
    for(const {signal,mesh} of this.signalLights){const on=sim.signals.has(signal);mesh.material.color.setHex(on?0xcde68b:0x96583e);mesh.material.emissive.setHex(on?0x81a645:0x3e1408);}
    this.goal.visible=this.goal.position.distanceTo(this.vehicle.position)<45;
    for(const {basin,mesh} of this.waterMeshes){
      mesh.visible=new THREE.Vector3(basin.x,basin.level,basin.z).distanceTo(this.vehicle.position)<95;if(!mesh.visible)continue;
      const position=mesh.geometry.attributes.position,level=sim.basinLevels.get(basin.id)!;
      for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);position.setY(i,waterSurface(basin,x,z,sim.elapsed,level).height);}
      position.needsUpdate=true;mesh.material.uniforms.time.value=sim.elapsed;
      mesh.material.uniforms.forward.value.set(sim.forward.x,sim.forward.z).multiplyScalar(sim.signedSpeed<-.1?-1:1);
      const wakes=mesh.material.uniforms.wakes.value as THREE.Vector4[];
      sim.wheels.forEach((wheel,i)=>{const p=wheel.body.translation(),wet=basinWeight(basin,p.x,p.z)<1.1&&p.y-1.2<level,activity=sim.sprayPoints.filter(e=>Math.hypot(e.p.x-p.x,e.p.z-p.z)<1.5).reduce((n,e)=>Math.max(n,e.strength),0),strength=wet?Math.min(1,activity+Math.abs(sim.signedSpeed)*.14):0;wakes[i].set(p.x,p.z,wakes[i].z+(strength-wakes[i].z)*Math.min(1,dt*6),0);});
    }
    this.effects(sim,Math.min(dt,.1));this.trails.update(sim);
    const snap=this.snapNextFrame||this.lastRescues!==sim.rescues;this.snapNextFrame=false;this.lastRescues=sim.rescues;
    const diff=Math.atan2(Math.sin(sim.heading-this.cameraHeading),Math.cos(sim.heading-this.cameraHeading));this.cameraHeading+=diff*(snap?1:1-Math.exp(-dt*2.7));
    const forward=new THREE.Vector3(Math.cos(this.cameraHeading),0,-Math.sin(this.cameraHeading)),side=new THREE.Vector3(-forward.z,0,forward.x),p=vector(sim.position);
    const target=p.clone().addScaledVector(forward,1.2);target.y+=.45;
    const desired=p.clone().addScaledVector(forward,-9.5).addScaledVector(side,5.5);desired.y+=6.4;
    desired.y=Math.max(desired.y,worldHeight(sim.level,desired.x,desired.z)+2.4);
    const anchor=p.clone().add(new THREE.Vector3(0,.1,0)),cameraShape=new RAPIER.Ball(.32);
    const unobstructed=(candidate:THREE.Vector3)=>{
      const delta=candidate.clone().sub(anchor),length=delta.length();delta.divideScalar(length);
      const hit=sim.world.castShape(anchor,{x:0,y:0,z:0,w:1},delta,cameraShape,.02,length,true,undefined,0x00020005,undefined,sim.body);
      return {point:anchor.clone().addScaledVector(delta,hit?Math.max(.6,hit.time_of_impact-.08):length),distance:hit?hit.time_of_impact:length};
    };
    let safe=unobstructed(desired);
    if(safe.distance<7){
      // A thin tree should make the boom move around its trunk, not zoom all
      // the way into the vehicle. Try nearby views before shortening it.
      let score=safe.distance;
      for(const angle of [-.42,.42,-.84,.84]){
        const offset=desired.clone().sub(p).applyAxisAngle(UP,angle),candidate=p.clone().add(offset);
        candidate.y=Math.max(candidate.y,sim.surfaceHeight(candidate.x,candidate.z)+.65);
        const alternative=unobstructed(candidate),candidateScore=alternative.distance-Math.abs(angle)*2.1;
        if(candidateScore>score+.35){safe=alternative;score=candidateScore;}
      }
    }
    if(safe.distance<4){
      const low=p.clone().addScaledVector(forward,-6).addScaledVector(side,2);low.y+=1.2;low.y=Math.max(low.y,sim.surfaceHeight(low.x,low.z)+.5);
      const alternate=unobstructed(low);if(alternate.distance>safe.distance+1)safe=alternate;
    }
    this.camera.position.lerp(safe.point,snap?1:1-Math.exp(-dt*5));this.camera.position.copy(unobstructed(this.camera.position).point);this.cameraTarget.lerp(target,snap?1:1-Math.exp(-dt*7));this.camera.lookAt(this.cameraTarget);
    this.sun.position.copy(p).add(new THREE.Vector3(-20,32,17));this.sun.target.position.copy(p);
    this.renderer.render(this.scene,this.camera);
    if(sim.started){
      this.average=this.average*.96+dt*1000*.04;this.adaptiveClock+=dt;
      if(this.quality==='auto'&&this.adaptiveClock>=2.5){
        this.adaptiveClock=0;
        if(this.average>26){
          if(this.pixelRatio>1){this.pixelRatio=Math.max(1,this.pixelRatio-.2);this.resize();}
          else if(this.shadowTier===0){this.shadowTier=1;this.setShadowResolution(1024);}
          else if(this.shadowTier===1&&this.average>34){this.shadowTier=2;this.renderer.shadowMap.enabled=false;}
        }
      }
    }
  }
  framing(){const v=this.vehicle.position.clone().project(this.camera);return {x:(v.x+1)/2,y:(1-v.y)/2,camera:this.camera.position.toArray(),heading:this.cameraHeading,quality:{requested:this.quality,pixelRatio:this.pixelRatio,shadows:this.renderer.shadowMap.enabled,shadowSize:this.sun.shadow.mapSize.x}};}
  image(){return this.renderer.domElement.toDataURL('image/png');}
}
