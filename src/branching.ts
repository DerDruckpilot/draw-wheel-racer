import type { Course,Feature,Segment } from './courses';

export interface PathCurve { start:number;end:number;center:number;sway:number;phase:number }
export interface Band { lateral?:number;depth?:number;channel?:number;curve?:PathCurve }
export interface RoutePath { channel:number;center:number;features:Feature[];curve:PathCurve;challenge:'technical'|'rough' }
export interface Fork { start:number;end:number;decision:number;paths:RoutePath[] }
export interface RouteNetwork { halfWidth:number;forks:Fork[] }
export const PATH_CENTERS=[-7,0,7];
export const PATH_WIDTH=5.6;
export const BRANCH_FAN=16;
export const GROUND_GROUPS=[0x100,0x200,0x400];
export const PROP_GROUPS=[0x800,0x1000,0x2000];
export const RIDGE_GROUP=0x4000;
export const ROUTE_GROUPS=0x7f00;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
/** Branches fan out from a shared trail, bend independently, then rejoin it.
 * The very same curve selects physics contacts and places the visible road. */
export function curveShift(c:PathCurve|undefined,x:number){
  if(!c)return 0;
  const t=Math.max(0,Math.min(1,(x-c.start)/(c.end-c.start)));
  const fan=smooth((x-c.start)/BRANCH_FAN)*smooth((c.end-x)/BRANCH_FAN);
  return c.center*(fan-1)+c.sway*Math.sin(t*Math.PI*2+c.phase)*Math.sin(t*Math.PI)*fan;
}
export function bandCenter(b:Band,x:number){return (b.lateral??0)+curveShift(b.curve,x);}
export function pathCenter(p:RoutePath,x:number){return p.center+curveShift(p.curve,x);}
export function inBand(b:Band,offset:number,margin=0,x=0){return b.lateral===undefined||Math.abs(offset-bandCenter(b,x))<=(b.depth??PATH_WIDTH)/2+margin;}
export function routeFork(c:Course,x:number){return c.routes?.forks.find(f=>x>=f.start&&x<=f.end);}
export function routePath(c:Course,x:number,offset:number){return routeFork(c,x)?.paths.reduce((a,b)=>Math.abs(pathCenter(a,x)-offset)<Math.abs(pathCenter(b,x)-offset)?a:b);}
export function routeEdges(c:Course,x:number){
  const f=routeFork(c,x);
  if(c.routes&&!c.routes.forks.length)return {left:-c.routes.halfWidth,right:c.routes.halfWidth};
  return f?{left:Math.min(...f.paths.map(p=>pathCenter(p,x)))-PATH_WIDTH/2,right:Math.max(...f.paths.map(p=>pathCenter(p,x)))+PATH_WIDTH/2}:{left:-PATH_WIDTH/2,right:PATH_WIDTH/2};
}
export function groundGroup(channel?:number){return channel===undefined?1:GROUND_GROUPS[channel];}
export function propGroup(channel?:number){return channel===undefined?32:PROP_GROUPS[channel];}

/** No scripted dead ends or route labels. Each arm contains physical challenges;
 * the difficult line can be attempted, abandoned, or completed on its own merits. */
