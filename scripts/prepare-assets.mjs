import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, compactPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readFile, mkdir, rename, stat, access } from 'node:fs/promises';
import { resolve } from 'node:path';
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const originalsPresent = await access('public/assets/boulder/boulder.gltf').then(() => true).catch(() => false);
const doc = await io.read(originalsPresent ? 'public/assets/boulder/boulder.gltf' : '.local/source-boulder/boulder.gltf');
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .045, error: .025 }), prune());
// Scanned UV islands constrain ordinary decimation. This background LOD permits
// seam simplification while retaining the scanned positions and original maps.
for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
  const index = primitive.getIndices(), position = primitive.getAttribute('POSITION');
  const [reduced] = MeshoptSimplifier.simplify(new Uint32Array(index.getArray()), new Float32Array(position.getArray()), 3, 24000, .04, ['Permissive']);
  primitive.setIndices(doc.createAccessor().setType('SCALAR').setArray(reduced).setBuffer(index.getBuffer()));
  compactPrimitive(primitive);
  console.log('Boulder triangles:', reduced.length / 3);
}
await doc.transform(prune());
await io.write('public/assets/boulder.glb', doc);
console.log('Optimized boulder bytes', (await stat('public/assets/boulder.glb')).size);
// Keep originals out of the offline payload. Both verified paths are inside this project.
const project = resolve('.'), src = resolve('public/assets/boulder'), dest = resolve('.local/source-boulder');
if (!src.startsWith(project + '/') && !src.startsWith(project + '\\')) throw Error('Invalid source');
if (!dest.startsWith(project + '/') && !dest.startsWith(project + '\\')) throw Error('Invalid destination');
await mkdir(resolve('.local'), { recursive: true });
if (originalsPresent) {
  const exists = await access(dest).then(() => true).catch(() => false);
  const archive = exists ? dest + '-' + Date.now() : dest;
  if (!archive.startsWith(project + '/') && !archive.startsWith(project + '\\')) throw Error('Invalid archive');
  await rename(src, archive);
}
const icon = await readFile('public/favicon.svg');
await mkdir('public/icons', { recursive: true });
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) await sharp(icon).resize(size, size).png().toFile(`public/icons/${file}`);
await sharp(icon).resize(360, 360).extend({ top: 76, bottom: 76, left: 76, right: 76, background: '#18201e' }).png().toFile('public/icons/maskable-512.png');
