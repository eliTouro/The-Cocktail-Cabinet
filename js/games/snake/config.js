import { ramp } from '../../core/difficulty.js';

export const CANVAS = { width: 640, height: 480 };
export const GRID = { cols: 32, rows: 24, cell: 20 };
export const START_LENGTH = 3;

/** Computer mode: the human may keep this many apples on the board and must wait between drops. */
export const APPLE_RULES = { maxApples: 3, cooldownSeconds: 0.7, idleDropSeconds: 6 };

/** Computer mode: the snake escapes (the human loses) once it grows this long. */
export const ESCAPE_LENGTH = 40;

/**
 * Every difficulty knob is a linear ramp { from, to, seconds } over the time since the round began.
 * Human mode: the snake speeds up, so the human's steering gets harder.
 * Computer mode: the snake starts slow, forgetful and reckless (mistakes, little care about
 * dead ends), then becomes quicker, sharper and more careful, so trapping it gets harder.
 * Mistake rate never reaches zero, so even the best snake can still be beaten.
 */
export const DIFFICULTY = {
  human: {
    stepSeconds: { from: 0.18, to: 0.07, seconds: 150 },
  },
  computer: {
    stepSeconds: { from: 0.16, to: 0.09, seconds: 120 },
    mistakeRate: { from: 0.3, to: 0.02, seconds: 120 },
    carefulness: { from: 0.1, to: 1, seconds: 120 },
  },
};

export function difficultyAt(modeId, elapsedSeconds) {
  const knobs = {};
  for (const [name, { from, to, seconds }] of Object.entries(DIFFICULTY[modeId])) {
    knobs[name] = ramp(from, to, seconds, elapsedSeconds);
  }
  return knobs;
}
