import { EXPEDITION_COUNT } from './courses';
export interface ExpeditionRecord { completed: boolean; noRescue: boolean; allCaches: boolean; fewestRescues: number }
export const expeditionStars = (record: ExpeditionRecord) => Number(record.completed) + Number(record.noRescue);
export function recordExpedition(previous: ExpeditionRecord | undefined, rescues: number, found: number, total: number): ExpeditionRecord {
  return { completed: true, noRescue: (previous?.noRescue ?? false) || rescues === 0, allCaches: (previous?.allCaches ?? false) || (total > 0 && found === total), fewestRescues: Math.min(previous?.fewestRescues ?? Infinity, rescues) };
}
export function restoreExpeditions(raw: unknown): Record<number, ExpeditionRecord> {
  const result: Record<number, ExpeditionRecord> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d+$/.test(key) || +key >= EXPEDITION_COUNT || !value || typeof value !== 'object' || value.completed !== true) continue;
    result[+key] = { completed: true, noRescue: value.noRescue === true, allCaches: value.allCaches === true, fewestRescues: Number.isInteger(value.fewestRescues) && value.fewestRescues >= 0 ? value.fewestRescues : 0 };
  }
  return result;
}
