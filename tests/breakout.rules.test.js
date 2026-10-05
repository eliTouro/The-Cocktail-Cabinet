import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BALL, DIFFICULTY, FIELD, LIVES, PADDLE, ROW_POINTS, WALL, difficultyAt } from '../js/games/breakout/config.js';
import {
  IDLE_INPUT, bricksLeft, brickRect, circleHitsRect, createGame, observe, reshape, step, wallBounds, wallScore,
} from '../js/games/breakout/rules.js';

const DT = 1 / 60;
const FIRST_BRICK = { col: 0, row: 0 };
const BOTTOM_ROW_BRICK = { col: 0, row: WALL.rows - 1 };

function playingGame(modeId, ball) {
  const state = createGame(modeId);
  state.status = 'playing';
  state.ball = { x: 320, y: 300, vx: 0, vy: -250, ...ball };
  return state;
}

const tick = (state, input = IDLE_INPUT) => step(state, input, DT);

test('ball bounces off the left, right and top borders', () => {
  const left = playingGame('human', { x: BALL.radius + 1, y: 300, vx: -250, vy: -100 });
  tick(left);
  assert.ok(left.ball.vx > 0);

  const right = playingGame('human', { x: FIELD.width - BALL.radius - 1, y: 300, vx: 250, vy: -100 });
  tick(right);
  assert.ok(right.ball.vx < 0);

  const top = playingGame('human', { x: 320, y: BALL.radius + 1, vx: 100, vy: -250 });
  tick(top);
  assert.ok(top.ball.vy > 0);
});

test('paddle bounce: centre goes straight up, edges angle outwards', () => {
  const centre = playingGame('human', { x: 320, y: PADDLE.y - BALL.radius - 1, vx: 0, vy: 250 });
  tick(centre);
  assert.ok(centre.ball.vy < 0);
  assert.ok(Math.abs(centre.ball.vx) < 1);

  const rightEdge = playingGame('human', { x: 320 + 50, y: PADDLE.y - BALL.radius - 1, vx: 0, vy: 250 });
  tick(rightEdge);
  assert.ok(rightEdge.ball.vx > 100);
  assert.ok(rightEdge.ball.vy < 0);

  const leftEdge = playingGame('human', { x: 320 - 50, y: PADDLE.y - BALL.radius - 1, vx: 0, vy: 250 });
  tick(leftEdge);
  assert.ok(leftEdge.ball.vx < -100);
});

test('ball that misses the paddle costs a life and returns to serving', () => {
  const state = playingGame('human', { x: 40, y: FIELD.height + BALL.radius, vx: 0, vy: 250 });
  tick(state);
  assert.equal(state.lives, LIVES - 1);
  assert.equal(state.status, 'serving');
});

test('losing the last life ends the game', () => {
  const state = playingGame('human', { x: 40, y: FIELD.height + BALL.radius, vx: 0, vy: 250 });
  state.lives = 1;
  tick(state);
  assert.equal(state.status, 'lost');
  assert.equal(state.livesLost, 1);
});

test('serving holds the ball on the paddle until launch', () => {
  const state = createGame('human');
  tick(state);
  assert.equal(state.status, 'serving');
  tick(state, { ...IDLE_INPUT, paddle: { ...IDLE_INPUT.paddle, launch: true } });
  assert.equal(state.status, 'playing');
  assert.ok(state.ball.vy < 0);
});

test('a brick hit from below bounces the ball down, removes the brick and scores its row', () => {
  const rect = brickRect(BOTTOM_ROW_BRICK, 320);
  const state = playingGame('human', { x: rect.x + rect.width / 2, y: rect.y + rect.height + BALL.radius + 1, vx: 0, vy: -250 });
  tick(state);
  assert.ok(state.ball.vy > 0);
  assert.equal(bricksLeft(state), WALL.columns * WALL.rows - 1);
  assert.equal(state.score, ROW_POINTS[WALL.rows - 1]);
});

test('a brick hit on its side reverses horizontal travel', () => {
  const rect = brickRect(FIRST_BRICK, 320);
  const state = playingGame('human', { x: rect.x - BALL.radius - 1, y: rect.y + rect.height / 2, vx: 250, vy: -80 });
  tick(state);
  assert.ok(state.ball.vx < 0);
});

test('corner contact pushes out along the diagonal and misses are null', () => {
  const rect = { x: 100, y: 100, width: 48, height: 18 };
  const diagonal = BALL.radius * 0.7;
  const corner = circleHitsRect({ x: 100 - diagonal, y: 100 - diagonal }, rect);
  assert.ok(Math.abs(corner.nx + Math.SQRT1_2) < 1e-9 && Math.abs(corner.ny + Math.SQRT1_2) < 1e-9);
  assert.ok(corner.depth > 0);
  assert.equal(circleHitsRect({ x: 100 - BALL.radius - 1, y: 100 - BALL.radius - 1 }, rect), null);
});

