import { ramp } from '../../core/difficulty.js';

export const WIDTH = 640;
export const HEIGHT = 480;
export const GROUND_Y = 442;

export const BASE_XS = [48, 320, 592];
export const CITY_XS = [128, 192, 256, 384, 448, 512];
/** A warhead that lands within this distance (sideways) of a city or base destroys it. */
export const IMPACT_RADIUS = 26;
export const IMPACT_FLASH_SECONDS = 0.7;

/** Interceptors cannot be aimed into the ground or the base line. */
export const MIN_TARGET_CLEARANCE = 24;

export const INTERCEPTOR = { speed: 300 };

/** A blast grows to `maxRadius`, then shrinks away; warheads inside the circle are destroyed. */
export const BLAST = { maxRadius: 36, growSeconds: 0.5, shrinkSeconds: 1 };
/** A destroyed warhead explodes too, so one shot can start a chain reaction. */
export const CHAIN_BLAST = { maxRadius: 28, growSeconds: 0.4, shrinkSeconds: 0.8 };

export const WARHEAD_POINTS = 25;
export const CITY_BONUS = 100;
export const AMMO_BONUS = 5;

/** Keys that fire from a chosen base, one per base left to right. */
export const BASE_KEYS = ['Digit1', 'Digit2', 'Digit3'];
export const NUMPAD_BASE_KEYS = ['Numpad1', 'Numpad2', 'Numpad3'];

export const SURVIVE_SECONDS = 80;

const WAVE_RAMP_SECONDS = 480;
const SKILL_RAMP_SECONDS = 60;

const HUMAN_TUNING = {
  waves: true,
  ammoPerBase: 10,
  ammoRefillPerSecond: 0,
  baseCooldown: 0.4,
  launchCooldown: 0.1,
  budgeted: false,
  budgetCap: 0,
  budgetRefill: 0,
  startBudget: 0,
  maxWarheads: Infinity,
  warheadSpeed: 0,
};

const COMPUTER_TUNING = {
  waves: false,
  ammoPerBase: 10,
  ammoRefillPerSecond: 0.2,
  baseCooldown: 0.4,
  launchCooldown: 0.1,
  budgeted: true,
  budgetCap: 7,
  budgetRefill: 0.67,
  startBudget: 3,
  maxWarheads: 9,
  warheadSpeed: 95,
};

/** Rules knobs per mode. In computer mode these stay fixed; the AI's skill is what ramps. */
export const TUNING = {
  human: () => HUMAN_TUNING,
  computer: () => COMPUTER_TUNING,
};

/** Seconds between a cleared wave and the next one, and before the first. */
export const WAVE_PAUSE = 2.5;
export const FIRST_WAVE_DELAY = 1;

/**
 * Human mode wave curve over eight minutes: 5 -> 16 warheads per wave falling at 26 -> 62 px/s,
 * launched over a window that stretches with the count. Early waves are slow enough to learn
 * the lead on a falling warhead; late ones need chain reactions and ammo discipline.
 * Splitting warheads (which break into extra warheads mid-fall) only begin after the first minutes
 * and top out at a one-in-three chance per warhead.
 */
export const WAVE = (seconds) => ({
  count: Math.round(ramp(5, 16, WAVE_RAMP_SECONDS, seconds)),
  speed: ramp(26, 62, WAVE_RAMP_SECONDS, seconds),
  splitChance: Math.max(0, ramp(-0.25, 0.33, WAVE_RAMP_SECONDS, seconds)),
});

export const WAVE_LAYOUT = {
  launchSecondsPerWarhead: 1.1,
  targetJitter: 12,
  splitAltitude: { min: 110, max: 230 },
  splitChildren: 2,
};

/**
 * Computer defender skill, ramped over 60 s of game time so the human attacks a sloppy defender first
 * and a sharp one late: it notices warheads 0.9 s late, misses its aim point by up to 30 px, wrongly
 * judges 25% of warheads and shuffles its priorities by 2.5 s, ending at 0.35 s, 10 px, 6% and 0.8 s.
 */
export const AI_SKILL = (seconds) => ({
  reactionDelay: ramp(0.9, 0.55, SKILL_RAMP_SECONDS, seconds),
  aimError: ramp(30, 18, SKILL_RAMP_SECONDS, seconds),
  mistakeRate: ramp(0.25, 0.12, SKILL_RAMP_SECONDS, seconds),
  priorityNoise: ramp(2.5, 1.2, SKILL_RAMP_SECONDS, seconds),
});

export const AI_TUNING = {
  /** Detonate this far along the warhead's path after arriving, so it flies into the growing blast. */
  leadSeconds: 0.25,
  arrivalMargin: 0.2,
  /** Below this much total ammo, only warheads about to land are worth a shot. */
  rationBelowAmmo: 5,
  rationHorizonSeconds: 3.5,
  /** Inside this many seconds to impact, the AI judges a warhead correctly whatever its mistakes. */
  panicSeconds: 1.5,
  commitSeconds: 0.45,
  aimIterations: 4,
  threatMargin: 6,
};

export const TONE_COLORS = { human: '#ffb347', computer: '#52d6ff', warhead: '#e4def0' };
