export interface V2 { x:number; z:number }
export interface V3 extends V2 { y:number }
export type Biome='canyon'|'forest'|'glacier'|'quarry'|'coast';
export type Ground='stone'|'soil'|'ice'|'mud'|'gravel';
export interface Trail { points:V3[]; width:number; rugged:number }
export interface Hill extends V2 { radius:number; height:number; stretch:number; angle:number }
export interface Basin extends V2 { id:string; rx:number; rz:number; angle:number; level:number; bottom:number; material:'water'|'mud'|'ice'; waves:number; current:V2; slope?:V2; controlledBy?:string; requires?:string[]; drainedLevel?:number; accessSide?:number }
export interface WorldProp extends V3 { id:string; asset:string; scale:number; yaw:number; pitch?:number; roll?:number; stretch?:V3; anchored?:boolean; mass:number; movable:boolean; foliage?:boolean; detail?:boolean; friction?:number }
export interface Plate extends V3 { id:string; yaw:number; width:number; depth:number; threshold:number }
export interface Gate extends V3 { id:string; yaw:number; width:number; height:number; requires:string[]; mode:'all'|'any'; travel:number; delay:number; kind:'gate'|'lift'|'sluice' }
export interface Bridge extends V3 { id:string; yaw:number; length:number; width:number; angle:number; counterweight:number }
export interface Cache extends V3 { id:string; kind:'cell'|'relic'; circuit?:string }
export interface Camp extends V3 { id:string; yaw:number }
export interface Relay extends V3 { id:string; requires:string[] }
export interface WorldSwitch extends V3 {id:string;yaw:number;toggle?:boolean;gate?:string}
export interface RockCourt extends V3 { width:number; depth:number; height:number; yaw:number; bend:number }
export interface TerrainFeature extends V3 {id:string;kind:'terraces'|'ravine'|'ridge'|'washout'|'shelf'|'pad';yaw:number;length:number;width:number;height:number;phase:number;priority?:boolean}
export interface WorldLevel {
  id:number; name:string; biome:Biome; seed:number; extent:number; start:V3; heading:number; goal:V3;
  trails:Trail[]; hills:Hill[]; basins:Basin[]; props:WorldProp[]; plates:Plate[]; gates:Gate[]; bridges:Bridge[];
  caches:Cache[]; camps:Camp[]; relays:Relay[]; switches:WorldSwitch[]; courts:RockCourt[]; features:TerrainFeature[]; goalRequires:string[]; parMinutes:number;
}
export interface AssetGeometry { positions:number[]; indices:number[] }
export type AssetCollisions=Record<string,AssetGeometry>;
export interface AssetInfo { id:string; name:string; glb:string; size:number[]; triangles:number; bytes:number; source:string; authors:Record<string,string>; license:string }
export interface TerrainTile { key:string; x:number; z:number; positions:Float32Array; normals:Float32Array; indices:Uint32Array; groups:Record<Ground,Uint32Array>; colors:Float32Array; cover:Float32Array; uv:Float32Array }
