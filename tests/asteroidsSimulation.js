import { STEP_SECONDS } from '../js/core/loop.js';
import { createRng } from '../js/core/rng.js';
import { createAi } from '../js/games/asteroids/ai.js';
import { AI_SKILL, ROCK_TIERS, SURVIVE_SECONDS, TUNING } from '../js/games/asteroids/config.js';
import { createWaveGenerator } from '../js/games/asteroids/controllers.js';
import { PHASE, createState, launchToward, observe, step } from '../js/games/asteroids/rules.js';

const WORST_CASE_TIER = ROCK_TIERS.length - 1;

/** A human sender that never wastes budget: the biggest rock it can pay for, aimed at the ship. */
function relentlessSender(state, tuning) {
  const affordable = ROCK_TIERS.map((_, tier) => tier).filter((tier) => state.budget >= ROCK_TIERS[tier].sendCost);
  if (affordable.length === 0 || state.sendCooldown > 0) return [];
  const tier = Math.min(Math.max(...affordable), WORST_CASE_TIER);
  return [launchToward(state.ship, tier, tuning.rockSpeed)];
}

/** Runs the computer pilot through the real rules against a sender; returns what happened. */
export function playComputerMode({ seed, skillAt = AI_SKILL, sender = relentlessSender, maxSeconds = SURVIVE_SECONDS + 5 }) {
  const rng = createRng(seed);
  const ai = createAi(rng, skillAt);
  const tuning = TUNING.computer();
  const state = createState({ surviveSeconds: SURVIVE_SECONDS });
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const pilot = ai.decide(observe(state));
    step(state, { ...pilot, spawns: sender(state, tuning) }, STEP_SECONDS, tuning);
  }
  return state;
}

/** Runs the same pilot inside human-mode waves, as a sanity check that the rules support classic play. */
export function playClassicMode({ seed, skillAt = AI_SKILL, maxSeconds = 120 }) {
  const rng = createRng(seed);
  const ai = createAi(rng, skillAt);
  const waves = createWaveGenerator(rng);
  const tuning = TUNING.human();
  const state = createState();
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const pilot = ai.decide(observe(state));
    step(state, { ...pilot, spawns: waves.read(state) }, STEP_SECONDS, tuning);
  }
  return state;
}
