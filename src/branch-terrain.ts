import {groundAt,type Course,type Segment} from './courses';

/** Closed strips share their exact side coordinates. Ridge feet meet both
 * neighboring profiles; the outer banks use the outermost branch profile. */
export function branchTerrain(c:Course,segments:Segment[]){
  const positions:number[]=[],uvs:number[]=[],tops:number[]=[],rock:number[]=[];
  const quad=(points:number[][],vertical=false)=>{const n=positions.length/3;for(const p of points){positions.push(...p);uvs.push(p[0]/5,p[2]/5);}(vertical?rock:tops).push(n,n+1,n+2,n,n+2,n+3);};
  for(const s of segments){
    const left=1+(s.lateral??0)-(s.depth??c.routes!.halfWidth*2)/2,right=1+(s.lateral??0)+(s.depth??c.routes!.halfWidth*2)/2;
    const n=Math.max(1,Math.ceil((s.b.x-s.a.x)/1.5));
    for(let j=0;j<n;j++){
      const a={x:s.a.x+(s.b.x-s.a.x)*j/n,y:s.a.y+(s.b.y-s.a.y)*j/n},b={x:s.a.x+(s.b.x-s.a.x)*(j+1)/n,y:s.a.y+(s.b.y-s.a.y)*(j+1)/n};
      const zs=s.ridge?[left,left+.35,(left+right)/2,right-.35,right]:[left,(left+right)/2,right];
      const row=(p:typeof a)=>zs.map((z,k)=>{
        if(!s.ridge)return [p.x,p.y,z];
        const base=groundAt(c,p.x,(s.lateral??0)+(k<2?-1:1));
        const blend=[0,.64,1,.58,0][k];
        return [p.x,base+(p.y-base)*blend,z+(k===2?Math.sin(p.x*.63+s.lateral!)*.18:0)];
      });
      const aa=row(a),bb=row(b);for(let k=1;k<zs.length;k++)quad([aa[k-1],aa[k],bb[k],bb[k-1]]);
      quad([aa[0],bb[0],[b.x,-12,left],[a.x,-12,left]],true);
      quad([bb.at(-1)!,aa.at(-1)!,[a.x,-12,right],[b.x,-12,right]],true);
      if(j===0)quad([aa.at(-1)!,aa[0],[a.x,-12,left],[a.x,-12,right]],true);
      if(j===n-1)quad([bb[0],bb.at(-1)!,[b.x,-12,right],[b.x,-12,left]],true);
    }
  }
  return {positions,uvs,indices:[...tops,...rock],groups:[{start:0,count:tops.length,material:0},{start:tops.length,count:rock.length,material:1}]};
}
