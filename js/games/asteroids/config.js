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

/** The ship wins by outlasting this many seconds, in both modes. */
export const SURVIVE_SECONDS = 90;

/**
 * Seconds of round clock for the difficulty to climb from level 1 to level 10. A round started
 * at level N begins with the clock at `elapsedAtLevel(N, SECONDS_TO_HARDEST)`; it then keeps
 * running, so a 90 s round that starts at level 1 still ends around level 7.
 */
export const SECONDS_TO_HARDEST = 120;

const COMPUTER_TUNING = {
  maxRocks: 12,
  rockSpeed: 120,
  rockLifetime: 14,
  budgetCap: 8,
  startingBudget: 3,
  budgetRefill: 0.85,
  sendCooldown: 0.5,
};

const HUMAN_TUNING = {
  maxRocks: 24,
  rockSpeed: 0,
  rockLifetime: Infinity,
  budgetCap: 0,
  startingBudget: 0,
  budgetRefill: 0,
  sendCooldown: 0,
};

/** Rules knobs per mode. They stay fixed; levels change the waves (human mode) or the pilot's skill (computer mode). */
export const TUNING = {
  human: () => HUMAN_TUNING,
  computer: () => COMPUTER_TUNING,
};

/**
 * Human mode wave curve over the level ramp: 3 -> 5 large rocks per wave, drifting 52 -> 72 px/s.
 * Early waves are slow and sparse enough to learn thrust and inertia; late ones demand real dodging.
 */
export const WAVE = (seconds) => ({
  count: Math.round(ramp(3, 5, SECONDS_TO_HARDEST, seconds)),
  speed: ramp(52, 72, SECONDS_TO_HARDEST, seconds),
});

/**
 * Computer pilot skill over the same level ramp: it sees rocks 0.9 s late with 0.3 rad aim
 * error at level 1, ending at 0.25 s and 0.12 rad at level 10.
 */
export const AI_SKILL = (seconds) => ({
  reactionDelay: ramp(0.9, 0.25, SECONDS_TO_HARDEST, seconds),
  aimError: ramp(0.3, 0.12, SECONDS_TO_HARDEST, seconds),
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

/** On-canvas rock-size buttons for the human sender (computer mode): a column down the left edge. */
export const SENDER_PANEL = {
  left: 10, top: 154, buttonWidth: 124, buttonHeight: 52, buttonGap: 8,
};
export const SIZE_KEYS = ['Digit1', 'Digit2', 'Digit3'];
export const NUMPAD_SIZE_KEYS = ['Numpad1', 'Numpad2', 'Numpad3'];

/** Round on-canvas buttons that stand in for the keyboard on touch screens (human mode). */
export const TOUCH_PAD = {
  radius: 38,
  y: HEIGHT * 0.6,
  buttons: [
    { id: 'left', x: 54, glyph: '◀' },
    { id: 'right', x: 140, glyph: '▶' },
    { id: 'thrust', x: WIDTH - 140, glyph: '▲' },
    { id: 'fire', x: WIDTH - 54, glyph: '●' },
  ],
};
