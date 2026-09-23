import { MAX_INPUT_POINTS, preset, sanitizeShape, simplifyStroke, type Point, type ShapeName } from './shapes';
import { prepareWheel } from './shape-preparation';
export class DrawingPad {
  shape = preset('round');
  previous = preset('round');
  raw: Point[] = [];
  active = false;
  enabled = true;
  private pointer: number | null = null;
  private mountId = 0;
  private pendingShape: Point[] | null = null;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private ro: ResizeObserver;
  constructor(public canvas: HTMLCanvasElement, public onShape: (shape: Point[]) => boolean, public feedback: (text: string) => void) {
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
  get scale() { return Math.min(this.width * .44, this.height * .43) / 1.2; }
  point(e: PointerEvent): Point { const rect = this.canvas.getBoundingClientRect(); return { x: (e.clientX - rect.left - this.width / 2) / this.scale, y: -(e.clientY - rect.top - this.height / 2) / this.scale }; }
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
        // Compact only exceptionally long captures; keep recording the end of
        // the gesture instead of silently stopping after 4000 samples.
        if (this.raw.length >= MAX_INPUT_POINTS - 1) {
          this.raw = simplifyStroke(this.raw, .001, MAX_INPUT_POINTS / 2);
        }
        this.raw.push(p);
      }
    }
    this.render();
  }
  up(e: PointerEvent) {
    if (!this.active || e.pointerId !== this.pointer) return;
    this.raw.push(this.point(e)); this.active = false; this.pointer = null;
    const shape = sanitizeShape(this.raw);
    if (shape) void this.mount(shape);
    else this.feedback('Zeichne eine etwas längere Linie.');
    this.raw = []; this.render();
  }
  cancelPending() { this.mountId++; this.pendingShape = null; this.canvas.removeAttribute('aria-busy'); }
  cancel() { this.cancelPending(); this.active = false; this.pointer = null; this.raw = []; this.render(); }
  private async mount(shape: Point[]) {
    const id = ++this.mountId;
    const preparation = prepareWheel(shape);
    if (preparation) {
      this.pendingShape = shape; this.canvas.setAttribute('aria-busy', 'true'); this.render();
      this.feedback('Deine Radform wird vorbereitet …');
      const ready = await preparation;
      if (id !== this.mountId) return;
      this.pendingShape = null; this.canvas.removeAttribute('aria-busy');
      if (!ready) { this.feedback('Die Kontur konnte nicht montiert werden. Versuche es noch einmal.'); this.render(); return; }
    }
    if (this.onShape(shape)) { this.previous = this.shape; this.shape = shape; this.feedback('Neue Radform übernommen'); }
    else this.feedback('Die Kontur konnte nicht montiert werden. Versuche es noch einmal.');
    this.render();
  }
  set(shape: Point[], notify = true) { this.cancel(); if (notify) void this.mount(shape); else { this.previous = this.shape; this.shape = shape; this.render(); } }
  usePreset(name: ShapeName) { this.set(preset(name)); }
  get visibleShape() { return this.pendingShape ?? this.shape; }
  undo() { const p = this.pendingShape ? this.shape : this.previous; this.set(p); }
  render() {
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h); if (!w) return;
    ctx.strokeStyle = this.active ? '#ffffff65' : '#ffffff26'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.arc(w / 2, h / 2, this.scale * 1.2, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    const draw = (points: Point[], color: string, width: number) => {
      if (points.length < 1) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath();
      points.forEach((p, i) => { const x = w / 2 + p.x * this.scale, y = h / 2 - p.y * this.scale; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
    };
    ctx.shadowColor = '#ffffff6b'; ctx.shadowBlur = 2;
    draw(this.visibleShape, this.active ? '#ffffff48' : '#101615', this.scale * .19);
    if (this.active) draw(this.raw, '#101615', this.scale * .19);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffffab'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2); ctx.stroke();
  }
}
