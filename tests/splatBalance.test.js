import assert from 'node:assert/strict';
import { test } from 'node:test';
import { humanWinRate, playRound } from './splatSimulation.js';

/**
 * Computer-vs-computer balance check. In each mode the person's job is done by a bot that only
 * uses what a person can: flapping from what is on screen (fly-through mode) or asking for a gap
 * height (lay mode), through the same session, rules and placement limits a person gets. The
 * rounds are seeded, so these numbers are exactly repeatable.
 *
 * "Human-role win" means: pass every column (fly-through mode), or splat the creature before it
 * passes all the columns (lay mode). Targets: clearly winnable at level 1, balanced mid-way, still
 * possible (but hard) at level 10.
 */
const ROUNDS = 200;
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

test('the two sides stay within 25 points of each other at mid levels', () => {
  assert.ok(Math.abs(rates.human[5] - rates.computer[5]) <= 0.25, `${rates.human[5]} vs ${rates.computer[5]}`);
});

test('every round ends with the creature splatting or surviving, never a timeout', () => {
  for (const modeId of MODES) {
    for (const level of [1, 10]) assert.notEqual(playRound({ modeId, level, seed: 7 }).phase, 'playing', `${modeId} level ${level}`);
  }
});
