import { ramp } from '../../core/difficulty.js';

export const FIELD = { width: 640, height: 480 };

// Leaves the strip below the paddle free for the on-screen help text.
export const PADDLE = { y: 348, height: 12, speed: 560 };

export const BALL = {
  radius: 6,
  maxSubstepDistance: 3,
  // Keeps every bounce steep enough that the ball can never settle into a flat horizontal loop.
  minVerticalRatio: 0.3,
  maxBounceAngle: 1.05,
  serveSpread: 0.28,
};

export const WALL = {
  columns: 10,
  rows: 5,
  brickWidth: 48,
  brickHeight: 16,
  gap: 4,
  // Leaves room above the wall for the level and lives readouts.
  top: 112,
  // Computer mode: the human slides the wall at most this fast, so the ball can always be tracked.
  speed: 150,
  // Share of the wall's sideways speed handed to a ball that hits it; this is the human's steering.
  kick: 1,
};

export const LIVES = 3;

export const ROW_POINTS = [50, 40, 30, 20, 10];

// Computer mode score for the human: every life the computer loses, plus every brick still standing.
export const LIFE_VALUE = 200;
export const STANDING_BRICK_VALUE = 10;

// Ball-in-play seconds from the easiest setting (level 1) to the hardest (level 10).
export const SECONDS_TO_HARDEST = 150;

/**
 * Difficulty curves as [from, to], reached linearly over SECONDS_TO_HARDEST of ball-in-play time.
 * Human mode: the ball speeds up and the paddle shrinks, so keeping it alive gets steadily harder.
 * Computer mode: the human's job gets harder as the computer's reaction time and aim error melt
 * away and the ball quickens, so dodging and steering the wall has to get sharper too.
 */
export const DIFFICULTY = {
  human: {
    ballSpeed: [270, 430],
    paddleWidth: [132, 84],
  },
  computer: {
    ballSpeed: [250, 440],
    paddleWidth: [96, 84],
    reaction: [0.45, 0.18],
    aimError: [40, 18],
  },
};

export function difficultyAt(modeId, seconds) {
  return Object.fromEntries(
    Object.entries(DIFFICULTY[modeId]).map(([knob, [from, to]]) => [knob, ramp(from, to, SECONDS_TO_HARDEST, seconds)]),
  );
}

export const COMPUTER_SERVE_PAUSE_SECONDS = 0.7;
// Stops the computer aiming at an impossible angle just to chase a brick.
export const COMPUTER_MAX_AIM_OFFSET = 0.85;
