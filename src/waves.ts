import type { Water } from './courses';
import {bandCenter} from './branching';

const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function waveEnvelope(w:Water,x:number,z=0){const shore=w.depth===undefined?1:1-smooth((Math.abs(z)-(w.depth/2-1.1))/1.9);return smooth((x-w.start)/4)*smooth((w.end-x)/4)*shore;}
/** Shared by buoyancy, exposed-face drag, spray and the water vertex shader.
 * Intersecting wave trains with anchored shores, not a whole strip oscillating
 * in phase. Prescribed wave energy with orbital flow, not a fluid solver. */
export function waterHeight(w:Water,x:number,lateral=w.sampleLateral??bandCenter(w,x)){
  if(!w.waves)return w.level;
  const {amplitude:a,wavelength,period,phase}=w.waves,k=2*Math.PI/wavelength,o=2*Math.PI/period,t=w.time??0,d=x-w.start;
  const z=lateral-bandCenter(w,x);
  return w.level+a*waveEnvelope(w,x,z)*(Math.sin(k*d+.42*k*z+o*t+phase)+.35*Math.sin(.7*k*d-1.2*k*z-.84*o*t+phase*1.7)+.18*Math.sin(1.7*k*d+.8*k*z-1.3*o*t+phase*.4));
}
export function waveVelocity(w:Water,x:number,y:number,lateral=w.sampleLateral??bandCenter(w,x)){
  if(!w.waves)return {x:0,y:0};
  const {amplitude:a,wavelength,period,phase}=w.waves,k=2*Math.PI/wavelength,o=2*Math.PI/period,t=w.time??0,d=x-w.start;
  const z=lateral-bandCenter(w,x),scale=a*o*waveEnvelope(w,x,z)*Math.exp(k*Math.min(0,y-w.level));
  const p=k*d+.42*k*z+o*t+phase,q=.7*k*d-1.2*k*z-.84*o*t+phase*1.7,r=1.7*k*d+.8*k*z-1.3*o*t+phase*.4;
  return {x:scale*(-Math.sin(p)+.35*.84*Math.sin(q)+.18*1.3*Math.sin(r)),y:scale*(Math.cos(p)-.35*.84*Math.cos(q)-.18*1.3*Math.cos(r))};
}

// Shared spectrum and shoreline envelope for both shader stages.
export const WAVE_GLSL=`uniform vec4 swell;uniform vec2 bounds;uniform float waterWidth;
float surfaceWave(vec2 p){
 float d=p.x-bounds.x,k=swell.y,o=swell.z,a=swell.w,z=p.y;
 float shore=waterWidth>0.?1.-smoothstep(waterWidth*.5-1.1,waterWidth*.5+.8,abs(z)):1.;
 float fade=smoothstep(0.,4.,d)*smoothstep(0.,4.,bounds.y-p.x)*shore;
 return swell.x*fade*(sin(k*d+.42*k*z+o*time+a)+.35*sin(.7*k*d-1.2*k*z-.84*o*time+a*1.7)+.18*sin(1.7*k*d+.8*k*z-1.3*o*time+a*.4));
}`;