test('a ball buried inside a brick is pushed out through the nearest face', () => {
  const rect = { x: 100, y: 100, width: 48, height: 18 };
  const hit = circleHitsRect({ x: 104, y: 109 }, rect);
  assert.deepEqual({ nx: hit.nx, ny: hit.ny }, { nx: -1, ny: 0 });
  assert.ok(hit.depth > BALL.radius);
});

test('clearing the last brick wins', () => {
  const rect = brickRect(FIRST_BRICK, 320);
  const state = playingGame('human', { x: rect.x + rect.width / 2, y: rect.y + rect.height + BALL.radius + 1, vx: 0, vy: -250 });
  state.bricks.forEach((brick) => { brick.alive = brick.col === 0 && brick.row === 0; });
  tick(state);
  assert.equal(state.status, 'won');
});

test('the ball never settles into a flat loop and keeps its speed', () => {
  const ball = { vx: 300, vy: 0 };
  reshape(ball, 300);
  assert.ok(Math.abs(ball.vy) >= 300 * BALL.minVerticalRatio - 1e-9);
  assert.ok(Math.abs(Math.hypot(ball.vx, ball.vy) - 300) < 1e-9);
});

test('paddle obeys its speed cap and stays inside the field', () => {
  const state = createGame('human');
  tick(state, { ...IDLE_INPUT, paddle: { target: 0, direction: 0, launch: false } });
  assert.ok(Math.abs(state.paddle.x - 320) <= PADDLE.speed * DT + 1e-9);
  for (let i = 0; i < 120; i += 1) tick(state, { ...IDLE_INPUT, paddle: { target: -999, direction: 0, launch: false } });
  assert.equal(state.paddle.x, state.paddle.width / 2);
});

test('wall slides no faster than its cap and never past its bounds', () => {
  const state = createGame('computer');
  tick(state, { ...IDLE_INPUT, wall: { target: 9999, direction: 0 } });
  assert.ok(Math.abs(state.wallX - 320 - WALL.speed * DT) < 1e-9);
  for (let i = 0; i < 600; i += 1) tick(state, { ...IDLE_INPUT, wall: { target: null, direction: 1 } });
  assert.equal(state.wallX, wallBounds().max);
  for (let i = 0; i < 1200; i += 1) tick(state, { ...IDLE_INPUT, wall: { target: null, direction: -1 } });
  assert.equal(state.wallX, wallBounds().min);
});

test('a sliding wall throws the ball sideways', () => {
  const rect = brickRect(FIRST_BRICK, 320);
  const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height + BALL.radius + 1, vx: 0, vy: -250 };
  const still = playingGame('computer', start);
  const sliding = playingGame('computer', start);
  tick(still);
  tick(sliding, { ...IDLE_INPUT, wall: { target: null, direction: 1 } });
  assert.ok(sliding.ball.vx > still.ball.vx);
});

test('the opponent score rewards lost lives and standing bricks', () => {
  const state = createGame('computer');
  const standing = wallScore(state);
  state.livesLost = 1;
  assert.ok(wallScore(state) > standing);
});

test('the computer observes only the ball, paddle and bricks', () => {
  const view = observe(createGame('computer'));
  assert.deepEqual(Object.keys(view).sort(), ['ball', 'bricks', 'paddle', 'serving']);
});

test('difficulty values move monotonically toward harder', () => {
  const times = [0, 10, 30, 60, 100, 150, 400];
  const series = (modeId, knob) => times.map((time) => difficultyAt(modeId, time)[knob]);
  const nonDecreasing = (values) => values.every((value, i) => i === 0 || value >= values[i - 1]);
  const nonIncreasing = (values) => values.every((value, i) => i === 0 || value <= values[i - 1]);

  assert.ok(nonDecreasing(series('human', 'ballSpeed')));
  assert.ok(nonIncreasing(series('human', 'paddleWidth')));
  assert.ok(nonDecreasing(series('computer', 'ballSpeed')));
  assert.ok(nonIncreasing(series('computer', 'paddleWidth')));
  assert.ok(nonIncreasing(series('computer', 'reaction')));
  assert.ok(nonIncreasing(series('computer', 'aimError')));
  assert.equal(difficultyAt('human', 0).ballSpeed, DIFFICULTY.human.ballSpeed[0]);
});
