import * as THREE from 'three';
import {randomSource,noise,nearestTrail,worldHeight,basinWeight,localCoordinates} from './world-levels';
import {clamp} from './shapes';
import type {WorldLevel} from './world-types';
import type {WorldSimulation} from './world-physics';

export const DRESSING_TILE=8;
export interface GroundDetail {asset:string;x:number;y:number;z:number;scale:number;flat:number;yaw:number;normal:THREE.Vector3;tint:number}
/** Continuous, deterministic cover beyond the road edges. No puzzle IDs or
 * colliders are created here; tiny stones are shallow surface dressing. */
export function createDressingTile(level:WorldLevel,tx:number,tz:number,height=(x:number,z:number)=>worldHeight(level,x,z)){
  const rand=randomSource(level.seed^Math.imul(tx,73856093)^Math.imul(tz,19349663)^0x22611),items:GroundDetail[]=[];
  const count=15,step=DRESSING_TILE/count,biome=level.biome;
  for(let iz=0;iz<count;iz++)for(let ix=0;ix<count;ix++){
    const x=tx*DRESSING_TILE+(ix+.15+rand()*.7)*step,z=tz*DRESSING_TILE+(iz+.15+rand()*.7)*step,y=height(x,z);
    if(level.basins.some(b=>basinWeight(b,x,z)<1.07&&y<b.level+.06))continue;
    if(level.plates.some(p=>{const a=localCoordinates(p,x,z);return Math.abs(a.x)<p.width/2+.14&&Math.abs(a.z)<p.depth/2+.14;}))continue;
    const dx=(height(x+.22,z)-height(x-.22,z))/.44,dz=(height(x,z+.22)-height(x,z-.22))/.44,slope=Math.hypot(dx,dz);
    if(slope>1.65)continue;
    const near=nearestTrail(level,x,z),verge=clamp((near.distance-1.0)/2.1,0,1),patch=clamp(.72+noise(x*1.6,z*1.6,level.seed)*.9,.18,1);
    let plantChance=(biome==='forest'?.82:biome==='glacier'?.045:biome==='quarry'?.52:.78)*patch*(.32+.68*verge);
    const service=level.caches.some(p=>Math.hypot(p.x-x,p.z-z)<1.1)||level.camps.some(p=>Math.hypot(p.x-x,p.z-z)<1.5)||level.relays.some(p=>Math.hypot(p.x-x,p.z-z)<1.2)||level.switches.some(p=>Math.hypot(p.x-x,p.z-z)<1.1);
    if(service||slope>1.15)plantChance=0;
    const plant=rand()<plantChance,choice=rand();let asset:string,scale:number,flat=1;
    if(plant){
      asset=choice<.22?'scrub_rooibos':choice<.31&&biome!=='glacier'?'flower_gazania':choice<.43&&biome==='forest'?'fern_02':choice<.50?'grass_medium_02':choice<.80?'grass_clump':'grass_low';
      scale=asset==='scrub_rooibos'?.64+rand()*.56:asset==='flower_gazania'?.42+rand()*.35:asset==='fern_02'?.60+rand()*.43:.70+rand()*.49;
    }else{
      if(biome==='glacier'&&rand()<.75)continue;
      asset=choice<.5?'gravel_01':'gravel_02';scale=.065+rand()**1.5*.27;flat=.35+rand()*.45;
    }
    const detail={asset,x,y,z,scale,flat,yaw:rand()*Math.PI*2,normal:new THREE.Vector3(-dx,1,-dz).normalize(),tint:rand()};items.push(detail);
    // Tufts grow into irregular clumps rather than a uniform grid of isolated
    // blades. A second, rotated copy shares the same root and contact height.
    if(asset.startsWith('grass')&&patch>.6&&rand()<.48)items.push({...detail,scale:scale*.84,yaw:detail.yaw+1.8});
    if(asset.startsWith('gravel'))for(let n=0;n<2;n++){
      const dx=(rand()-.5)*.3,dz=(rand()-.5)*.3;
      items.push({...detail,x:x+dx,z:z+dz,y:height(x+dx,z+dz),scale:.035+rand()*.065,yaw:rand()*Math.PI*2,tint:rand()});
    }
  }
  return items;
}

