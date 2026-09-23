import type { Course, Feature, Surface } from './courses';
import type { Point } from './shapes';

type Line = (length:number, profile:Point[], surface?:Surface, gaps?:number[])=>void;
const pts=(pairs:number[][]):Point[]=>pairs.map(([x,y])=>({x,y}));

/** Short authored problems with different contact geometry, not taller copies
 * of the same ramp. Heights are in the same units as the physical wheel stroke. */
export function buildChallenge(f:Feature,c:Course,start:number,line:Line):boolean {
  const zone=(a:number,b:number,kind:Feature)=>c.zones.push({start:start+a,end:start+b,kind,label:''});
  const roof=(x:number,y:number,width:number)=>c.obstacles.push({x:start+x,y:y+.2,width,height:.4,kind:'ceiling',structure:f==='rubblegate'?'bridge':'cave'});
  if(f==='notch'){
    line(23,pts([[0,0],[3,0],[5,0],[8,.035],[10,0],[13,.045],[16,0],[23,0]]));
    roof(11,1.8,12);zone(0,23,'tunnel');
  }else if(f==='escarpment'){
    line(27,pts([[0,0],[3,0],[3.12,1.25],[6.3,1.25],[6.43,2.55],[9.7,2.55],[9.85,3.9],[13,3.9],[16,3.5],[20,1.5],[23,.8],[27,0]]));
    zone(0,14,'steps');zone(14,27,'ridge');
  }else if(f==='rubblegate'){
    line(34,pts([[0,0],[4,0],[6,.08],[11,.08],[14,0],[18.4,0],[18.54,1.3],[22,1.3],[22.15,2.65],[25.5,2.65],[28,2.2],[31,.8],[34,0]]));
    roof(8.5,1.88,9);zone(0,16,'tunnel');zone(16,27,'steps');zone(27,34,'ridge');
  }else if(f==='siltclimb'){
    line(32,pts([[0,0],[3,0],[6,-.95],[14,-.95],[14.3,-.55],[17,-.55],[17.2,.55],[20,.55],[20.15,1.75],[24,1.75],[28,.6],[32,0]]),'mud');
    c.muds!.push({start:start+3,end:start+17.3,level:-.02,deep:false});zone(0,17,'mudpit');zone(17,25,'steps');zone(25,32,'ridge');
  }else if(f==='tidalcave'){
    line(43,pts([[0,0],[3,0],[8,-1.1],[29,-1.1],[31,-.5],[31.25,.45],[34,.45],[34.2,1.55],[37,1.55],[43,0]]));
    c.waters.push({start:start+3,end:start+31,level:-.02,deep:false});roof(15,1.38,9);
    zone(0,9,'ford');zone(9,28,'tidalcave');zone(28,38,'steps');zone(38,43,'ridge');
  }else if(f==='brokenbridge'){
    line(32,pts([[0,0],[3,0],[4,-1.7],[24,-1.7],[26,-1],[29,0],[32,0]]));
    for(let j=0;j<3;j++)c.obstacles.push({x:start+7+j*7.2,y:.05+(j===1?.12:0),width:7,height:.23,kind:'beam',tilt:.24});
    zone(0,32,'brokenbridge');
  }else if(f==='potholes'){
    const p:Point[]=pts([[0,0],[3,0]]);let x=3;
    for(const [w,d] of [[1.35,1.2],[1.8,1.5],[1.1,.9],[1.95,1.6]]){p.push(...pts([[x,0],[x+.14,-d],[x+w-.12,-d],[x+w,.15],[x+w+1.7,.15],[x+w+2,0]]));x+=w+2.2;}
    p.push({x:26,y:0});line(26,p);zone(0,26,'trenches');
  }else if(f==='crater'){
    line(34,pts([[0,0],[3,0],[3.2,.65],[5,.65],[5.15,1.3],[7,1.3],[7.2,1.8],[9,1.8],[12,-2.6],[16,-2.6],[16.12,-1.3],[19.5,-1.3],[19.65,.05],[23,.05],[23.15,1.35],[26,1.35],[30,.6],[34,0]]));
    zone(0,13,'ridge');zone(13,28,'steps');zone(28,34,'ridge');
  }else if(f==='icefissure'){
    line(34,pts([[0,0],[4,0],[7,-.3],[7.2,-1.05],[8,-1.05],[8.2,.1],[13,.1],[13.2,-1.1],[14.2,-1.1],[14.4,.2],[19,.2],[19.2,-.95],[20.4,-.95],[20.6,.35],[25,.35],[29,.2],[34,0]]),'ice');zone(0,34,'trenches');
  }else if(f==='glacier'){
    const p:Point[]=pts([[0,0],[3,0]]);let y=0;
    for(let j=0;j<10;j++){const x=3+j*1.75;p.push({x:x+1.05,y:y+.08});y+=.54+(j%3)*.045;p.push({x:x+1.25,y},{x:x+1.75,y:y-.12});y-=.12;}
    p.push(...pts([[24,y],[28,y-1.4],[31,1.4],[37,0]]));line(37,p,'ice');zone(0,25,'iceclimb');zone(25,37,'ridge');
  }else if(f==='stepwell'){
    line(30,pts([[0,0],[3,0],[3.15,1.25],[5,1.25],[5.2,.15],[7,.15],[7.12,1.2],[9.2,1.2],[9.4,.4],[11.5,.4],[11.65,1.55],[14,1.55],[14.2,.7],[16,.7],[16.15,1.95],[19,1.95],[23,1.7],[26,.4],[30,0]]));zone(0,23,'steps');zone(23,30,'ridge');
  }else if(f==='knifeedge'){
    line(34,pts([[0,0],[3,0],[3.2,.9],[5,.9],[5.2,1.9],[7.4,1.9],[7.55,3.1],[10,3.1],[10.2,4.4],[13,4.4],[16,2.8],[19,1.2],[21,-1.1],[24,-1.1],[24.2,.3],[28,.3],[34,0]]));zone(0,14,'steps');zone(14,23,'ridge');zone(23,29,'steps');zone(29,34,'ridge');
  }else return false;
  return true;
}
