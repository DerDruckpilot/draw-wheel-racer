import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const requested=process.argv.slice(2);
const records=requested.length?JSON.parse(await readFile('public/assets/world/textures.json','utf8')).filter(t=>!requested.includes(t.id)):[];
for(const id of ['sandy_gravel','leaves_forest_ground','snow_02','brown_mud_03','brown_mud_rocks_01','aerial_rocks_02','aerial_ground_rock','rock_face_03','grass_ground']){
  if(requested.length&&!requested.includes(id))continue;
  const files=await fetch('https://api.polyhaven.com/files/'+id).then(r=>r.json());
  const info=await fetch('https://api.polyhaven.com/info/'+id).then(r=>r.json());
  await mkdir('.local/world-textures/'+id,{recursive:true});
  const record={id,source:'https://polyhaven.com/a/'+id,authors:info.authors,license:'CC0-1.0',files:[]};
  for(const [map,key] of [['color','Diffuse'],['normal','nor_gl'],['roughness','Rough']]){
    const source=files[key]['1k'].jpg??files[key]['1k'].png;
    const response=await fetch(source.url);if(!response.ok)throw Error(source.url);
    const raw=Buffer.from(await response.arrayBuffer());
    await writeFile('.local/world-textures/'+id+'/'+map+'.webp',await sharp(raw).webp({quality:88}).toBuffer());
    record.files.push({map,url:source.url,sha256:createHash('sha256').update(raw).digest('hex')});
  }
  records.push(record);console.log(id);
}
await writeFile('public/assets/world/textures.json',JSON.stringify(records,null,2));
