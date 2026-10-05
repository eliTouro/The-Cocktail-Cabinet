import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { chooseAction } from '../js/games/snake/ai.js';
import { APPLE_RULES, DIFFICULTY, ESCAPE_LENGTH, difficultyAt } from '../js/games/snake/config.js';
import { createState, keyOf, legalActions, placeApple, reachableCells, spawnRandomApple, step } from '../js/games/snake/rules.js';
import { createSession } from '../js/games/snake/session.js';

const GRID = { cols: 10, rows: 8 };
const FRAME = 1 / 60;

function stateWith(snake, direction = 'right', apples = []) {
  return { ...GRID, snake, direction, apples, alive: true };
}

test('the snake moves one cell in its direction and keeps its length', () => {
  const state = stateWith([{ x: 5, y: 4 }, { x: 4, y: 4 }, { x: 3, y: 4 }]);
  step(state, null);
  assert.deepEqual(state.snake, [{ x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }]);
});

test('turning straight back into the neck is ignored', () => {
  const state = stateWith([{ x: 5, y: 4 }, { x: 4, y: 4 }]);
  step(state, 'left');
  assert.equal(state.direction, 'right');
  assert.equal(state.snake[0].x, 6);
});

test('eating an apple grows the snake and removes the apple', () => {
  const state = stateWith([{ x: 5, y: 4 }, { x: 4, y: 4 }], 'right', [{ x: 6, y: 4 }]);
  const result = step(state, null);
  assert.equal(result.ate, true);
  assert.equal(state.snake.length, 3);
  assert.equal(state.apples.length, 0);
});

test('hitting a wall kills the snake', () => {
  const state = stateWith([{ x: 9, y: 4 }, { x: 8, y: 4 }]);
  assert.equal(step(state, null).died, true);
  assert.equal(state.alive, false);
});

test('running into its own body kills the snake', () => {
  const loop = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 4, y: 3 }];
  const state = stateWith(loop, 'up');
  assert.equal(step(state, 'right').died, true);
});

test('the cell the tail is leaving is safe to enter', () => {
  const chase = [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 5, y: 4 }];
  const state = stateWith(chase, 'up');
  assert.equal(step(state, 'right').died, false);
});

test('the human may only drop apples on free cells the snake can reach', () => {
  const state = stateWith([{ x: 5, y: 4 }, { x: 4, y: 4 }]);
  assert.deepEqual(placeApple(state, { x: 5, y: 4 }, 3), { ok: false, reason: 'blocked' });
  assert.deepEqual(placeApple(state, { x: 20, y: 4 }, 3), { ok: false, reason: 'blocked' });
  assert.deepEqual(placeApple(state, { x: 8, y: 2 }, 3), { ok: true });
  assert.deepEqual(placeApple(state, { x: 8, y: 2 }, 3), { ok: false, reason: 'blocked' });
});

test('apples cannot be dropped in cells walled off from the head', () => {
  const wall = Array.from({ length: GRID.rows }, (_, y) => ({ x: 6, y }));
  const state = stateWith([{ x: 5, y: 4 }, ...wall, { x: 7, y: 0 }]);
  assert.equal(reachableCells(state).has(keyOf({ x: 8, y: 4 })), false);
  assert.deepEqual(placeApple(state, { x: 8, y: 4 }, 3), { ok: false, reason: 'unreachable' });
});

test('the board holds at most the maximum number of apples', () => {
  const state = stateWith([{ x: 5, y: 4 }, { x: 4, y: 4 }]);
  placeApple(state, { x: 1, y: 1 }, 2);
  placeApple(state, { x: 2, y: 1 }, 2);
  assert.deepEqual(placeApple(state, { x: 3, y: 1 }, 2), { ok: false, reason: 'too-many' });
});

test('a session enforces the drop cooldown, then allows another apple', () => {
  const session = createSession({ modeId: 'computer', rng: createRng(1) });
  session.state.apples.length = 0;
  assert.equal(session.requestApple({ x: 1, y: 1 }).ok, true);
  assert.deepEqual(session.requestApple({ x: 2, y: 1 }), { ok: false, reason: 'cooldown' });
  session.update(APPLE_RULES.cooldownSeconds + FRAME);
  assert.equal(session.requestApple({ x: 2, y: 1 }).ok, true);
});

