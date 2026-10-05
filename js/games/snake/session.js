import { chooseAction } from './ai.js';
import { APPLE_RULES, ESCAPE_LENGTH, GRID, START_LENGTH, difficultyAt } from './config.js';
import { createState, hasFreeCell, isReversal, placeApple, spawnRandomApple, step } from './rules.js';

const MAX_QUEUED_TURNS = 2;

/**
 * One round of Snake in either mode, free of DOM and real time: feed it `update(seconds)`.
 * Human mode: the steering queue comes from the player. Computer mode: `chooseAction` steers and
 * the player drops apples with `requestApple`. Both go through the same `step` in rules.js.
 * outcome stays null while playing, then is 'dead', 'cleared' (human mode) or 'escaped' (computer mode).
 */
export function createSession({ modeId, rng }) {
  const state = createState(GRID, START_LENGTH);
  const turnQueue = [];
  const session = {
    modeId,
    state,
    elapsed: 0,
    outcome: null,
    cooldownLeft: 0,
    update,
    queueTurn,
    requestApple,
    applesLeftToPlace: () => APPLE_RULES.maxApples - state.apples.length,
  };
  let stepClock = 0;
  let idleSeconds = 0;

  spawnRandomApple(state, rng);

  function update(seconds) {
    if (session.outcome) return;
    session.elapsed += seconds;
    session.cooldownLeft = Math.max(0, session.cooldownLeft - seconds);
    idleSeconds = state.apples.length ? 0 : idleSeconds + seconds;
    if (idleSeconds >= APPLE_RULES.idleDropSeconds) spawnRandomApple(state, rng);

    stepClock += seconds;
    const skill = difficultyAt(modeId, session.elapsed);
    while (stepClock >= skill.stepSeconds && !session.outcome) {
      stepClock -= skill.stepSeconds;
      tick(skill);
    }
  }

  function tick(skill) {
    const action = modeId === 'human' ? turnQueue.shift() : chooseAction(state, skill, rng);
    const { ate, died } = step(state, action);
    if (died) session.outcome = 'dead';
    else if (modeId === 'computer' && state.snake.length >= ESCAPE_LENGTH) session.outcome = 'escaped';
    else if (ate && modeId === 'human') replaceEatenApple();
  }

  function replaceEatenApple() {
    if (hasFreeCell(state)) spawnRandomApple(state, rng);
    else session.outcome = 'cleared';
  }

  function queueTurn(action) {
    const lastDirection = turnQueue.at(-1) ?? state.direction;
    if (action === lastDirection || isReversal(lastDirection, action)) return;
    if (turnQueue.length < MAX_QUEUED_TURNS) turnQueue.push(action);
  }

  function requestApple(cell) {
    if (session.cooldownLeft > 0) return { ok: false, reason: 'cooldown' };
    const result = placeApple(state, cell, APPLE_RULES.maxApples);
    if (result.ok) session.cooldownLeft = APPLE_RULES.cooldownSeconds;
    return result;
  }

  return session;
}
