import {ShapeUtils,Vector2} from 'three';

/** Close the unphotographed underside of a scanned rock. The outline comes
 * from its actual open edges; concave outlines are triangulated, not replaced
 * by a bounding box. Existing surface vertices and UVs remain untouched. */
export function closeMeshBase(doc,primitive){
  const position=primitive.getAttribute('POSITION'),array=position.getArray(),indices=primitive.getIndices().getArray();
  const keys=new Map(),canonical=[],edges=new Map();let minY=Infinity,maxY=-Infinity;
  for(let i=0;i<position.getCount();i++){
    const key=[0,1,2].map(axis=>array[i*3+axis].toFixed(6)).join(',');if(!keys.has(key))keys.set(key,i);canonical.push(keys.get(key));
    minY=Math.min(minY,array[i*3+1]);maxY=Math.max(maxY,array[i*3+1]);
  }
  for(let i=0;i<indices.length;i+=3){
    const triangle=Array.from(indices.slice(i,i+3),index=>canonical[index]);
    for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3];if(a===b)continue;const key=a<b?`${a},${b}`:`${b},${a}`,edge=edges.get(key);if(edge)edge.count++;else edges.set(key,{a,b,count:1});}
  }
  const neighbours=new Map(),unused=new Set();
  for(const edge of edges.values())if(edge.count===1){for(const [a,b] of [[edge.a,edge.b],[edge.b,edge.a]]){const values=neighbours.get(a)??[];values.push(b);neighbours.set(a,values);}unused.add(edge.a);unused.add(edge.b);}
  const loops=[];
  while(unused.size){
    const first=unused.values().next().value,loop=[];let previous=-1,current=first;
    for(let steps=0;steps<=neighbours.size;steps++){
      if(!unused.has(current)&&current!==first)break;
      loop.push(current);unused.delete(current);const nexts=neighbours.get(current);if(nexts?.length!==2)break;
      const next=nexts.find(n=>n!==previous);previous=current;current=next;
      if(current===first){if(loop.length>=3&&loop.every(i=>array[i*3+1]<minY+(maxY-minY)*.35))loops.push(loop);break;}
    }
  }
  if(!loops.length)return 0;
  const vertices=[],faces=[];
  for(const loop of loops){
    const points=loop.map(i=>new Vector2(array[i*3],array[i*3+2])),offset=position.getCount()+vertices.length;
    for(const triangle of ShapeUtils.triangulateShape(points,[])){
      const [a,b,c]=triangle.map(i=>points[i]),cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
      // Counterclockwise in XZ gives the downward-facing underside in XYZ.
      const order=cross>=0?triangle:[triangle[0],triangle[2],triangle[1]];faces.push(...order.map(i=>offset+i));
    }
    vertices.push(...loop);
  }
  for(const semantic of primitive.listSemantics()){
    if(semantic==='TANGENT'){primitive.setAttribute(semantic,null);continue;}
    const accessor=primitive.getAttribute(semantic),old=accessor.getArray(),size=old.length/accessor.getCount(),next=new old.constructor(old.length+vertices.length*size);next.set(old);
    for(const [i,source] of vertices.entries())for(let axis=0;axis<size;axis++){
      next[old.length+i*size+axis]=semantic==='NORMAL'?(axis===1?-1:0):semantic.startsWith('TEXCOORD')?(array[source*3+(axis?2:0)]+.5):old[source*size+axis];
    }
    primitive.setAttribute(semantic,accessor.clone().setArray(next));
  }
  primitive.setIndices(primitive.getIndices().clone().setArray(new Uint32Array([...indices,...faces])));
  return faces.length/3;
}
