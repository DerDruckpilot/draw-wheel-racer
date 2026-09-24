import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,KHRTextureBasisu} from '@gltf-transform/extensions';
import {listTextureSlots} from '@gltf-transform/functions';
import {readFile,writeFile,mkdir,access,copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

// KTX-Software 4.4.2: https://github.com/KhronosGroup/KTX-Software/releases/tag/v4.4.2
// Encoding happens offline. The delivered game contains only the small Basis
// transcoder and textures that stay compressed in mobile GPU memory.
const executable=process.env.TOKTX_PATH??resolve('.local/tools/ktx/bin/toktx.exe');
const run=promisify(execFile),cache=resolve('.local/ktx-cache');await mkdir(cache,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function compress(bytes,color,normal=false){
  const metadata=await sharp(bytes).metadata(),uastc=normal||metadata.hasAlpha;
  const key=hash(Buffer.concat([Buffer.from(`${color}:${uastc}:v1`),Buffer.from(bytes)]));
  const png=resolve(cache,key+'.png'),output=resolve(cache,key+'.ktx2');
  if(!await access(output).then(()=>true).catch(()=>false)){
    await sharp(bytes).png().toFile(png);
    const options=['--t2','--genmipmap','--assign_oetf',color?'srgb':'linear','--encode',uastc?'uastc':'etc1s','--threads','2'];
    options.push(...(uastc?['--uastc_quality','2','--uastc_rdo_l',normal?'.5':'.7','--zcmp','18']:['--clevel','2','--qlevel','180']));
    await run(executable,[...options,output,png],{windowsHide:true,maxBuffer:1024*1024});
  }
  return readFile(output);
}
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),root=resolve('public/assets/world');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
const requested=process.argv.slice(2);
for(const item of manifest){
  if(requested.length&&!requested.includes(item.id))continue;
  const path=resolve(root,item.glb),doc=await io.read(path);
  for(const texture of doc.getRoot().listTextures()){
    if(texture.getMimeType()==='image/ktx2')continue;
    const slots=listTextureSlots(texture),color=slots.some(slot=>/baseColor|emissive|specularColor/.test(slot)),normal=slots.some(slot=>/normal/i.test(slot));
    const bytes=await compress(texture.getImage(),color,normal);texture.setImage(bytes).setMimeType('image/ktx2').setURI('');
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);await io.write(path,doc);
  const bytes=await readFile(path);item.bytes=bytes.length;item.sha256=hash(bytes);item.textureEncoding='KTX2: ETC1S colour/materials, UASTC normals/alpha, full mipmaps';
  console.log(item.id,Math.round(bytes.length/1024)+' KB');
  await writeFile(resolve(root,'manifest.json'),JSON.stringify(manifest,null,2));
}
if(!requested.length){
  const textures=JSON.parse(await readFile(resolve(root,'textures.json'),'utf8'));
  for(const item of textures)for(const map of ['color','normal','roughness']){
    const bytes=await readFile(resolve('.local/world-textures',item.id,map+'.webp'));
    await mkdir(resolve(root,item.id),{recursive:true});
    await writeFile(resolve(root,item.id,map+'.ktx2'),await compress(bytes,map==='color',map==='normal'));console.log(item.id,map);
  }
}
await mkdir('public/assets/basis',{recursive:true});
for(const file of ['basis_transcoder.js','basis_transcoder.wasm'])await copyFile('node_modules/three/examples/jsm/libs/basis/'+file,'public/assets/basis/'+file);
await copyFile('public/licenses/basis.txt','public/assets/basis/LICENSE.txt');
