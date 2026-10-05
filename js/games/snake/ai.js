import { firstStepToApple, legalActions, reachableCells, simulate } from './rules.js';

/**
 * The computer's steering: a pure function of what is on the board (the state's grid, snake and
 * apples) and a skill. It returns an action exactly like a keypress, which then goes through
 * the same `step` as a human's would.
 *
 * skill.mistakeRate: chance per move of a thoughtless random turn (the "forgetful" snake).
 * skill.carefulness: chance per move of checking that a move leaves room to keep living.
 */
export function chooseAction(state, skill, rng) {
  const actions = legalActions(state);
  if (rng.next() < skill.mistakeRate) return rng.pick(actions);

  const survivable = actions
    .map((action) => ({ action, ...simulate(state, action) }))
    .filter((option) => !option.died);
  if (survivable.length === 0) return state.direction;

  const careful = rng.next() < skill.carefulness;
  const towardApple = firstStepToApple(state);
  const direct = survivable.find((option) => option.action === towardApple);
  if (direct && (!careful || hasRoomToLive(direct.state))) return direct.action;

  return careful ? mostSpacious(survivable).action : rng.pick(survivable).action;
}

const roomAround = (state) => reachableCells(state).size;

/** Enough open cells ahead to hold the snake's own length: a cheap test for "not a dead end". */
const hasRoomToLive = (state) => roomAround(state) >= state.snake.length;

const mostSpacious = (options) =>
  options.reduce((best, option) => (roomAround(option.state) > roomAround(best.state) ? option : best));
