import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {Vector3} from 'three';

const root=resolve('public/assets/world'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
for(const id of process.argv.length>2?process.argv.slice(2):['pine_tree_01','pine_sapling_small','tree_small_02']){
  const folder=resolve('.local/tree-bakes',id),cards=JSON.parse(await readFile(resolve(folder,'cards.json'),'utf8'));
  const doc=await io.read(resolve(root,id+'.glb')),scene=doc.getRoot().getDefaultScene(),buffer=doc.getRoot().listBuffers()[0];
  // Replace destructively decimated leaves with slices of the untouched asset.
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())if(/twig|leav|canopy/i.test(p.getMaterial()?.getName()??''))mesh.removePrimitive(p);
  const width=640,height=640,composites=[];
  for(const [i,card] of cards.entries())composites.push({input:await sharp(resolve(folder,card.file)).resize(width,height).toBuffer(),left:i%3*width,top:Math.floor(i/3)*height});
  const atlas=await sharp({create:{width:width*3,height:height*3,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).webp({quality:91,alphaQuality:100}).toBuffer();
  const texture=doc.createTexture(id+' full-resolution foliage bake').setImage(atlas).setMimeType('image/webp');
  const material=doc.createMaterial(id+'_canopy').setBaseColorTexture(texture).setEmissiveTexture(texture).setEmissiveFactor([.28,.28,.28]).setAlphaMode('MASK').setAlphaCutoff(.32).setDoubleSided(true).setMetallicFactor(0).setRoughnessFactor(1);
  const vertices=[],normals=[],uv=[],indices=[];
  for(const [i,card] of cards.entries()){
    const center=new Vector3(...card.center),right=new Vector3(...card.right),up=new Vector3(...card.up),normal=new Vector3().crossVectors(right,up).normalize().multiplyScalar(.25).add(new Vector3(0,.75,0)).normalize();
    const base=vertices.length/3;
    for(const [x,y] of [[-1,-1],[1,-1],[1,1],[-1,1]]){vertices.push(...center.clone().addScaledVector(right,x).addScaledVector(up,y));normals.push(...normal);}
    const u=(i%3)/3,v=Math.floor(i/3)/3;
    uv.push(u,v+1/3,u+1/3,v+1/3,u+1/3,v,u,v);indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  const accessor=(type,array)=>doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',accessor('VEC3',new Float32Array(vertices))).setAttribute('NORMAL',accessor('VEC3',new Float32Array(normals))).setAttribute('TEXCOORD_0',accessor('VEC2',new Float32Array(uv))).setIndices(accessor('SCALAR',new Uint16Array(indices))).setMaterial(material);
  scene.addChild(doc.createNode(id+' canopy').setMesh(doc.createMesh().addPrimitive(primitive)));await doc.transform(prune());
  await io.write(resolve(root,id+'.glb'),doc);const bytes=await readFile(resolve(root,id+'.glb')),item=manifest.find(a=>a.id===id);
  item.bytes=bytes.length;item.sha256=createHash('sha256').update(bytes).digest('hex');item.triangles=doc.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);item.canopy='Nine orthographic depth slices baked from the original full-detail Poly Haven foliage; separate 3D wood mesh';
  console.log(id,item.triangles+' triangles',Math.round(bytes.length/1024)+' KB');
}
await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2));
