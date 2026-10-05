import { STEP_SECONDS } from '../js/core/loop.js';
import { createRng } from '../js/core/rng.js';
import { createAi } from '../js/games/missile-command/ai.js';
import { AI_SKILL, SURVIVE_SECONDS, TUNING, WIDTH } from '../js/games/missile-command/config.js';
import { createWaveGenerator } from '../js/games/missile-command/controllers.js';
import {
  PHASE, createState, groundTarget, observe, step, warheadRejectionFor, warheadRequest,
} from '../js/games/missile-command/rules.js';

/**
 * A human attacker who never wastes a launch: it saves its budget until the pool is full, then
 * fires the whole salvo at the standing cities in turn, from random points on the top edge.
 */
export function salvoSender(rng) {
  let turn = 0;
  let isFiring = false;
  return (state, tuning) => {
    if (state.budget >= tuning.budgetCap - 1e-6) isFiring = true;
    if (state.budget < 1) isFiring = false;
    const cities = state.cities.filter((city) => city.alive);
    const request = warheadRequest({ x: rng.range(0, WIDTH), y: 0 }, groundTarget(cities[turn % cities.length].x), tuning.warheadSpeed);
    if (!isFiring || warheadRejectionFor(state, request, tuning) !== null) return [];
    turn += 1;
    return [request];
  };
}

/** Runs the computer defender through the real rules against a sender; returns the final state. */
export function playComputerMode({ seed, skillAt = AI_SKILL, makeSender = salvoSender, maxSeconds = SURVIVE_SECONDS + 5, onStep = () => {} }) {
  const rng = createRng(seed);
  const ai = createAi(rng, skillAt);
  const sender = makeSender(createRng(seed + 1));
  const tuning = TUNING.computer();
  const state = createState(tuning, { surviveSeconds: SURVIVE_SECONDS });
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const defence = ai.decide(observe(state));
    step(state, { launches: [...defence.launches, ...sender(state, tuning)], startWave: 0 }, STEP_SECONDS, tuning);
    onStep(state);
  }
  return state;
}

/** Runs the same defender inside classic waves, as a sanity check that the wave rules are playable. */
export function playClassicMode({ seed, skillAt = AI_SKILL, maxSeconds = 120 }) {
  const rng = createRng(seed);
  const ai = createAi(rng, skillAt);
  const waves = createWaveGenerator(createRng(seed + 1));
  const tuning = TUNING.human();
  const state = createState(tuning);
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const attack = waves.read(state);
    step(state, { launches: [...ai.decide(observe(state)).launches, ...attack.launches], startWave: attack.startWave }, STEP_SECONDS, tuning);
  }
  return state;
}
