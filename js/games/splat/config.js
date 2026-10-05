import { ramp } from '../../core/difficulty.js';

export const WIDTH = 640;
export const HEIGHT = 480;
export const FLOOR_Y = 456;

export const GRAVITY = 1500;
export const FLAP_VELOCITY = -430;
export const FLAP_COOLDOWN = 0.18;

export const CREATURE_X = 150;
export const CREATURE_RADIUS = 14;
export const HOVER_Y = 230;

export const COLUMN_WIDTH = 56;
export const SPAWN_X = WIDTH;
export const MIN_SPACING = 300;
export const GAP_MARGIN = 20;

/** The placement guarantee assumes this speed, so it holds at any speed up to it. */
export const SPEED_MAX = 230;
/** Fraction of the physical climb capacity a placement may use; covers discrete steps and flap latency. */
export const CLIMB_SAFETY = 0.75;

export const COLUMN_BUDGET = 20;

const HUMAN_RAMP_SECONDS = 120;
const COMPUTER_RAMP_SECONDS = 40;

/**
 * Difficulty curves, all through core/difficulty ramp.
 * human mode: scroll speed 150 -> 225 px/s and gap 190 -> 140 px over two minutes.
 * computer mode: speed and gap stay fixed; the AI (see AI_SKILL) is what ramps.
 */
export const TUNING = {
  human: (seconds) => ({
    speed: ramp(150, 225, HUMAN_RAMP_SECONDS, seconds),
    gapSize: ramp(190, 140, HUMAN_RAMP_SECONDS, seconds),
  }),
  computer: () => ({ speed: 180, gapSize: 150 }),
};

/**
 * The AI starts clumsy (0.14 s late, +-38 px aim error) and ends sharp (0.07 s late, +-22 px)
 * over 40 s, so splatting it gets steadily harder for the human.
 */
export const AI_SKILL = (seconds) => ({
  reactionDelay: ramp(0.14, 0.07, COMPUTER_RAMP_SECONDS, seconds),
  aimError: ramp(38, 22, COMPUTER_RAMP_SECONDS, seconds),
});

export const AI_FLAP_BELOW_TARGET = 25;

export const PLACER_KEY_SPEED = 260;
