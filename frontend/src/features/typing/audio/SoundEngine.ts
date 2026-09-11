export type SoundEvent = 'keystroke' | 'error' | 'wordComplete' | 'streakMilestone' | 'goalReached' | 'sessionEnd';
export type SoundProfile = 'off' | 'mechanical' | 'soft' | 'minimal';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private profile: SoundProfile = 'off';
  private volume: number = 0.5;

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  public setProfile(profile: SoundProfile): void {
    this.profile = profile;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  private playTone(type: OscillatorType, freq1: number, freq2: number | null, durationMs: number, baseGain: number, startTimeOffset = 0) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime + startTimeOffset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq1, t);
      if (freq2 !== null) {
        osc.frequency.exponentialRampToValueAtTime(freq2, t + durationMs / 1000);
      }

      const peakGain = baseGain * this.volume;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peakGain, t + (durationMs * 0.1) / 1000);
      gain.gain.exponentialRampToValueAtTime(0.001, t + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + durationMs / 1000);
    } catch (e) {
      console.warn('AudioContext playback error', e);
    }
  }

  public play(event: SoundEvent): void {
    if (this.profile === 'off') return;
    if (typeof document !== 'undefined' && document.hidden) return;

    this.initCtx();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (this.profile === 'mechanical') {
      switch (event) {
        case 'keystroke':
          this.playTone('sine', 600, 120, 8, 0.08);
          break;
        case 'error':
          this.playTone('triangle', 150, null, 30, 0.12);
          break;
        case 'wordComplete':
          this.playTone('sine', 500, null, 50, 0.06);
          this.playTone('sine', 700, null, 50, 0.06, 0.05);
          break;
        case 'streakMilestone':
          this.playTone('sine', 400, null, 50, 0.08);
          this.playTone('sine', 600, null, 50, 0.08, 0.05);
          this.playTone('sine', 800, null, 50, 0.08, 0.1);
          break;
        case 'goalReached':
          this.playTone('sine', 500, null, 200, 0.06);
          this.playTone('sine', 700, null, 200, 0.06);
          this.playTone('sine', 900, null, 200, 0.06);
          break;
        case 'sessionEnd':
          this.playTone('sine', 800, 300, 150, 0.06);
          break;
      }
    } else if (this.profile === 'soft') {
      switch (event) {
        case 'keystroke':
          this.playTone('sine', 400, 200, 6, 0.04);
          break;
        case 'error':
          this.playTone('sine', 200, null, 20, 0.06);
          break;
        case 'wordComplete':
          this.playTone('sine', 600, null, 60, 0.04);
          break;
        case 'streakMilestone':
          this.playTone('sine', 500, 700, 100, 0.05);
          break;
        case 'goalReached':
          this.playTone('sine', 600, 800, 150, 0.05);
          break;
        case 'sessionEnd':
          this.playTone('sine', 500, 300, 100, 0.04);
          break;
      }
    } else if (this.profile === 'minimal') {
      switch (event) {
        case 'error':
          this.playTone('sine', 300, null, 15, 0.08);
          break;
        case 'streakMilestone':
          this.playTone('sine', 500, null, 40, 0.05);
          break;
        case 'goalReached':
          this.playTone('sine', 600, null, 60, 0.06);
          break;
      }
    }
  }
}

export const soundEngine = new SoundEngine();
