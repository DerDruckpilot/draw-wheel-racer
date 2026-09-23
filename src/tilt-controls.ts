import { clamp } from './shapes';

export type TiltSample = { beta:number;gamma:number;angle:number };
const radians=Math.PI/180;
/** Gravity in screen coordinates; alpha (compass heading) is deliberately unused. */
export function screenTilt({beta,gamma,angle}:TiltSample){
  const b=beta*radians,g=gamma*radians,a=angle*radians;
  const x=-Math.cos(b)*Math.sin(g),y=Math.sin(b),z=Math.cos(b)*Math.cos(g);
  // Screen angle is counter-clockwise from portrait: at 90°, screen-right
  // points toward device -Y. Project earth-up into that screen frame.
  const sx=x*Math.cos(a)-y*Math.sin(a),sy=x*Math.sin(a)+y*Math.cos(a);
  return {roll:Math.atan2(sx,Math.hypot(sy,z))/radians,pitch:Math.atan2(sy,z)/radians};
}
const difference=(a:number,b:number)=>((a-b+540)%360)-180;
const response=(v:number,range:number)=>Math.sign(v)*clamp((Math.abs(v)-2.5)/(range-2.5),0,1);
export class TiltFilter {
  neutral?:ReturnType<typeof screenTilt>;
  angle=0;weight=0;steer=0;
  calibrate(sample:TiltSample){this.neutral=screenTilt(sample);this.angle=sample.angle;this.clear();}
  clear(){this.weight=0;this.steer=0;}
  update(sample:TiltSample,dt:number){
    if(!this.neutral||sample.angle!==this.angle)this.calibrate(sample);
    const p=screenTilt(sample),blend=1-Math.exp(-Math.min(.1,dt)/.12);
    this.weight+=(-response(difference(p.roll,this.neutral!.roll),20)-this.weight)*blend;
    this.steer+=(response(difference(p.pitch,this.neutral!.pitch),18)-this.steer)*blend;
    return {weight:this.weight,steer:this.steer};
  }
}
type SensorConstructor=typeof DeviceOrientationEvent & {requestPermission?:()=>Promise<string>};
export class TiltControls {
  filter=new TiltFilter();
  active=false;running=false;status='Aus';
  private sample?:TiltSample;
  private lastSample=0;
  private clock=0;
  constructor(private change:()=>void){
    window.addEventListener('deviceorientation',e=>{
      if(!this.active||e.beta===null||e.gamma===null||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
      const now=performance.now(),resumed=!!this.sample&&now-this.lastSample>900;
      this.sample={beta:e.beta,gamma:e.gamma,angle:screen.orientation?.angle??Number((window as any).orientation??0)};
      this.lastSample=now;
      if(!this.filter.neutral||resumed){this.filter.calibrate(this.sample);this.status='Aktiv';this.change();}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();});
    window.addEventListener('blur',()=>this.suspend());
  }
  async enable(){
    const sensor=window.DeviceOrientationEvent as SensorConstructor|undefined;
    if(!sensor||!window.isSecureContext){this.status='Keine Neigungssensoren verfügbar';this.change();return false;}
    try{
      // Safari requires this call directly from a tap, before any awaited work.
      const permission=sensor.requestPermission?await sensor.requestPermission():'granted';
      if(permission!=='granted'){this.status='Sensorzugriff nicht erlaubt';this.change();return false;}
      this.active=true;this.sample=undefined;this.filter.neutral=undefined;this.filter.clear();this.lastSample=performance.now();this.status='Warte auf Sensoren …';this.change();
      const attempt=this.lastSample;window.setTimeout(()=>{if(this.active&&!this.sample&&this.lastSample===attempt){this.status='Keine Sensordaten';this.change();}},3200);return true;
    }catch{this.status='Sensorzugriff nicht möglich';this.change();return false;}
  }
  disable(){this.active=false;this.filter.clear();this.status='Aus';this.change();}
  calibrate(){if(this.sample){this.filter.calibrate(this.sample);this.status='Aktiv';this.change();}}
  suspend(){this.running=false;this.filter.clear();this.clock=0;}
  resume(){this.running=true;this.calibrate();}
  read(now:number){
    const dt=this.clock?(now-this.clock)/1000:1/60;this.clock=now;
    if(!this.active||!this.running||!this.sample||now-this.lastSample>900){
      this.filter.clear();
      if(this.active&&now-this.lastSample>3000&&this.status!=='Keine Sensordaten'){this.status='Keine Sensordaten';this.change();}
      return null;
    }
    return this.filter.update(this.sample,dt);
  }
}
