import type { Point } from './shapes';

export type MechanismKind = 'plate' | 'gate' | 'counterweight' | 'swing' | 'fragile' | 'breakice' | 'loose';
export interface MechanismSpec {
  id: string; kind: MechanismKind; x: number; y: number; width: number; height: number;
  signal?: string; travel?: number; strength?: number; lateral?:number; depth?:number; clears?:string[];
}
export interface MasterRoute { id: string; name: string; marks: (Point & { radius: number })[] }
export interface FreightSpec { mass: number; name: string }
export type AdventureFeature = 'sluice' | 'current' | 'softground' | 'fragilepath' | 'thinice' | 'highroute' | 'precisionjump' | 'axlelock' | 'countergate' | 'swinggate' | 'loosefield' | 'flexshelf' | 'waterworks' | 'freightpass';
