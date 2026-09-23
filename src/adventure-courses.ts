import type { Course, Feature, Surface } from './courses';
import type { AdventureFeature, MechanismSpec } from './mechanics-types';
import type { Point } from './shapes';

export const ADVENTURE_FEATURES: AdventureFeature[] = ['sluice','current','softground','fragilepath','thinice','highroute','precisionjump','axlelock','countergate','swinggate','loosefield','flexshelf','waterworks','freightpass'];
export const adventureSpecs: [string,string,Feature[]][] = [
  ['Das Schleusenwerk','MECHANIK · Last, Wasserstand und bewegliche Tore.', ['countergate','sluice','swinggate','notch','axlelock','escarpment']],
  ['Gegen den Strom','FLUSS · Strömungen, Lehm und zwei Wege ans Ufer.', ['current','softground','tidalcave','highroute','notch','siltclimb']],
  ['Auf dünnem Eis','WINTER · Tragfähigkeit und kontrollierte Landungen.', ['thinice','precisionjump','notch','fragilepath','glacier','highroute']],
  ['Die Höhenlinie','MEISTERROUTEN · Der obere Weg verlangt Präzision.', ['highroute','axlelock','precisionjump','notch','loosefield','flexshelf']],
  ['Die Versorgungsfahrt','FRACHT · Bring die Messgeräte heil ins Lager.', ['flexshelf','countergate','fragilepath','softground','swinggate','potholes','freightpass']],
  ['Das alte Wasserwerk','ABSCHLUSSRÄTSEL · Alles hängt zusammen.', ['waterworks','axlelock','current','notch','highroute','escarpment']],
];
type Line=(length:number,profile:Point[],surface?:Surface,gaps?:number[])=>void;
const pts=(p:number[][])=>p.map(([x,y])=>({x,y}));

