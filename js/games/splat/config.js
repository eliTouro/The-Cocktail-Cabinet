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

/** Lay-the-columns mode: the creature must pass this many columns for the computer to win. */
export const COLUMN_BUDGET = 20;
/** Fly-through mode: passing this many columns wins the round. */
export const WIN_COLUMNS = 30;

/** Both modes hold the world still this long after Start, so a new player can find the controls. */
export const GET_READY_SECONDS = 1.2;
/** The splat stays on screen this long before the result panel covers it. */
export const SPLAT_LINGER_SECONDS = 0.9;
/** A placed gap that ended up this far from where the player aimed counts as "limited" and is explained. */
export const CLAMP_NOTICE_PIXELS = 8;

/**
 * Seconds a round takes to climb from level 1 to level 10 (and then hold there). Everything
 * below follows this one clock, so starting at level N is just starting the clock further on.
 */
export const SECONDS_TO_HARDEST = { human: 60, computer: 40 };

/**
 * Difficulty curves, all through core/difficulty ramp.
 * human mode: scroll speed 150 -> 225 px/s and gap 190 -> 140 px.
 * computer mode: speed and gap stay fixed; the AI (see AI_SKILL) is what ramps.
 */
export const TUNING = {
  human: (seconds) => ({
    speed: ramp(150, 225, SECONDS_TO_HARDEST.human, seconds),
    gapSize: ramp(190, 140, SECONDS_TO_HARDEST.human, seconds),
  }),
  computer: () => ({ speed: 180, gapSize: 150 }),
};

/**
 * The AI starts clumsy (0.13 s late, +-34 px aim error) and ends sharp (0.07 s late, +-22 px)
 * over the computer ramp, so splatting it gets steadily harder for the human.
 */
export const AI_SKILL = (seconds) => ({
  reactionDelay: ramp(0.13, 0.07, SECONDS_TO_HARDEST.computer, seconds),
  aimError: ramp(34, 22, SECONDS_TO_HARDEST.computer, seconds),
});

export const AI_FLAP_BELOW_TARGET = 25;

export const PLACER_KEY_SPEED = 260;
