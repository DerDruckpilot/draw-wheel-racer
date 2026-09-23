import { EXPEDITION_COUNT } from './courses';
export interface ExpeditionRecord { completed: boolean; noRescue: boolean; allCaches: boolean; fewestRescues: number; masterRoutes?:string[]; freightDelivered?:boolean }
export const expeditionStars = (record: ExpeditionRecord) => Number(record.completed) + Number(record.noRescue);
export function recordExpedition(previous: ExpeditionRecord | undefined, rescues: number, found: number, total: number, achievements?:{masterRoutes:string[];freightDelivered:boolean}): ExpeditionRecord {
  const extra=achievements?{masterRoutes:[...new Set([...(previous?.masterRoutes??[]),...achievements.masterRoutes])],freightDelivered:!!previous?.freightDelivered||achievements.freightDelivered}:previous?.masterRoutes?{masterRoutes:previous.masterRoutes,freightDelivered:previous.freightDelivered}:{};
  return { completed: true, noRescue: (previous?.noRescue ?? false) || rescues === 0, allCaches: (previous?.allCaches ?? false) || (total > 0 && found === total), fewestRescues: Math.min(previous?.fewestRescues ?? Infinity, rescues),...extra };
}
export function restoreExpeditions(raw: unknown): Record<number, ExpeditionRecord> {
  const result: Record<number, ExpeditionRecord> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || +key >= EXPEDITION_COUNT || !value || typeof value !== 'object' || value.completed !== true) continue;
    result[+key] = { completed: true, noRescue: value.noRescue === true, allCaches: value.allCaches === true, fewestRescues: Number.isInteger(value.fewestRescues) && value.fewestRescues >= 0 ? value.fewestRescues : 0 };
    if(Array.isArray(value.masterRoutes))result[+key].masterRoutes=[...new Set(value.masterRoutes.filter((v:unknown):v is string=>typeof v==='string'&&/^[a-z]+-\d+\.\d{2}$/.test(v)))].slice(0,30) as string[];
    if(typeof value.freightDelivered==='boolean')result[+key].freightDelivered=value.freightDelivered;
  }
  return result;
}
