import {InstancedMesh,PlaneGeometry,MeshBasicMaterial,InstancedBufferAttribute,Matrix4,Quaternion,Vector3,DynamicDrawUsage} from 'three';
import {groundType,basinWeight} from './world-levels';
import type {WorldSimulation,Wheel3D} from './world-physics';

/** Faint marks from actual tyre/ground contacts. They help recognize a recently
 * explored turn without revealing anything on the radar or adding a map. */
export class WheelTrails {
  readonly mesh:InstancedMesh;
  private readonly capacity=2048;
  private readonly alpha=new Float32Array(this.capacity);
  private readonly born=new Float64Array(this.capacity);
  private readonly strength=new Float32Array(this.capacity);
  private next=0;
  private last=new WeakMap<Wheel3D,Vector3>();
  constructor(){
    const geometry=new PlaneGeometry(1,1),material=new MeshBasicMaterial({color:0x382b1b,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    geometry.setAttribute('trackOpacity',new InstancedBufferAttribute(this.alpha,1).setUsage(DynamicDrawUsage));
    material.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float trackOpacity;varying float tyreAlpha;varying vec2 tyreUv;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntyreAlpha=trackOpacity;tyreUv=uv;');
      shader.fragmentShader='varying float tyreAlpha;varying vec2 tyreUv;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        vec2 p=tyreUv*2.-1.;
        float feather=1.-smoothstep(.42,1.,dot(p,p));
        diffuseColor.a*=tyreAlpha*feather;
        if(diffuseColor.a<.008)discard;
      `);
    };
    this.mesh=new InstancedMesh(geometry,material,this.capacity);this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.renderOrder=1;
  }
  clear(){this.mesh.count=0;this.next=0;this.alpha.fill(0);this.last=new WeakMap();}
  update(sim:WorldSimulation){
    let changed=false;
    for(const wheel of sim.wheels){
      const contact=wheel.contactPoint;if(!contact||wheel.load<18)continue;
      const point=new Vector3().copy(contact),previous=this.last.get(wheel);
      if(previous&&point.distanceToSquared(previous)<.18)continue;
      const ground=sim.surfaceHeight(point.x,point.z),material=groundType(sim.level,point.x,point.z);
      if(Math.abs(point.y-ground)>.14||material==='ice')continue;
      if(sim.level.basins.some(b=>b.material==='water'&&basinWeight(b,point.x,point.z)<1.02&&(sim.basinLevels.get(b.id)??b.level)>point.y+.1))continue;
      const normal=new Vector3(sim.surfaceHeight(point.x-.2,point.z)-sim.surfaceHeight(point.x+.2,point.z),.4,sim.surfaceHeight(point.x,point.z-.2)-sim.surfaceHeight(point.x,point.z+.2)).normalize();
      if(normal.y<.68)continue;
      const forward=new Vector3(1,0,0).applyQuaternion(new Quaternion().copy(wheel.knuckle.rotation()));forward.addScaledVector(normal,-forward.dot(normal)).normalize();
      const right=forward.clone().cross(normal).normalize(),rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,forward,normal));
      point.y=ground;point.addScaledVector(normal,.022);
      const matrix=new Matrix4().compose(point,rotation,new Vector3(.24*wheel.size,.55,1)),index=this.next++%this.capacity;
      this.mesh.setMatrixAt(index,matrix);this.born[index]=sim.elapsed;this.strength[index]=material==='mud'?.38:sim.level.biome==='glacier'?.10:.19;
      this.mesh.count=Math.min(this.next,this.capacity);this.last.set(wheel,point);changed=true;
    }
    for(let i=0;i<this.mesh.count;i++)this.alpha[i]=this.strength[i]*Math.max(0,1-(sim.elapsed-this.born[i])/110);
    this.mesh.geometry.attributes.trackOpacity.needsUpdate=true;if(changed)this.mesh.instanceMatrix.needsUpdate=true;
  }
}
