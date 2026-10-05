import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIFFICULTY, LIVES, PADDLE, WALL } from '../js/games/breakout/config.js';
import {
  DT, bricksBroken, computerGame, idlePaddle, idleWall, perfectPaddle, playGame, steeringWall,
} from './breakoutSimulation.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const MAX_SECONDS = DIFFICULTY.computer.seconds;
const EPSILON = 1e-9;

const sum = (values) => values.reduce((total, value) => total + value, 0);

test('human mode: a flawless paddle clears the wall at the start', () => {
  const state = playGame({ modeId: 'human', paddleHand: perfectPaddle, wallHand: idleWall });
  assert.equal(state.status, 'won');
  assert.equal(state.livesLost, 0);
});

test('human mode: a flawless paddle survives even the hardest settings', () => {
  const state = playGame({ modeId: 'human', startSeconds: MAX_SECONDS, paddleHand: perfectPaddle, wallHand: idleWall });
  assert.equal(state.livesLost, 0);
  assert.ok(bricksBroken(state) > 0);
});

test('human mode: a paddle that never moves loses all its lives', () => {
  const state = playGame({ modeId: 'human', paddleHand: idlePaddle, wallHand: idleWall });
  assert.equal(state.status, 'lost');
  assert.equal(state.livesLost, LIVES);
});

test('computer mode: the computer makes real progress at the easiest setting', () => {
  const broken = SEEDS.map((seed) => bricksBroken(computerGame({ seed, wallHand: idleWall })));
  assert.ok(Math.min(...broken) >= 3);
  assert.ok(sum(broken) / SEEDS.length >= 15);
});

test('computer mode: the computer is beatable at full skill by a steering wall', () => {
  const games = SEEDS.map((seed) => computerGame({ seed, startSeconds: MAX_SECONDS, wallHand: steeringWall }));
  assert.ok(sum(games.map((game) => game.livesLost)) >= SEEDS.length);
  assert.ok(games.some((game) => game.status === 'lost'));
});

test('computer mode: the computer can still clear the wall, so the human is never safe', () => {
  const games = SEEDS.map((seed) => computerGame({ seed, startSeconds: MAX_SECONDS, wallHand: steeringWall }));
  assert.ok(games.some((game) => game.status === 'won'));
});

test('computer mode: the computer paddle and the human wall obey the speed caps', () => {
  let fastestPaddle = 0;
  let fastestWall = 0;
  computerGame({
    seed: 3,
    startSeconds: MAX_SECONDS,
    wallHand: steeringWall,
    onStep(state, before) {
      fastestPaddle = Math.max(fastestPaddle, Math.abs(state.paddle.x - before.paddleX) / DT);
      fastestWall = Math.max(fastestWall, Math.abs(state.wallX - before.wallX) / DT);
    },
  });
  assert.ok(fastestPaddle <= PADDLE.speed + EPSILON);
  assert.ok(fastestWall <= WALL.speed + EPSILON);
  assert.ok(fastestPaddle > 0 && fastestWall > 0);
});
