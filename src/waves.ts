import type { Water } from './courses';

const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function waveEnvelope(w:Water,x:number){return smooth((x-w.start)/4)*smooth((w.end-x)/4);}
/** Shared by buoyancy, exposed-face drag, spray and the water vertex shader.
 * Two bounded travelling wave trains; this is prescribed wave energy, not CFD. */
export function waterHeight(w:Water,x:number){
  if(!w.waves)return w.level;
  const {amplitude:a,wavelength,period,phase}=w.waves,k=2*Math.PI/wavelength,o=2*Math.PI/period,t=w.time??0,d=x-w.start;
  return w.level+a*waveEnvelope(w,x)*(Math.sin(k*d+o*t+phase)+.28*Math.sin(1.73*k*d-1.31*o*t+phase*.7));
}
export function waveVelocity(w:Water,x:number,y:number){
  if(!w.waves)return {x:0,y:0};
  const {amplitude:a,wavelength,period,phase}=w.waves,k=2*Math.PI/wavelength,o=2*Math.PI/period,t=w.time??0,d=x-w.start;
  const scale=a*o*waveEnvelope(w,x)*Math.exp(k*Math.min(0,y-w.level));
  const p=k*d+o*t+phase,q=1.73*k*d-1.31*o*t+phase*.7;
  return {x:scale*(-Math.sin(p)+.28*1.31*Math.sin(q)),y:scale*(Math.cos(p)-.28*1.31*Math.cos(q))};
}
