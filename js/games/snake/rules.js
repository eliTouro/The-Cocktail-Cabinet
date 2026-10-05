/** Pure Snake rules: no DOM, no timing, no knowledge of who is steering. Cells are { x, y }. */

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITES = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const sameCell = (a, b) => a.x === b.x && a.y === b.y;

const KEY_ROW_STRIDE = 1000;

export const keyOf = (cell) => cell.y * KEY_ROW_STRIDE + cell.x;

export function createState({ cols, rows }, startLength) {
  const y = Math.floor(rows / 2);
  const headX = Math.floor(cols / 2);
  const snake = Array.from({ length: startLength }, (_, index) => ({ x: headX - index, y }));
  return { cols, rows, snake, direction: 'right', apples: [], alive: true };
}

export function cloneState(state) {
  return {
    ...state,
    snake: state.snake.map((cell) => ({ ...cell })),
    apples: state.apples.map((cell) => ({ ...cell })),
  };
}

export const isOutside = (state, cell) => cell.x < 0 || cell.y < 0 || cell.x >= state.cols || cell.y >= state.rows;

export const isReversal = (direction, action) => OPPOSITES[direction] === action;

/** Actions a steerer may pick: everything except turning straight back into the neck. */
export const legalActions = (state) => Object.keys(DIRECTIONS).filter((action) => !isReversal(state.direction, action));

/** Advances one tick in place. `action` is a direction name or null to keep going. */
export function step(state, action) {
  const direction = action && !isReversal(state.direction, action) ? action : state.direction;
  const vector = DIRECTIONS[direction];
  const head = { x: state.snake[0].x + vector.x, y: state.snake[0].y + vector.y };
  const appleIndex = state.apples.findIndex((apple) => sameCell(apple, head));
  const ate = appleIndex >= 0;
  // The tail cell is vacated this tick unless the snake is growing, so it is safe to enter.
  const blockers = ate ? state.snake : state.snake.slice(0, -1);

  if (isOutside(state, head) || blockers.some((cell) => sameCell(cell, head))) {
    state.alive = false;
    return { ate: false, died: true };
  }

  state.direction = direction;
  state.snake.unshift(head);
  if (ate) state.apples.splice(appleIndex, 1);
  else state.snake.pop();
  return { ate, died: false };
}

/** Runs `step` on a copy so a controller can look ahead with exactly the real collision code. */
export function simulate(state, action) {
  const next = cloneState(state);
  const result = step(next, action);
  return { state: next, ...result };
}

function* neighbours(state, cell) {
  for (const vector of Object.values(DIRECTIONS)) {
    const next = { x: cell.x + vector.x, y: cell.y + vector.y };
    if (!isOutside(state, next)) yield next;
  }
}

/** Cells that block movement: the whole snake except the tail, which moves away. */
function blockedKeys(state) {
  return new Set(state.snake.slice(0, -1).map(keyOf));
}

/** Free cells the head could walk to, as a Map of cell key to cell. */
export function reachableCells(state) {
  const blocked = blockedKeys(state);
  const reached = new Map();
  const queue = [state.snake[0]];
  for (let read = 0; read < queue.length; read += 1) {
    for (const next of neighbours(state, queue[read])) {
      const key = keyOf(next);
      if (blocked.has(key) || reached.has(key)) continue;
      reached.set(key, next);
      queue.push(next);
    }
  }
  return reached;
}

/** First action of a shortest walk from the head to any apple, or null if none is reachable. */
export function firstStepToApple(state) {
  const blocked = blockedKeys(state);
  const appleKeys = new Set(state.apples.map(keyOf));
  const head = state.snake[0];
  const seen = new Set([keyOf(head)]);
  const queue = legalActions(state).map((action) => ({
    action,
    cell: { x: head.x + DIRECTIONS[action].x, y: head.y + DIRECTIONS[action].y },
  }));

  for (let read = 0; read < queue.length; read += 1) {
    const { action, cell } = queue[read];
    const key = keyOf(cell);
    if (isOutside(state, cell) || blocked.has(key) || seen.has(key)) continue;
    if (appleKeys.has(key)) return action;
    seen.add(key);
    for (const next of neighbours(state, cell)) queue.push({ action, cell: next });
  }
  return null;
}

const isOccupied = (state, cell) =>
  state.snake.some((part) => sameCell(part, cell)) || state.apples.some((apple) => sameCell(apple, cell));

/**
 * The human's apple drop. Only free cells the snake can actually walk to are allowed, so the
 * snake is never handed an impossible apple, and at most `maxApples` may be on the board.
 */
export function placeApple(state, cell, maxApples) {
  if (isOutside(state, cell) || isOccupied(state, cell)) return { ok: false, reason: 'blocked' };
  if (state.apples.length >= maxApples) return { ok: false, reason: 'too-many' };
  if (!reachableCells(state).has(keyOf(cell))) return { ok: false, reason: 'unreachable' };
  state.apples.push({ x: cell.x, y: cell.y });
  return { ok: true };
}

/** Whether a drop on this cell would be legal ignoring the apple cap, used for the hover preview. */
export const isDropTarget = (state, cell) =>
  !isOutside(state, cell) && !isOccupied(state, cell) && reachableCells(state).has(keyOf(cell));

export function hasFreeCell(state) {
  return state.snake.length + state.apples.length < state.cols * state.rows;
}

/** Drops an apple on a random reachable free cell; does nothing if there is none. */
export function spawnRandomApple(state, rng) {
  const candidates = [...reachableCells(state).values()].filter((cell) => !isOccupied(state, cell));
  if (candidates.length) state.apples.push({ ...rng.pick(candidates) });
}
