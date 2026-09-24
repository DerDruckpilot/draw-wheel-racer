import {clamp} from './shapes';

/** Uniform scale of the mounted drawing, including its rubber cross section.
 * Keep the original strokes: resizing must never simplify or destroy a design. */
export const MIN_WHEEL_SIZE=.4;
export const MAX_WHEEL_SIZE=1.4;
export const DEFAULT_WHEEL_SIZE=1;
export const wheelSize=(value:number)=>Number.isFinite(value)?clamp(value,MIN_WHEEL_SIZE,MAX_WHEEL_SIZE):DEFAULT_WHEEL_SIZE;
export const wheelSizeLabel=(value:number)=>`${Math.round(value*100)} %`;
