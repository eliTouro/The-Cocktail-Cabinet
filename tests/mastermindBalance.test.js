import assert from 'node:assert/strict';
import { test } from 'node:test';
import { personBreakRate, personStumpRate } from './mastermindSimulation.js';

const GAMES = 80;
const LEVELS = [1, 5, 10];

const breaking = Object.fromEntries(LEVELS.map((level) => [level, personBreakRate({ level, games: GAMES })]));
const making = Object.fromEntries(LEVELS.map((level) => [level, personStumpRate({ level, games: GAMES })]));

test('breaking the code: clearly winnable at level 1, harder at level 10, never impossible', () => {
  assert.ok(breaking[1] >= 0.65 && breaking[1] <= 0.97, `level 1 won ${breaking[1]}`);
  assert.ok(breaking[5] > breaking[10], 'the levels get harder');
  assert.ok(breaking[10] >= 0.1, `level 10 won only ${breaking[10]}`);
});

test('making the code: stumping the computer is likely early and still possible at level 10', () => {
  assert.ok(making[1] >= 0.5 && making[1] <= 0.9, `level 1 stumped ${making[1]}`);
  assert.ok(making[10] >= 0.1, `level 10 stumped only ${making[10]}`);
});

test('the two sides are roughly balanced at the middle level', () => {
  for (const rate of [breaking[5], making[5]]) {
    assert.ok(rate >= 0.25 && rate <= 0.75, `level 5 side won ${rate}`);
  }
});
