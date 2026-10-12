import { play } from '../../core/sound.js';

/* Recipes shared with the other games live in core/sound.js; these four are aMaze Me's own. */
const ERASE = [{ wave: 'triangle', from: 480, to: 300, seconds: 0.06, volume: 0.2 }];
const STEP = [{ wave: 'sine', from: 260, to: 220, seconds: 0.03, volume: 0.06 }];
const THUD = [{ wave: 'noise', from: 700, to: 120, seconds: 0.08, volume: 0.22 }];
const WARP = [{ wave: 'sine', from: 300, to: 1200, seconds: 0.25, volume: 0.16 }];

/**
 * Which sound each game event makes. Every part the builder places sounds the same ('place'), so
 * the runner, looking away during the build, cannot hear whether a portal or an arrow is in the maze.
 */
const CUES = {
  select: 'click',
  tick: 'click',
  place: 'place',
  erase: ERASE,
  refused: 'denied',
  warn: 'warn',
  go: 'levelUp',
  step: STEP,
  bump: THUD,
  warp: WARP,
  flare: 'shoot',
  win: 'win',
  lost: 'lose',
  draw: 'levelUp',
};

export const cue = (event) => play(CUES[event]);
