import { groundAt, type Course, type Obstacle } from './courses';
import { bankHeight } from './landscape';
import { terrainHeight } from './branch-terrain';
import { archSection, structureExtent } from './structures';

/** One sealed solid: roof, soffit, both portals and both buried feet share vertices.
 * No alpha cutouts, intersecting aprons or uncapped half-meshes. */
export function structureMesh(course: Course, o: Obstacle) {
  const positions: number[] = [], indices: number[] = [];
  const nx = 16, nz = 48, extent = structureExtent(o.structure!,o.channel!==undefined?o.depth:undefined);
  const zs = [...new Set([-extent, -1.35, -.97, 0, .97, 1.35, extent,
    ...Array.from({ length: nz + 1 }, (_, j) => -extent + j * extent * 2 / nz)])].sort((a,b)=>a-b);
  const row = zs.length, plane = (nx + 1) * row;
  for (const upper of [false, true]) for (let i=0;i<=nx;i++) for (const z of zs) {
    const t=i/nx, shoulder=Math.max(0,Math.abs(z)-1.35), fade=Math.min(1,shoulder/2);
    const spread=o.structure==='bridge'?1:Math.max(.18,Math.sqrt(1-Math.min(1,shoulder/(extent-1.35))**2));
    const x=o.x+(t-.5)*o.width*spread+fade*(Math.sin(z*.83+o.x)*.28+Math.sin(z*1.63+t*3)*.13);
    const base=course.routes?Math.max(-5,terrainHeight(course,x,(o.lateral??0)+z)):bankHeight(x,groundAt(course,x),1+z), shape=archSection(o,z,base);
    const crest=o.structure==='bridge'?0:o.structure==='cave'?1.75:.3;
    let y=upper?shape.bottom+(shape.top-shape.bottom)*(1-(o.structure==='bridge'?0:fade*.8)*(1-Math.sin(t*Math.PI)))+Math.sin(t*Math.PI)*crest*Math.max(0,1-shoulder/(extent-1.35)):shape.bottom;
    if (upper) y=Math.max(shape.bottom+.08,y+fade*Math.sin(t*7+z*1.7+o.x)*.12*Math.sin(Math.PI*(z+extent)/(2*extent)));
    positions.push(x,y,1+(o.lateral??0)+z);
  }
  const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,a,c,d);
  for(let i=0;i<nx;i++)for(let j=0;j<row-1;j++){
    const a=i*row+j,b=a+row;
    quad(a,b,b+1,a+1); // underside faces into the tunnel
    quad(a+plane,a+plane+1,b+plane+1,b+plane);
  }
  for(let j=0;j<row-1;j++){
    quad(j,j+1,j+1+plane,j+plane);
    const a=nx*row+j;quad(a,a+plane,a+1+plane,a+1);
  }
  for(let i=0;i<nx;i++){
    const a=i*row,b=(i+1)*row;quad(a,a+plane,b+plane,b);
    const c=a+row-1,d=b+row-1;quad(c,d,d+plane,c+plane);
  }
  return {positions,indices};
}
