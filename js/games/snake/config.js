import { ramp } from '../../core/difficulty.js';

export const CANVAS = { width: 640, height: 480 };
export const GRID = { cols: 32, rows: 18, cell: 20 };

/** The board sits this far down the canvas, leaving bands above and below it for the HUD, so no apple or snake hides behind it. */
export const BOARD_TOP = (CANVAS.height - GRID.rows * GRID.cell) / 2;
export const START_LENGTH = 3;

/** Both modes give the player a moment to find the keys or the mouse before the snake moves. */
export const GET_READY_SECONDS = 1.2;

/** Computer mode: the human may keep this many apples on the board and must wait between drops. */
export const APPLE_RULES = { maxApples: 3, cooldownSeconds: 0.7, idleDropSeconds: 6 };

/** Computer mode: the snake escapes (the human loses) once it grows this long. */
export const ESCAPE_LENGTH = 24;

/** Computer mode: the HUD and a warning sound say so when the snake is this close to escaping. */
export const ESCAPE_WARNING_MARGIN = 8;

/** Human mode: eating this many apples wins the round. */
export const WIN_APPLES = 30;

/**
 * Seconds a round takes to climb from level 1 to level 10 (and then hold there). Every knob in
 * DIFFICULTY follows this one clock, so starting at level N is just starting the clock further on.
 */
export const SECONDS_TO_HARDEST = { human: 150, computer: 120 };

/**
 * Every difficulty knob is a linear ramp { from, to } over the time since the round began.
 * Human mode: the snake speeds up, so the human's steering gets harder.
 * Computer mode: the snake starts slow, forgetful and reckless (mistakes, little care about
 * dead ends), then becomes quicker, sharper and more careful, so trapping it gets harder.
 * Mistake rate never reaches zero, so even the best snake can still be beaten.
 */
export const DIFFICULTY = {
  human: {
    stepSeconds: { from: 0.18, to: 0.07 },
  },
  computer: {
    stepSeconds: { from: 0.14, to: 0.08 },
    mistakeRate: { from: 0.03, to: 0.003 },
    carefulness: { from: 0.85, to: 1 },
  },
};

export function difficultyAt(modeId, elapsedSeconds) {
  const knobs = {};
  for (const [name, { from, to }] of Object.entries(DIFFICULTY[modeId])) {
    knobs[name] = ramp(from, to, SECONDS_TO_HARDEST[modeId], elapsedSeconds);
  }
  return knobs;
}
