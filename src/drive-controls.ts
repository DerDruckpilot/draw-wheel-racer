import { clamp } from './shapes';

/** Independent pointer ownership lets one thumb drive while another draws. */
export class DriveControls {
  enabled = false;
  cruise = false;
  private pointers = new Map<number, { kind: string; startY: number; value: number }>();
  private keys = new Set<string>();
  constructor(private root: HTMLElement, private change: (drive: number, brake: number) => void) {
    root.querySelectorAll<HTMLButtonElement>('[data-pedal]').forEach(button => {
      const kind = button.dataset.pedal!;
      button.addEventListener('contextmenu', e => e.preventDefault());
      button.addEventListener('pointerdown', e => {
        if (!this.enabled || e.button !== 0) return;
        e.preventDefault(); button.setPointerCapture(e.pointerId);
        this.cruise = false;
        this.pointers.set(e.pointerId, { kind, startY: e.clientY, value: kind === 'gas' ? .65 : .55 }); this.publish();
      });
      button.addEventListener('pointermove', e => {
        const p = this.pointers.get(e.pointerId); if (!p) return;
        p.value = clamp((p.kind === 'gas' ? .65 : .55) + (p.startY - e.clientY) / 90, .15, 1); this.publish();
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, e => {
        this.pointers.delete((e as PointerEvent).pointerId); this.publish();
      });
    });
    root.querySelector<HTMLButtonElement>('#cruise-button')!.onclick = () => {
      if (!this.enabled) return;
      this.cruise = !this.cruise; this.publish();
    };
    const bound = ['ArrowRight', 'KeyD', 'ArrowLeft', 'KeyA', 'Space'];
    window.addEventListener('keydown', e => {
      if (!this.enabled || !bound.includes(e.code)) return;
      e.preventDefault(); this.cruise = false; this.keys.add(e.code); this.publish();
    });
    window.addEventListener('keyup', e => { if (this.keys.delete(e.code)) { e.preventDefault(); this.publish(); } });
    window.addEventListener('blur', () => this.reset());
  }
  reset() { this.pointers.clear(); this.keys.clear(); this.cruise = false; this.publish(); }
  private publish() {
    const held = (kind: string) => Math.max(0, ...[...this.pointers.values()].filter(p => p.kind === kind).map(p => p.value));
    const gas = Math.max(held('gas'), this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 1 : 0);
    const reverse = Math.max(held('reverse'), this.keys.has('ArrowLeft') || this.keys.has('KeyA') ? .75 : 0);
    const brake = held('brake') > 0 || this.keys.has('Space') || (gas > 0 && reverse > 0) ? 1 : 0;
    const drive = brake ? 0 : reverse ? -reverse : gas || (this.cruise ? .65 : 0);
    this.root.querySelectorAll<HTMLButtonElement>('[data-pedal]').forEach(b => {
      const active = b.dataset.pedal === 'gas' ? gas > 0 : b.dataset.pedal === 'reverse' ? reverse > 0 : brake > 0;
      b.classList.toggle('held', active); b.setAttribute('aria-pressed', String(active));
    });
    const cruise = this.root.querySelector<HTMLButtonElement>('#cruise-button')!;
    cruise.classList.toggle('held', this.cruise); cruise.setAttribute('aria-pressed', String(this.cruise));
    this.root.style.setProperty('--throttle', String(Math.abs(drive)));
    this.change(this.enabled ? drive : 0, this.enabled ? brake : 0);
  }
}
