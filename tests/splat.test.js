import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { STEP_SECONDS } from '../js/core/loop.js';
import { createAi } from '../js/games/splat/ai.js';
import {
  AI_SKILL, COLUMN_BUDGET, COLUMN_WIDTH, CREATURE_RADIUS, CREATURE_X, FLAP_COOLDOWN,
  FLAP_VELOCITY, FLOOR_Y, GRAVITY, HEIGHT, MIN_SPACING, SPAWN_X, SPEED_MAX, TUNING,
} from '../js/games/splat/config.js';
import { createColumnGenerator } from '../js/games/splat/controllers.js';
import {
  PHASE, SPLAT_CAUSE, centerRange, clampCenter, createState, maxCenterShift, observe,
  placeColumn, step,
} from '../js/games/splat/rules.js';

const IDLE = { flap: false, column: null };
const TUNING_FIXED = { speed: 180, gapSize: 150 };
const STEP = STEP_SECONDS;

function stateWithColumn(overrides = {}) {
  const state = createState();
  state.columns.push({ id: 1, x: 400, gapCenter: 230, gapSize: 150, passed: false, ...overrides });
  return state;
}

test('gravity pulls the creature down and a flap kicks it up', () => {
  const state = createState();
  const startY = state.creature.y;
  step(state, IDLE, STEP, TUNING_FIXED);
  assert.ok(state.creature.vy > 0 && state.creature.y > startY);

  step(state, { flap: true, column: null }, STEP, TUNING_FIXED);
  assert.ok(state.creature.vy < 0);
  assert.ok(Math.abs(state.creature.vy - (FLAP_VELOCITY + GRAVITY * STEP)) < 1e-9);
});

test('a flap is ignored while the flap cooldown runs', () => {
  const state = createState();
  step(state, { flap: true, column: null }, STEP, TUNING_FIXED);
  const velocity = state.creature.vy;
  step(state, { flap: true, column: null }, STEP, TUNING_FIXED);
  assert.ok(state.creature.vy > velocity);
  for (let i = 0; i < FLAP_COOLDOWN / STEP; i += 1) step(state, IDLE, STEP, TUNING_FIXED);
  step(state, { flap: true, column: null }, STEP, TUNING_FIXED);
  assert.ok(state.creature.vy < 0);
});

test('columns scroll left at the tuned speed', () => {
  const state = stateWithColumn();
  step(state, IDLE, 0.5, { speed: 100, gapSize: 150 });
  assert.equal(state.columns[0].x, 350);
});

test('hitting the floor, the ceiling or a column splats', () => {
  const floor = createState();
  floor.creature.y = FLOOR_Y - CREATURE_RADIUS + 1;
  step(floor, IDLE, STEP, TUNING_FIXED);
  assert.equal(floor.splat.cause, SPLAT_CAUSE.floor);

  const ceiling = createState();
  ceiling.creature.y = CREATURE_RADIUS - 1;
  step(ceiling, IDLE, STEP, TUNING_FIXED);
  assert.equal(ceiling.splat.cause, SPLAT_CAUSE.ceiling);

  const upper = stateWithColumn({ x: CREATURE_X - 10, gapCenter: 400 });
  upper.creature.y = 100;
  step(upper, IDLE, STEP, TUNING_FIXED);
  assert.equal(upper.splat.cause, SPLAT_CAUSE.column);

  const lower = stateWithColumn({ x: CREATURE_X - 10, gapCenter: 100 });
  lower.creature.y = 300;
  step(lower, IDLE, STEP, TUNING_FIXED);
  assert.equal(lower.splat.cause, SPLAT_CAUSE.column);
  assert.equal(lower.phase, PHASE.splat);
});

test('flying through the gap is safe and scores once the column is behind', () => {
  const state = stateWithColumn({ x: CREATURE_X + 30 });
  state.creature.y = 230;
  const hover = () => ({ flap: state.creature.vy > 0 && state.creature.y > 230, column: null });
  for (let i = 0; i < 120 && state.score === 0; i += 1) step(state, hover(), STEP, TUNING_FIXED);
  assert.equal(state.phase, PHASE.playing);
  assert.equal(state.score, 1);
  step(state, hover(), STEP, TUNING_FIXED);
  assert.equal(state.score, 1);
});

test('a finished game ignores further steps', () => {
  const state = createState();
  state.creature.y = FLOOR_Y;
  step(state, IDLE, STEP, TUNING_FIXED);
  const { time } = state;
  step(state, IDLE, STEP, TUNING_FIXED);
  assert.equal(state.time, time);
});

test('the creature wins once it has passed the goal number of columns', () => {
  const state = createState({ goal: 1 });
  state.columns.push({ id: 1, x: CREATURE_X - COLUMN_WIDTH - 1, gapCenter: 230, gapSize: 150, passed: false });
  state.creature.y = 230;
  step(state, IDLE, STEP, TUNING_FIXED);
  assert.equal(state.phase, PHASE.survived);
});

test('columns are only placed after the spacing cooldown and never beyond the budget', () => {
  const state = createState({ goal: 2 });
  assert.equal(placeColumn(state, 230, 150), true);
  assert.equal(placeColumn(state, 230, 150), false);
  state.columns[0].x = SPAWN_X - MIN_SPACING;
  assert.equal(placeColumn(state, 230, 150), true);
  state.columns[1].x = SPAWN_X - MIN_SPACING;
  assert.equal(placeColumn(state, 230, 150), false);
});