test('an idle board gets a random apple so the snake is never stranded', () => {
  const session = createSession({ modeId: 'computer', rng: createRng(2) });
  session.state.apples.length = 0;
  let idleFrames = 0;
  while (session.state.apples.length === 0) {
    session.update(FRAME);
    idleFrames += 1;
  }
  assert.ok(Math.abs(idleFrames * FRAME - APPLE_RULES.idleDropSeconds) < 0.1);
});

test('human steering is queued and applied on the next ticks', () => {
  const session = createSession({ modeId: 'human', rng: createRng(3) });
  session.queueTurn('up');
  session.queueTurn('left');
  session.queueTurn('left');
  session.update(difficultyAt('human', 0).stepSeconds + FRAME);
  assert.equal(session.state.direction, 'up');
});

test('difficulty ramps in the harder direction and then holds', () => {
  const direction = { stepSeconds: -1, mistakeRate: -1, carefulness: 1 };
  for (const [modeId, knobs] of Object.entries(DIFFICULTY)) {
    for (const name of Object.keys(knobs)) {
      let previous = difficultyAt(modeId, 0)[name];
      for (let seconds = 10; seconds <= 400; seconds += 10) {
        const value = difficultyAt(modeId, seconds)[name];
        assert.ok((value - previous) * direction[name] >= 0, `${modeId}.${name} moved the wrong way at ${seconds}s`);
        previous = value;
      }
      assert.ok((previous - difficultyAt(modeId, 0)[name]) * direction[name] > 0, `${modeId}.${name} never changed`);
    }
  }
});

function playAi(skill, seed, maxSteps) {
  const rng = createRng(seed);
  const state = createState(GRID_FULL, 3);
  spawnRandomApple(state, rng);
  let eaten = 0;
  for (let steps = 0; steps < maxSteps && state.alive; steps += 1) {
    const { ate } = step(state, chooseAction(state, skill, rng));
    if (ate) {
      eaten += 1;
      spawnRandomApple(state, rng);
    }
  }
  return { eaten, alive: state.alive };
}

const GRID_FULL = { cols: 32, rows: 24 };
const SEEDS = Array.from({ length: 12 }, (_, index) => index + 1);
const FIRST_SKILL = { mistakeRate: DIFFICULTY.computer.mistakeRate.from, carefulness: DIFFICULTY.computer.carefulness.from };
const LAST_SKILL = { mistakeRate: DIFFICULTY.computer.mistakeRate.to, carefulness: DIFFICULTY.computer.carefulness.to };
const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

test('the AI steers through the real rules and makes real progress', () => {
  const games = SEEDS.map((seed) => playAi(LAST_SKILL, seed, 1500));
  assert.ok(average(games.map((game) => game.eaten)) >= 15, 'a capable snake eats plenty of apples');
});

test('a weak AI dies sooner than a strong one', () => {
  const weak = average(SEEDS.map((seed) => playAi(FIRST_SKILL, seed, 1500).eaten));
  const strong = average(SEEDS.map((seed) => playAi(LAST_SKILL, seed, 1500).eaten));
  assert.ok(weak < strong, `weak ${weak} should eat fewer than strong ${strong}`);
});

test('even the strongest AI is not invincible', () => {
  const deaths = SEEDS.filter((seed) => !playAi(LAST_SKILL, seed, 6000).alive).length;
  assert.ok(deaths > 0, 'some games must end in a death');
});

test('the AI never reverses into its neck', () => {
  const rng = createRng(9);
  const state = createState(GRID_FULL, 3);
  spawnRandomApple(state, rng);
  for (let steps = 0; steps < 300 && state.alive; steps += 1) {
    const action = chooseAction(state, LAST_SKILL, rng);
    assert.ok(legalActions(state).includes(action) || !state.alive);
    if (step(state, action).ate) spawnRandomApple(state, rng);
  }
});

test('a full computer-mode session ends in a death or an escape, never a hang', () => {
  const session = createSession({ modeId: 'computer', rng: createRng(5) });
  for (let frame = 0; frame < 60 * 600 && !session.outcome; frame += 1) {
    session.update(FRAME);
    if (session.cooldownLeft === 0) session.requestApple({ x: (frame * 7) % 32, y: (frame * 3) % 24 });
  }
  assert.ok(['dead', 'escaped'].includes(session.outcome));
  assert.ok(session.state.snake.length <= ESCAPE_LENGTH);
});