type Tile={x:number;z:number;items:GroundDetail[];sphere:THREE.Sphere};
type Batch={mesh:THREE.InstancedMesh;source:THREE.Mesh;capacity:number};
export class GroundDressing {
  readonly root=new THREE.Group();
  private tiles=new Map<string,Tile>();private batches=new Map<string,Batch[]>();
  private sim?:WorldSimulation;private models=new Map<string,THREE.Group>();private bottoms=new Map<string,number>();
  private materials=new Set<THREE.Material>();private fade={value:34};
  private lastCamera=new THREE.Vector3(Infinity,0,0);private lastRotation=new THREE.Quaternion();
  private lastTile='';private pending=true;private lastRadius=0;private lastDensity=1;
  get needsFrame(){return this.pending;}
  get count(){let n=0;for(const batches of this.batches.values())n+=batches[0]?.mesh.count??0;return n;}
  get cachedTiles(){return this.tiles.size;}
  setWorld(sim:WorldSimulation,models:Map<string,THREE.Group>){
    for(const batches of this.batches.values())for(const {mesh} of batches)mesh.dispose();
    for(const m of this.materials)m.dispose();this.materials.clear();this.root.clear();this.batches.clear();this.tiles.clear();this.bottoms.clear();
    this.sim=sim;this.models=models;this.lastTile='';this.pending=true;this.lastCamera.set(Infinity,0,0);
  }
  private material(source:THREE.Material,gravel:boolean){
    const material=source.clone();this.materials.add(material);
    // Coverage sampling thins subpixel grass into almost invisible specks on
    // mobile render targets. Keep the scanned leaf mask with a stable cutoff.
    material.alphaToCoverage=false;if(material.alphaTest>0)material.alphaTest=.24;
    material.onBeforeCompile=(shader,renderer)=>{
      source.onBeforeCompile(shader,renderer);shader.uniforms.dressingRange=this.fade;
      shader.vertexShader='varying vec3 dressingWorld;varying float dressingHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        dressingWorld=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;dressingHeight=position.y;
      `);
      shader.fragmentShader='varying vec3 dressingWorld;varying float dressingHeight;uniform float dressingRange;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float fade=1.-smoothstep(dressingRange-7.,dressingRange,length(dressingWorld.xz-cameraPosition.xz));
        float pixel=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        if(pixel>fade)discard;
        diffuseColor.rgb*=mix(.74,1.,smoothstep(-.45,.18,dressingHeight));
        ${gravel?'diffuseColor.rgb=diffuseColor.rgb*.78+vec3(.065,.059,.045);':''}
      `);
    };
    material.customProgramCacheKey=()=>source.customProgramCacheKey()+'-dressing-2-'+gravel;return material;
  }
  update(camera:THREE.PerspectiveCamera,radius:number,density=1){
    const sim=this.sim;if(!sim)return;
    this.fade.value=radius+7;
    const p=sim.position,cx=Math.floor(p.x/DRESSING_TILE),cz=Math.floor(p.z/DRESSING_TILE),key=cx+','+cz,reach=Math.ceil(radius/DRESSING_TILE);
    const wanted:{x:number;z:number;distance:number}[]=[];
    for(let z=cz-reach;z<=cz+reach;z++)for(let x=cx-reach;x<=cx+reach;x++){
      const distance=Math.hypot((x+.5)*DRESSING_TILE-p.x,(z+.5)*DRESSING_TILE-p.z);if(distance<radius+4)wanted.push({x,z,distance});
    }
    wanted.sort((a,b)=>a.distance-b.distance);let changed=key!==this.lastTile||radius!==this.lastRadius||density!==this.lastDensity,budget=this.tiles.size?3:9;this.pending=false;
    for(const tile of wanted){
      const id=tile.x+','+tile.z;if(this.tiles.has(id))continue;if(budget--<=0){this.pending=true;continue;}
      const items=createDressingTile(sim.level,tile.x,tile.z,(x,z)=>sim.surfaceHeight(x,z,false));
      const box=new THREE.Box3();items.forEach(i=>box.expandByPoint(new THREE.Vector3(i.x,i.y+.5,i.z)));
      this.tiles.set(id,{...tile,items,sphere:items.length?box.expandByScalar(.7).getBoundingSphere(new THREE.Sphere()):new THREE.Sphere(new THREE.Vector3(tile.x*8,0,tile.z*8),7)});changed=true;
    }
    for(const [id,tile] of this.tiles)if(Math.hypot((tile.x-cx)*8,(tile.z-cz)*8)>radius+19)this.tiles.delete(id);
    if(!changed&&camera.position.distanceToSquared(this.lastCamera)<.18&&Math.abs(camera.quaternion.dot(this.lastRotation))>.998)return;
    this.lastTile=key;this.lastRadius=radius;this.lastDensity=density;this.lastCamera.copy(camera.position);this.lastRotation.copy(camera.quaternion);
    camera.updateMatrixWorld();const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    const lists=new Map<string,GroundDetail[]>();
    for(const tile of wanted){const data=this.tiles.get(tile.x+','+tile.z);if(!data||!frustum.intersectsSphere(data.sphere))continue;for(const item of data.items){
      const distance=Math.hypot(item.x-camera.position.x,item.z-camera.position.z);
      if(distance>4&&item.tint>density)continue;
      // Tiny pebbles are only useful close enough to resolve on a phone.
      if(item.scale<.1&&distance>17)continue;
      const list=lists.get(item.asset)??[];list.push(item);lists.set(item.asset,list);
    }}
    for(const [asset,batches] of this.batches)if(!lists.has(asset))for(const b of batches)b.mesh.count=0;
    const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),yaw=new THREE.Quaternion(),position=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color(),up=new THREE.Vector3(0,1,0);
    for(const [asset,items] of lists){
      let batches=this.batches.get(asset);const model=this.models.get(asset);if(!model)throw Error('Missing ground dressing asset: '+asset);
      if(!batches||batches[0].capacity<items.length){
        if(batches)for(const b of batches){this.root.remove(b.mesh);b.mesh.dispose();for(const material of (Array.isArray(b.mesh.material)?b.mesh.material:[b.mesh.material])){material.dispose();this.materials.delete(material);}}
        const capacity=Math.max(128,2**Math.ceil(Math.log2(items.length)));batches=[];
        model.traverse(o=>{if(o instanceof THREE.Mesh){const sources=Array.isArray(o.material)?o.material:[o.material],materials=sources.map(m=>this.material(m,asset.startsWith('gravel'))),mesh=new THREE.InstancedMesh(o.geometry,Array.isArray(o.material)?materials:materials[0],capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=false;mesh.receiveShadow=true;this.root.add(mesh);batches!.push({mesh,source:o,capacity});}});this.batches.set(asset,batches);
      }
      let bottom=this.bottoms.get(asset);if(bottom===undefined){bottom=new THREE.Box3().setFromObject(model).min.y;this.bottoms.set(asset,bottom);}
      for(const batch of batches){
        items.forEach((item,i)=>{
          const gravel=asset.startsWith('gravel');rotation.identity();if(gravel)rotation.setFromUnitVectors(up,item.normal);yaw.setFromAxisAngle(up,item.yaw);rotation.multiply(yaw);
          scale.set(item.scale,item.scale*item.flat,item.scale);position.set(item.x,item.y,item.z);position.addScaledVector(gravel?item.normal:up,-bottom!*scale.y-(gravel?.014:.018));
          matrix.compose(position,rotation,scale);batch.mesh.setMatrixAt(i,matrix);
          color.setRGB(.88+item.tint*.18,.86+item.tint*.16,.77+item.tint*.19);batch.mesh.setColorAt(i,color);
        });
        batch.mesh.count=items.length;batch.mesh.instanceMatrix.needsUpdate=true;if(batch.mesh.instanceColor)batch.mesh.instanceColor.needsUpdate=true;batch.mesh.computeBoundingSphere();
      }
    }
  }
}
