import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune} from '@gltf-transform/functions';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {closeMeshBase} from './close-mesh-bases.mjs';
const root='public/assets/world/',manifest=JSON.parse(await readFile(root+'manifest.json','utf8')),io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const id of ['namaqualand_boulder_02','coast_rocks_05']){
  const doc=await io.read(root+id+'.glb');let added=0;
  for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives())added+=closeMeshBase(doc,primitive);
  if(!added){console.log(id,'already closed');continue;}
  await doc.transform(prune());await io.write(root+id+'.glb',doc);
  const positions=[],indices=[];for(const mesh of doc.getRoot().listMeshes())for(const primitive of mesh.listPrimitives()){
    const offset=positions.length/3;positions.push(...primitive.getAttribute('POSITION').getArray());indices.push(...Array.from(primitive.getIndices().getArray(),i=>i+offset));
  }
  await writeFile(root+id+'.collision.json',JSON.stringify({positions:positions.map(v=>+v.toFixed(6)),indices}));
  const item=manifest.find(a=>a.id===id),bytes=await readFile(root+id+'.glb');item.triangles=indices.length/3;item.bytes=bytes.length;item.sha256=createHash('sha256').update(bytes).digest('hex');item.changes+=' Scanned underside closed along the original boundary; matching render and collision triangles.';
  console.log(id,'closed with',added,'triangles');
}
await writeFile(root+'manifest.json',JSON.stringify(manifest,null,2));
