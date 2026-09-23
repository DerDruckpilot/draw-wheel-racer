import * as THREE from 'three';
import type { Simulation } from './physics';
import type { RouteLayout } from './route-layout';
import type { Machine, Soil } from './mechanics';
import { groundAt, type Water } from './courses';

const box=(w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;};
/** Small physical props share the course's wood/rock maps and route transform. */
export class MechanicsView {
  root=new THREE.Group();
  private machines:{machine:Machine;mesh:THREE.Group;cracks?:THREE.LineSegments;lamp?:THREE.Mesh}[]=[];
  private soilMeshes:{soil:Soil;mesh:THREE.Mesh;version:number}[]=[];
  private flags:{mesh:THREE.Group;index:number;mark:number}[]=[];
  private waterfalls:{water:Water;mesh:THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;foam:THREE.Points;data:Float32Array}[]=[];
  private cargo?:THREE.Group;
  private ballast?:THREE.Mesh;
  private ownMaterials:THREE.Material[]=[];
  constructor(private sim:Simulation,private layout:RouteLayout,rock:THREE.MeshStandardMaterial,wood:THREE.MeshStandardMaterial,ice:THREE.MeshStandardMaterial,mud:THREE.MeshStandardMaterial,rockTemplate:THREE.Group|null){
    const metal=new THREE.MeshStandardMaterial({color:0x364d47,metalness:.65,roughness:.55});
    const bronze=new THREE.MeshStandardMaterial({color:0xb99560,metalness:.55,roughness:.6});
    const rope=new THREE.MeshStandardMaterial({color:0x5b5742,roughness:1});this.ownMaterials.push(metal,bronze,rope);
    for(const m of sim.mechanics.machines){
      const s=m.spec,g=new THREE.Group(),base=new THREE.Group();let cracks:THREE.LineSegments|undefined,lamp:THREE.Mesh|undefined;
      if(s.kind==='loose'){
        const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(s.width/2,1),rock);stone.castShadow=true;g.add(stone);
      }else if(s.kind==='fragile'||s.kind==='breakice'){
        const slab=box(s.width,s.height,2.6,s.kind==='breakice'?ice:wood);
        if(s.kind==='breakice'){
          slab.geometry.dispose();slab.geometry=new THREE.BoxGeometry(s.width,s.height,2.6,5,1,4);
          const a=slab.geometry.attributes.position;for(let i=0;i<a.count;i++){const z=a.getZ(i),x=a.getX(i);if(Math.abs(z)>1.06){a.setZ(i,z+Math.sin(x*3.5+s.x)*.18);a.setX(i,x+Math.sin(z*4+x+s.x)*.11);}}slab.geometry.computeVertexNormals();
        }
        g.add(slab);
        const points:number[]=[];for(let j=0;j<5;j++){const x=-s.width*.4+j*s.width*.18;points.push(x,s.height/2+.009,-1.2,x+.17,s.height/2+.01,0,x+.17,s.height/2+.01,0,x-.11,s.height/2+.009,1.2);}
        const mat=new THREE.LineBasicMaterial({color:s.kind==='breakice'?0xebfbff:0x151e19,transparent:true,opacity:0});this.ownMaterials.push(mat);
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));cracks=new THREE.LineSegments(geo,mat);g.add(cracks);
        if(s.kind==='fragile')for(const z of [-1.2,1.2])base.add(box(.18,Math.max(.3,s.y-groundAt(sim.course,s.x,s.lateral??0)),.18,wood,0,-Math.max(.3,s.y-groundAt(sim.course,s.x,s.lateral??0))/2,z));
      }else if(s.kind==='plate'||s.kind==='counterweight'){
        g.add(box(s.width,s.height,2.45,s.kind==='plate'?bronze:wood));
        for(const z of [-1.08,1.08])g.add(box(s.width,.04,.09,metal,0,s.height/2+.03,z));
        if(s.kind==='counterweight'){
          g.add(box(.7,.58,1.5,rock,-1.8,-.4));
          base.add(new THREE.Mesh(new THREE.CylinderGeometry(.12,.45,.6,8),metal));
        }
        const lm=new THREE.MeshStandardMaterial({color:0xd1a65e,emissive:0x6b3913,emissiveIntensity:.35});this.ownMaterials.push(lm);
        lamp=new THREE.Mesh(new THREE.SphereGeometry(.1,10,6),lm);lamp.position.set(0,.24,-1.2);g.add(lamp);
      }else{
        g.add(box(s.width,s.height,2.8,wood));
        for(const y of [-s.height*.4,0,s.height*.4])g.add(box(s.width+.02,.1,2.82,metal,0,y));
        const floor=groundAt(sim.course,s.x,s.lateral??0),h=s.y+s.height/2-floor+(s.kind==='gate'?(s.travel??4.5):.1);
        for(const z of [-1.7,1.7]){base.add(box(.55,h,.55,rock,0,floor-s.y+h/2,z));base.add(box(.7,.25,.7,rock,0,floor-s.y+.1,z));}
        base.add(box(.3,.22,3.9,wood,0,floor-s.y+h));
        if(s.kind==='gate'){
          base.add(box(.45,1.2,.55,metal,0,2,-2.05));
          for(const z of [-1.38,1.38])g.add(box(.08,2,.08,rope,0,s.height/2+1,z));
        }
      }
      const depthScale=s.depth?(s.depth/(s.kind==='plate'||s.kind==='counterweight'?2.45:s.kind==='fragile'||s.kind==='breakice'?2.6:s.kind==='loose'?s.width:2.8)):1;g.scale.z=depthScale;base.scale.z=depthScale;this.place(base,s.x,s.y,1+(s.lateral??0));this.root.add(base,g);this.machines.push({machine:m,mesh:g,cracks,lamp});
    }
    for(const soil of sim.mechanics.soils){
      const geo=new THREE.BufferGeometry(),count=soil.segments.length*12;
      geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(count*2),2));
      const mesh=new THREE.Mesh(geo,mud);mesh.receiveShadow=true;this.root.add(mesh);this.soilMeshes.push({soil,mesh,version:-1});
    }
    (sim.course.masterRoutes??[]).forEach((route,index)=>route.marks.forEach((mark,j)=>{
      const flag=new THREE.Group(),mat=new THREE.MeshStandardMaterial({color:0xe6b65e,roughness:.7});this.ownMaterials.push(mat);
      flag.add(box(.06,1.3,.06,metal,0,-.4,0));const badge=box(.34,.34,.065,mat,0,.22,0);badge.rotation.z=Math.PI/4;flag.add(badge);
      this.place(flag,mark.x,mark.y,-.7+(route.lateral??0));this.root.add(flag);this.flags.push({mesh:flag,index,mark:j});
    }));
    for(const w of sim.course.waters)if(w.fall){
      const f=w.fall,mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 v;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=vec2(v.x*5.,v.y*7.+time*3.4);float n=noise(uv)*.65+noise(uv*2.7+vec2(time*.4,0))*.35;float mist=smoothstep(.47,.74,n);float bend=(noise(vec2(v.y*4.+time*.4,2.))-.5)*.09;float edge=1.-smoothstep(.29+(1.-v.y)*.1,.48,abs(v.x-.5+bend));gl_FragColor=vec4(mix(vec3(.23,.5,.53),vec3(.85,.94,.92),mist),edge*(.5+n*.42));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});this.ownMaterials.push(mat);
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(f.width,f.top-w.level,8,8),mat);this.place(mesh,f.x,(f.top+w.level)/2,-.55);this.root.add(mesh);
      // Anchored rocky lip and a continuous, bounded spray emitter.
      for(const [dx,z,width,height,depth] of [[0,-2.8,4.5,7,3.8],[-2,-4.0,4.5,5.3,4],[2.4,-4.3,4,4.7,4]]){
        const g=new THREE.Group();
        if(rockTemplate){const scan=rockTemplate.clone(true);scan.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry=o.geometry.clone();o.castShadow=true;o.receiveShadow=true;}});g.add(scan);}
        else g.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1,1),rock));
        const b=new THREE.Box3().setFromObject(g),size=b.getSize(new THREE.Vector3());g.scale.set(width/size.x,height/size.y,depth/size.z);g.updateMatrixWorld(true);const bottom=new THREE.Box3().setFromObject(g).min.y;
        this.place(g,f.x+dx,groundAt(sim.course,f.x+dx)-bottom-.25,z);this.root.add(g);
      }
      const data=new Float32Array(120*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(data,3));const foamMat=new THREE.PointsMaterial({color:0xe7faf5,size:.10,transparent:true,opacity:.6,depthWrite:false});this.ownMaterials.push(foamMat);const foam=new THREE.Points(geo,foamMat);this.root.add(foam);this.waterfalls.push({water:w,mesh,foam,data});
    }
    this.ballast=box(.65,.17,.6,metal);this.root.add(this.ballast);
    if(sim.mechanics.cargo){this.cargo=new THREE.Group();this.cargo.add(box(.86,.58,.9,wood));for(const x of [-.27,.27])this.cargo.add(box(.09,.61,.93,bronze,x));this.root.add(this.cargo);}
    this.update(0);
  }
  private place(object:THREE.Object3D,x:number,y:number,z=1,angle=0){const p=this.layout.point(x,z);object.position.set(p.x,y,p.z);object.rotation.set(0,p.yaw,angle,'YXZ');}
  update(time:number){
    for(const v of this.machines){const p=v.machine.body.translation();this.place(v.mesh,p.x,p.y,1+(v.machine.spec.lateral??0),v.machine.body.rotation());if(v.cracks)(v.cracks.material as THREE.LineBasicMaterial).opacity=Math.min(1,v.machine.damage*1.6);if(v.lamp){const mat=v.lamp.material as THREE.MeshStandardMaterial;const on=this.sim.mechanics.signals.has(v.machine.spec.signal!);mat.color.set(on?0xd9ee8e:0xd1a65e);mat.emissive.set(on?0x4a772a:0x6b3913);}}
    for(const v of this.soilMeshes)if(v.version!==v.soil.version){
      const a=v.mesh.geometry.attributes.position,u=v.mesh.geometry.attributes.uv;let i=0;
      for(const s of v.soil.segments)for(const [z0,z1] of [[1+(v.soil.water.lateral??0)-(v.soil.water.depth??4.1)/2,1+(v.soil.water.lateral??0)],[1+(v.soil.water.lateral??0),1+(v.soil.water.lateral??0)+(v.soil.water.depth??4.1)/2]]){
        for(const [p,z] of [[s.a,z0],[s.b,z0],[s.a,z1],[s.b,z0],[s.b,z1],[s.a,z1]] as const){const pos=this.layout.point(p.x,z);a.setXYZ(i,pos.x,p.y,pos.z);u.setXY(i++,p.x/5,z/5);}
      }
      a.needsUpdate=true;u.needsUpdate=true;v.mesh.geometry.computeVertexNormals();v.mesh.geometry.computeBoundingSphere();v.version=v.soil.version;
    }
    for(const f of this.flags){const mat=(f.mesh.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;mat.color.set(this.sim.mechanics.routeProgress[f.index]>f.mark?0xd9ee8e:0xe6b65e);}
    for(const fall of this.waterfalls){
      fall.mesh.material.uniforms.time.value=time;const f=fall.water.fall!;
      for(let i=0;i<fall.data.length/3;i++){const t=(time*.6+i*.071)%1,angle=i*2.4;const x=f.x+Math.cos(angle)*t*.9,z=-.35+Math.sin(angle)*t*1.2,p=this.layout.point(x,z);fall.data[i*3]=p.x;fall.data[i*3+1]=fall.water.level+.05+Math.sin(t*Math.PI)*.6;fall.data[i*3+2]=p.z;}fall.foam.geometry.attributes.position.needsUpdate=true;fall.foam.geometry.computeBoundingSphere();
    }
    const car=this.sim.cars[0],p=car.body.translation(),a=car.body.rotation();
    if(this.ballast)this.place(this.ballast,p.x+car.ballast*1.3*Math.cos(a),p.y+.1+car.ballast*1.3*Math.sin(a),1+car.lateral.offset,a);
    if(this.cargo&&this.sim.mechanics.cargo){const b=this.sim.mechanics.cargo.body,q=b.translation();this.place(this.cargo,q.x,q.y,1+car.lateral.offset,b.rotation());}
  }
  dispose(){this.root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments||o instanceof THREE.Points)o.geometry.dispose();});this.ownMaterials.forEach(m=>m.dispose());this.root.removeFromParent();}
}
