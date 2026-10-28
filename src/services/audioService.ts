// Procedural Web Audio API sound synthesizer (Zero external MP3 dependencies)

class EmergencyAudioService {
  private ctx: AudioContext | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private isSirenActive = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Play short tactile tick during 5-second hold
  public playHoldTick(frequency = 440, duration = 0.04) {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy catch
    }
  }

  // Dispatch confirmation chime
  public playDispatchConfirmed() {
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.12, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch {
      // Silently catch
    }
  }

  // Toggle or start ambulance emergency siren (wail effect)
  public startSiren() {
    try {
      this.initCtx();
      if (!this.ctx || this.isSirenActive) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(650, this.ctx.currentTime);

      // LFO modulates the siren frequency between ~550Hz and 950Hz
      lfo.type = 'triangle';
      lfo.frequency.setValueAtTime(0.65, this.ctx.currentTime); // 1.5s wail period
      lfoGain.gain.setValueAtTime(220, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime); // Soft volume

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      lfo.start();
      osc.start();

      this.sirenOsc = osc;
      this.sirenGain = gain;
      this.sirenLfo = lfo;
      this.isSirenActive = true;
    } catch {
      // Catch policy
    }
  }

  public stopSiren() {
    try {
      if (this.sirenGain && this.ctx) {
        this.sirenGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
        setTimeout(() => {
          this.sirenOsc?.stop();
          this.sirenLfo?.stop();
          this.sirenOsc?.disconnect();
          this.sirenLfo?.disconnect();
          this.sirenGain?.disconnect();
          this.sirenOsc = null;
          this.sirenLfo = null;
          this.sirenGain = null;
          this.isSirenActive = false;
        }, 120);
      }
    } catch {
      this.isSirenActive = false;
    }
  }

  public toggleSiren(): boolean {
    if (this.isSirenActive) {
      this.stopSiren();
      return false;
    } else {
      this.startSiren();
      return true;
    }
  }

  public getSirenStatus(): boolean {
    return this.isSirenActive;
  }
}

export const emergencyAudio = new EmergencyAudioService();