test('placement is clamped inside the screen and within the passable shift', () => {
  const state = createState();
  const gap = 150;
  assert.equal(clampCenter(state, -500, gap), centerRange(gap).low);
  assert.equal(clampCenter(state, 5000, gap), centerRange(gap).high);

  placeColumn(state, 230, gap);
  state.columns[0].x = SPAWN_X - MIN_SPACING;
  const limit = maxCenterShift(MIN_SPACING, gap, gap);
  assert.ok(limit > 0 && limit < HEIGHT);
  assert.equal(clampCenter(state, 5000, gap), Math.min(centerRange(gap).high, 230 + limit));
  assert.equal(clampCenter(state, -5000, gap), Math.max(centerRange(gap).low, 230 - limit));
});

test('waiting longer before sending a column allows a bigger shift', () => {
  assert.ok(maxCenterShift(450, 150, 150) > maxCenterShift(300, 150, 150));
});

test('the AI observes only columns that are on screen and not yet behind it', () => {
  const state = createState();
  state.columns.push(
    { id: 1, x: CREATURE_X - COLUMN_WIDTH - CREATURE_RADIUS - 1, gapCenter: 200, gapSize: 150, passed: true },
    { id: 2, x: 300, gapCenter: 200, gapSize: 150, passed: false },
    { id: 3, x: SPAWN_X + 1, gapCenter: 200, gapSize: 150, passed: false },
  );
  assert.deepEqual(observe(state).columns.map((column) => column.id), [2]);
});

function worstCasePlacement(state, flip) {
  const previous = state.columns[state.columns.length - 1];
  const nearTop = !previous || previous.gapCenter > HEIGHT / 2;
  flip.up = !nearTop;
  return flip.up ? -1000 : 5000;
}

function playComputerGame(seed, { startAt = 0, limit = 90 } = {}) {
  const state = createState({ goal: COLUMN_BUDGET });
  state.time = startAt;
  const ai = createAi(createRng(seed));
  const flip = {};
  while (state.phase === PHASE.playing && state.time - startAt < limit) {
    const tuning = TUNING.computer(state.time);
    const column = worstCasePlacement(state, flip);
    const wantsColumn = state.columns.length === 0 || SPAWN_X - state.columns[state.columns.length - 1].x >= 300;
    step(state, { flap: ai.decide(observe(state)).flap, column: wantsColumn ? column : null }, STEP, tuning);
  }
  return state;
}

function survivalRate(startAt, seeds) {
  const results = seeds.map((seed) => playComputerGame(seed, { startAt }));
  return {
    survived: results.filter((state) => state.phase === PHASE.survived).length / results.length,
    meanScore: results.reduce((sum, state) => sum + state.score, 0) / results.length,
  };
}

const SEEDS = Array.from({ length: 40 }, (_, index) => index + 1);

test('a perfectly aimed pilot clears worst-case placements at the highest speed', () => {
  const state = createState({ goal: COLUMN_BUDGET });
  const flip = {};
  const pilot = createAi(createRng(1), () => ({ reactionDelay: STEP, aimError: 0 }));
  const fastTuning = { speed: SPEED_MAX, gapSize: 140 };
  while (state.phase === PHASE.playing && state.time < 120) {
    const { flap } = pilot.decide(observe(state));
    const wantsColumn = state.columns.length === 0 || SPAWN_X - state.columns[state.columns.length - 1].x >= 300;
    step(state, { flap, column: wantsColumn ? worstCasePlacement(state, flip) : null }, STEP, fastTuning);
  }
  assert.equal(state.phase, PHASE.survived);
});

test('the AI is not hopeless at low difficulty and not invincible at high difficulty', () => {
  const early = survivalRate(0, SEEDS);
  const late = survivalRate(100, SEEDS);
  assert.ok(early.meanScore >= 1, `early mean ${early.meanScore}`);
  assert.ok(early.survived < late.survived, `early ${early.survived} late ${late.survived}`);
  assert.ok(late.meanScore > early.meanScore, `late mean ${late.meanScore}`);
  assert.ok(late.survived > 0.3, `late survived ${late.survived}`);
  assert.ok(late.survived < 1, `late survived ${late.survived}`);
  assert.ok(early.survived < 0.5, `early survived ${early.survived}`);
});

test('AI skill improves monotonically with time', () => {
  let previous = AI_SKILL(0);
  for (let seconds = 1; seconds <= 70; seconds += 1) {
    const skill = AI_SKILL(seconds);
    assert.ok(skill.reactionDelay <= previous.reactionDelay);
    assert.ok(skill.aimError <= previous.aimError);
    previous = skill;
  }
});

test('human mode gets faster and tighter, but never past the passable limits', () => {
  let previous = TUNING.human(0);
  for (let seconds = 1; seconds <= 200; seconds += 1) {
    const tuning = TUNING.human(seconds);
    assert.ok(tuning.speed >= previous.speed && tuning.gapSize <= previous.gapSize);
    assert.ok(tuning.speed <= SPEED_MAX);
    assert.ok(tuning.gapSize >= 2 * CREATURE_RADIUS + 90);
    previous = tuning;
  }
  assert.ok(TUNING.human(0).speed < TUNING.human(200).speed);
});

test('generated classic columns are always placed within the passable shift', () => {
  const rng = createRng(7);
  const generator = createColumnGenerator(rng);
  const state = createState();
  for (let i = 0; i < 200; i += 1) {
    const tuning = TUNING.human(i);
    const requested = generator.read(state, tuning);
    if (requested !== null) {
      const before = state.columns[state.columns.length - 1];
      placeColumn(state, requested, tuning.gapSize);
      const placed = state.columns[state.columns.length - 1];
      if (before) assert.ok(Math.abs(placed.gapCenter - before.gapCenter) <= maxCenterShift(SPAWN_X - before.x, before.gapSize, placed.gapSize) + 1e-9);
    }
    step(state, IDLE, 0.1, { speed: SPEED_MAX, gapSize: tuning.gapSize });
    state.phase = PHASE.playing;
  }
});
