import type { Course,Feature,Segment } from './courses';

export interface Band { lateral?:number;depth?:number;channel?:number }
export interface RoutePath { channel:number;center:number;features:Feature[];blocked:boolean }
export interface Fork { start:number;end:number;decision:number;paths:RoutePath[] }
export interface RouteNetwork { halfWidth:number;forks:Fork[] }
export const PATH_CENTERS=[-7,0,7];
export const PATH_WIDTH=5.6;
export const GROUND_GROUPS=[0x100,0x200,0x400];
export const PROP_GROUPS=[0x800,0x1000,0x2000];
export const RIDGE_GROUP=0x4000;
export const ROUTE_GROUPS=0x7f00;
export function inBand(b:Band,offset:number,margin=0){return b.lateral===undefined||Math.abs(offset-b.lateral)<=(b.depth??PATH_WIDTH)/2+margin;}
export function routeFork(c:Course,x:number){return c.routes?.forks.find(f=>x>=f.start&&x<=f.end);}
export function routePath(c:Course,x:number,offset:number){return routeFork(c,x)?.paths.reduce((a,b)=>Math.abs(a.center-offset)<Math.abs(b.center-offset)?a:b);}
export function groundGroup(channel?:number){return channel===undefined?1:GROUND_GROUPS[channel];}
export function propGroup(channel?:number){return channel===undefined?32:PROP_GROUPS[channel];}

/** Every fork contains two genuinely different passages and one physical dead end.
 * Junctions are level and wide enough to reverse and change branches. No route
 * is selected by a trigger and no wall disappears based on progress. */
