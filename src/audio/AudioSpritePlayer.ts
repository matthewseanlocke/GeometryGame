import type { SoundCue, SoundName } from './soundManifest';

type SoundManifest = {
  spriteUrl: string;
  masterVolume: number;
  stageNotes: {
    frequencies: readonly number[];
    duration: number;
    volume: number;
  };
  sounds: Record<SoundName, SoundCue>;
};

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class AudioSpritePlayer {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private masterGain: GainNode | null = null;
  private loadPromise: Promise<void> | null = null;
  private hasFailed = false;
  private unlocked = false;
  private muted = false;
  private readonly manifest: SoundManifest;

  constructor(manifest: SoundManifest) {
    this.manifest = manifest;
  }

  async unlock(): Promise<void> {
    if (this.unlocked) return;

    const audioWindow = window as AudioWindow;
    const AudioContextClass = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass) {
      this.hasFailed = true;
      return;
    }

    this.context ??= new AudioContextClass();
    this.masterGain ??= this.createMasterGain();

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.unlocked = true;
    await this.load();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.manifest.masterVolume;
    }
  }

  playStageNote(stageIndex: number): void {
    if (!this.unlocked || !this.context || !this.masterGain || this.muted) return;

    const frequencies = this.manifest.stageNotes.frequencies;
    const frequency = frequencies[Math.min(stageIndex, frequencies.length - 1)] ?? frequencies[0];
    if (!frequency) return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const duration = this.manifest.stageNotes.duration;

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(this.manifest.stageNotes.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  play(name: SoundName): void {
    if (!this.unlocked || !this.context || !this.buffer || !this.masterGain || this.hasFailed || this.muted) return;

    const cue = this.manifest.sounds[name];
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();

    source.buffer = this.buffer;
    source.playbackRate.value = cue.playbackRate ?? 1;
    gain.gain.value = cue.volume;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0, cue.start, cue.duration);
  }

  private createMasterGain(): GainNode {
    if (!this.context) {
      throw new Error('Audio context must exist before creating master gain.');
    }

    const gain = this.context.createGain();
    gain.gain.value = this.muted ? 0 : this.manifest.masterVolume;
    gain.connect(this.context.destination);
    return gain;
  }

  private load(): Promise<void> {
    if (this.buffer || this.hasFailed) return Promise.resolve();
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.loadSprite();
    return this.loadPromise;
  }

  private async loadSprite(): Promise<void> {
    if (!this.context) return;

    try {
      const response = await fetch(this.manifest.spriteUrl);
      if (!response.ok) throw new Error('Unable to load audio sprite: ' + response.status);
      const audioData = await response.arrayBuffer();
      this.buffer = await this.context.decodeAudioData(audioData);
    } catch {
      this.hasFailed = true;
    }
  }
}
