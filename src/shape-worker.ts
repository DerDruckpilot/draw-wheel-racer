import { wheelHydro } from './hydrodynamics';
import type { Point } from './shapes';

self.onmessage = (event: MessageEvent<{ id: number; shape: Point[] }>) => {
  const { id, shape } = event.data;
  try { self.postMessage({ id, geometry: wheelHydro(shape) }); }
  catch { self.postMessage({ id, error: true }); }
};
