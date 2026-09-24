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
await writeFile(resolve(root, 'sources.json'), JSON.stringify({ license: 'CC0-1.0', provider: 'Poly Haven', assets: ['https://polyhaven.com/a/kloppenheim_06_puresky'], files: sources }, null, 2));
