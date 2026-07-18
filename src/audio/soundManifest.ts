export type SoundName =
  | 'lifeLost'
  | 'levelComplete'
  | 'heartEarned'
  | 'gameOver';

export type SoundCue = {
  start: number;
  duration: number;
  volume: number;
  playbackRate?: number;
};

export const soundManifest = {
  spriteUrl: import.meta.env.BASE_URL + 'audio/geometry-game-sfx.wav',
  masterVolume: 0.78,
  stageNotes: {
    frequencies: [261.63, 329.63, 392, 523.25],
    duration: 0.16,
    volume: 0.2,
  },
  sounds: {
    lifeLost: { start: 1.7, duration: 0.42, volume: 0.72 },
    levelComplete: { start: 8.05, duration: 0.85, volume: 0.62, playbackRate: 1.08 },
    heartEarned: { start: 6.15, duration: 0.65, volume: 0.9, playbackRate: 1.08 },
    gameOver: { start: 4.15, duration: 1.2, volume: 0.85 },
  } satisfies Record<SoundName, SoundCue>,
} as const;
