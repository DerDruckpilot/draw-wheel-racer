import {clamp} from './shapes';
import {propScale} from './world-scale';
import type {V2,V3,WorldLevel,WorldProp,Biome,Trail,Basin,Ground,TerrainTile,TerrainFeature,RockCourt} from './world-types';

// Every expedition has its own fixed seed, terrain arrangement and puzzle recipe.
// Trails shape the landscape; they never constrain the vehicle or switch colliders.
export const WORLD_LEVELS=[
  ['Das vergessene Tal','canyon','weight',173],['Wurzeln und Umwege','forest','balance',409],
  ['Die stille Bucht','coast','sluice',887],['Zwischen den Findlingen','canyon','double',1409],
  ['Hinter dem Gletscher','glacier','weight',1871],['Der versunkene Steinbruch','quarry','lift',2311],
  ['Im Farnlabyrinth','forest','relay',3011],['Die Gezeitenhöfe','coast','sluice',3527],
  ['Unter den Felsnadeln','canyon','balance',4201],['Das Eisarchiv','glacier','double',4787],
  ['Gegengewicht','quarry','balance',5501],['Der lange Rückweg','forest','relay',6073],
  ['Die schwarze Küste','coast','double',6833],['Verlorene Höhen','canyon','lift',7331],
  ['Die weißen Inseln','glacier','sluice',8011],['Das verlassene Depot','quarry','relay',8501],
  ['Tief im Wurzelwald','forest','double',9221],['Drei verschlossene Täler','canyon','relay',10007],
  ['Das Gegengezeitenwerk','coast','sluice',10837],['Am Rand des Eises','glacier','lift',11369],
  ['Das letzte Lager','quarry','double',12203],
] as const;
export const WORLD_COUNT=WORLD_LEVELS.length;
export const WORLD_TILE=24, WORLD_CELLS=24;
export const smooth=(t:number)=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export function randomSource(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
export const dist=(a:V2,b:V2)=>Math.hypot(a.x-b.x,a.z-b.z);
export function basinCoordinates(b:Basin,x:number,z:number){const co=Math.cos(b.angle),si=Math.sin(b.angle),dx=x-b.x,dz=z-b.z;return {u:(co*dx+si*dz)/b.rx,v:(-si*dx+co*dz)/b.rz};}
export function basinWeight(b:Basin,x:number,z:number){const {u,v}=basinCoordinates(b,x,z);return Math.hypot(u,v)*(1+.027*Math.sin(u*6+v*3)+.023*Math.sin(v*8-u*4));}
export function noise(x:number,z:number,seed:number){return Math.sin(x*.119+seed)*Math.sin(z*.107-seed*.4)*.58+Math.sin(x*.347+z*.269+seed)*.21+Math.sin(x*.67-z*.553)*.10;}
type Segment={a:V3;dx:number;dz:number;dy:number;length2:number;width:number;rugged:number};
const trailIndices=new WeakMap<WorldLevel,{count:number;grid:Map<string,Segment[]>}>();
function trailIndex(level:WorldLevel){
  const existing=trailIndices.get(level);if(existing?.count===level.trails.length)return existing.grid;
  const grid=new Map<string,Segment[]>(),cell=24;
  for(const trail of level.trails)for(let i=1;i<trail.points.length;i++){
    const a=trail.points[i-1],b=trail.points[i],dx=b.x-a.x,dz=b.z-a.z;
    const segment={a,dx,dz,dy:b.y-a.y,length2:Math.max(.00001,dx*dx+dz*dz),width:trail.width,rugged:trail.rugged},margin=trail.width*.5+8;
    for(let z=Math.floor((Math.min(a.z,b.z)-margin)/cell);z<=Math.floor((Math.max(a.z,b.z)+margin)/cell);z++)for(let x=Math.floor((Math.min(a.x,b.x)-margin)/cell);x<=Math.floor((Math.max(a.x,b.x)+margin)/cell);x++){
      const key=x+','+z,list=grid.get(key)??[];list.push(segment);grid.set(key,list);
    }
  }
  trailIndices.set(level,{count:level.trails.length,grid});return grid;
}
export function nearestTrail(level:WorldLevel,x:number,z:number){
  let distance=Infinity,y=0,width=4,rugged=0;
  for(const segment of trailIndex(level).get(Math.floor(x/24)+','+Math.floor(z/24))??[]){
    const {a,dx,dz,dy,length2}=segment,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/length2,0,1);
    const d=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
    if(d<distance){distance=d;y=a.y+dy*t;width=segment.width;rugged=segment.rugged;}
  }
  return {distance,y,width,rugged};
}
export function localCoordinates(p:V2&{yaw:number},x:number,z:number){const co=Math.cos(p.yaw),si=Math.sin(p.yaw),dx=x-p.x,dz=z-p.z;return {x:co*dx-si*dz,z:si*dx+co*dz};}
export function rotatedPoint(p:V3,yaw:number,x:number,z:number):V3{const co=Math.cos(yaw),si=Math.sin(yaw);return {x:p.x+co*x+si*z,y:p.y,z:p.z-si*x+co*z};}
export function insideCourt(c:RockCourt,p:V2,margin=0){const q=localCoordinates(c,p.x,p.z);return Math.abs(q.x)<c.width*.5+margin&&q.z>-margin&&q.z<c.depth+margin;}
export function worldHeight(level:WorldLevel,x:number,z:number){
  const near=nearestTrail(level,x,z);
  let ground=1.7+noise(x*.5,z*.5,level.seed)*1.3;
  for(const h of level.hills){
    const co=Math.cos(h.angle),si=Math.sin(h.angle),dx=x-h.x,dz=z-h.z;
    const d=Math.hypot((co*dx+si*dz)/h.radius,(-si*dx+co*dz)/(h.radius*h.stretch));
    ground+=h.height*Math.exp(-d*d*1.9);
  }
  const road=near.y+noise(x,z,level.seed)*near.rugged;
  ground=road+(ground-road)*smooth((near.distance-near.width*.5)/5.7);
  // Outside the authored area the landscape continues, without a clipping wall.
  const outer=Math.max(Math.abs(x),Math.abs(z))-level.extent;
  ground+=smooth(outer/38)*(8+noise(x*.3,z*.3,level.seed)*5);
  for(const feature of level.features??[]){
    if(feature.kind==='shelf'||feature.priority)continue;
    const p=localCoordinates(feature,x,z),edgeX=1-smooth((Math.abs(p.x)-feature.length*.5)/2.2),edgeZ=1-smooth((Math.abs(p.z)-feature.width*.5)/2.8),blend=edgeX*edgeZ;
    if(blend<=0)continue;
    const u=p.x+Math.sin(p.z*.43+feature.phase)*.55+p.z*.13;
    if(feature.kind==='pad'){
      ground=ground*(1-blend)+(feature.y+noise(x,z,level.seed)*.018)*blend;
    }else if(feature.kind==='terraces'){
      const rise=(smooth((u+feature.length*.35)/.65)+smooth((u+feature.length*.1)/.55)+smooth((u-feature.length*.16)/.65))/3;
      const exit=1-smooth((p.x-feature.length*.3)/(feature.length*.3));
      ground+=feature.height*rise*exit*blend;
    }else if(feature.kind==='ravine'){
      const cut=1-smooth((Math.abs(u)-feature.length*.2)/(feature.length*.15));
      ground-=feature.height*cut*edgeZ;
    }else if(feature.kind==='ridge'){
      ground+=feature.height*Math.exp(-(((p.z+Math.sin(p.x*.32)*.8)/1.7)**2))*edgeX*edgeZ;
    }else{
      ground+=feature.height*(Math.sin(u*1.4+feature.phase)*.52+Math.sin(u*.81-p.z*.93)*.3)*blend;
    }
  }
  for(const b of level.basins){
    const radius=basinWeight(b,x,z),blend=1-smooth((radius-.7)/.4);
    const bed=b.material==='ice'?b.level+(x-b.x)*(b.slope?.x??0)+(z-b.z)*(b.slope?.z??0)+Math.sin((x-b.x)*.9+Math.sin((z-b.z)*.7))*.08:b.bottom;
    if(blend>0)ground=ground*(1-blend)+(bed+noise(x,z,level.seed)*(b.material==='ice'?.025:.13))*blend;
    if(b.accessSide){
      // A broad, submerged gravel tongue becomes the way out after draining.
      // The rest of the basin keeps its steep banks; this is actual terrain,
      // shared by the rendered mesh and the wheel contacts.
      const {u,v}=basinCoordinates(b,x,z),along=u*b.accessSide;
      const ramp=smooth(along/.18)*(1-smooth((along-1.08)/.14))*(1-smooth((Math.abs(v)*b.rz-2.8)/2));
      const height=b.bottom+(b.level+.24-b.bottom)*smooth(along/1.12);
      ground+=(height-ground)*ramp;
    }
    if(b.material!=='ice'){
      const bank=1-smooth((Math.abs(radius-1.1)-.04)/.18),rim=b.level+(b.material==='mud'?.10:.24);
      if(bank>0)ground+=(Math.max(ground,rim)-ground)*bank;
    }
  }
  // Raised landings are solid islands, even when a river surrounds their base.
  for(const f of level.features??[])if(f.kind==='shelf'){
    const p=localCoordinates(f,x,z),blend=(1-smooth((Math.abs(p.x)-f.length*.5)/1.05))*(1-smooth((Math.abs(p.z)-f.width*.5)/1.05));
    if(blend>0)ground=ground*(1-blend)+(f.y+f.height+noise(x,z,level.seed)*.018)*blend;
  }
  // U-shaped outcrops surround the supply caches. Their only gentle entrance is
  // the physical gate; the steep exterior remains a real, climbable rock face.
  for(const court of level.courts??[]){
    const local=localCoordinates(court,x,z),dz=local.z,dx=local.x-Math.sin(Math.max(0,dz)*.23)*court.bend;
    const halfWidth=court.width*.5+Math.sin(dz*.34+court.bend)*.6;
    const side=Math.exp(-(((Math.abs(dx)-halfWidth)/2.35)**2))*(smooth((dz+2)/3)*(1-smooth((dz-court.depth)/3)));
    const back=Math.exp(-(((dz-court.depth-Math.cos(dx*.42)*.6)/2.8)**2))*(1-smooth((Math.abs(dx)-halfWidth)/3));
    const floorBlend=(1-smooth((Math.abs(dx)-court.width*.5-1)/4))*(smooth((dz+5)/4)*(1-smooth((dz-court.depth-1)/4)));
    const base=court.y+Math.max(side,back)*court.height*(.97+noise(x*.5,z*.5,level.seed)*.05);
    ground=ground*(1-floorBlend)+base*floorBlend;
  }
  // Keep the deliberately authored working area of a puzzle intact when a
  // later camp spur, outcrop or river modifies the surrounding landscape.
  for(const f of level.features??[])if(f.priority){
    const p=localCoordinates(f,x,z),blend=(1-smooth((Math.abs(p.x)-f.length*.5)/3.4))*(1-smooth((Math.abs(p.z)-f.width*.5)/3.4));
    if(blend>0)ground=ground*(1-blend)+(f.y+noise(x,z,level.seed)*.018)*blend;
  }
  return ground;
}
export function groundType(level:WorldLevel,x:number,z:number):Ground{
  for(const b of level.basins)if(b.accessSide&&basinWeight(b,x,z)<1.22)return 'gravel';
  for(const b of level.basins)if(basinWeight(b,x,z)<.99){if(b.material==='ice')return 'ice';if(b.material==='mud')return 'mud';}
  return level.biome==='glacier'?'stone':level.biome==='forest'?'soil':'stone';
}
export function makeTerrainTile(level:WorldLevel,tx:number,tz:number):TerrainTile{
  const positions:number[]=[],normals:number[]=[],uv:number[]=[],colors:number[]=[],cover:number[]=[],indices:number[]=[];
  const groups:Record<Ground,number[]>={stone:[],soil:[],ice:[],mud:[],gravel:[]};
  // A one-vertex apron shares exact samples across tile boundaries. Normals
  // follow the actual metre-spaced mesh instead of evaluating the complete
  // landscape five times at every vertex just for sub-grid derivatives.
  const stride=WORLD_CELLS+3,heights=new Float64Array(stride*stride);
  for(let z=-1;z<=WORLD_CELLS+1;z++)for(let x=-1;x<=WORLD_CELLS+1;x++)heights[(z+1)*stride+x+1]=worldHeight(level,tx*WORLD_TILE+x,tz*WORLD_TILE+z);
  for(let z=0;z<=WORLD_CELLS;z++)for(let x=0;x<=WORLD_CELLS;x++){
    const sample=(z+1)*stride+x+1,wx=tx*WORLD_TILE+x,wz=tz*WORLD_TILE+z,y=heights[sample];
    positions.push(wx,y,wz);uv.push(wx/5,wz/5);
    const nx=(heights[sample-1]-heights[sample+1])/2,nz=(heights[sample-stride]-heights[sample+stride])/2;
    const magnitude=Math.hypot(nx,1,nz),slope=Math.hypot(nx,nz);normals.push(nx/magnitude,1/magnitude,nz/magnitude);
    const variation=.85+noise(wx*.45,wz*.45,level.seed)*.18;
    const biome=level.biome;
    const tint=biome==='glacier'?[.91,.95,1]:biome==='forest'?[.94,1,.9]:biome==='coast'?[1,.96,.87]:biome==='quarry'?[.95,.97,1]:[1,.91,.8];
    const frost=biome==='glacier'?clamp(.6-slope*.32,0,.65):0;
    colors.push(...tint.map(c=>(c*variation)*(1-frost)+frost));
    const near=nearestTrail(level,wx,wz),verge=smooth((near.distance-near.width*.37)/3.1),patch=.66+noise(wx*.38,wz*.38,level.seed)*.7;
    cover.push((biome==='forest'?1:biome==='coast'?.55:0)*verge*clamp(patch,0,1));
  }
  for(let z=0;z<WORLD_CELLS;z++)for(let x=0;x<WORLD_CELLS;x++){
    const a=z*(WORLD_CELLS+1)+x,b=a+1,c=a+WORLD_CELLS+1,d=c+1;
    const face=[a,c,b,b,c,d];indices.push(...face);
    groups[groundType(level,tx*WORLD_TILE+x+.5,tz*WORLD_TILE+z+.5)].push(...face);
  }
  return {key:tx+','+tz,x:tx,z:tz,positions:new Float32Array(positions),normals:new Float32Array(normals),indices:new Uint32Array(indices),groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,new Uint32Array(v)])) as TerrainTile['groups'],uv:new Float32Array(uv),colors:new Float32Array(colors),cover:new Float32Array(cover)};
}

