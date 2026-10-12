import { elapsedAtLevel } from '../js/core/level.js';
import { STEP_SECONDS } from '../js/core/loop.js';
import { createRng } from '../js/core/rng.js';
import { createAi } from '../js/games/missile-command/ai.js';
import {
  AI_SKILL, GROUND_Y, SECONDS_TO_HARDEST, SURVIVE_SECONDS, TUNING, WIDTH,
} from '../js/games/missile-command/config.js';
import { createDefenderInput, createWarheadSender, createWaveGenerator } from '../js/games/missile-command/controllers.js';
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

/*
 * Stand-ins for a typical person, used to balance each side. They work the same controls a person
 * does: the defender looks at `observe(state)` and clicks a spot, the attacker clicks a spot, and
 * both clicks go through the game's own input readers (createDefenderInput, createWarheadSender)
 * into the same rules. They obey the same ammo, cooldown, budget and in-the-air limits, because
 * those live in the rules and a refused click is simply wasted, as it would be for a person.
 */
export const HUMAN_DEFENDER = {
  skill: { reactionDelay: 1, aimError: 32, mistakeRate: 0.3, priorityNoise: 3 },
  clickSeconds: 0.6,
  clickJitter: 0.35,
  meanSecondsBetweenLapses: 9,
  lapseSeconds: 2,
};
export const HUMAN_ATTACKER = {
  clickSeconds: 0.8,
  clickJitter: 0.6,
  aimNoise: 14,
  baseShare: 0.2,
};

const NO_KEYS = { consumeTap: () => false };

/** A pointer whose clicks are fed in by a bot instead of a mouse. */
function createBotPointer() {
  let pendingPress = null;
  return {
    click: (position) => { pendingPress = position; },
    consumePress() {
      const press = pendingPress;
      pendingPress = null;
      return press;
    },
    position: () => pendingPress ?? { x: WIDTH / 2, y: GROUND_Y / 2 },
  };
}

/** Looks for a threat at a human pace (with the odd lapse of attention), aims ahead of it with a human's slop, and clicks there. */
function createHumanDefenderBrain(rng, habits) {
  const eyes = createAi(rng, () => habits.skill);
  let nextClickAt = 0;
  let lapseEndsAt = 0;
  return (observation) => {
    if (observation.time >= lapseEndsAt && rng.next() < STEP_SECONDS / habits.meanSecondsBetweenLapses) {
      lapseEndsAt = observation.time + habits.lapseSeconds;
    }
    if (observation.time < nextClickAt || observation.time < lapseEndsAt) return null;
    const [shot] = eyes.decide(observation).launches;
    if (!shot) return null;
    nextClickAt = observation.time + habits.clickSeconds + rng.range(0, habits.clickJitter);
    return shot.target;
  };
}

/** Clicks at a human pace on a random standing city (sometimes a base), a little off-centre. */
function createHumanAttackerBrain(rng, habits) {
  let nextClickAt = 0;
  return (state) => {
    if (state.time < nextClickAt) return null;
    nextClickAt = state.time + habits.clickSeconds + rng.range(0, habits.clickJitter);
    const bases = state.bases.filter((base) => base.alive);
    const cities = state.cities.filter((city) => city.alive);
    const pool = bases.length > 0 && rng.next() < habits.baseShare ? bases : cities;
    return { x: rng.pick(pool).x + rng.range(-habits.aimNoise, habits.aimNoise), y: GROUND_Y / 2 };
  };
}

/** The computer defends and a person-like attacker sends warheads; returns the final state. */
export function playAttackMode({
  seed, level = 1, habits = HUMAN_ATTACKER, maxSeconds = SURVIVE_SECONDS + 5,
}) {
  const rng = createRng(seed);
  const ai = createAi(rng);
  const pointer = createBotPointer();
  const sender = createWarheadSender(pointer, createRng(seed + 1), TUNING.computer());
  const brain = createHumanAttackerBrain(createRng(seed + 2), habits);
  const tuning = TUNING.computer();
  const state = createState(tuning, { surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(level, SECONDS_TO_HARDEST) });
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const click = brain(state);
    if (click) pointer.click(click);
    step(state, { launches: [...ai.decide(observe(state)).launches, ...sender.read().launches], startWave: 0 }, STEP_SECONDS, tuning);
  }
  return state;
}

/** A person-like defender holds the cities against the waves; returns the final state. */
export function playDefendMode({
  seed, level = 1, habits = HUMAN_DEFENDER, maxSeconds = SURVIVE_SECONDS + 5,
}) {
  const waves = createWaveGenerator(createRng(seed));
  const pointer = createBotPointer();
  const defender = createDefenderInput(NO_KEYS, pointer);
  const brain = createHumanDefenderBrain(createRng(seed + 1), habits);
  const tuning = TUNING.human();
  const state = createState(tuning, { surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(level, SECONDS_TO_HARDEST) });
  while (state.phase === PHASE.playing && state.time < maxSeconds) {
    const click = brain(observe(state));
    if (click) pointer.click(click);
    const attack = waves.read(state);
    step(state, { launches: [...defender.read().launches, ...attack.launches], startWave: attack.startWave }, STEP_SECONDS, tuning);
  }
  return state;
}
