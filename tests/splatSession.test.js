import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_COUNT } from '../js/core/level.js';
import { createRng } from '../js/core/rng.js';
import { STEP_SECONDS } from '../js/core/loop.js';
import {
  AI_SKILL, COLUMN_BUDGET, MIN_SPACING, SECONDS_TO_HARDEST, SPAWN_X, TUNING, WIN_COLUMNS,
} from '../js/games/splat/config.js';
import { EVENT, PHASE, REFUSAL, createState, placementBlock, step } from '../js/games/splat/rules.js';
import { LEVEL_UP, createSession } from '../js/games/splat/session.js';

const IDLE = { flap: false, column: null };
const TUNING_FIXED = { speed: 180, gapSize: 150 };

function sessionAt(modeId, startLevel, onEvent) {
  return createSession({ modeId, rng: createRng(1), startLevel, onEvent });
}

test('level 10 gives the hardest knobs the moment the round starts', () => {
  const human = sessionAt('human', LEVEL_COUNT);
  assert.deepEqual(human.tuning(), TUNING.human(SECONDS_TO_HARDEST.human));
  assert.equal(human.level(), LEVEL_COUNT);
  assert.equal(human.tuning().speed, TUNING.human(Infinity).speed);
  assert.equal(human.tuning().gapSize, TUNING.human(Infinity).gapSize);

  const computer = sessionAt('computer', LEVEL_COUNT);
  assert.equal(computer.level(), LEVEL_COUNT);
  assert.deepEqual(AI_SKILL(computer.state.time), AI_SKILL(Infinity));
});

test('level 1 starts at the easy end and each mode reports its starting level', () => {
  for (const modeId of ['human', 'computer']) {
    const session = sessionAt(modeId, 1);
    assert.equal(session.state.time, 0);
    assert.equal(session.level(), 1);
    assert.equal(sessionAt(modeId, 5).level(), 5);
  }
});

test('fly-through mode is won by passing the win count; lay mode has a column budget', () => {
  assert.equal(sessionAt('human', 1).state.goal, WIN_COLUMNS);
  assert.equal(sessionAt('computer', 1).state.goal, COLUMN_BUDGET);
});

test('a round announces each new level once as the clock climbs', () => {
  const levels = [];
  const session = sessionAt('computer', 1, (event) => event.type === LEVEL_UP && levels.push(event.level));
  while (session.state.time < SECONDS_TO_HARDEST.computer + 5 && !session.isOver()) session.advance(STEP_SECONDS, IDLE);
  assert.deepEqual(levels, Array.from({ length: LEVEL_COUNT - 1 }, (_, index) => index + 2));
});

test('a flap and a passed column are reported as events', () => {
  const state = createState();
  state.columns.push({ id: 1, x: 150 - 56 - 1, gapCenter: 230, gapSize: 150, passed: false });
  state.creature.y = 230;
  step(state, { flap: true, column: null }, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(state.events.map((event) => event.type), [EVENT.flap, EVENT.passed]);
  step(state, IDLE, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(state.events, []);
});

test('splatting and surviving are reported once, as the round ends', () => {
  const splatted = createState();
  splatted.creature.y = 1000;
  step(splatted, IDLE, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(splatted.events, [{ type: EVENT.splat, cause: 'floor' }]);

  const survived = createState({ goal: 1 });
  survived.columns.push({ id: 1, x: 150 - 56 - 1, gapCenter: 230, gapSize: 150, passed: false });
  survived.creature.y = 230;
  step(survived, IDLE, STEP_SECONDS, TUNING_FIXED);
  assert.equal(survived.phase, PHASE.survived);
  assert.ok(survived.events.some((event) => event.type === EVENT.survived));
});

test('a column laid too soon is refused with the reason, and a laid one says whether its gap was limited', () => {
  const state = createState({ goal: 3 });
  step(state, { flap: false, column: 230 }, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(state.events, [{ type: EVENT.placed, clamped: false }]);

  step(state, { flap: false, column: 230 }, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(state.events, [{ type: EVENT.refused, reason: REFUSAL.spacing }]);
  assert.equal(state.columnsPlaced, 1);

  state.columns[0].x = SPAWN_X - MIN_SPACING;
  step(state, { flap: false, column: 9999 }, STEP_SECONDS, TUNING_FIXED);
  assert.equal(state.events[0].type, EVENT.placed);
  assert.equal(state.events[0].clamped, true);
});

test('once the budget is spent a further column is refused as spent, not as too close', () => {
  const state = createState({ goal: 1 });
  step(state, { flap: false, column: 230 }, STEP_SECONDS, TUNING_FIXED);
  state.columns[0].x = SPAWN_X - MIN_SPACING;
  assert.equal(placementBlock(state), REFUSAL.budget);
  step(state, { flap: false, column: 230 }, STEP_SECONDS, TUNING_FIXED);
  assert.deepEqual(state.events, [{ type: EVENT.refused, reason: REFUSAL.budget }]);
});