function trailBetween(a:V3,b:V3,rand:()=>number,width:number,rugged:number):Trail{
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),bend=(rand()-.5)*length*.42;
  const points=Array.from({length:9},(_,i)=>{const t=i/8,s=Math.sin(t*Math.PI)*bend;return {x:a.x+dx*t-dz/length*s,z:a.z+dz*t+dx/length*s,y:a.y+(b.y-a.y)*smooth(t)};});
  return {points,width,rugged};
}
export function createWorldLevel(id:number):WorldLevel{
  id=clamp(Math.floor(id),0,WORLD_COUNT-1);
  const [name,biome,recipe,seed]=WORLD_LEVELS[id],rand=randomSource(seed);
  const size=id<5?3:id<15?4:5,spacing=31+id*.6;
  let extent=(size-1)*spacing/2+24;
  const nodes:V3[]=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++)nodes.push({x:(x-(size-1)/2)*spacing+(rand()-.5)*9,z:(z-(size-1)/2)*spacing+(rand()-.5)*9,y:1.2+rand()*(3+id*.19)});
  // Broad bends, unequal valley widths and oblique junctions break the grid.
  const turn=(id%6)*.31-.68;
  for(const p of nodes){
    const x=p.x+Math.sin(p.z/spacing*1.25+id*.37)*spacing*.28,z=p.z+Math.sin(p.x/spacing*1.47-id*.29)*spacing*.21;
    p.x=x*Math.cos(turn)+z*Math.sin(turn);p.z=-x*Math.sin(turn)+z*Math.cos(turn);
  }
  extent=Math.max(...nodes.flatMap(p=>[Math.abs(p.x),Math.abs(p.z)]))+24;
  nodes[0].y=1.2;
  const goal=nodes.at(-1)!;
  const level:WorldLevel={id,name,biome:biome as Biome,seed,extent,start:{...nodes[0]},heading:0,goal:{...goal},trails:[],hills:[],basins:[],props:[],plates:[],gates:[],bridges:[],caches:[],camps:[],relays:[],switches:[],courts:[],features:[],goalRequires:[],parMinutes:7+id*.65};
  const edges:[number,number][]=[];
  // Winding spine visits every region, with independently placed cross links.
  const snake:number[]=[];
  for(let z=0;z<size;z++)for(let xx=0;xx<size;xx++)snake.push(z*size+(z%2?size-1-xx:xx));
  for(let i=1;i<snake.length;i++)edges.push([snake[i-1],snake[i]]);
  for(let z=0;z<size-1;z++)for(let x=0;x<size;x++)if(rand()<.68&&!edges.some(([a,b])=>a===z*size+x&&b===(z+1)*size+x))edges.push([z*size+x,(z+1)*size+x]);
  for(const [i,j] of edges)level.trails.push(trailBetween(nodes[i],nodes[j],rand,4.2+rand()*2.7,.28+id*.024));
  for(let z=0;z<size-1;z++)for(let x=0;x<size-1;x++){
    const a=nodes[z*size+x],b=nodes[(z+1)*size+x+1];
    level.hills.push({x:(a.x+b.x)/2,z:(a.z+b.z)/2,radius:13+rand()*7,height:12+rand()*10+id*.2,stretch:.8+rand()*.6,angle:rand()*6.28});
  }
  const feature=(kind:TerrainFeature['kind'],p:V3,yaw:number,length:number,width:number,height:number)=>{
    const f:TerrainFeature={id:'earth-'+level.features.length,kind,...p,y:worldHeight(level,p.x,p.z),yaw,length,width,height,phase:rand()*6.28};level.features.push(f);return f;
  };
  for(let i=0;i<level.trails.length;i++){
    if(i%4===3&&id<4)continue;
    const t=level.trails[i],p=t.points[4],a=t.points[3],b=t.points[5];
    const yaw=-Math.atan2(b.z-a.z,b.x-a.x)+(rand()-.5)*.5;
    const kind=(['terraces','ravine','washout','ridge'] as const)[(i+id)%4];
    feature(kind,p,yaw,kind==='ravine'?6.5:11+rand()*3,kind==='ridge'?6:8+rand()*4,kind==='terraces'?2.7+id*.055:kind==='ravine'?2.5+id*.06:kind==='ridge'?1.7+id*.04:.75+id*.02);
  }
  const point=(n:number,dx=0,dz=0)=>{const p=nodes[clamp(n,0,nodes.length-1)];return {x:p.x+dx,y:p.y,z:p.z+dz};};
  let serial=0;
  const prop=(asset:string,p:V2,scale:number,mass=0,yaw=rand()*6.28)=>{
    scale=propScale(asset,scale);
    const result:WorldProp={id:'prop-'+serial++,asset,x:p.x,z:p.z,y:worldHeight(level,p.x,p.z)+scale*.32,scale,yaw,mass,movable:mass>0};level.props.push(result);return result;
  };
  const rockPassage=(p:V3,yaw:number,cave:boolean)=>{
    const clearing=feature('pad',p,yaw,cave?16:10,8,0);clearing.id='passage-'+level.features.length;
    const ground=clearing.y;
    for(const u of cave?[-2.6,0,2.6]:[0]){
      // Interlocking, closed boulders follow a vault. There is no flattened
      // roof plane, and the buried feet meet the surrounding hillside.
      for(let i=0;i<7;i++){
        const angle=i*Math.PI/6,center=rotatedPoint(p,yaw,u+Math.sin(i*2.3)*.1,Math.cos(angle)*2.55);
        const stone=prop('rock_09',center,3,0,yaw);
        stone.stretch={x:(cave?3.5:3.1)/(3*.512),y:1.55/(3*.227),z:2.25/3};stone.pitch=angle-Math.PI/2;
        stone.y=ground+.67+Math.sin(angle)*2.28;stone.anchored=true;
      }
    }
    for(const side of [-1,1]){
      feature('ridge',rotatedPoint({...p,y:ground},yaw,side*.8,side*6),yaw+side*.12,cave?14:10,5,2.1);
      // The vault grows out of overlapping outcrops rather than standing as a
      // row of isolated stones on a flat pad. Its driving opening stays clear.
      for(const [i,u] of (cave?[-2.7,2.9]:[-.6]).entries()){
        const foot=rotatedPoint(p,yaw,u+side*.35,side*(4.8+i*.45));
        prop(i%2?'namaqualand_boulder_03':'namaqualand_boulder_02',foot,5.2+i*.5,0,yaw+side*.37+i*.22);
      }
    }
  };
  const basin=(p:V3,rx:number,rz:number,material:Basin['material'],controlledBy?:string)=>{
    // A sluice exposes a genuinely submerged floor. In a shallow basin the
    // floating chassis could collect its supply crate during a wave trough,
    // making the valve and counterweight unnecessary.
    const depth=material==='mud'?.65:controlledBy?3.6:2.25;
    const b:Basin={id:'basin-'+level.basins.length,...p,rx,rz,angle:rand()*1.8,level:p.y-.05,bottom:p.y-depth,material,waves:material==='water'?.14+id*.018:0,current:{x:.2+rand()*(.45+id*.04),z:(rand()-.5)*(.5+id*.06)},controlledBy,drainedLevel:p.y-depth+.45};
    if(controlledBy){
      // Point the submerged access tongue toward existing low ground, including
      // the land beyond its bank, rather than terminating below a nearby cliff.
      const candidates=Array.from({length:12},(_,i)=>{
        const angle=b.angle+i*Math.PI/6;
        const height=Math.max(...[.95,1.2,1.45].map(t=>worldHeight(level,p.x+Math.cos(angle)*rx*t,p.z+Math.sin(angle)*rx*t)));
        return {angle,height};
      }).sort((a,b)=>a.height-b.height);
      b.angle=candidates[0].angle;b.accessSide=1;
    }
    if(material==='ice'){const a=rand()*6.28;b.slope={x:Math.cos(a)*(.08+id*.006),z:Math.sin(a)*(.08+id*.006)};}
    level.basins.push(b);return b;
  };
  const addPlate=(id:string,p:V3,yaw=0)=>{
    const pad=feature('pad',rotatedPoint(p,yaw,-3.5,0),yaw,17,8,0);pad.priority=true;
    const plate={id,...p,y:pad.y,yaw,width:3.3,depth:3.1,threshold:7};
    level.plates.push(plate);prop('wooden_crate_01',rotatedPoint(p,yaw,-4.5,.2),2.65,10,yaw);return plate;
  };
  const addGate=(id:string,p:V3,requires:string[],kind:'gate'|'lift'|'sluice'='gate',yaw=0)=>{level.gates.push({id,...p,y:worldHeight(level,p.x,p.z),yaw,width:5.2,height:3.8,requires,mode:'all',travel:kind==='lift'?4.5:4.8,delay:kind==='gate'?.7:0,kind});};
  const addSwitch=(id:string,p:V3,yaw=0)=>{
    // Space to stop beside the handwheel with the complete wheelbase supported.
    // A six-metre patch left the rear axle over a steep lip in glacier terrain.
    const pad=feature('pad',p,yaw,11,10,0),spec={id,...p,y:pad.y,yaw};level.switches.push(spec);
    prop('industrial_valve',p,1.8,0,yaw);return spec;
  };
  const puzzles=Math.min(2+Math.floor(id/5),5);
  const puzzleNodes=new Set<number>();
  for(let n=0;n<puzzles;n++){
    const candidates=nodes.map((_,i)=>i).filter(i=>i>0&&i<nodes.length-1&&!puzzleNodes.has(i));
    const node=n===0?1:candidates.sort((a,b)=>Math.min(...[...puzzleNodes].map(i=>dist(nodes[b],nodes[i])))-Math.min(...[...puzzleNodes].map(i=>dist(nodes[a],nodes[i]))))[0];
    puzzleNodes.add(node);
    const yaw=rand()*Math.PI*2,local=(x:number,z:number)=>rotatedPoint(point(node),yaw,x,z);
    const p=local(0,3),variant=n===0?0:(id+n)%4;
    const control=variant===2?addSwitch('valve-'+n,local(-11,-13),yaw):addPlate('weight-'+n,local(-8,-5),yaw);
    addGate('door-'+n,p,[control.id],'gate',yaw);
    if(variant===3)level.gates.at(-1)!.requires.push('relay-0');
    level.courts.push({...p,y:worldHeight(level,p.x,p.z),width:11.6,depth:12.5,height:7.5+id*.12,yaw,bend:(rand()-.5)*2});
    // A physical rock arch around each gate makes the opening legible in space.
    for(const sign of [-1,1])prop('namaqualand_boulder_03',local(sign*5.2,5.5),6.8,0,yaw+sign*.25);
    const cell=local(1.4,11);level.caches.push({id:'cell-'+n,...cell,y:worldHeight(level,cell.x,cell.z)+.85,kind:'cell',circuit:'relay-'+n});
    const relay=point(Math.min(nodes.length-1,node+1),-7,6);
    feature('pad',relay,0,6,6,0);
    level.relays.push({id:'relay-'+n,...relay,y:worldHeight(level,relay.x,relay.z),requires:['cell-'+n]});
    prop('portable_generator',relay,2.5,0,.4);
    level.goalRequires.push('relay-'+n);
    if(variant===1||(n===0&&(recipe==='double'||id>12))){
      const second=addPlate('second-'+n,local(8,-7),yaw+Math.PI);level.gates.at(-1)!.requires.push(second.id);
      prop('barrel_03',local(12,-4),1.65,8);
    }
  }
  // Hand selected signature mechanics distinguish the terrain recipes.
  const middle=nodes.map((_,i)=>i).filter(i=>i>0&&i<nodes.length-1&&!puzzleNodes.has(i)).sort((a,b)=>{
    const score=(n:number)=>Math.min(...[...puzzleNodes,0,nodes.length-1].map(i=>dist(nodes[n],nodes[i])));
    return score(b)-score(a);
  })[0];
  const mid=point(middle);
  if(recipe==='sluice'){
    const positions=Array.from({length:12},(_,i)=>rotatedPoint(mid,i*Math.PI/6,-18,0));
    const site=positions.find(p=>!level.courts.some(c=>insideCourt(c,p,13))&&!level.plates.some(s=>dist(s,p)<21))??positions[0],yaw=-Math.atan2(mid.z-site.z,mid.x-site.x);
    const plate=addPlate('drain',site,yaw),pad=level.features.at(-1)!;pad.y=Math.max(pad.y,mid.y+.35);
    const valve=addSwitch('drain-valve',point(middle,12,12)),water=basin(mid,13,8,'water',plate.id);water.requires=[valve.id];
    const outlet=rotatedPoint(mid,-water.angle,0,-water.rz*1.02);addGate('sluice',outlet,[plate.id,valve.id],'sluice',-water.angle);
    const gate=level.gates.at(-1)!;gate.width=3.2;gate.height=3.6;gate.travel=3.5;gate.y=water.bottom+.1;
    for(const side of [-1,1])prop('rock_07',rotatedPoint(outlet,-water.angle,side*2.5,.3),4.8,0,-water.angle+side*.3);
    level.caches.push({id:'submerged-cell',...mid,y:mid.y-1.1,kind:'cell'});
    level.relays.at(-1)!.requires.push('submerged-cell');
  }else if(recipe==='balance'){
    feature('pad',mid,0,26,18,0);
    const working=feature('pad',point(middle,-13.5,0),0,12,8,0);working.id='balance-work';working.priority=true;working.y=mid.y;
    const b=basin(mid,7.2,7,'water');b.angle=0;b.level=mid.y-.15;
    const shelf=feature('shelf',point(middle,12.7,0),0,6,7,5.2);shelf.y=mid.y;
    level.bridges.push({id:'balance-bridge',...mid,y:mid.y+2.85,yaw:0,length:17,width:5.4,angle:.32,counterweight:18});
    const ballast=prop('wooden_crate_01',point(middle,-12,-1.8),2.5,20,0);ballast.id='balance-ballast';ballast.friction=.36;
    const approach=prop('wooden_deck',point(middle,-9,0),1,0,0);approach.id='balance-approach';approach.anchored=true;
    approach.stretch={x:1.8/.7088,y:.18/.08483751,z:5.4};approach.y=mid.y+.09;approach.roll=.22;
    // A short timber apron rests on the rock landing. Its exact edge bridges
    // the grid-dependent terrain lip without propping up the swinging deck.
    const apron=prop('wooden_deck',point(middle,9.65,0),1,0,0);apron.id='balance-landing';apron.anchored=true;
    apron.stretch={x:1.4/.7088,y:.24/.08483751,z:5.4};apron.y=mid.y+5.25;
    level.caches.push({id:'balance-cell',...point(middle,12.7,0),y:mid.y+6,kind:'cell'});level.relays.at(-1)!.requires.push('balance-cell');
  }else if(recipe==='lift'){
    const ground=feature('pad',mid,0,17,15,0).y;
    const plate=addPlate('lift-weight',point(middle,-9,-4));
    const landing=feature('shelf',point(middle,0,7),0,8,7,4.65);landing.y=ground;
    addGate('freight-lift',{...mid,y:ground},[plate.id,'lift-control'],'lift');
    level.switches.push({id:'lift-control',...mid,y:ground+1,x:mid.x+2.8,z:mid.z-3.4,yaw:0,toggle:true,gate:'freight-lift'});
    level.caches.push({id:'high-cell',...point(middle,0,7),y:ground+5.5,kind:'cell'});level.relays.at(-1)!.requires.push('high-cell');
  }else if(recipe==='relay'){
    const cache=point(middle,-10,8);level.caches.push({id:'relay-cell',...cache,y:worldHeight(level,cache.x,cache.z)+.8,kind:'cell'});
    level.relays[0].requires.push('relay-cell');
    addGate('linked-door',point(middle),['relay-0']);
  }
  // Scenic wetlands may cross a route, but never overwrite a working puzzle,
  // another body of water, the start, or a raised landing.
  const wetCount=1+Math.floor(id/6)+(biome==='forest'||biome==='quarry'?1:0);
  const wetSites=level.trails.flatMap(t=>[t.points[2],t.points[4],t.points[6]]).map(p=>({...p,order:rand()})).sort((a,b)=>a.order-b.order);
  for(let i=0;i<wetCount;i++){
    const rx=8+rand()*3,rz=6+rand()*2,radius=Math.max(rx,rz);
    const p=wetSites.find(p=>
      dist(p,level.start)>radius+7&&dist(p,level.goal)>radius+6&&
      !level.basins.some(b=>dist(b,p)<Math.max(b.rx,b.rz)+radius+4)&&
      !level.courts.some(c=>insideCourt(c,p,radius+4))&&
      !level.plates.some(s=>dist(rotatedPoint(s,s.yaw,-3.5,0),p)<radius+13)&&
      ![...level.relays,...level.switches,...level.gates].some(s=>dist(s,p)<radius+6)&&
      !level.features.some(f=>f.kind==='shelf'&&dist(f,p)<radius+Math.max(f.length,f.width)*.5+3));
    if(!p)continue;
    const site={x:p.x,z:p.z,y:worldHeight(level,p.x,p.z)};
    basin(site,rx,rz,biome==='glacier'?'ice':i%2?'mud':'water');
  }
  // Low rock openings reward a compact wheel set; the adjacent exposed climbs
  // remain traversable alternatives. Entrances always have room to turn back.
  for(let i=0;i<1+Math.floor(id/7);i++){
    const t=level.trails[(2+i*4+id)%level.trails.length],p=t.points[5],a=t.points[4],b=t.points[6];
    if(level.courts.some(c=>insideCourt(c,p,8))||level.basins.some(w=>basinWeight(w,p.x,p.z)<1.15)||level.plates.some(s=>dist(p,s)<11)||level.relays.some(s=>dist(p,s)<9))continue;
    rockPassage(p,-Math.atan2(b.z-a.z,b.x-a.x),i%2===1||id%3===1);
  }
  // Imported pier sections meet the banks instead of ending as floating slabs.
  for(const [i,b] of level.basins.entries())if(b.material==='water'&&(biome==='coast'||biome==='quarry')){
    const yaw=-b.angle+Math.PI/2;
    for(let n=0;n<2;n++){
      const p=rotatedPoint({x:b.x,y:b.level,z:b.z},yaw,-b.rx*.68+n*3.4,b.rz*.55);
      const deck=prop(n%2?'wooden_pier_worn':'wooden_pier',p,5.5,0,yaw);deck.y=b.level-2.15;deck.anchored=true;
    }
    const pipe=prop('industrial_pipe',{x:b.x-b.rx*.8,z:b.z},2.8,0,yaw);pipe.pitch=Math.PI/2;
  }
  // Findable camps sit outside the through routes and are not auto-checkpoints.
  const count=id<6?2:id<15?3:4;
  for(let i=0;i<count;i++){
    const node=1+Math.floor((i+.6)*(nodes.length-2)/count);
    let p=point(node,12,12);
    for(let attempt=0;attempt<144;attempt++){
      const angle=rand()*Math.PI*2,radius=11+rand()*8+Math.floor(attempt/36)*7,candidate=point(node,Math.cos(angle)*radius,Math.sin(angle)*radius);
      if(level.courts.some(c=>insideCourt(c,candidate,7))||level.basins.some(b=>basinWeight(b,candidate.x,candidate.z)<1.1+5/Math.min(b.rx,b.rz))||level.plates.some(s=>{const q=localCoordinates(s,candidate.x,candidate.z);return q.x>-19&&q.x<12&&Math.abs(q.z)<11;})||level.gates.some(g=>dist(g,candidate)<(g.kind==='lift'?16:10))||level.bridges.some(b=>dist(b,candidate)<18)||level.relays.some(r=>dist(r,candidate)<8)||level.switches.some(s=>dist(s,candidate)<8)||level.camps.some(c=>dist(c,candidate)<12)||level.features.some(f=>{if(!f.id.startsWith('passage-')&&f.id!=='balance-work')return false;const q=localCoordinates(f,candidate.x,candidate.z);return Math.abs(q.x)<f.length/2+8&&Math.abs(q.z)<8;}))continue;
      p=candidate;break;
    }
    // A short unmarked spur reaches a sheltered, level clearing. It remains
    // discoverable away from the through route, without stranding a rescue.
    const yaw=-Math.atan2(p.z-nodes[node].z,p.x-nodes[node].x);
    const ground=worldHeight(level,p.x,p.z);p.y=Math.min(ground,nodes[node].y+2);
    level.trails.push(trailBetween(nodes[node],p,rand,3.8,.18));
    feature('pad',p,yaw,6,6,0).y=p.y;
    const camp={id:'camp-'+i,...p,yaw:yaw+Math.PI};level.camps.push(camp);
    prop('wooden_crate_01',{x:p.x+3,z:p.z+1.7},1.2);prop('barrel_03',{x:p.x+3.5,z:p.z-1},1.3);
    prop('vintage_oil_lamp',rotatedPoint(p,yaw,-1.8,2.8),.9);
    const table=rotatedPoint(p,yaw,0,4.1);feature('pad',table,yaw,3.2,4.2,0);prop('wooden_picnic_table',table,3.2,0,yaw);
  }
  for(const relay of level.relays){
    prop('electricity_pole',{x:relay.x+3.8,z:relay.z+1.8},6.2,0,rand()*6.28);
    prop('old_military_crate',{x:relay.x-2.9,z:relay.z+1.5},1.3);
  }
  for(let i=0;i<3;i++){
    const original=point(1+Math.floor(rand()*(nodes.length-2)),(rand()>.5?1:-1)*(10+rand()*5),(rand()-.5)*14);
    let p=original;
    // Relics are hidden off the route, but never inside an already built vault
    // or its flanking rocks. A deterministic local search leaves the random
    // sequence for the remaining scenery unchanged.
    for(let attempt=0;attempt<144;attempt++){
      const angle=attempt*2.3999632297+i*.51,radius=Math.sqrt(attempt)*1.75;
      const candidate={x:original.x+Math.cos(angle)*radius,z:original.z+Math.sin(angle)*radius,y:original.y};
      const height=worldHeight(level,candidate.x,candidate.z);
      if(level.basins.some(b=>basinWeight(b,candidate.x,candidate.z)<1.15)||level.courts.some(c=>insideCourt(c,candidate,4))||level.camps.some(c=>dist(c,candidate)<6)||level.relays.some(r=>dist(r,candidate)<6)||level.plates.some(s=>dist(s,candidate)<5)||level.caches.some(c=>dist(c,candidate)<5))continue;
      if(level.props.some(o=>!o.foliage&&dist(o,candidate)<o.scale*Math.max(o.stretch?.x??1,o.stretch?.z??1)*.55+1.5))continue;
      if([[1,0],[-1,0],[0,1],[0,-1]].some(([x,z])=>Math.abs(worldHeight(level,candidate.x+x,candidate.z+z)-height)>1.1))continue;
      p=candidate;break;
    }
    level.caches.push({id:'relic-'+i,...p,y:worldHeight(level,p.x,p.z)+.8,kind:'relic'});
  }
  const rocks=['rock_07','rock_09','namaqualand_boulder_02','namaqualand_boulder_03','coast_rocks_05'];
  const serviceSpace=(p:V2,margin=0)=>level.caches.some(s=>dist(s,p)<1.8+margin)||level.camps.some(s=>dist(s,p)<4+margin)||level.plates.some(s=>{const q=localCoordinates(s,p.x,p.z);return q.x>-12.5-margin&&q.x<4+margin&&Math.abs(q.z)<4.3+margin;})||level.switches.some(s=>dist(s,p)<3.5+margin)||level.bridges.some(s=>{const q=localCoordinates(s,p.x,p.z);return Math.abs(q.x)<s.length*.5+4+margin&&Math.abs(q.z)<s.width*.5+1+margin;})||level.gates.some(s=>s.kind==='lift'&&Math.abs(s.x-p.x)<5+margin&&p.z-s.z>-6-margin&&p.z-s.z<11+margin)||level.features.some(f=>{if(!f.id.startsWith('passage-')&&f.id!=='balance-work')return false;const q=localCoordinates(f,p.x,p.z);return Math.abs(q.x)<f.length/2+3+margin&&Math.abs(q.z)<(f.id==='balance-work'?f.width/2+1:2.4)+margin;});
  // Scenery is solid wherever it looks solid. No route-membership filters exist.
  for(let i=0;i<100+id*6;i++){
    const x=(rand()-.5)*extent*2.2,z=(rand()-.5)*extent*2.2;
    if(dist({x,z},level.start)<7||dist({x,z},level.goal)<6||serviceSpace({x,z},2.5)||level.camps.some(p=>dist(p,{x,z})<4)||level.courts.some(c=>insideCourt(c,{x,z},6)))continue;
    const near=nearestTrail(level,x,z),small=near.distance<near.width*.6;
    if(small&&rand()<.46)continue;
    const size=small?.7+rand()*1.3:2.2+rand()*4.8;
    prop(rocks[i%rocks.length],{x,z},size,small&&i%3===0?3+size*2:0);
  }
  // Offset rocks and loose rubble in crossings force line choice from level one.
  for(let i=1;i<level.trails.length;i+=2){const t=level.trails[i],p=t.points[3],q=t.points[5];if(serviceSpace(p,3)||serviceSpace(q,3)||level.courts.some(c=>insideCourt(c,p,6)))continue;prop('rock_09',{x:p.x+1.1,z:p.z},2.3+id*.025);prop('rock_07',{x:q.x-1,z:q.z+.4},1.35,4.5);}
  for(let i=0;i<24+id;i++){
    const p=point(Math.floor(rand()*nodes.length),(rand()-.5)*23,(rand()-.5)*23);
    if(dist(p,level.start)<5||serviceSpace(p,2))continue;
    if(i%6===0&&biome==='quarry')prop('concrete_road_barrier',p,3.6);
    else if(i%9===0)prop('barrel_03',p,1.1+rand()*.3,7);
  }
  // Botanical groups grow along verges and sheltered rock pockets. Their
  // distribution is continuous across routes, not a row of repeated props.
  const planted:V2[]=[];
  const suitable=(p:V2,large:boolean)=>{
    if(large&&serviceSpace(p,1.5))return false;
    if(dist(p,level.start)<(large?5:2.8)||dist(p,level.goal)<3||level.plates.some(s=>dist(s,p)<4.4)||level.relays.some(s=>dist(s,p)<3.4)||level.switches.some(s=>dist(s,p)<3)||level.camps.some(s=>dist(s,p)<2.6))return false;
    if(level.gates.some(g=>{const q=localCoordinates(g,p.x,p.z);return Math.abs(q.x)<g.width*.5+2&&Math.abs(q.z)<5;}))return false;
    if(level.basins.some(b=>basinWeight(b,p.x,p.z)<1.02&&worldHeight(level,p.x,p.z)<b.level+.1))return false;
    const h=worldHeight(level,p.x,p.z),slope=Math.hypot(worldHeight(level,p.x+.6,p.z)-h,worldHeight(level,p.x,p.z+.6)-h)/.6;
    return slope<(large?.72:1.1);
  };
  const groveCount=biome==='forest'?135+id*3:biome==='glacier'?22+id:60+id;
  for(let i=0;i<groveCount*3&&planted.length<groveCount;i++){
    const p=point(Math.floor(rand()*nodes.length),(rand()-.5)*34,(rand()-.5)*34),near=nearestTrail(level,p.x,p.z);
    if(!suitable(p,true)||near.distance<near.width*.44||planted.some(q=>dist(p,q)<3))continue;
    planted.push(p);
    if(biome==='forest'){
      const asset=i%11===0?'tree_stump_02':i%9===0?'tree_stump_01':i%4===0?'tree_small_02':i%3===0?'pine_sapling_small':'pine_tree_01';
      prop(asset,p,/stump/.test(asset)?1.8+rand()*1.9:asset==='pine_tree_01'?8.5+rand()*5:5.8+rand()*4.2);
    }else if(biome==='glacier'){
      prop(i%4===0?'dead_tree_trunk':'pine_sapling_small',p,i%4===0?2.4+rand()*2.5:4.4+rand()*3.8);
    }else{
      const asset=i%5===0?'quiver_tree_01':i%6===0?'dead_tree_trunk':i%8===0?'tree_stump_01':'wild_rooibos_bush';
      const shrub=asset==='wild_rooibos_bush',o=prop(asset,p,shrub?1+rand()*1.3:asset==='quiver_tree_01'?3.6+rand()*2.2:2+rand()*2);
      o.foliage=shrub;
    }
  }
  // Low vegetation uses separate, reduced botanical variants. Instancing keeps
  // hundreds of clumps inexpensive while retaining their photographed leaves.
  const clumps=biome==='forest'?1200+id*16:biome==='glacier'?110:580+id*10;
  for(let i=0;i<clumps;i++){
    const anchor=i%3===0&&planted.length?planted[i%planted.length]:point(Math.floor(rand()*nodes.length));
    const p={x:anchor.x+(rand()-.5)*25,z:anchor.z+(rand()-.5)*25};
    if(!suitable(p,false))continue;
    const near=nearestTrail(level,p.x,p.z);if(near.distance<near.width*.38&&rand()<.88)continue;
    const asset=biome==='forest'&&i%5===0?'fern_02':biome==='forest'&&i%11===0?'nettle_plant':i%3===0?'grass_low':i%3===1?'grass_clump':'grass_medium_01';
    const scale=asset==='nettle_plant'?.7+rand()*.55:asset==='fern_02'?.8+rand()*.9:asset==='grass_medium_01'?.35+rand()*.45:.55+rand()*.75;
    const o=prop(asset,p,scale);o.foliage=true;
  }
  // Fallen trunks are actual low obstacles and loose timber can be pushed.
  if(biome==='forest'||biome==='coast')for(let i=0;i<3+Math.floor(id/5);i++){
    const p=point(1+i,4+(rand()-.5)*4,-6);if(!suitable(p,true))continue;
    prop('dead_tree_trunk',p,3.8+rand()*1.8,i%2===0?12:0);
  }
  for(let i=0;i<2+Math.floor(id/8);i++){const p=point(1+i,9,-7);if(!serviceSpace(p,2))prop('wooden_ladder_02',p,3.5+rand());}
  // Dense small vegetation and gravel are streamed by GroundDressing across
  // the landscape. This leaves saved puzzle-object IDs and colliders unchanged.
  level.heading=-Math.atan2(level.trails[0].points[1].z-level.start.z,level.trails[0].points[1].x-level.start.x);
  level.start.y=worldHeight(level,level.start.x,level.start.z);
  level.goal.y=worldHeight(level,level.goal.x,level.goal.z);
  // Re-seat authored objects after all river beds have been carved.
  for(const o of level.props)if(!o.anchored)o.y=worldHeight(level,o.x,o.z)+o.scale*.35;
  for(const p of level.plates)p.y=worldHeight(level,p.x,p.z);
  for(const c of level.camps)c.y=worldHeight(level,c.x,c.z);
  for(const g of level.gates)if(g.kind!=='sluice')g.y=worldHeight(level,g.x,g.z);
  for(const r of level.relays)r.y=worldHeight(level,r.x,r.z);
  for(const s of level.switches)if(!s.gate)s.y=worldHeight(level,s.x,s.z);else s.y=level.gates.find(g=>g.id===s.gate)!.y+1;
  for(const c of level.caches)c.y=worldHeight(level,c.x,c.z)+(c.kind==='relic'?.8:.85);
  return level;
}
