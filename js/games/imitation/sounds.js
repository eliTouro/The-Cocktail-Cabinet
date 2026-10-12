import { play } from '../../core/sound.js';

/**
 * Imitation's sound effects, in core/sound.js's recipe format.
 *
 * Fairness rule: every sound plays only in the browser of the player it is about, and nothing the
 * judge hears depends on who is answering. The deceiver's secret choice makes one "locked in" sound
 * whichever way they pick, so even a judge sitting in the same room learns nothing from it.
 */
export const SOUNDS = {
  searchTick: [{ wave: 'sine', from: 880, to: 880, seconds: 0.03, volume: 0.06 }],
  found: [
    { wave: 'triangle', from: 660, to: 660, seconds: 0.07, volume: 0.16 },
    { wave: 'triangle', from: 880, to: 880, seconds: 0.12, volume: 0.16, delay: 0.07 },
  ],
  connected: [
    { wave: 'sine', from: 523, to: 523, seconds: 0.1, volume: 0.2 },
    { wave: 'sine', from: 659, to: 659, seconds: 0.1, volume: 0.2, delay: 0.09 },
    { wave: 'sine', from: 988, to: 988, seconds: 0.22, volume: 0.2, delay: 0.18 },
  ],
  inviteReady: [{ wave: 'triangle', from: 440, to: 660, seconds: 0.12, volume: 0.16 }],
  roundStart: [
    { wave: 'sine', from: 784, to: 784, seconds: 0.4, volume: 0.18 },
    { wave: 'sine', from: 1568, to: 1568, seconds: 0.3, volume: 0.06 },
  ],
  sent: [{ wave: 'triangle', from: 520, to: 900, seconds: 0.07, volume: 0.12 }],
  received: [
    { wave: 'sine', from: 988, to: 988, seconds: 0.08, volume: 0.16 },
    { wave: 'sine', from: 740, to: 740, seconds: 0.14, volume: 0.16, delay: 0.08 },
  ],
  secretLocked: [
    { wave: 'triangle', from: 220, to: 150, seconds: 0.12, volume: 0.22 },
    { wave: 'noise', from: 2400, to: 600, seconds: 0.05, volume: 0.1 },
  ],
  call: [
    { wave: 'noise', from: 1800, to: 200, seconds: 0.08, volume: 0.2 },
    { wave: 'square', from: 200, to: 110, seconds: 0.12, volume: 0.1 },
  ],
  pointWon: [
    { wave: 'triangle', from: 659, to: 659, seconds: 0.1, volume: 0.22 },
    { wave: 'triangle', from: 880, to: 880, seconds: 0.1, volume: 0.22, delay: 0.1 },
    { wave: 'triangle', from: 1175, to: 1175, seconds: 0.24, volume: 0.22, delay: 0.2 },
  ],
  pointLost: [
    { wave: 'sawtooth', from: 330, to: 300, seconds: 0.16, volume: 0.12 },
    { wave: 'sawtooth', from: 247, to: 165, seconds: 0.34, volume: 0.12, delay: 0.16 },
  ],
  matchWon: 'win',
  matchLost: 'lose',
  matchDrawn: [
    { wave: 'triangle', from: 523, to: 523, seconds: 0.16, volume: 0.2 },
    { wave: 'triangle', from: 523, to: 523, seconds: 0.24, volume: 0.2, delay: 0.2 },
  ],
  error: 'denied',
};

/** Plays one of SOUNDS by name: a recipe of our own, or the name of a shared core effect. */
export function cue(name) {
  play(SOUNDS[name]);
}
