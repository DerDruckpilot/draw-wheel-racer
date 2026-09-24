import * as THREE from 'three';
import type {Basin} from './world-types';

/** Small waves use the same displaced mesh as buoyancy. Fine surface normals,
 * depth colour, a continuous shoreline and wheel wakes are shading only. */
export function worldWaterMaterial(basin:Basin,bathymetry:THREE.DataTexture,sky:THREE.Texture,eye:THREE.Vector3,sediment:{color:THREE.Texture;normal:THREE.Texture}){
  const mud=basin.material==='mud';
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    uniforms:{time:{value:0},baseLevel:{value:basin.level},mud:{value:mud?1:0},sky:{value:sky},eye:{value:eye},sedimentColor:{value:sediment.color},sedimentNormal:{value:sediment.normal},bathymetry:{value:bathymetry},flow:{value:new THREE.Vector2(basin.current.x,basin.current.z)},forward:{value:new THREE.Vector2(1,0)},wakes:{value:Array.from({length:4},()=>new THREE.Vector4(-1000,-1000,0,0))},fogColor:{value:new THREE.Color()},fogNear:{value:0},fogFar:{value:1}},
    vertexShader:`varying vec3 liquidWorld;varying vec2 liquidUv;
      #include <fog_pars_vertex>
      void main(){vec4 world=modelMatrix*vec4(position,1.);liquidWorld=world.xyz;liquidUv=uv;vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`varying vec3 liquidWorld;varying vec2 liquidUv;
      uniform float time;uniform float baseLevel;uniform float mud;uniform vec2 flow;uniform vec2 forward;uniform vec3 eye;uniform sampler2D sky;uniform sampler2D bathymetry;uniform sampler2D sedimentColor;uniform sampler2D sedimentNormal;uniform vec4 wakes[4];
      #include <fog_pars_fragment>
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      float ripple(vec2 p,float t){return noise(p*.75+vec2(t*.14,-t*.09))*.56+noise(p*1.8+vec2(-t*.22,t*.15))*.3+noise(p*4.7+t*.2)*.14;}
      void main(){
        vec2 shore=(liquidUv*2.-1.)*1.24;
        float radius=length(shore)*(1.+.027*sin(shore.x*6.+shore.y*3.)+.023*sin(shore.y*8.-shore.x*4.));
        if(radius>1.085)discard;
        float depth=texture2D(bathymetry,liquidUv).r*16.-8.+liquidWorld.y-baseLevel;
        if(depth<.016)discard;
        float rate=mix(1.,.12,mud),t=time*rate;vec2 p=liquidWorld.xz,moving=p-flow*t*.5;
        float h=ripple(moving,t),e=.07;
        vec3 geometric=normalize(cross(dFdx(liquidWorld),dFdy(liquidWorld)));if(geometric.y<0.)geometric=-geometric;
        vec3 normal=normalize(geometric+vec3((h-ripple(moving+vec2(e,0.),t))*3.2,0.,(h-ripple(moving+vec2(0.,e),t))*3.2));
        vec2 mudUv=p*.32-flow*t*.012;
        if(mud>.5){vec3 relief=texture2D(sedimentNormal,mudUv).rgb*2.-1.;normal=normalize(normal+vec3(relief.x,0.,relief.y)*.25);}
        vec3 view=normalize(eye-liquidWorld),reflection=reflect(-view,normal);
        vec2 env=vec2(atan(reflection.z,reflection.x)*.159154943+.5,asin(clamp(reflection.y,-1.,1.))*.318309886+.5);
        vec3 skyColor=texture2D(sky,env).rgb;skyColor=skyColor/(1.+max(skyColor.r,max(skyColor.g,skyColor.b)))*1.2;
        float fresnel=.035+.965*pow(1.-max(dot(normal,view),0.),5.);
        vec3 water=mix(vec3(.025,.26,.23),vec3(.003,.095,.105),smoothstep(.05,2.5,depth))*(.93+h*.19);
        float spec=pow(max(dot(normal,normalize(view+normalize(vec3(-.5,.9,.5)))),0.),100.);
        vec3 color=mix(water,skyColor,clamp(fresnel*.9+.025,0.,.78))+vec3(spec*.32);
        float edge=(1.-smoothstep(.025,.24,depth))*smoothstep(.016,.055,depth);
        float foam=edge*(.3+noise(p*5.-t*.2)*.4),rut=0.;
        for(int i=0;i<4;i++){
          vec2 d=p-wakes[i].xy;float along=dot(d,forward),across=dot(d,vec2(-forward.y,forward.x)),behind=1.-smoothstep(-.3,.6,along);
          float trail=exp(-abs(along)*.65)*exp(-pow(across/(.24+max(0.,-along)*.09),2.))*behind;
          float churn=smoothstep(.3,.75,noise(vec2(along*4.+t*3.,across*6.)));
          foam+=trail*churn*wakes[i].z*.75;rut+=trail*wakes[i].z;
        }
        if(mud>.5){
          vec3 soil=texture2D(sedimentColor,mudUv).rgb;
          color=mix(mix(vec3(.03,.017,.008),vec3(.105,.064,.027),h),soil*.36,.62)*(.95-min(.42,rut*.18));
          color=mix(color,skyColor,clamp(fresnel*.2,0.,.16))+vec3(.22,.16,.09)*spec*.5;
          color+=vec3(.045,.029,.014)*min(.7,foam);
        }
        else color=mix(color,vec3(.72,.86,.83),clamp(foam,0.,.83));
        gl_FragColor=vec4(color,mix(mix(.6,.97,smoothstep(.02,1.4,depth)),.99,mud)*smoothstep(.016,.13,depth)*(1.-smoothstep(1.055,1.085,radius)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  material.addEventListener('dispose',()=>bathymetry.dispose());return material;
}
