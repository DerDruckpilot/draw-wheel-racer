import { cacheWheelHydro, type HydroShape } from './hydrodynamics';
import { shapeLength, type Point } from './shapes';

let worker: Worker | undefined;
let nextId = 0;
const pending = new Map<number, { shape: Point[]; resolve: (ok: boolean) => void }>();

// Polygon unions of very long scribbles can take hundreds of milliseconds.
// Compute those off the game thread; the existing wheels keep driving meanwhile.
export function prepareWheel(shape: Point[]): Promise<boolean> | undefined {
  if (shape.length <= 128 && shapeLength(shape) <= 22) return;
  if (!worker) {
    worker = new Worker(new URL('./shape-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<{ id: number; geometry?: HydroShape[] }>) => {
      const job = pending.get(event.data.id); if (!job) return;
      pending.delete(event.data.id);
      if (event.data.geometry) cacheWheelHydro(job.shape, event.data.geometry);
      job.resolve(!!event.data.geometry);
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.resolve(false);
      pending.clear(); worker?.terminate(); worker = undefined;
    };
  }
  const id = ++nextId;
  return new Promise(resolve => { pending.set(id, { shape, resolve }); worker!.postMessage({ id, shape }); });
}
