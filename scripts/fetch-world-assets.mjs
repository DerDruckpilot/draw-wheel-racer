import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup, weld, prune, compactPrimitive} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {Matrix4, Matrix3, Vector3} from 'three';
import sharp from 'sharp';
import {mkdir, writeFile, readFile, access} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {closeMeshBase} from './close-mesh-bases.mjs';

// Originals are downloaded exclusively from Poly Haven's documented asset API.
// Mobile GLBs and collision meshes share precisely the same normalized geometry.
const selection = [
  ['rock_07', 2400], ['rock_09', 2400], ['namaqualand_boulder_02', 3000],
  ['namaqualand_boulder_03', 3000], ['coast_rocks_05', 4000],
  ['wooden_crate_01', 2200], ['barrel_03', 1800], ['old_military_crate', 2600],
  ['tree_stump_01', 3200], ['pine_sapling_small', 6500, 'pine_sapling_small', '^pine_sapling_small_a$'],
  ['pine_tree_01', 7000, 'pine_tree_01', '^pine_tree_01_a_LOD0$'],
  ['fern_02', 1400, 'fern_02', '^fern_02_b$', 512],
  ['grass_medium_01', 300, 'grass_medium_01', '^grass_medium_01_tall_a_LOD0$', 512],
  ['grass_clump', 850, 'grass_medium_01', '^grass_medium_01_mid_a_LOD0$', 512],
  ['grass_low', 1100, 'grass_medium_01', '^grass_medium_01_large_b_LOD0$', 512],
  ['wild_rooibos_bush', 2500, 'wild_rooibos_bush', '^wild_rooibos_bush_b$', 512], ['quiver_tree_01', 6500], ['dead_tree_trunk', 3200],
  ['tree_small_02', 6500], ['tree_stump_02', 2200],
  ['concrete_road_barrier', 2200], ['portable_generator', 4200],
  ['large_iron_gate', 4500], ['wooden_ladder_02', 2800], ['vintage_oil_lamp', 2400],
  ['wooden_pier', 5200, 'modular_wooden_pier', '^modular_wooden_pier_section_01$'],
  ['wooden_pier_worn', 4800, 'modular_wooden_pier', '^modular_wooden_pier_section_02$'],
  ['wooden_deck', 2800, 'modular_wooden_pier', '^modular_wooden_pier_section_01$', 1024, 'planks'],
  ['electricity_pole', 3000, 'modular_electricity_poles', '^preset_02_'],
  ['industrial_pipe', 2200, 'modular_industrial_pipes_01', '^modular_industrial_pipes_01_pipe01$'],
  ['industrial_valve', 3200, 'modular_industrial_pipes_01', '^modular_industrial_pipes_01_pipe08$'],
  ['nettle_plant', 1800, 'nettle_plant', '^nettle_plant_medium_b_LOD0$', 512],
  ['wooden_picnic_table', 4200],
  ['grass_medium_02', 1250, 'grass_medium_02', '^grass_medium_02_d$', 512],
  ['scrub_rooibos', 720, 'wild_rooibos_bush', '^wild_rooibos_bush_b$', 512],
  ['flower_gazania', 1250, 'flower_gazania', '^flower_gazania_h_LOD0$', 512],
];
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const catalog = await fetch('https://api.polyhaven.com/assets?t=models').then(r=>r.json());
const sourceRoot = resolve('.local/world-assets');
const outputRoot = resolve('public/assets/world');
await mkdir(outputRoot,{recursive:true});
const requested=process.argv.slice(2);
const manifest=requested.length?JSON.parse(await readFile(resolve(outputRoot,'manifest.json'),'utf8')).filter(a=>!requested.includes(a.id)):[];
for(const [id,budget,sourceId=id,nodePattern=null,textureSize=1024,materialPattern=null] of selection){
  if(requested.length&&!requested.includes(id))continue;
  const files=await fetch('https://api.polyhaven.com/files/'+sourceId).then(r=>r.json());
  const model=files.gltf?.['1k']?.gltf;
  if(!model)throw Error('No glTF model: '+id);
  const directory=resolve(sourceRoot,sourceId);
  await mkdir(directory,{recursive:true});
  const sources=[];
  for(const [name,file] of [['model.gltf',model],...Object.entries(model.include??{})]){
    const local=resolve(directory,name);
    if(!local.startsWith(directory+'\\')&&!local.startsWith(directory+'/'))throw Error('Asset path outside source directory');
    await mkdir(dirname(local),{recursive:true});
    if(!await access(local).then(()=>true).catch(()=>false)){
      const response=await fetch(file.url);if(!response.ok)throw Error(file.url+' '+response.status);
      await writeFile(local,new Uint8Array(await response.arrayBuffer()));
    }
    const buffer=await readFile(local);
    sources.push({file:name,url:file.url,sha256:createHash('sha256').update(buffer).digest('hex')});
  }
  const doc=await io.read(resolve(directory,'model.gltf'));
  // Poly Haven's JPEG glTF variants reference the colour photograph without
  // embedding the separately published alpha map. Reunite the channels before
  // simplifying or encoding, otherwise transparent leaves become black cards.
  for(const material of doc.getRoot().listMaterials())if(material.getAlphaMode()!=='OPAQUE'){
    const color=material.getBaseColorTexture();if(!color)continue;
    const candidates=Object.keys(files).filter(key=>/alpha/i.test(key)&&files[key]?.['1k']);
    const key=candidates.find(key=>key.toLowerCase()==='alpha')??candidates.find(key=>material.getName().includes(key.replace(/_alpha/i,'')))??(candidates.length===1?candidates[0]:null);
    if(!key)throw Error('Missing plant alpha map: '+id+' / '+material.getName());
    const alphaSource=files[key]['1k'].png??files[key]['1k'].jpg;
    const path=resolve(directory,'textures','mask-'+key+'.png');
    if(!await access(path).then(()=>true).catch(()=>false)){const response=await fetch(alphaSource.url);if(!response.ok)throw Error(alphaSource.url);await writeFile(path,new Uint8Array(await response.arrayBuffer()));}
    const alphaImage=await readFile(path),metadata=await sharp(color.getImage()).metadata();
    const alpha=await sharp(alphaImage).resize(metadata.width,metadata.height).removeAlpha().greyscale().raw().toBuffer();
    const rgb=await sharp(color.getImage()).removeAlpha().png().toBuffer();
    const rgba=await sharp(rgb).joinChannel(alpha,{raw:{width:metadata.width,height:metadata.height,channels:1}}).png().toBuffer();
    material.setBaseColorTexture(color.clone().setURI('alpha-combined-'+material.getName()+'.png').setImage(rgba).setMimeType('image/png')).setAlphaMode('MASK').setAlphaCutoff(.38);
    if(!sources.some(s=>s.url===alphaSource.url))sources.push({file:'textures/mask-'+key+'.png',url:alphaSource.url,sha256:createHash('sha256').update(alphaImage).digest('hex')});
  }
  await doc.transform(weld(),dedup(),prune());
  // Bake transforms so the renderer and Rapier use identical coordinate systems.
  const meshes=[];
  const scene=doc.getRoot().getDefaultScene()??doc.getRoot().listScenes()[0];
  for(const node of doc.getRoot().listNodes())if(node.getMesh()&&(!nodePattern||new RegExp(nodePattern).test(node.getName()))){
    const matrix=new Matrix4().fromArray(node.getWorldMatrix()),normal=new Matrix3().getNormalMatrix(matrix);
    const mesh=node.getMesh().clone();
    for(const original of mesh.listPrimitives()){
      if(materialPattern&&!new RegExp(materialPattern,'i').test(original.getMaterial()?.getName()??'')){mesh.removePrimitive(original);continue;}
      const primitive=original.clone();mesh.removePrimitive(original).addPrimitive(primitive);
      for(const semantic of ['POSITION','NORMAL']){
        const old=primitive.getAttribute(semantic);if(!old)continue;
        const a=old.clone(),array=new Float32Array(old.getArray());a.setArray(array);primitive.setAttribute(semantic,a);
        const v=new Vector3();
        for(let i=0;i<array.length;i+=3){v.fromArray(array,i);if(semantic==='POSITION')v.applyMatrix4(matrix);else v.applyMatrix3(normal).normalize();v.toArray(array,i);}
      }
      primitive.setAttribute('TANGENT',null);
    }
    if(mesh.listPrimitives().length)meshes.push(mesh);
  }
  if(!meshes.length)throw Error('No matching model variant: '+id+' / '+nodePattern);
  if(id==='wooden_deck'){
    // The source pier includes diagonal braces in its plank material. Select
    // the complete horizontal deck boards, not a squashed version of the pier.
    const bins=new Map();
    for(const mesh of meshes)for(const p of mesh.listPrimitives()){
      const a=p.getAttribute('POSITION').getArray(),idx=p.getIndices()?.getArray()??Uint32Array.from({length:a.length/3},(_,i)=>i);
      for(let i=0;i<idx.length;i+=3){const v=Array.from(idx.slice(i,i+3),n=>new Vector3().fromArray(a,n*3)),cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(cross.y<=Math.hypot(cross.x,cross.z)*3)continue;const y=(v[0].y+v[1].y+v[2].y)/3,key=Math.round(y/.04);bins.set(key,(bins.get(key)??0)+cross.y);}
    }
    const top=[...bins].sort((a,b)=>b[1]-a[1])[0][0]*.04;
    for(const mesh of meshes)for(const p of [...mesh.listPrimitives()]){
      const a=p.getAttribute('POSITION').getArray(),idx=p.getIndices()?.getArray()??Uint32Array.from({length:a.length/3},(_,i)=>i),keep=[];
      for(let i=0;i<idx.length;i+=3){const ids=Array.from(idx.slice(i,i+3));if(ids.every(n=>a[n*3+1]>=top-.24&&a[n*3+1]<=top+.055))keep.push(...ids);}
      if(!keep.length){mesh.removePrimitive(p);continue;}
      p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(keep)).setBuffer(p.getAttribute('POSITION').getBuffer()));compactPrimitive(p);
    }
  }
  for(const node of [...doc.getRoot().listNodes()])node.dispose();
  for(const mesh of meshes)scene.addChild(doc.createNode().setMesh(mesh));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of meshes)for(const p of mesh.listPrimitives()){
    const a=p.getAttribute('POSITION').getArray();
    for(let i=0;i<a.length;i++) {min[i%3]=Math.min(min[i%3],a[i]);max[i%3]=Math.max(max[i%3],a[i]);}
  }
  const size=max.map((v,i)=>v-min[i]);const center=min.map((v,i)=>(v+max[i])/2);
  // Unit longest dimension, geometric center at the origin.
  const scale=1/Math.max(...size);
  const total=meshes.reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount()),0),0);
  const canopyTree=['pine_tree_01','pine_sapling_small','tree_small_02'].includes(id);
  const woodTotal=meshes.reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+(/twig|leav/i.test(p.getMaterial()?.getName()??'')?0:(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())),0),0);
  let triangles=0;const collisionPositions=[],collisionIndices=[];
  for(const mesh of meshes)for(const p of mesh.listPrimitives()){
    const position=p.getAttribute('POSITION'),a=position.getArray();
    for(let i=0;i<a.length;i++)a[i]=(a[i]-center[i%3])*scale;
    let index=p.getIndices();
    if(!index){index=doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from({length:position.getCount()},(_,i)=>i)).setBuffer(position.getBuffer());p.setIndices(index);}
    const leaf=/twig|leav/i.test(p.getMaterial()?.getName()??'');
    const target=canopyTree&&leaf?300:Math.max(12,Math.floor(budget*3*index.getCount()/(canopyTree?woodTotal:total)/3)*3);
    if(index.getCount()>target){
      const [simplified]=MeshoptSimplifier.simplify(new Uint32Array(index.getArray()),new Float32Array(a),3,target,.012,['Permissive']);
      p.setIndices(index.clone().setArray(simplified));compactPrimitive(p);
    }
    if(id==='namaqualand_boulder_02'||id==='coast_rocks_05')closeMeshBase(doc,p);
    // Transparent leaf cards are not walls. Trees collide on their photographed
    // wood geometry; their foliage remains soft and can be driven through.
    const tree=/pine|quiver_tree|tree_small/.test(id),material=p.getMaterial();
    if(!tree||(material?.getAlphaMode()==='OPAQUE'&&!/leaf|leaves|twig/i.test(material?.getName()??''))){
      const base=collisionPositions.length/3;
      for(const value of p.getAttribute('POSITION').getArray())collisionPositions.push(value);
      for(const value of p.getIndices().getArray())collisionIndices.push(value+base);
    }
    triangles+=p.getIndices().getCount()/3;
  }
  for(const t of doc.getRoot().listTextures()){
    t.setImage(await sharp(t.getImage()).resize({width:textureSize,height:textureSize,fit:'inside',withoutEnlargement:true}).webp({quality:86,alphaQuality:96}).toBuffer()).setMimeType('image/webp');
  }
  await doc.transform(dedup(),prune());
  const copyright='Poly Haven / '+Object.keys(catalog[sourceId].authors).join(', ')+' · CC0-1.0 · Mobile adaptation for FORMDRIVE';
  doc.getRoot().getAsset().copyright=copyright;
  await io.write(resolve(outputRoot,id+'.glb'),doc);
  await writeFile(resolve(outputRoot,id+'.collision.json'),JSON.stringify({positions:collisionPositions.map(v=>+v.toFixed(6)),indices:collisionIndices}));
  const output=await readFile(resolve(outputRoot,id+'.glb'));
  manifest.push({id,name:catalog[sourceId].name,authors:catalog[sourceId].authors,license:'CC0-1.0',source:'https://polyhaven.com/a/'+sourceId,variant:nodePattern,glb:id+'.glb',size:size.map(v=>v*scale),triangles,bytes:output.length,sha256:createHash('sha256').update(output).digest('hex'),changes:'Selected asset variant; normalized coordinates; mesh simplification; embedded '+textureSize+'px WebP PBR textures; collision triangles from identical geometry.',originals:sources});
  await writeFile(resolve(outputRoot,'manifest.json'),JSON.stringify(manifest,null,2));
  console.log(id,triangles+' triangles',(output.length/1024).toFixed(0)+' KB');
}
