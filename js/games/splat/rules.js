import {
  CLAMP_NOTICE_PIXELS, CLIMB_SAFETY, COLUMN_WIDTH, CREATURE_RADIUS, CREATURE_X, FLAP_COOLDOWN, FLAP_VELOCITY,
  FLOOR_Y, GAP_MARGIN, GRAVITY, HOVER_Y, MIN_SPACING, SPAWN_X, SPEED_MAX, WIDTH,
} from './config.js';

export const PHASE = { playing: 'playing', splat: 'splat', survived: 'survived' };
export const SPLAT_CAUSE = { column: 'column', floor: 'floor', ceiling: 'ceiling' };

export const EVENT = {
  flap: 'flap',
  placed: 'placed',
  refused: 'refused',
  passed: 'passed',
  splat: 'splat',
  survived: 'survived',
};
export const REFUSAL = { spacing: 'spacing', budget: 'budget' };

/**
 * `goal` is the number of columns the creature must pass to win, or null for an endless run.
 * `startTime` seeds the clock that every difficulty curve reads, so a round can begin at a later level.
 * `events` lists what happened during the latest step, for sound and on-screen messages.
 */
export function createState({ goal = null, startTime = 0 } = {}) {
  return {
    phase: PHASE.playing,
    time: startTime,
    events: [],
    creature: { x: CREATURE_X, y: HOVER_Y, vy: 0, flapCooldown: 0 },
    columns: [],
    nextColumnId: 1,
    columnsPlaced: 0,
    score: 0,
    goal,
    splat: null,
  };
}

/** Average climb speed of a creature that flaps as often as the cooldown allows. */
function climbRate() {
  const rise = -FLAP_VELOCITY * FLAP_COOLDOWN - 0.5 * GRAVITY * FLAP_COOLDOWN ** 2;
  return rise / FLAP_COOLDOWN;
}

/**
 * Largest change of gap centre between two consecutive columns that is still passable.
 * The creature has `spacing - width - 2r` of travel between leaving one gap and entering the next,
 * minus one flap cooldown of latency, and may start at the far edge of the first gap.
 */
export function maxCenterShift(spacing, gapBefore, gapAfter) {
  const travel = spacing - COLUMN_WIDTH - 2 * CREATURE_RADIUS;
  const climbSeconds = Math.max(0, travel / SPEED_MAX - FLAP_COOLDOWN);
  const capacity = climbRate() * CLIMB_SAFETY * climbSeconds;
  const edgeSlack = (gapBefore - gapAfter) / 2;
  return Math.max(0, capacity - Math.max(0, edgeSlack));
}

export function centerRange(gapSize) {
  return { low: gapSize / 2 + GAP_MARGIN, high: FLOOR_Y - gapSize / 2 - GAP_MARGIN };
}

const clamp = (value, low, high) => Math.min(Math.max(value, low), high);

function lastColumn(state) {
  return state.columns[state.columns.length - 1] ?? null;
}

/** The nearest passable gap centre to `requested`, given the column placed before it. */
export function clampCenter(state, requested, gapSize) {
  const range = centerRange(gapSize);
  const previous = lastColumn(state);
  if (!previous) return clamp(requested, range.low, range.high);

  const shift = maxCenterShift(SPAWN_X - previous.x, previous.gapSize, gapSize);
  const low = Math.max(range.low, previous.gapCenter - shift);
  const high = Math.min(range.high, previous.gapCenter + shift);
  return clamp(requested, low, high);
}

/** Why no column can be placed right now: the previous one is too close, or the budget is spent. Null if one can. */
export function placementBlock(state) {
  if (state.phase !== PHASE.playing) return REFUSAL.budget;
  if (state.goal !== null && state.columnsPlaced >= state.goal) return REFUSAL.budget;
  const previous = lastColumn(state);
  return !previous || SPAWN_X - previous.x >= MIN_SPACING ? null : REFUSAL.spacing;
}

export const canPlaceColumn = (state) => placementBlock(state) === null;

/** How far the previous column has travelled towards the next allowed spot: 0 just placed, 1 ready. */
export function spacingProgress(state) {
  const previous = lastColumn(state);
  return previous ? Math.min((SPAWN_X - previous.x) / MIN_SPACING, 1) : 1;
}

