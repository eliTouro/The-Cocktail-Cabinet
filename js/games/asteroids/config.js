import { ramp } from '../../core/difficulty.js';

export const WIDTH = 640;
export const HEIGHT = 480;

export const SHIP = {
  /** Collision circle; the drawn triangle's tips poke slightly outside it, which keeps hits forgiving. */
  radius: 9,
  noseOffset: 12,
  turnRate: 4.2,
  thrust: 240,
  /** Fraction of speed lost per second; keeps inertia but stops the ship accelerating forever. */
  drag: 0.45,
  maxSpeed: 260,
  startingLives: 3,
  respawnDelay: 1,
  invulnerableSeconds: 2.5,
  /** The ship only reappears once no rock is within this distance of the centre. */
  respawnClearRadius: 90,
};

export const BULLET = {
  speed: 400,
  lifetime: 0.95,
  cooldown: 0.28,
};

export const BULLET_RANGE = BULLET.speed * BULLET.lifetime;

/**
 * Rocks are regular polygons. `radius` is the circumradius, so the drawn outline touches the
 * circle of that radius. Collision uses the polygon itself, never a circle approximation.
 * Index is the tier: a hit on tier n leaves two rocks of tier n-1, and tier 0 leaves nothing.
 */
export const ROCK_TIERS = [
  { name: 'triangle', sides: 3, radius: 15, points: 100, sendCost: 1 },
  { name: 'square', sides: 4, radius: 26, points: 50, sendCost: 2 },
  { name: 'hexagon', sides: 6, radius: 42, points: 20, sendCost: 3 },
];
export const LARGEST_TIER = ROCK_TIERS.length - 1;

export const SPLIT = {
  spread: 0.6,
  speedGain: 1.25,
  spin: 0.9,
};

/** Seconds between the last rock of a human-mode wave and the next wave. */
export const WAVE_PAUSE = 1.5;

/** Rock spawns (waves or sent rocks) need this much clear space around the ship. */
export const SAFE_RADIUS = 140;

export const SURVIVE_SECONDS = 90;

const WAVE_RAMP_SECONDS = 360;
const SKILL_RAMP_SECONDS = 60;

const COMPUTER_TUNING = {
  maxRocks: 9,
  rockSpeed: 100,
  rockLifetime: 14,
  budgetCap: 6,
  budgetRefill: 0.7,
  sendCooldown: 0.5,
};

const HUMAN_TUNING = {
  maxRocks: 24,
  rockSpeed: 0,
  rockLifetime: Infinity,
  budgetCap: 0,
  budgetRefill: 0,
  sendCooldown: 0,
};

/** Rules knobs per mode. In computer mode these stay fixed; the AI's skill is what ramps. */
export const TUNING = {
  human: () => HUMAN_TUNING,
  computer: () => COMPUTER_TUNING,
};

/**
 * Human mode wave curve over six minutes: 2 -> 6 large rocks per wave, drifting 35 -> 80 px/s.
 * Early waves are slow and sparse enough to learn thrust and inertia; late ones demand real dodging.
 */
export const WAVE = (seconds) => ({
  count: Math.round(ramp(2, 6, WAVE_RAMP_SECONDS, seconds)),
  speed: ramp(35, 80, WAVE_RAMP_SECONDS, seconds),
});

/**
 * Computer pilot skill, ramped over 60 s of game time so the human faces a clumsy pilot first and
 * a sharp one late: it sees rocks 0.42 s late with 0.30 rad aim error, ending at 0.30 s and 0.20 rad.
 */
export const AI_SKILL = (seconds) => ({
  reactionDelay: ramp(0.42, 0.3, SKILL_RAMP_SECONDS, seconds),
  aimError: ramp(0.3, 0.2, SKILL_RAMP_SECONDS, seconds),
});

export const AI_TUNING = {
  threatHorizon: 3,
  dangerMargin: 14,
  dodgeSeconds: 1.1,
  dodgeDistance: 150,
  thrustAlignment: 0.7,
  fireAlignmentFloor: 0.05,
  historySeconds: 1,
};

/** On-canvas controls for the human sender (computer mode). */
export const SENDER_PANEL = { top: HEIGHT - 34, buttonWidth: 92, buttonGap: 8, left: 12 };
export const SIZE_KEYS = ['Digit1', 'Digit2', 'Digit3'];
export const NUMPAD_SIZE_KEYS = ['Numpad1', 'Numpad2', 'Numpad3'];