export function branchCourse(base:Course,make:(features:Feature[])=>Course):Course {
  const c:Course={...base,segments:[],obstacles:[],waters:[],muds:[],zones:[],mechanisms:[],masterRoutes:[],checkpoints:[2],routes:{halfWidth:9.8,forks:[]}};
  const winter=c.theme==='alpine';
  const count=c.id===12?6:c.id>=13&&c.id<=15?5:4;
  const extras:Feature[]=c.freight?['freightpass','flexshelf','softground','loosefield','countergate','potholes']:winter?['icefissure','notch','thinice','glacier','brokenbridge','current']:['notch','current','rubblegate','mudpit','precisionjump','softground'];
  const original=base.features.filter(f=>winter||!['ice','iceclimb','icegully','glacier','icefissure','thinice'].includes(f));
  const flat=(a:number,b:number,band:Band={})=>{if(b>a)c.segments.push({a:{x:a,y:0},b:{x:b,y:0},surface:'stone',...band});};
  let cursor=12;flat(-30,cursor);
  for(let j=0;j<count;j++){
    const start=cursor+19,featureStart=start+6;
    const blocked=(c.id+j*2+1)%3;
    const paths:RoutePath[]=PATH_CENTERS.map((center,channel)=>{
      const first=original[(j*2+channel)%original.length];
      let second=extras[(j+c.id+channel)%extras.length];
      if(first===second)second=extras[(j+c.id+channel+1)%extras.length];
      // A low route and an exposed climbing/water route demand different forms.
      if(channel===(blocked+1)%3&&j%2===0)second=c.freight?'freightpass':'notch';
      if(first===second)second=c.freight?'softground':winter?'icefissure':'rubblegate';
      // A blocked arm must also be reversible: no one-way jump, collapsing deck
      // or flood gate between the junction and its rockfall.
      const features:Feature[]=channel===blocked?[(j+c.id)%2?'domes':'flexshelf',(j+c.id)%3?'rocks':'washboard']:[first,second];
      return {channel,center,features,blocked:channel===blocked};
    });
    const sources=paths.map(p=>make(p.features));
    const ends=sources.map(s=>Math.max(...s.zones.map(z=>z.end)));
    const length=Math.max(...ends)-12,end=featureStart+length+8;
    c.routes!.forks.push({start,end,decision:cursor+3,paths});c.checkpoints.push(cursor+3);
    flat(cursor,start);
    for(const [i,source] of sources.entries()){
      const p=paths[i],shift=featureStart-12,band={lateral:p.center,depth:PATH_WIDTH,channel:i};
      const id=(v:string)=>`${j}-${i}-${v}`;
      flat(start,featureStart,band);
      for(const s of source.segments.filter(s=>s.a.x>=12-.001&&s.b.x<=ends[i]+.001))c.segments.push({...s,a:{x:s.a.x+shift,y:s.a.y},b:{x:s.b.x+shift,y:s.b.y},...band});
      flat(ends[i]+shift,end,band);
      c.zones.push(...source.zones.map(z=>({...z,start:z.start+shift,end:z.end+shift,...band})));
      c.obstacles.push(...source.obstacles.map(o=>({...o,x:o.x+shift,lateral:p.center+(o.lateral??0),depth:o.depth??PATH_WIDTH,channel:i})));
      const fluid=(w:NonNullable<Course['waters']>[number])=>({...w,start:w.start+shift,end:w.end+shift,...band,control:w.control?id(w.control):undefined,drainControl:w.drainControl?id(w.drainControl):undefined,eddies:w.eddies?.map(e=>({...e,x:e.x+shift})),fall:undefined,
        waves:w.fall||p.features.includes('current')?{amplitude:.62+(c.difficulty-1)*.035,wavelength:7.8,period:2.9,phase:(i+j)*1.7}:w.waves});
      c.waters.push(...source.waters.map(fluid));c.muds!.push(...(source.muds??[]).map(w=>({...fluid(w),waves:undefined})));
      c.mechanisms!.push(...(source.mechanisms??[]).map(m=>({...m,id:id(m.id),x:m.x+shift,lateral:p.center+(m.lateral??0),depth:m.depth??PATH_WIDTH,channel:i,signal:m.signal?id(m.signal):undefined,clears:m.clears?.map(id)})));
      c.masterRoutes!.push(...(source.masterRoutes??[]).map(r=>({...r,id:id(r.id),lateral:p.center,marks:r.marks.map(m=>({...m,x:m.x+shift}))})));
      if(p.blocked){
        const x=featureStart+Math.min(length-8,Math.max(19,(ends[i]-12)*.62));
        const floor=profileHeight(c.segments,x,p.center);
        // Sealed rockfall: the return journey stays possible; there is no death pit.
        c.obstacles.push({kind:'boulder',x,y:floor,width:7.4,height:7.5,lane:0,lateral:p.center,depth:PATH_WIDTH+.3,channel:i,deadEnd:true,
          outline:[{x:-3.7,y:-.7},{x:3.7,y:-.7},{x:3.0,y:4.8},{x:1.4,y:6.1},{x:-.5,y:6.8},{x:-2.8,y:5.5}]});
      }
    }
    // Rounded, continuous bedrock between neighboring profiles, with buried feet.
    for(const z of [-3.5,3.5]){
      const profile=[];
      for(let x=start;x<=end+.01;x+=1.5){const edge=Math.max(0,Math.min(1,(x-start)/7,(end-x)/7)),floor=Math.max(profileHeight(c.segments,x,z-2),profileHeight(c.segments,x,z+2));profile.push({x,y:edge*edge*(3-2*edge)*(Math.max(0,floor)+1.3+.35*Math.sin(x*.39)+.22*Math.sin(x*.91+z))});}
      if(profile.at(-1)!.x<end)profile.push({x:end,y:0});
      for(let k=1;k<profile.length;k++)c.segments.push({a:profile[k-1],b:profile[k],surface:'stone',lateral:z,depth:1.4,ridge:true});
    }
    cursor=end+19;flat(end,cursor);
  }
  c.length=cursor+9;flat(cursor,c.length+40);
  c.features=[...new Set(c.routes!.forks.flatMap(f=>f.paths.flatMap(p=>p.features)))];
  c.subtitle=c.id===12?'Breite Abzweigungen, Sackgassen und Brandung zum Experimentieren.':'Drei Wege an jeder Abzweigung. Erkunde, kehre um, finde deinen Weg.';
  return c;
}
function profileHeight(segments:Segment[],x:number,z:number){let height=-12;for(const s of segments)if(!s.ridge&&inBand(s,z)&&x>=s.a.x-.001&&x<=s.b.x+.001)height=Math.max(height,s.a.y+(s.b.y-s.a.y)*(x-s.a.x)/Math.max(.001,s.b.x-s.a.x));return height;}
