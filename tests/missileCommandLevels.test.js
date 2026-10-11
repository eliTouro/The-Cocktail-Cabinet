import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_COUNT, elapsedAtLevel, levelAt } from '../js/core/level.js';
import { STEP_SECONDS } from '../js/core/loop.js';
import { createRng } from '../js/core/rng.js';
import {
  AI_SKILL, SECONDS_TO_HARDEST, SURVIVE_SECONDS, TUNING, WAVE,
} from '../js/games/missile-command/config.js';
import { createWaveGenerator } from '../js/games/missile-command/controllers.js';
import { createState, difficultyClock, observe, step } from '../js/games/missile-command/rules.js';

const stateAtLevel = (level) => createState(TUNING.human(), { startElapsed: elapsedAtLevel(level, SECONDS_TO_HARDEST) });

test('starting at the last level gives the hardest waves and the sharpest defender at once', () => {
  const state = stateAtLevel(LEVEL_COUNT);
  assert.equal(levelAt(difficultyClock(state), SECONDS_TO_HARDEST), LEVEL_COUNT);
  assert.deepEqual(WAVE(difficultyClock(state)), WAVE(Infinity));
  assert.deepEqual(AI_SKILL(observe(state).elapsed), AI_SKILL(Infinity));
});

test('starting at level 1 gives the gentlest waves and the clumsiest defender', () => {
  const state = stateAtLevel(1);
  assert.equal(levelAt(difficultyClock(state), SECONDS_TO_HARDEST), 1);
  assert.deepEqual(WAVE(difficultyClock(state)), WAVE(0));
  assert.deepEqual(AI_SKILL(observe(state).elapsed), AI_SKILL(0));
});

test('the first wave of a round started at the last level already has the most warheads and the top speed', () => {
  const state = stateAtLevel(LEVEL_COUNT);
  const waves = createWaveGenerator(createRng(3));
  state.time = 10;
  const { startWave } = waves.read(state);
  const hardest = WAVE(Infinity);
  assert.equal(startWave, hardest.count);
  state.time += 60;
  const { launches } = waves.read(state);
  assert.ok(launches.length > 0);
  launches.forEach((launch) => assert.equal(launch.speed, hardest.speed));
});

test('the round clock keeps climbing from the starting level while the round runs', () => {
  const state = stateAtLevel(4);
  const startLevel = levelAt(difficultyClock(state), SECONDS_TO_HARDEST);
  const idle = { launches: [], startWave: 0 };
  for (let tick = 0; tick < 40 / STEP_SECONDS; tick += 1) step(state, idle, STEP_SECONDS, TUNING.human());
  assert.ok(levelAt(difficultyClock(state), SECONDS_TO_HARDEST) > startLevel);
});

test('the difficulty ramp ends within the survival time plus the longest level head start', () => {
  assert.ok(SECONDS_TO_HARDEST > 0 && SECONDS_TO_HARDEST <= SURVIVE_SECONDS * 2);
});
