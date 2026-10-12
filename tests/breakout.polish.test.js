import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elapsedAtLevel, levelAt } from '../js/core/level.js';
import { BALL, DIFFICULTY, FIELD, PADDLE, SECONDS_TO_HARDEST, WALL, difficultyAt } from '../js/games/breakout/config.js';
import { railPosition } from '../js/games/breakout/humanControls.js';
import {
  IDLE_INPUT, brickRect, createGame, pushesPastRail, step, wallBounds,
} from '../js/games/breakout/rules.js';
import { resultSound, soundFor } from '../js/games/breakout/sounds.js';

const DT = 1 / 60;
const launchInput = { ...IDLE_INPUT, paddle: { ...IDLE_INPUT.paddle, launch: true } };
const eventTypes = (state) => state.events.map((event) => event.type);

function playingGame(modeId, ball) {
  const state = createGame(modeId);
  state.status = 'playing';
  state.ball = { x: 320, y: 250, vx: 0, vy: -250, ...ball };
  return state;
}

test('starting at level 10 gives the hardest settings immediately, in both modes', () => {
  const startSeconds = elapsedAtLevel(10, SECONDS_TO_HARDEST);
  for (const modeId of ['human', 'computer']) {
    const state = createGame(modeId, startSeconds);
    assert.equal(levelAt(state.time, SECONDS_TO_HARDEST), 10);
    assert.deepEqual(difficultyAt(modeId, state.time), difficultyAt(modeId, SECONDS_TO_HARDEST * 3));
    assert.equal(state.paddle.width, DIFFICULTY[modeId].paddleWidth[1]);

    step(state, launchInput, DT);
    assert.ok(Math.abs(Math.hypot(state.ball.vx, state.ball.vy) - DIFFICULTY[modeId].ballSpeed[1]) < 1e-6);
  }
});

test('starting at level 1 gives the easiest settings', () => {
  const state = createGame('human', elapsedAtLevel(1, SECONDS_TO_HARDEST));
  assert.equal(state.time, 0);
  assert.equal(state.paddle.width, DIFFICULTY.human.paddleWidth[0]);
});

test('each step reports launch, border, paddle and brick events, and forgets them on the next step', () => {
  const serving = createGame('human');
  step(serving, launchInput, DT);
  assert.deepEqual(eventTypes(serving), ['launch']);
  step(serving, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(serving), []);

  const border = playingGame('human', { x: BALL.radius + 1, vx: -250, vy: -100 });
  step(border, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(border), ['border']);

  const paddle = playingGame('human', { x: 320, y: PADDLE.y - BALL.radius - 1, vy: 250 });
  step(paddle, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(paddle), ['paddle']);

  const rect = brickRect({ col: 0, row: WALL.rows - 1 }, FIELD.width / 2);
  const brick = playingGame('human', { x: rect.x + rect.width / 2, y: rect.y + rect.height + BALL.radius + 1 });
  step(brick, IDLE_INPUT, DT);
  assert.deepEqual(brick.events, [{ type: 'brick', row: WALL.rows - 1 }]);
});

test('losing a ball reports lifeLost, and the last one also reports lost', () => {
  const state = playingGame('human', { x: 40, y: FIELD.height + BALL.radius, vy: 250 });
  step(state, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(state), ['lifeLost']);

  const lastLife = playingGame('human', { x: 40, y: FIELD.height + BALL.radius, vy: 250 });
  lastLife.lives = 1;
  step(lastLife, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(lastLife), ['lifeLost', 'lost']);
});

test('clearing the last brick reports won', () => {
  const rect = brickRect({ col: 0, row: 0 }, FIELD.width / 2);
  const state = playingGame('human', { x: rect.x + rect.width / 2, y: rect.y + rect.height + BALL.radius + 1 });
  state.bricks.forEach((brick) => { brick.alive = brick.col === 0 && brick.row === 0; });
  step(state, IDLE_INPUT, DT);
  assert.deepEqual(eventTypes(state), ['brick', 'won']);
});

test('every playable event has a sound, and a lost ball sounds different to each side', () => {
  for (const type of ['launch', 'paddle', 'border', 'lifeLost']) {
    assert.ok(soundFor({ type }, 'human'), `${type} is silent`);
  }
  for (let row = 0; row < WALL.rows; row += 1) assert.ok(soundFor({ type: 'brick', row }, 'human'));
  assert.notEqual(soundFor({ type: 'lifeLost' }, 'human'), soundFor({ type: 'lifeLost' }, 'computer'));
  assert.notEqual(soundFor({ type: 'brick', row: 0 }, 'human'), soundFor({ type: 'brick', row: 4 }, 'human'));
});

test('the result jingle is a win for whoever the human is: the paddle clears the wall, or the wall outlasts the computer', () => {
  assert.equal(resultSound({ modeId: 'human', status: 'won' }), 'win');
  assert.equal(resultSound({ modeId: 'human', status: 'lost' }), 'lose');
  assert.equal(resultSound({ modeId: 'computer', status: 'lost' }), 'win');
  assert.equal(resultSound({ modeId: 'computer', status: 'won' }), 'lose');
});

test('the pointer spreads across the whole screen onto the wall rail', () => {
  const { min, max } = wallBounds();
  assert.equal(railPosition(0), min);
  assert.equal(railPosition(FIELD.width), max);
  assert.equal(railPosition(FIELD.width / 2), FIELD.width / 2);
  assert.equal(railPosition(-50), min);
  assert.equal(railPosition(FIELD.width + 50), max);
});

test('pushing the wall into the end of its rail is flagged, pushing away is not', () => {
  const { min, max } = wallBounds();
  assert.equal(pushesPastRail(max, 1), true);
  assert.equal(pushesPastRail(min, -1), true);
  assert.equal(pushesPastRail(max, -1), false);
  assert.equal(pushesPastRail(FIELD.width / 2, 1), false);
  assert.equal(pushesPastRail(max, 0), false);
});
