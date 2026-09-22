// Optional, reproducible asset acquisition. Runtime uses the committed local files only.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
const root = resolve('public/assets');
const sources = [];
async function json(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'FORMDRIVE/1.0 (personal noncommercial game)' } });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return r.json();
}
async function download(info, local) {
  const r = await fetch(info.url);
  if (!r.ok) throw Error(`${r.status}: ${info.url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (info.md5 && createHash('md5').update(bytes).digest('hex') !== info.md5) throw Error(`Checksum mismatch: ${local}`);
  const path = resolve(root, local);
  if (!path.startsWith(root + '\\') && !path.startsWith(root + '/')) throw Error('Invalid asset path');
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes);
  sources.push({ local, url: info.url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(`${local}: ${(bytes.length / 1024).toFixed(0)} KB`);
}
await download((await json('https://api.polyhaven.com/files/kloppenheim_06_puresky')).hdri['1k'].hdr, 'sky.hdr');
for (const id of ['rock_face', 'rocky_terrain']) {
  const files = await json(`https://api.polyhaven.com/files/${id}`);
  for (const [key, suffix] of [['Diffuse', 'color'], ['nor_gl', 'normal'], ['rough', 'roughness']]) {
    const entry = files[key] || files[Object.keys(files).find(k => k.toLowerCase() === key.toLowerCase())] || (key === 'Diffuse' ? files.diff : null);
    if (!entry?.['1k']?.jpg) throw Error(`Missing ${id}/${key}`);
    await download(entry['1k'].jpg, `${id}/${suffix}.jpg`);
  }
}
const rock = (await json('https://api.polyhaven.com/files/boulder_01')).gltf['1k'].gltf;
await download(rock, 'boulder/boulder.gltf');
for (const [name, info] of Object.entries(rock.include)) await download(info, `boulder/${name}`);
await writeFile(resolve(root, 'sources.json'), JSON.stringify({ license: 'CC0-1.0', provider: 'Poly Haven', assets: ['https://polyhaven.com/a/rock_face', 'https://polyhaven.com/a/rocky_terrain', 'https://polyhaven.com/a/boulder_01', 'https://polyhaven.com/a/kloppenheim_06_puresky'], files: sources }, null, 2));
