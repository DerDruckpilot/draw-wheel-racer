import type {MeshStandardMaterial} from 'three';

/** Offset sampling blends across cells without repeating the same recognizable
 * tile. Albedo, roughness and tangent normals share those offsets. */
export function naturalTerrain(material:MeshStandardMaterial){
  const winter=material.userData.winter??{value:0};material.userData.winter=winter;
  material.onBeforeCompile=shader=>{
    shader.uniforms.winter=winter;
    shader.vertexShader='varying vec3 groundPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPosition=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`varying vec3 groundPosition;uniform float winter;
      vec2 terrainHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
      vec4 terrainSample(sampler2D tex,vec2 uv){
        vec2 cell=floor(uv*.58),f=fract(uv*.58);f=f*f*(3.-2.*f);
        vec4 a=texture2D(tex,uv+terrainHash(cell)*7.);
        vec4 b=texture2D(tex,uv+terrainHash(cell+vec2(1,0))*7.);
        vec4 c=texture2D(tex,uv+terrainHash(cell+vec2(0,1))*7.);
        vec4 d=texture2D(tex,uv+terrainHash(cell+vec2(1,1))*7.);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 grain=terrainSample(map,vMapUv).rgb;
      float strata=sin(groundPosition.x*.16+sin(groundPosition.z*.21)*2.)*.5+sin(groundPosition.z*.34-groundPosition.x*.073)*.5;
      float dust=smoothstep(-.15,.8,strata)*.52;
      grain=mix(grain,vec3(.26,.205,.14),dust);
      diffuseColor.rgb*=grain*(.94+strata*.10);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.53,.59,.64)+diffuseColor.rgb*.25,winter);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#ifdef USE_NORMALMAP_TANGENTSPACE
      vec3 mapN=terrainSample(normalMap,vNormalMapUv).xyz*2.-1.;mapN.xy*=normalScale;normal=normalize(tbn*mapN);
      #endif`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`float roughnessFactor=roughness;
      #ifdef USE_ROUGHNESSMAP
      roughnessFactor*=terrainSample(roughnessMap,vRoughnessMapUv).g;
      #endif`);
  };
  material.customProgramCacheKey=()=> 'natural-terrain-112';
}
