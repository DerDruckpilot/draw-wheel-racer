import { MAX_INPUT_POINTS, preset, sanitizeShape, simplifyStroke, splitStrokes, type Point, type ShapeName } from './shapes';
import { prepareWheel } from './shape-preparation';

/** A draft belongs to one axle. Lifting the pen never installs a wheel. */
export class DrawingPad {
  shape: Point[] = [];
  draft: Point[] = [];
  raw: Point[] = [];
  active = false;
  enabled = true;
  busy = false;
  private pointer: number | null = null;
  private mountId = 0;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private ro: ResizeObserver;
  constructor(public canvas: HTMLCanvasElement, public onShape: (shape: Point[]) => boolean, public feedback: (text: string) => void, private changed: () => void = () => {}) {
    this.ctx = canvas.getContext('2d')!;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
    canvas.addEventListener('pointerdown', e => this.down(e));
    canvas.addEventListener('pointermove', e => this.move(e));
    canvas.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', () => this.cancel());
    canvas.addEventListener('lostpointercapture', () => { if (this.active) this.cancel(); });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(); this.width = r.width; this.height = r.height;
    const dpr = Math.min(devicePixelRatio, 2); this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.render();
  }
  get scale() { return Math.min(this.width, this.height) * .43 / 1.2; }
  get dirty() { return this.draft.length > 1; }
  get visibleShape() { return this.draft; }
  point(e: PointerEvent): Point { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - this.width / 2) / this.scale, y: -(e.clientY - r.top - this.height / 2) / this.scale }; }
  down(e: PointerEvent) {
    if (!this.enabled || this.active || e.button !== 0) return;
    e.preventDefault(); this.cancelPending(); this.canvas.setPointerCapture(e.pointerId); this.pointer = e.pointerId; this.active = true; this.raw = [this.point(e)]; this.render();
  }
  move(e: PointerEvent) {
    if (!this.active || e.pointerId !== this.pointer) return;
    e.preventDefault();
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
    for (const event of events.length ? events : [e]) {
      const p = this.point(event), prev = this.raw.at(-1)!;
      if (Math.hypot(p.x - prev.x, p.y - prev.y) > .002) {
        if (this.raw.length >= MAX_INPUT_POINTS - 1024) this.raw = simplifyStroke(this.raw, .001, MAX_INPUT_POINTS / 2);
        this.raw.push(p);
      }
    }
    this.render();
  }
  up(e: PointerEvent) {
    if (!this.active || e.pointerId !== this.pointer) return;
    this.raw.push(this.point(e)); this.active = false; this.pointer = null;
    const stroke = this.raw.map((p, i) => this.draft.length && !i ? { ...p, move: true as const } : p);
    const shape = sanitizeShape([...this.draft, ...stroke]);
    if (shape) this.draft = shape; else this.feedback('Zeichne eine etwas längere Linie.');
    this.raw = []; this.render();
  }
  cancelPending() { this.mountId++; this.busy = false; this.canvas.removeAttribute('aria-busy'); }
  cancel() { this.cancelPending(); this.active = false; this.pointer = null; this.raw = []; this.render(); }
  async mount(shape = this.draft) {
    if (!this.enabled || this.active || this.busy) return false;
    const valid = sanitizeShape(shape); if (!valid) return false;
    const id = ++this.mountId, preparation = prepareWheel(valid);
    if (preparation) {
      this.busy = true; this.canvas.setAttribute('aria-busy', 'true'); this.render();
      const ready = await preparation;
      if (id !== this.mountId) return false;
      this.busy = false; this.canvas.removeAttribute('aria-busy');
      if (!ready) { this.feedback('Die Kontur konnte nicht vorbereitet werden. Tippe erneut auf das Häkchen.'); this.render(); return false; }
    }
    const ok = this.onShape(valid);
    if (ok) { this.shape = valid; this.draft = []; }
    else this.feedback('Die Kontur konnte nicht montiert werden. Versuche es noch einmal.');
    this.render(); return ok;
  }
  set(shape: Point[], notify = true) { this.cancel(); this.draft = shape; if (notify) void this.mount(); else { this.shape = shape; this.render(); } }
  // Used only by deterministic development/test hooks; no preset UI exists.
  usePreset(name: ShapeName) { this.set(preset(name)); }
  undo() { this.cancel(); this.draft = splitStrokes(this.draft).slice(0, -1).flat(); this.render(); }
  clear() { this.cancel(); this.draft = []; this.render(); }
  render() {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h); if (!w) return;
    ctx.strokeStyle = '#ffffff35'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(w / 2, h / 2, this.scale * 1.2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const draw = (points: Point[]) => {
      ctx.strokeStyle = '#101c18'; ctx.lineWidth = this.scale * .19; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
      points.forEach((p, i) => { const x = w / 2 + p.x * this.scale, y = h / 2 - p.y * this.scale; i && !p.move ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    };
    ctx.shadowColor = '#ffffff9b'; ctx.shadowBlur = 2; draw(this.draft); if (this.active) draw(this.raw); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffffbb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.stroke();
    this.changed();
  }
}
