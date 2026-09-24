import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {compactPrimitive,dedup,prune} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {closeMeshBase} from './close-mesh-bases.mjs';

// Small gravel keeps the photographed shape and PBR maps of the imported rocks,
// but does not spend thousands of triangles on a pebble a few pixels across.
const root='public/assets/world/',io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const manifest=JSON.parse(await readFile(root+'manifest.json','utf8'));
await MeshoptSimplifier.ready;
for(const [id,sourceId] of [['gravel_01','rock_07'],['gravel_02','rock_09']]){
  const source=manifest.find(a=>a.id===sourceId),doc=await io.read(root+source.glb);
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const position=primitive.getAttribute('POSITION'),indices=primitive.getIndices();
    const [reduced]=MeshoptSimplifier.simplify(new Uint32Array(indices.getArray()),new Float32Array(position.getArray()),3,120*3,.12,['Permissive']);
    primitive.setIndices(indices.clone().setArray(reduced));compactPrimitive(primitive);
    closeMeshBase(doc,primitive);primitive.setAttribute('TANGENT',null);
  }
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives())for(const [i,v] of p.getAttribute('POSITION').getArray().entries()){min[i%3]=Math.min(min[i%3],v);max[i%3]=Math.max(max[i%3],v);}
  const size=max.map((v,i)=>v-min[i]),length=Math.max(...size),center=min.map((v,i)=>(v+max[i])/2);
  const positions=[],indices=[];
  for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
    const array=p.getAttribute('POSITION').getArray(),base=positions.length/3;
    for(let i=0;i<array.length;i++)array[i]=(array[i]-center[i%3])/length;
    positions.push(...array);indices.push(...Array.from(p.getIndices().getArray(),i=>i+base));
  }
  await doc.transform(dedup(),prune());await io.write(root+id+'.glb',doc);
  await writeFile(root+id+'.collision.json',JSON.stringify({positions:positions.map(v=>+v.toFixed(6)),indices}));
  const bytes=await readFile(root+id+'.glb');
  const record={...source,id,name:source.name+' · gravel detail',glb:id+'.glb',size:size.map(v=>v/length),triangles:indices.length/3,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),changes:source.changes+'; low polygon gravel derivative from '+sourceId+'; photographed textures retained; open scan base closed.'};
  const old=manifest.findIndex(a=>a.id===id);if(old<0)manifest.push(record);else manifest[old]=record;
  console.log(id,record.triangles+' triangles',Math.round(bytes.length/1024)+' KB');
}
await writeFile(root+'manifest.json',JSON.stringify(manifest,null,2));
