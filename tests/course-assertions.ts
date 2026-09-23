import assert from 'node:assert/strict';
import type {Course} from '../src/courses';
import {inBand,PATH_CENTERS} from '../src/branching';

/** Continuity is longitudinal within each route, never between different arms. */
export function assertJoinedGround(c:Course){
  for(const lateral of c.routes?PATH_CENTERS:[0]){
    const segments=c.segments.filter(s=>!s.ridge&&inBand(s,lateral)).sort((a,b)=>a.a.x-b.a.x);
    for(let i=1;i<segments.length;i++){
      const a=segments[i-1].b,b=segments[i].a;
      assert.ok(Math.abs(a.x-b.x)<1e-7&&Math.abs(a.y-b.y)<1e-7,`${c.id} / side ${lateral}: unjoined ground at ${a.x},${a.y} -> ${b.x},${b.y}`);
    }
  }
}