/** Adds a column at the right edge with its gap clamped to a passable position. Returns whether it was added. */
export function placeColumn(state, requestedCenter, gapSize) {
  if (!canPlaceColumn(state)) return false;
  state.columns.push({
    id: state.nextColumnId,
    x: SPAWN_X,
    gapCenter: clampCenter(state, requestedCenter, gapSize),
    gapSize,
    passed: false,
  });
  state.nextColumnId += 1;
  state.columnsPlaced += 1;
  return true;
}

function applyFlap(state) {
  const { creature } = state;
  if (creature.flapCooldown > 0) return;
  creature.vy = FLAP_VELOCITY;
  creature.flapCooldown = FLAP_COOLDOWN;
  state.events.push({ type: EVENT.flap });
}

function requestColumn(state, requestedCenter, gapSize) {
  const block = placementBlock(state);
  if (block) {
    state.events.push({ type: EVENT.refused, reason: block });
    return;
  }
  placeColumn(state, requestedCenter, gapSize);
  const placed = lastColumn(state);
  const clamped = Math.abs(placed.gapCenter - requestedCenter) > CLAMP_NOTICE_PIXELS;
  state.events.push({ type: EVENT.placed, clamped });
}

function moveCreature(creature, dt) {
  creature.vy += GRAVITY * dt;
  creature.y += creature.vy * dt;
  creature.flapCooldown = Math.max(0, creature.flapCooldown - dt);
}

function scrollColumns(state, speed, dt) {
  for (const column of state.columns) column.x -= speed * dt;
  const newest = lastColumn(state);
  state.columns = state.columns.filter((column) => column === newest || column.x + COLUMN_WIDTH > 0);
}

function circleHitsRect(circle, rect) {
  const nearestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(circle.y, rect.y, rect.y + rect.height);
  return (circle.x - nearestX) ** 2 + (circle.y - nearestY) ** 2 < CREATURE_RADIUS ** 2;
}

function hitsColumn(creature, column) {
  const top = { x: column.x, y: 0, width: COLUMN_WIDTH, height: column.gapCenter - column.gapSize / 2 };
  const bottomY = column.gapCenter + column.gapSize / 2;
  const bottom = { x: column.x, y: bottomY, width: COLUMN_WIDTH, height: FLOOR_Y - bottomY };
  return circleHitsRect(creature, top) || circleHitsRect(creature, bottom);
}

function findSplatCause(state) {
  const { creature } = state;
  if (creature.y - CREATURE_RADIUS < 0) return SPLAT_CAUSE.ceiling;
  if (creature.y + CREATURE_RADIUS > FLOOR_Y) return SPLAT_CAUSE.floor;
  if (state.columns.some((column) => hitsColumn(creature, column))) return SPLAT_CAUSE.column;
  return null;
}

function scorePassedColumns(state) {
  for (const column of state.columns) {
    if (!column.passed && column.x + COLUMN_WIDTH < state.creature.x) {
      column.passed = true;
      state.score += 1;
      state.events.push({ type: EVENT.passed });
    }
  }
}

/**
 * Advances the world by dt seconds. `input` is { flap, column } where column is a requested gap
 * centre or null; `tuning` is { speed, gapSize }. Human and computer controllers both go through here.
 */
export function step(state, input, dt, tuning) {
  state.events = [];
  if (state.phase !== PHASE.playing) return;
  if (input.flap) applyFlap(state);
  if (input.column !== null && input.column !== undefined) requestColumn(state, input.column, tuning.gapSize);

  moveCreature(state.creature, dt);
  scrollColumns(state, tuning.speed, dt);
  state.time += dt;

  const cause = findSplatCause(state);
  if (cause) {
    state.phase = PHASE.splat;
    state.splat = { x: state.creature.x, y: state.creature.y, cause };
    state.events.push({ type: EVENT.splat, cause });
    return;
  }
  scorePassedColumns(state);
  if (state.goal !== null && state.score >= state.goal) {
    state.phase = PHASE.survived;
    state.events.push({ type: EVENT.survived });
  }
}

/** What a player can see on screen: the creature and the columns that are on screen and not yet behind it. */
export function observe(state) {
  const { creature } = state;
  const columns = state.columns
    .filter((column) => column.x < WIDTH && column.x + COLUMN_WIDTH > creature.x - CREATURE_RADIUS)
    .map(({ id, x, gapCenter, gapSize }) => ({ id, x, gapCenter, gapSize }));
  return { time: state.time, y: creature.y, vy: creature.vy, columns };
}
