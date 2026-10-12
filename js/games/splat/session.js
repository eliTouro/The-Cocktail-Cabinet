import { elapsedAtLevel, levelAt } from '../../core/level.js';
import { createAi } from './ai.js';
import { COLUMN_BUDGET, SECONDS_TO_HARDEST, TUNING, WIN_COLUMNS } from './config.js';
import { createColumnGenerator } from './controllers.js';
import { PHASE, createState, observe, step } from './rules.js';

export const LEVEL_UP = 'level-up';

/**
 * One round of Splat in either mode, free of DOM and real time: feed it `advance(dt, human)`.
 * The game plays one side itself: fly-through mode builds the course with the column generator,
 * lay-the-columns mode flies the creature with the AI, which sees only `observe(state)`.
 * `human` is what the person gives: { flap } when they fly, { column } (a requested gap centre
 * or null) when they lay columns. Both sides go through the same `step` in rules.js.
 * `startLevel` seeds the clock so the round begins at that point of the difficulty ramp.
 * `onEvent(event)` hears every rules event plus { type: LEVEL_UP, level } when the round gets harder.
 */
export function createSession({ modeId, rng, startLevel = 1, onEvent = () => {} }) {
  const isHumanFlying = modeId === 'human';
  const secondsToHardest = SECONDS_TO_HARDEST[modeId];
  const state = createState({
    goal: isHumanFlying ? WIN_COLUMNS : COLUMN_BUDGET,
    startTime: elapsedAtLevel(startLevel, secondsToHardest),
  });
  const ai = isHumanFlying ? null : createAi(rng);
  const generator = isHumanFlying ? createColumnGenerator(rng) : null;
  const level = () => levelAt(state.time, secondsToHardest);
  let shownLevel = level();

  function inputFor(human, tuning) {
    if (isHumanFlying) return { flap: human.flap, column: generator.read(state, tuning) };
    return { flap: ai.decide(observe(state)).flap, column: human.column };
  }

  function announceLevel() {
    const now = level();
    if (now > shownLevel) onEvent({ type: LEVEL_UP, level: now });
    shownLevel = now;
  }

  return {
    modeId,
    state,
    level,
    tuning: () => TUNING[modeId](state.time),
    isOver: () => state.phase !== PHASE.playing,
    advance(dt, human) {
      const tuning = TUNING[modeId](state.time);
      step(state, inputFor(human, tuning), dt, tuning);
      state.events.forEach(onEvent);
      if (state.phase === PHASE.playing) announceLevel();
    },
  };
}
