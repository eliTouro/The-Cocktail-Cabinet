import { elapsedAtLevel, levelAt } from '../../core/level.js';
import { chooseAction } from './ai.js';
import {
  APPLE_RULES, ESCAPE_LENGTH, ESCAPE_WARNING_MARGIN, GRID, SECONDS_TO_HARDEST, START_LENGTH, WIN_APPLES, difficultyAt,
} from './config.js';
import { createState, isBoxedIn, isReversal, placeApple, spawnRandomApple, step } from './rules.js';

const MAX_QUEUED_TURNS = 2;

/**
 * One round of Snake in either mode, free of DOM and real time: feed it `update(seconds)`.
 * Human mode: the steering queue comes from the player. Computer mode: `chooseAction` steers and
 * the player drops apples with `requestApple`. Both go through the same `step` in rules.js.
 * `startLevel` seeds the clock so the round begins at that point of the difficulty ramp.
 * outcome stays null while playing, then is 'dead', 'won' (human mode) or 'escaped' (computer mode). `onEvent(name)` is told about moments worth a sound: 'ate', 'level-up',
 * 'boxed-in', 'near-escape' and the outcome names.
 */
export function createSession({ modeId, rng, startLevel = 1, onEvent = () => {} }) {
  const state = createState(GRID, START_LENGTH);
  const turnQueue = [];
  const secondsToHardest = SECONDS_TO_HARDEST[modeId];
  const session = {
    modeId,
    state,
    elapsed: elapsedAtLevel(startLevel, secondsToHardest),
    outcome: null,
    crashedInto: null,
    cooldownLeft: 0,
    update,
    queueTurn,
    requestApple,
    level: () => levelAt(session.elapsed, secondsToHardest),
    applesEaten: () => state.snake.length - START_LENGTH,
    applesLeftToPlace: () => APPLE_RULES.maxApples - state.apples.length,
  };
  let stepClock = 0;
  let idleSeconds = 0;
  let boxedIn = false;
  let shownLevel = session.level();

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
    announceLevel();
  }

  function announceLevel() {
    const level = session.level();
    if (level > shownLevel && !session.outcome) onEvent('level-up');
    shownLevel = level;
  }

  function tick(skill) {
    const action = modeId === 'human' ? turnQueue.shift() : chooseAction(state, skill, rng);
    const lengthBefore = state.snake.length;
    const { ate, died, crashedInto } = step(state, action);
    if (died) crash(crashedInto);
    else if (modeId === 'computer' && state.snake.length >= ESCAPE_LENGTH) finish('escaped');
    else if (modeId === 'human' && session.applesEaten() >= WIN_APPLES) finish('won');
    else if (ate) afterEating(lengthBefore);
    else if (modeId === 'human') watchForBoxedIn();
  }

  function crash(crashedInto) {
    session.crashedInto = crashedInto;
    finish('dead');
  }

  function afterEating(lengthBefore) {
    onEvent('ate');
    if (modeId === 'human') spawnRandomApple(state, rng);
    else if (lengthBefore < ESCAPE_LENGTH - ESCAPE_WARNING_MARGIN && state.snake.length >= ESCAPE_LENGTH - ESCAPE_WARNING_MARGIN) {
      onEvent('near-escape');
    }
  }

  function watchForBoxedIn() {
    const nowBoxedIn = isBoxedIn(state);
    if (nowBoxedIn && !boxedIn) onEvent('boxed-in');
    boxedIn = nowBoxedIn;
  }

  function finish(outcome) {
    session.outcome = outcome;
    onEvent(outcome);
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
