import {MeshStandardMaterial,Vector2,type Texture} from 'three';
import type {Biome} from './world-types';

export interface SurfaceMaps {color:Texture;normal:Texture;roughness:Texture}

/** World-space rock projection keeps cliffs detailed, even on vertical faces.
 * Two offset samples hide repeated ground tiles without blurring their grain. */
export function landscapeMaterial(base:SurfaceMaps,cliff:SurfaceMaps,grass:SurfaceMaps,macro:Texture,biome:Biome){
  const material=new MeshStandardMaterial({map:base.color,normalMap:base.normal,roughnessMap:base.roughness,
    normalScale:new Vector2(.85,.85),roughness:.98,vertexColors:true});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{rockMap:{value:cliff.color},rockNormal:{value:cliff.normal},grassMap:{value:grass.color},grassNormal:{value:grass.normal},macroMap:{value:macro}});
    shader.vertexShader='attribute float groundCover;varying float terrainCover;varying vec3 terrainPosition;varying vec3 terrainWorldNormal;\n'+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\nterrainCover=groundCover;terrainPosition=(modelMatrix*vec4(position,1.)).xyz;terrainWorldNormal=normalize(mat3(modelMatrix)*normal);');
    shader.fragmentShader=`varying float terrainCover;varying vec3 terrainPosition;varying vec3 terrainWorldNormal;
      uniform sampler2D rockMap;uniform sampler2D rockNormal;uniform sampler2D grassMap;uniform sampler2D grassNormal;uniform sampler2D macroMap;
      vec2 groundHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      vec4 groundSample(sampler2D tex,vec2 uv){
        float k=sin(uv.x*.23+sin(uv.y*.19)*2.)*.5+.5;
        return mix(texture2D(tex,uv),texture2D(tex,uv+vec2(.371,.683)),smoothstep(.15,.85,k));
      }
      vec3 rockProjection(sampler2D tex,vec3 p,vec3 weights){
        return texture2D(tex,p.zy).rgb*weights.x+texture2D(tex,p.xz).rgb*weights.y+texture2D(tex,p.xy).rgb*weights.z;
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 terrainN=normalize(terrainWorldNormal);
      vec3 projectionWeights=pow(abs(terrainN),vec3(5.));projectionWeights/=dot(projectionWeights,vec3(1.));
      float steepness=1.-smoothstep(.42,.83,abs(terrainN.y));
      vec2 soilUv=terrainPosition.xz*.31;
      vec3 groundGrain=groundSample(map,soilUv).rgb;
      float grassBlend=smoothstep(.15,.85,terrainCover)*(1.-steepness);
      groundGrain=mix(groundGrain,groundSample(grassMap,soilUv*.82).rgb,grassBlend);
      vec3 rockGrain=rockProjection(rockMap,terrainPosition*.24,projectionWeights);
      vec3 wideGrain=texture2D(macroMap,terrainPosition.xz*.021).rgb;
      float macroLuma=dot(wideGrain,vec3(.3,.59,.11));
      vec3 grain=mix(groundGrain,rockGrain,steepness);
      grain*=.76+macroLuma*.95;
      ${biome==='glacier'?'grain=mix(grain,groundGrain,1.-steepness);':''}
      diffuseColor.rgb*=grain;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      vec3 soilNormal=groundSample(normalMap,soilUv).xyz*2.-1.;
      soilNormal=mix(soilNormal,groundSample(grassNormal,soilUv*.82).xyz*2.-1.,grassBlend);
      vec3 rx=texture2D(rockNormal,terrainPosition.zy*.24).xyz*2.-1.;
      vec3 ry=texture2D(rockNormal,terrainPosition.xz*.24).xyz*2.-1.;
      vec3 rz=texture2D(rockNormal,terrainPosition.xy*.24).xyz*2.-1.;
      vec3 rockGradient=vec3(0.,rx.y,rx.x)*projectionWeights.x+vec3(ry.x,0.,ry.y)*projectionWeights.y+vec3(rz.x,rz.y,0.)*projectionWeights.z;
      vec3 worldGradient=mix(vec3(soilNormal.x,0.,soilNormal.y),rockGradient,steepness)*.72;
      worldGradient-=terrainN*dot(worldGradient,terrainN);
      normal=normalize(normal+mat3(viewMatrix)*worldGradient);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      float roughnessFactor=roughness*mix(groundSample(roughnessMap,soilUv).g,.92,steepness);
    `);
  };
  material.customProgramCacheKey=()=>`world-landscape-3-${biome}`;
  return material;
}
