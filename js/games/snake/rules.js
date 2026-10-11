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

  const hitWall = isOutside(state, head);
  if (hitWall || blockers.some((cell) => sameCell(cell, head))) {
    state.alive = false;
    return { ate: false, died: true, crashedInto: hitWall ? 'wall' : 'tail' };
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

const ACTION_NAMES = Object.keys(DIRECTIONS);
const STEP_X = ACTION_NAMES.map((name) => DIRECTIONS[name].x);
const STEP_Y = ACTION_NAMES.map((name) => DIRECTIONS[name].y);

/**
 * Breadth-first walk from the head over free cells. `onReach(x, y, firstAction)` is called once per
 * cell reached, with the first move of the shortest way there; returning true stops the walk.
 * Plain typed arrays rather than cell objects: the computer's look-ahead runs this several times a move.
 */
function walkReachable(state, onReach) {
  const { cols, rows, snake } = state;
  const seen = new Uint8Array(cols * rows);
  for (let index = 0; index < snake.length - 1; index += 1) seen[snake[index].y * cols + snake[index].x] = 1;
  const headIndex = snake[0].y * cols + snake[0].x;
  seen[headIndex] = 1;
  const queue = new Int32Array(cols * rows);
  const firstMoves = new Int8Array(cols * rows).fill(-1);
  queue[0] = headIndex;
  let queued = 1;
  for (let read = 0; read < queued; read += 1) {
    const x = queue[read] % cols;
    const y = (queue[read] - x) / cols;
    for (let move = 0; move < ACTION_NAMES.length; move += 1) {
      const nextX = x + STEP_X[move];
      const nextY = y + STEP_Y[move];
      if (nextX < 0 || nextY < 0 || nextX >= cols || nextY >= rows || seen[nextY * cols + nextX]) continue;
      seen[nextY * cols + nextX] = 1;
      const first = firstMoves[read] < 0 ? move : firstMoves[read];
      if (onReach(nextX, nextY, ACTION_NAMES[first])) return;
      queue[queued] = nextY * cols + nextX;
      firstMoves[queued] = first;
      queued += 1;
    }
  }
}

/** Free cells the head could walk to, as a Map of cell key to cell. */
export function reachableCells(state) {
  const reached = new Map();
  walkReachable(state, (x, y) => { reached.set(keyOf({ x, y }), { x, y }); });
  return reached;
}

/** How many free cells the head could walk to; cheaper than `reachableCells` when only the room matters. */
export function reachableCount(state) {
  let count = 0;
  walkReachable(state, () => { count += 1; });
  return count;
}

/** First action of a shortest walk from the head to any apple, or null if none is reachable. */
export function firstStepToApple(state) {
  const appleKeys = new Set(state.apples.map(keyOf));
  let found = null;
  walkReachable(state, (x, y, first) => {
    if (!appleKeys.has(keyOf({ x, y }))) return false;
    found = first;
    return true;
  });
  return found;
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

/** True when the snake has less open room than its own length, so it can no longer fit without a gap. */
export const isBoxedIn = (state) => reachableCount(state) < state.snake.length;

/** Drops an apple on a random reachable free cell; does nothing if there is none. */
export function spawnRandomApple(state, rng) {
  const candidates = [...reachableCells(state).values()].filter((cell) => !isOccupied(state, cell));
  if (candidates.length) state.apples.push({ ...rng.pick(candidates) });
}
