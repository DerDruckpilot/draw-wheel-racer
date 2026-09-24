import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorldLevel,WORLD_COUNT,worldHeight,localCoordinates,dist,basinWeight,insideCourt,makeTerrainTile,WORLD_TILE} from '../src/world-levels';

test('every pressure puzzle has a level approach and its hidden camps and caches remain unobstructed',()=>{
  for(let id=0;id<WORLD_COUNT;id++){
    const level=createWorldLevel(id);
    for(const plate of level.plates){
      assert.ok(level.features.some(f=>f.priority&&Math.abs(localCoordinates(plate,f.x,f.z).x+3.5)<.01&&Math.abs(localCoordinates(plate,f.x,f.z).z)<.01),`${id}: working area ${plate.id}`);
      for(const x of [-8,-5,0,2]){const height=worldHeight(level,plate.x+Math.cos(plate.yaw)*x,plate.z-Math.sin(plate.yaw)*x);assert.ok(Math.abs(height-plate.y)<.18,`${id}: uneven plate approach ${plate.id}`);}
    }
    for(const camp of level.camps){assert.ok(!level.basins.some(b=>basinWeight(b,camp.x,camp.z)<1.05),`${id}: submerged checkpoint`);assert.ok(!level.courts.some(c=>insideCourt(c,camp,2)),`${id}: checkpoint intersects a rock enclosure`);}
    for(const cache of level.caches)assert.ok(!level.props.some(p=>!p.foliage&&!p.movable&&p.asset.includes('rock')&&dist(p,cache)<p.scale*.28),`${id}: cache buried in a rock ${cache.id}`);
    const signals=new Set([...level.plates,...level.switches,...level.relays].map(s=>s.id));
    for(const gate of level.gates)for(const signal of gate.requires)assert.ok(signals.has(signal),`${id}: missing control ${signal}`);
    assert.equal(level.caches.filter(c=>c.kind==='cell').length,level.relays.reduce((n,r)=>n+r.requires.length,0),'every energy cell has a purpose');
  }
});
test('all terrain tiles have complete triangle coverage and exactly joined shared edges',()=>{
  for(const id of [0,1,4,13,20]){
    const level=createWorldLevel(id),tx=Math.floor(level.start.x/WORLD_TILE),tz=Math.floor(level.start.z/WORLD_TILE),a=makeTerrainTile(level,tx,tz),b=makeTerrainTile(level,tx+1,tz);
    assert.equal(Object.values(a.groups).reduce((n,v)=>n+v.length,0),WORLD_TILE*WORLD_TILE*6);
    assert.ok([...a.positions,...a.normals].every(Number.isFinite));
    for(let z=0;z<=WORLD_TILE;z++){const ai=(z*(WORLD_TILE+1)+WORLD_TILE)*3,bi=z*(WORLD_TILE+1)*3;assert.deepEqual(a.positions.slice(ai,ai+3),b.positions.slice(bi,bi+3));assert.deepEqual(a.normals.slice(ai,ai+3),b.normals.slice(bi,bi+3));}
  }
});
test('water has continuous containing banks and ice belongs to glacier environments',()=>{
  for(let id=0;id<WORLD_COUNT;id++){
    const level=createWorldLevel(id);
    for(const basin of level.basins){
      if(basin.material==='ice'){assert.equal(level.biome,'glacier');continue;}
      for(let n=0;n<36;n++){
        const angle=n*Math.PI/18,point=(r:number)=>{const x=Math.cos(angle)*basin.rx*r,z=Math.sin(angle)*basin.rz*r;return {x:basin.x+Math.cos(basin.angle)*x-Math.sin(basin.angle)*z,z:basin.z+Math.sin(basin.angle)*x+Math.cos(basin.angle)*z};};
        let lo=.8,hi=1.4;for(let i=0;i<18;i++){const r=(lo+hi)/2,p=point(r);if(basinWeight(basin,p.x,p.z)<1.085)lo=r;else hi=r;}
        const p=point((lo+hi)/2);assert.ok(worldHeight(level,p.x,p.z)>basin.level-.08,`${id}: open water edge ${basin.id} ${n}`);
      }
    }
  }
});
test('imported mobile assets retain their documented hashes and collision geometry',()=>{
  const manifest=JSON.parse(readFileSync('public/assets/world/manifest.json','utf8'));
  assert.ok(manifest.length>=30);
  for(const asset of manifest){
    const bytes=readFileSync('public/assets/world/'+asset.glb);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.id);assert.equal(bytes.length,asset.bytes);assert.equal(asset.license,'CC0-1.0');
    const collision=JSON.parse(readFileSync(`public/assets/world/${asset.id}.collision.json`,'utf8'));assert.ok(collision.positions.length>0);assert.ok(collision.positions.every(Number.isFinite));assert.ok(collision.indices.every((n:number)=>Number.isInteger(n)&&n>=0&&n<collision.positions.length/3));
    if(['rock_07','rock_09','namaqualand_boulder_02','namaqualand_boulder_03','coast_rocks_05'].includes(asset.id)){
      const vertices=Array.from({length:collision.positions.length/3},(_,i)=>collision.positions.slice(i*3,i*3+3).join(',')),edges=new Map<string,number>();
      for(let i=0;i<collision.indices.length;i+=3){const triangle=collision.indices.slice(i,i+3).map((n:number)=>vertices[n]);for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3];if(a===b)continue;const key=[a,b].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}}
      assert.ok(![...edges.values()].includes(1),`${asset.id}: a rock turned on a hillside must not expose an open scan underside`);
    }
  }
});
test('utility props and ground dressing stay in proportion to the 3.2 unit vehicle',()=>{
  const manifest=JSON.parse(readFileSync('public/assets/world/manifest.json','utf8'));
  const sizes=new Map<string,number[]>(manifest.map((a:any)=>[a.id,a.size]));
  for(let id=0;id<WORLD_COUNT;id++){
    const level=createWorldLevel(id),details=level.props.filter(p=>p.detail);
    assert.ok(details.length>600,`${id}: close ground detail is present`);
    assert.ok(details.every(p=>!p.movable&&p.mass===0&&p.scale<.7),'tiny dressing cannot create invisible collision barriers');
    for(const prop of level.props){
      const [x,y,z]=sizes.get(prop.asset)!.map(n=>n*prop.scale),longest=Math.max(x,y,z);
      if(prop.asset==='portable_generator')assert.ok(longest<.8&&y<.55,'a portable generator is much smaller than the vehicle');
      if(prop.asset==='barrel_03')assert.ok(y>=.58&&y<=.71&&x<.5,'a drum is below cabin height');
      if(prop.asset==='vintage_oil_lamp')assert.ok(y<.27,'the lamp has a hand-held scale');
      if(prop.asset==='wooden_picnic_table')assert.ok(longest<1.9,'camp furniture is not another vehicle');
      if(prop.asset==='pine_sapling_small')assert.ok(y<2.9,'saplings are smaller than mature trees');
      if(prop.asset==='wooden_ladder_02')assert.ok(y<=2.7,'ladders fit the surroundings');
    }
  }
});
