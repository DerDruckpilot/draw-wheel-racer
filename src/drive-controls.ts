import { clamp } from './shapes';
type Pedal = { kind: string; startX: number; startY: number; started: number; reverse: boolean; latched: boolean;throttle:number };

/** Each thumb owns its pointer. A gas swipe latches cruise; brake cancels it. */
export class DriveControls {
  enabled = false;
  cruise = false;
  private pointers = new Map<number, Pedal>();
  private keys = new Set<string>();
  constructor(private root: HTMLElement, private change: (drive: number, brake: number) => void, private speed = () => 0) {
    root.querySelectorAll<HTMLButtonElement>('[data-pedal]').forEach(button => {
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('pointerdown', e => {
        if (!this.enabled || e.button !== 0) return;
        e.preventDefault(); button.setPointerCapture(e.pointerId); this.cruise = false;
        const r=button.getBoundingClientRect(),throttle=.12+.88*clamp((r.bottom-e.clientY)/r.height*1.3,0,1);
        this.pointers.set(e.pointerId, { kind: button.dataset.pedal!, startX: e.clientX, startY: e.clientY, started: performance.now(), reverse: false, latched: false,throttle }); this.publish();
      });
      button.addEventListener('pointermove', e => {
        const p = this.pointers.get(e.pointerId); if (!p) return;
        const r=button.getBoundingClientRect();p.throttle=.12+.88*clamp((r.bottom-e.clientY)/r.height*1.3,0,1);
        if (p.kind === 'gas' && p.startY - e.clientY >= 42 && Math.abs(e.clientX - p.startX) < 95) { p.latched = true; this.cruise = true; }
        this.publish();
      });
      button.addEventListener('pointerup', e => { this.pointers.delete(e.pointerId); this.publish(); });
      for (const event of ['pointercancel', 'lostpointercapture']) button.addEventListener(event, e => {
        if (this.pointers.delete((e as PointerEvent).pointerId)) { this.cruise = false; this.publish(); }
      });
    });
    const bound = ['ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'Space','KeyW','KeyS','ArrowUp','ArrowDown','KeyQ','KeyE'];
    window.addEventListener('keydown', e => { if (!this.enabled || !bound.includes(e.code)) return; e.preventDefault(); this.cruise = false; this.keys.add(e.code); this.publish(); });
    window.addEventListener('keyup', e => { if (this.keys.delete(e.code)) { e.preventDefault(); this.publish(); } });
    window.addEventListener('blur', () => this.reset());
  }
  get steering(){return this.keys.has('KeyW')||this.keys.has('ArrowUp')?-1:this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:null;}
  get weight(){return this.keys.has('KeyQ')?-1:this.keys.has('KeyE')?1:null;}
  update() {
    let changed = false;
    for (const p of this.pointers.values()) if (p.kind === 'brake' && !p.reverse && performance.now() - p.started > 350 && this.speed() < .28) { p.reverse = true; changed = true; }
    if (changed) this.publish();
  }
  reset() { this.pointers.clear(); this.keys.clear(); this.cruise = false; this.publish(); }
  private publish() {
    const held = [...this.pointers.values()];
    const gas = held.some(p => p.kind === 'gas') || this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const left = held.find(p => p.kind === 'brake');
    const reverse = left?.reverse || this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const brake = this.keys.has('Space') || (left && !left.reverse) || (gas && reverse) ? 1 : 0;
    if (left || brake || reverse) this.cruise = false;
    const throttle=this.keys.has('ArrowRight')||this.keys.has('KeyD')?1:Math.max(0,...held.filter(p=>p.kind==='gas').map(p=>p.throttle));
    const drive = brake ? 0 : reverse ? -(left?Math.max(.12,left.throttle*.7):.65) : gas ? throttle : this.cruise ? .65 : 0;
    this.root.querySelectorAll<HTMLButtonElement>('[data-pedal]').forEach(b => {
      const active = b.dataset.pedal === 'gas' ? gas || this.cruise : !!left || brake > 0 || !!reverse;
      b.classList.toggle('held', !!active); b.setAttribute('aria-pressed', String(!!active));
    });
    const gasButton = this.root.querySelector<HTMLButtonElement>('[data-pedal="gas"]')!;
    gasButton.classList.toggle('cruising', this.cruise);
    gasButton.setAttribute('aria-label', this.cruise ? 'Tempomat aktiv, antippen zum Lösen' : 'Gas, nach oben wischen aktiviert den Tempomat');
    this.root.querySelector('[data-pedal="brake"]')!.setAttribute('aria-label', reverse ? 'Rückwärts fahren' : 'Bremse und Rückwärtsgang');
    this.root.style.setProperty('--throttle', String(Math.abs(drive)));
    this.change(this.enabled ? clamp(drive, -1, 1) : 0, this.enabled ? brake : 0);
  }
}
