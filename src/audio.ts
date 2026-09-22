export class GameAudio {
  context?: AudioContext;
  gain?: GainNode;
  oscillator?: OscillatorNode;
  enabled = false;
  async unlock() {
    if (!this.enabled) return;
    if (!this.context) {
      this.context = new AudioContext(); this.gain = this.context.createGain(); this.gain.gain.value = 0;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 350;
      this.oscillator = this.context.createOscillator(); this.oscillator.type = 'sawtooth'; this.oscillator.frequency.value = 48;
      this.oscillator.connect(filter); filter.connect(this.gain); this.gain.connect(this.context.destination); this.oscillator.start();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  update(speed: number, active: boolean) {
    if (!this.context || !this.gain || !this.oscillator) return;
    this.gain.gain.setTargetAtTime(this.enabled && active ? .014 : 0, this.context.currentTime, .15);
    this.oscillator.frequency.setTargetAtTime(38 + Math.min(15, Math.abs(speed)) * 5, this.context.currentTime, .12);
  }
  beep(frequency = 660, duration = .12) {
    if (!this.enabled || !this.context) return;
    const o = this.context.createOscillator(), g = this.context.createGain(); o.frequency.value = frequency;
    g.gain.setValueAtTime(.035, this.context.currentTime); g.gain.exponentialRampToValueAtTime(.001, this.context.currentTime + duration);
    o.connect(g); g.connect(this.context.destination); o.start(); o.stop(this.context.currentTime + duration);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }
}