export function branchCourse(base:Course,make:(features:Feature[])=>Course):Course {
  const c:Course={...base,segments:[],obstacles:[],waters:[],muds:[],zones:[],mechanisms:[],masterRoutes:[],checkpoints:[2],routes:{halfWidth:10.4,forks:[]}};
  const winter=c.theme==='alpine',count=c.id===12?6:c.id>=13&&c.id<=15?5:4;
  const extras:Feature[]=c.freight?['freightpass','flexshelf','softground','loosefield','countergate','potholes']:winter?['icefissure','notch','thinice','glacier','brokenbridge','current']:['notch','current','rubblegate','mudpit','precisionjump','softground'];
  const original=base.features.filter(f=>winter||!['ice','iceclimb','icegully','glacier','icefissure','thinice'].includes(f));
  const flat=(a:number,b:number,band:Band={})=>{if(b>a)c.segments.push({a:{x:a,y:0},b:{x:b,y:0},surface:'stone',...band});};
  let cursor=10;flat(-30,cursor);
  for(let j=0;j<count;j++){
    const start=cursor,featureStart=start+BRANCH_FAN;
    // Two unequal arms leave room for a broad landform, rather than thin
    // partitions. Each junction has different curvature and sight lines.
    const centers=[-5.8-.35*Math.sin(j+c.id),5.8+.35*Math.cos(j*.7+c.id)];
    const paths:RoutePath[]=centers.map((center,channel)=>{
      const first=original[(j*2+channel)%original.length];
      let second=extras[(j+c.id+channel)%extras.length];
      if(first===second)second=extras[(j+c.id+channel+1)%extras.length];
      if(channel===j%centers.length&&j%2===0)second=c.freight?'freightpass':'notch';
      if(first===second)second=c.freight?'softground':winter?'icefissure':'rubblegate';
      return {channel,center,features:[first,second],challenge:channel===j%centers.length?'technical':'rough',curve:{start,end:0,center,sway:1.4,phase:c.id*.71+j*.93+channel*1.8}};
    });
    let sources=paths.map(p=>make(p.features));
    let ends=sources.map(s=>Math.max(...s.zones.map(z=>z.end)));
    // Fill a substantially shorter arm with a real approach puzzle, not a plaza.
    const longest=Math.max(...ends);
    sources=sources.map((s,i)=>{if(longest-ends[i]>24){paths[i].features.push('washboard');return make(paths[i].features);}return s;});
    ends=sources.map(s=>Math.max(...s.zones.map(z=>z.end)));
    const end=featureStart+Math.max(...ends)-12+BRANCH_FAN;
    paths.forEach(p=>p.curve.end=end);
    c.routes!.forks.push({start,end,decision:cursor-4,paths});c.checkpoints.push(cursor-4);
    for(const [i,source] of sources.entries()){
      const p=paths[i],shift=featureStart-12,band:Band={lateral:p.center,depth:PATH_WIDTH,channel:i,curve:p.curve};
      const id=(v:string)=>`${j}-${i}-${v}`;
      flat(start,featureStart,band);
      for(const s of source.segments.filter(s=>s.a.x>=12-.001&&s.b.x<=ends[i]+.001))c.segments.push({...s,a:{x:s.a.x+shift,y:s.a.y},b:{x:s.b.x+shift,y:s.b.y},...band});
      flat(ends[i]+shift,end,band);
      c.zones.push(...source.zones.map(z=>({...z,start:z.start+shift,end:z.end+shift,...band})));
      // Rigid props stay rigid; their origin sits on their arm's actual center.
      c.obstacles.push(...source.obstacles.map(o=>({...o,x:o.x+shift,lateral:pathCenter(p,o.x+shift)+(o.lateral??0),depth:o.depth??PATH_WIDTH,channel:i})));
      const fluid=(w:Course['waters'][number])=>({...w,start:w.start+shift,end:w.end+shift,...band,control:w.control?id(w.control):undefined,drainControl:w.drainControl?id(w.drainControl):undefined,eddies:w.eddies?.map(e=>({...e,x:e.x+shift})),fall:undefined,
        waves:w.fall||p.features.includes('current')?{amplitude:.27+(c.difficulty-1)*.016,wavelength:6.6,period:2.35,phase:(i+j)*1.7}:w.waves});
      c.waters.push(...source.waters.map(fluid));c.muds!.push(...(source.muds??[]).map(w=>({...fluid(w),waves:undefined})));
      c.mechanisms!.push(...(source.mechanisms??[]).map(m=>({...m,id:id(m.id),x:m.x+shift,lateral:pathCenter(p,m.x+shift)+(m.lateral??0),depth:m.depth??PATH_WIDTH,channel:i,signal:m.signal?id(m.signal):undefined,clears:m.clears?.map(id)})));
      c.masterRoutes!.push(...(source.masterRoutes??[]).map(r=>({...r,id:id(r.id),lateral:p.center,curve:p.curve,marks:r.marks.map(m=>({...m,x:m.x+shift}))})));
    }
    // Solid, broad landforms fill the changing spaces between arms. Their feet
    // meet both road profiles; there are no thin extruded separator walls.
    for(let i=1;i<paths.length;i++){
      for(let x=start;x<end;x+=1){
        const b=Math.min(end,x+1),aCenter=(pathCenter(paths[i-1],x)+pathCenter(paths[i],x))/2,bCenter=(pathCenter(paths[i-1],b)+pathCenter(paths[i],b))/2;
        const span=(at:number)=>Math.max(0,pathCenter(paths[i],at)-pathCenter(paths[i-1],at)-PATH_WIDTH);
        const depth=Math.max(span(x),span(b));if(depth<.04)continue;
        const top=(at:number)=>{const edge=Math.min(smooth((at-start-5)/20),smooth((end-at-5)/20));const floor=Math.max(profileHeight(c.segments,at,pathCenter(paths[i-1],at)),profileHeight(c.segments,at,pathCenter(paths[i],at)));return Math.max(0,floor)+edge*(2.9+1.0*Math.sin(at*.09+i)+.45*Math.sin(at*.31+c.id));};
        c.segments.push({a:{x,y:top(x)},b:{x:b,y:top(b)},surface:'stone',lateral:(aCenter+bCenter)/2,depth,ridge:true,island:i-1,edgeA:{left:pathCenter(paths[i-1],x)+PATH_WIDTH/2,right:pathCenter(paths[i],x)-PATH_WIDTH/2},edgeB:{left:pathCenter(paths[i-1],b)+PATH_WIDTH/2,right:pathCenter(paths[i],b)-PATH_WIDTH/2}});
      }
    }
    cursor=end+8;flat(end,cursor);
  }
  c.length=cursor+7;flat(cursor,c.length+40);
  c.features=[...new Set(c.routes!.forks.flatMap(f=>f.paths.flatMap(p=>p.features)))];
  c.subtitle=c.id===12?'Kurven, Abzweigungen und Wasser zum Experimentieren.':'Erkunde die Schluchten. Probiere eine Passage – oder suche einen anderen Weg.';
  return c;
}
function profileHeight(segments:Segment[],x:number,z:number){let height=-12;for(const s of segments)if(!s.ridge&&x>=s.a.x-.001&&x<=s.b.x+.001&&inBand(s,z,0,x))height=Math.max(height,s.a.y+(s.b.y-s.a.y)*(x-s.a.x)/Math.max(.001,s.b.x-s.a.x));return height;}
