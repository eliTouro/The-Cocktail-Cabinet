import assert from 'node:assert/strict';
import { test } from 'node:test';
import { humanWinRate, playRound } from './snakeSimulation.js';

/**
 * Computer-vs-computer balance check. In each mode the person's job is done by a bot that only
 * uses the session API a human uses (queueTurn, requestApple), so the same rules, cooldowns and
 * turn queue apply to it. The rounds are seeded, so these numbers are exactly repeatable.
 *
 * "Human-role win" means: steer to the apple target (human mode), or crash the snake before it
 * escapes (computer mode). Targets: clearly winnable at level 1, balanced mid-way, still possible
 * (but hard) at level 10.
 */
const ROUNDS = 50;
const MODES = ['human', 'computer'];
const BANDS = {
  1: { min: 0.65, max: 0.95 },
  5: { min: 0.25, max: 0.75 },
  10: { min: 0.1, max: 0.6 },
};

const rates = Object.fromEntries(MODES.map((modeId) => [
  modeId,
  Object.fromEntries(Object.keys(BANDS).map((level) => [level, humanWinRate({ modeId, level: Number(level), rounds: ROUNDS })])),
]));

for (const modeId of MODES) {
  for (const [level, { min, max }] of Object.entries(BANDS)) {
    test(`${modeId} mode, level ${level}: the human-role side wins ${min * 100}-${max * 100}% of rounds`, () => {
      const rate = rates[modeId][level];
      assert.ok(rate >= min && rate <= max, `won ${Math.round(rate * 100)}% of ${ROUNDS} rounds`);
    });
  }

  test(`${modeId} mode gets harder from level 1 to level 10 for the human-role side`, () => {
    assert.ok(rates[modeId][10] < rates[modeId][1] - 0.2, `${rates[modeId][1]} then ${rates[modeId][10]}`);
  });
}

test('a round always ends with an outcome, never a timeout', () => {
  for (const modeId of MODES) {
    for (const level of [1, 10]) assert.ok(playRound({ modeId, level, seed: 7 }).outcome, `${modeId} level ${level}`);
  }
});
