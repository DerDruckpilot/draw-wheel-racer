import {type Course,type Segment} from './courses';
import {bandCenter,inBand,PATH_WIDTH,routeEdges} from './branching';

const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function islandEdges(s:Segment,x:number){
  const t=Math.max(0,Math.min(1,(x-s.a.x)/Math.max(.001,s.b.x-s.a.x)));
  const e=s.edgeA&&s.edgeB?{left:mix(s.edgeA.left,s.edgeB.left,t),right:mix(s.edgeA.right,s.edgeB.right,t)}:{left:s.lateral!-s.depth!/2,right:s.lateral!+s.depth!/2};
  // At the nose the roads still overlap. Collapse the island there instead of
  // reversing its triangles when the interpolated gap has negative width.
  if(e.right<e.left)e.left=e.right=(e.left+e.right)/2;
  return e;
}
function profile(c:Course,x:number,z:number){let y=-12;for(const s of c.segments)if(!s.ridge&&x>=s.a.x-.001&&x<=s.b.x+.001&&inBand(s,z,.025,x))y=Math.max(y,mix(s.a.y,s.b.y,(x-s.a.x)/Math.max(.001,s.b.x-s.a.x)));return y===-12?0:y;}
export function islandHeight(c:Course,s:Segment,x:number,z:number){
  const {left,right}=islandEdges(s,x),t=Math.max(0,Math.min(1,(z-left)/Math.max(.001,right-left)));
  const base=mix(profile(c,x,left-.03),profile(c,x,right+.03),t),top=mix(s.a.y,s.b.y,(x-s.a.x)/Math.max(.001,s.b.x-s.a.x));
  const crown=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.72);
  return base+(top-base)*crown+.12*Math.sin(x*.8+t*7)*Math.sin(Math.PI*t);
}
/** Visible bathymetry and shoreline use the same terrain as the bank mesh. */
export function terrainHeight(c:Course,x:number,z:number){
  const e=routeEdges(c,x),outside=Math.max(e.left-z,z-e.right,0);
  if(outside>0){const edge=z<e.left?e.left:e.right,floor=profile(c,x,edge),t=Math.min(1,outside/2.4),blend=t*t*(3-2*t);
    const land=.65+.3*Math.sin(x*.11+z*.27)+.2*Math.cos(x*.23-z*.13);
    return mix(floor,land,blend);}
  for(const s of c.segments)if(s.ridge&&x>=s.a.x-.001&&x<=s.b.x+.001){const e=islandEdges(s,x);if(z>e.left&&z<e.right)return islandHeight(c,s,x,z);}
  return profile(c,x,z);
}

/** Watertight curved ribbons, with broad erosion-shaped islands between them. */
export function branchTerrain(c:Course,segments:Segment[]){
  const positions:number[]=[],uvs:number[]=[],tops:number[]=[],rock:number[]=[];
  const quad=(points:number[][],vertical=false)=>{const n=positions.length/3;for(const p of points){positions.push(...p);uvs.push(p[0]/5,p[2]/5);}(vertical?rock:tops).push(n,n+1,n+2,n,n+2,n+3);};
  for(const s of segments){
    const n=Math.max(1,Math.ceil((s.b.x-s.a.x)/1.2));
    const row=(t:number)=>{
      const x=mix(s.a.x,s.b.x,t),y=mix(s.a.y,s.b.y,t),center=bandCenter(s,x),depth=s.depth??PATH_WIDTH;
      const e=s.ridge?islandEdges(s,x):{left:center-depth/2,right:center+depth/2};
      const count=s.ridge?8:2;
      return Array.from({length:count+1},(_,i)=>{const z=mix(e.left,e.right,i/count);return [x,s.ridge?islandHeight(c,s,x,z):y,z+1];});
    };
    for(let j=0;j<n;j++){
      const a=row(j/n),b=row((j+1)/n);for(let k=1;k<a.length;k++)quad([a[k-1],a[k],b[k],b[k-1]]);
      const low=(p:number[])=>[p[0],-12,p[2]];
      quad([a[0],b[0],low(b[0]),low(a[0])],true);
      quad([b.at(-1)!,a.at(-1)!,low(a.at(-1)!),low(b.at(-1)!)],true);
      if(j===0)quad([a.at(-1)!,a[0],low(a[0]),low(a.at(-1)!)],true);
      if(j===n-1)quad([b[0],b.at(-1)!,low(b.at(-1)!),low(b[0])],true);
    }
  }
  return {positions,uvs,indices:[...tops,...rock],groups:[{start:0,count:tops.length,material:0},{start:tops.length,count:rock.length,material:1}]};
}
