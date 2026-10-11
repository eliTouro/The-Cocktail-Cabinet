import { STEP_SECONDS } from '../js/core/loop.js';
import { elapsedAtLevel } from '../js/core/level.js';
import { createRng } from '../js/core/rng.js';
import { createAi } from '../js/games/asteroids/ai.js';
import {
  AI_SKILL, ROCK_TIERS, SECONDS_TO_HARDEST, SURVIVE_SECONDS, TUNING,
} from '../js/games/asteroids/config.js';
import { createWaveGenerator } from '../js/games/asteroids/controllers.js';
import { nearestEdgePoint, wrappedDistance } from '../js/games/asteroids/geometry.js';
import {
  PHASE, createState, launchToward, observe, spawnRejection, step,
} from '../js/games/asteroids/rules.js';

const WORST_CASE_TIER = ROCK_TIERS.length - 1;

/** A human sender that never wastes budget: the biggest rock it can pay for, aimed at the ship. */
export function relentlessSender(state, tuning) {
  const affordable = ROCK_TIERS.map((_, tier) => tier).filter((tier) => state.budget >= ROCK_TIERS[tier].sendCost);
  if (affordable.length === 0 || state.sendCooldown > 0) return [];
  const tier = Math.min(Math.max(...affordable), WORST_CASE_TIER);
  return [launchToward(state.ship, tier, tuning.rockSpeed)];
}

/**
 * Stand-ins for a typical human, used to balance each side. They go through the same rules and
 * the same inputs a person uses: the pilot only gets `observe(state)`, the sender only clicks.
 */
export const HUMAN_PILOT_SKILL = () => ({ reactionDelay: 0.5, aimError: 0.4 });
export const HUMAN_LAPSES = { meanSecondsBetween: 14, lapseSeconds: 0.8 };
export const HUMAN_SENDER = { clickSeconds: 0.7, clickJitter: 0.4, aimNoise: 45, leadShare: 0.5 };

/** Wraps a pilot with the odd lapse of attention: for a moment it lets go of every control. */
export function withLapses(pilot, rng, habits = HUMAN_LAPSES) {
  let lapseEndsAt = 0;
  return {
    decide(observation) {
      const input = pilot.decide(observation);
      const lapseChance = STEP_SECONDS / habits.meanSecondsBetween;
      if (observation.time >= lapseEndsAt && rng.next() < lapseChance) lapseEndsAt = observation.time + habits.lapseSeconds;
      return observation.time < lapseEndsAt ? { rotate: 0, thrust: false, fire: false } : input;
    },
  };
}

/**
 * A sender that clicks at a human pace, buys the biggest rock it can afford, and aims at where it
 * guesses the ship will be (part of the way along its current velocity) with a human's slop.
 * Clicks the rules refuse (too close, no budget) are simply wasted, as they would be for a person.
 */
export function createHumanSender(rng, habits = HUMAN_SENDER) {
  let nextClickAt = 0;

  return (state, tuning) => {
    if (state.time < nextClickAt || !state.ship.alive) return [];
    nextClickAt = state.time + habits.clickSeconds + rng.range(0, habits.clickJitter);
    const affordable = ROCK_TIERS.map((_, tier) => tier).filter((tier) => state.budget >= ROCK_TIERS[tier].sendCost);
    if (affordable.length === 0) return [];
    const { ship } = state;
    const tier = Math.max(...affordable);
    const flightSeconds = wrappedDistance(ship, nearestEdgePoint(ship)) / tuning.rockSpeed;
    const guess = {
      x: ship.x + ship.vx * flightSeconds * habits.leadShare + rng.range(-habits.aimNoise, habits.aimNoise),
      y: ship.y + ship.vy * flightSeconds * habits.leadShare + rng.range(-habits.aimNoise, habits.aimNoise),
    };
    const launch = launchToward(guess, tier, tuning.rockSpeed);
    return spawnRejection(state, launch, tuning) ? [] : [launch];
  };
}

/** Runs the computer pilot through the real rules against a sender; returns what happened. */
export function playComputerMode({
  seed, level = 1, skillAt = AI_SKILL, sender = null, maxSeconds = SURVIVE_SECONDS + 5,
}) {
  const rng = createRng(seed);
  const ai = createAi(rng, skillAt);
  const tuning = TUNING.computer();
  const state = createState({
    surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(level, SECONDS_TO_HARDEST), budget: tuning.startingBudget,
  });
  const spawnsFor = sender ?? createHumanSender(createRng(seed + 7919));
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const pilot = ai.decide(observe(state));
    step(state, { ...pilot, spawns: spawnsFor(state, tuning) }, STEP_SECONDS, tuning);
  }
  return state;
}

/** Runs a pilot inside human-mode waves for the full round, like a person flying the ship. */
export function playHumanMode({
  seed, level = 1, skillAt = HUMAN_PILOT_SKILL, lapses = true, maxSeconds = SURVIVE_SECONDS + 5,
}) {
  const rng = createRng(seed);
  const ai = lapses ? withLapses(createAi(rng, skillAt), createRng(seed + 104729)) : createAi(rng, skillAt);
  const waves = createWaveGenerator(rng);
  const tuning = TUNING.human();
  const state = createState({ surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(level, SECONDS_TO_HARDEST) });
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const pilot = ai.decide(observe(state));
    step(state, { ...pilot, spawns: waves.read(state) }, STEP_SECONDS, tuning);
  }
  return state;
}