export function buildAdventure(f:Feature,c:Course,start:number,line:Line):boolean {
  if(!ADVENTURE_FEATURES.includes(f as AdventureFeature))return false;
  c.mechanisms??=[];c.masterRoutes??=[];
  const key=`${f}-${start.toFixed(2)}`;
  const machine=(kind:MechanismSpec['kind'],x:number,y:number,width:number,height:number,extra:Partial<MechanismSpec>={})=>c.mechanisms!.push({id:`${key}-${c.mechanisms!.length}`,kind,x:start+x,y,width,height,...extra});
  const zone=(a:number,b:number,kind:Feature)=>c.zones.push({start:start+a,end:start+b,kind,label:''});
  const roof=(x:number,y:number,width:number)=>c.obstacles.push({kind:'ceiling',structure:'cave',x:start+x,y:y+.2,width,height:.4});
  if(f==='freightpass'){
    line(33,pts([[0,0],[24,0],[24.2,1.15],[27,1.15],[30,.3],[33,0]]));roof(11,2.25,10);zone(0,21,'tunnel');zone(21,33,'steps');
  }else if(f==='sluice'||f==='waterworks'){
    const final=f==='waterworks',len=final?67:48,signal=key;
    // A dry control apron precedes the basin. The free exit bay is long enough
    // for both axles to leave the roof before the steep, stepped bank begins.
    line(len,pts([[0,0],[10,0],[14,-2.9],[31,-2.9],[35,-1.1],[43,-1.1],[46,-.15],[46.2,.65],[49>len?len:49,final?.65:0],...(final?[[52,.65],[52.2,1.65],[57,1.65],[62,.5],[67,0]]:[])]));
    if(final)machine('counterweight',6,.18,7,.22,{signal});else machine('plate',6,.09,3.5,.18,{signal});
    c.waters.push({start:start+10,end:start+46,level:-2.7,deep:true,control:signal,targetLevel:.0,current:{x:0,y:0},...(final?{drainControl:signal+'-outflow',drainLevel:-1.02}:{})});
    roof(26,2.05,9);
    machine('gate',12,1.8,.28,4,{signal,travel:4.8});
    if(final){
      // The exit apron has a second load-operated control: draining the basin
      // releases the exit gate. Both controls remain latched until recovery.
      machine('plate',39,-.99,4,.18,{signal:signal+'-outflow'});
      machine('gate',43,1.2,.26,4,{signal:signal+'-outflow',travel:4.7});
      c.obstacles.push({kind:'beam',x:start+55,y:1.75,width:7,height:.23,tilt:.24});
    }
    zone(0,11,'countergate');zone(11,35,'lake');zone(35,44,'ford');zone(44,len,'steps');
  }else if(f==='current'){
    line(48,pts([[0,0],[4,0],[10,-2.8],[15,-2.8],[18,-1.2],[23,-1.2],[26,-2.65],[34,-2.65],[39,-1.05],[43,-.15],[48,0]]));
    c.waters.push({start:start+4,end:start+43,level:-.05,deep:true,current:{x:-.85,y:0},eddies:[{x:start+20,radius:3,strength:.95}],fall:{x:start+29,top:3.8,width:1.1}});
    zone(0,38,'lake');zone(38,48,'ford');
  }else if(f==='softground'){
    line(35,pts([[0,0],[4,0],[7,-.65],[23,-.65],[26,-.45],[30,0],[35,0]]),'mud');
    c.muds!.push({start:start+4,end:start+30,level:-.03,deep:false,deform:true});zone(0,35,'mudpit');
  }else if(f==='fragilepath'||f==='thinice'){
    line(35,pts([[0,0],[4,0],[5,-1.45],[27,-1.45],...(f==='thinice'?[[27.15,-1],[28.8,-1],[29,-.5],[30.6,-.5],[30.8,0]]:[[30,-.45]]),[35,0]]),f==='thinice'?'ice':'stone');
    for(let j=0;j<6;j++)machine(f==='thinice'?'breakice':'fragile',6.5+j*3.8,.03,3.65,.2,{strength:f==='thinice'?50:62});
    zone(0,35,'brokenbridge');
    if(f==='thinice')c.waters.push({start:start+5,end:start+29,level:.01,deep:false});
  }else if(f==='countergate'){
    line(29,pts([[0,0],[29,0]]));machine('counterweight',7,.2,7,.22,{signal:key});machine('gate',16,1.8,.3,3.7,{signal:key,travel:4.3});zone(0,29,'countergate');
  }else if(f==='swinggate'){
    line(28,pts([[0,0],[4,0],[8,-.25],[20,-.25],[24,0],[28,0]]));
    machine('swing',12,1.85,.22,2.5);machine('swing',20,1.85,.22,2.5);zone(0,28,'swinggate');
  }else if(f==='loosefield'){
    line(30,pts([[0,0],[4,0],[6,-.4],[22,-.4],[25,0],[30,0]]));
    for(let j=0;j<5;j++)machine('loose',8+j*3.1,.1+(j%2)*.1,1+(j%3)*.2,1+(j%3)*.2);zone(0,30,'rocks');
  }else if(f==='flexshelf'){
    const p=pts([[0,0],[3,0]]);for(let j=0;j<16;j++)p.push({x:3+j*1.25+.4,y:.15+Math.sin(j*2.3)*.14},{x:3+j*1.25+1.1,y:.35+(j%3)*.13});p.push({x:28,y:0});line(28,p);zone(0,28,'washboard');
  }else if(f==='axlelock'){
    // The roof ends just beyond a short front-axle pocket. A large rear lever
    // and compact front rim can bridge this opposed height requirement.
    line(34,pts([[0,0],[4,0],[4.15,.75],[7,.75],[7.15,1.45],[11,1.45],[12,.65],[18,.65],[24.5,.65],[24.7,1.5],[27,1.5],[29,.5],[34,0]]));
    roof(16.3,2.55,5.2);zone(0,11,'steps');zone(11,22.5,'tunnel');zone(22.5,34,'steps');
  }else if(f==='highroute'){
    line(43,pts([[0,0],[4,0],[8,-1.35],[30,-1.35],[35,-.4],[39,0],[43,0]]));
    if(c.theme==='alpine')c.waters.push({start:start+5,end:start+35,level:-.5,deep:false});else c.waters.push({start:start+5,end:start+35,level:-.05,deep:false,current:{x:-.3,y:0}});
    // A raised stair and discontinuous elevated ledges are a real upper route;
    // the channel below remains traversable and rejoins the same exit.
    for(const [x,y,w,h] of [[6,.45,2.4,.9],[8,1.15,1.8,.45],[10,1.85,1.8,.45],[13,2.45,3.4,.4],[18.3,2.6,3.0,.35],[24,2.9,3.4,.35],[29.8,2.2,4,.35]])
      c.obstacles.push({kind:'platform',x:start+x,y,width:w,height:h});
    c.masterRoutes.push({id:key,name:'Höhenlinie',marks:[{x:start+13,y:3.6,radius:1.45},{x:start+24,y:4.0,radius:1.45},{x:start+30,y:3.4,radius:1.5}]});
    zone(0,11,'steps');zone(11,34,'ford');zone(34,43,'steps');
  }else if(f==='precisionjump'){
    line(38,pts([[0,0],[4,0],[10,1.3],[13,2.3],[13.2,-2.1],[19,-2.1],[19.15,-1.05],[22,-1.05],[22.2,0],[25,0],[25.2,.85],[29,.85],[33,.4],[38,0]]));
    c.obstacles.push({kind:'platform',x:start+17,y:1.3,width:3.2,height:.35});
    c.masterRoutes.push({id:key,name:'Punktlandung',marks:[{x:start+12,y:3.2,radius:1.45},{x:start+17,y:2.6,radius:1.25}]});zone(0,14,'gap');zone(14,38,'steps');
  }
  return true;
}
