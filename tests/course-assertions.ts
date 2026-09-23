import assert from 'node:assert/strict';
import type {Course} from '../src/courses';
import {inBand,PATH_CENTERS} from '../src/branching';

/** Continuity is longitudinal within each route, never between different arms. */
export function assertJoinedGround(c:Course){
  if(c.routes){
    for(const fork of c.routes.forks)for(const path of fork.paths){
      const segments=c.segments.filter(s=>s.curve===path.curve&&!s.ridge).sort((a,b)=>a.a.x-b.a.x);
      assert.equal(segments[0].a.x,fork.start);assert.equal(segments.at(-1)!.b.x,fork.end);
      for(let i=1;i<segments.length;i++){const a=segments[i-1].b,b=segments[i].a;assert.ok(Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7,`${c.id} / arm ${path.channel}: unjoined ground at ${a.x},${a.y} -> ${b.x},${b.y}`);}
    }
    return;
  }
  for(const lateral of c.routes?PATH_CENTERS:[0]){
    const segments=c.segments.filter(s=>!s.ridge&&inBand(s,lateral)).sort((a,b)=>a.a.x-b.a.x);
    for(let i=1;i<segments.length;i++){
      const a=segments[i-1].b,b=segments[i].a;
      assert.ok(Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7,`${c.id} / side ${lateral}: unjoined ground at ${a.x},${a.y} -> ${b.x},${b.y}`);
    }
  }
}
