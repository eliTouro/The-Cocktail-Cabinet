import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { FINAL_LEVEL, levelSettings } from '../js/games/mastermind/config.js';
import { createRun } from '../js/games/mastermind/session.js';
import { feedbackRecipe } from '../js/games/mastermind/sounds.js';

test('a run can start at the last level and gets that level\'s board straight away', () => {
  const run = createRun({ modeId: 'human', rng: createRng(1), startLevel: FINAL_LEVEL });
  assert.equal(run.level, FINAL_LEVEL);
  assert.deepEqual(run.settings, levelSettings(FINAL_LEVEL, { personBreaks: true }));
});

test('a start level outside the ramp is clamped', () => {
  assert.equal(createRun({ modeId: 'computer', rng: createRng(1), startLevel: 99 }).level, FINAL_LEVEL);
  assert.equal(createRun({ modeId: 'computer', rng: createRng(1), startLevel: -3 }).level, 1);
});

test('the peg sound has one blip per peg, reds higher than whites, and a buzz for none', () => {
  const recipe = feedbackRecipe({ black: 2, white: 1 });
  assert.equal(recipe.length, 3);
  assert.ok(recipe[0].from > recipe[2].from);
  assert.deepEqual(recipe.map((voice) => voice.delay), [0, 0.09, 0.18]);
  assert.equal(feedbackRecipe({ black: 0, white: 0 }).length, 1);
});
