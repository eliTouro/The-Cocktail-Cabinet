/**
 * The maze and its rules. Pure data in, data out: no DOM, no randomness, no timers.
 * Cells are numbered `y * cols + x`. Walls, one-way arrows and portals are parts placed on floor.
 * The Start and Exit squares are always plain floor underneath.
 */

export const DIRS = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
export const ARROWS = ['up', 'right', 'down', 'left'];

const isArrow = (cell) => cell in DIRS;

export function createMaze({ cols, rows }) {
  const middleRow = Math.floor(rows / 2) * cols;
  return {
    cols,
    rows,
    cells: Array(cols * rows).fill('floor'),
    start: middleRow,
    exit: middleRow + cols - 1,
  };
}

export function countParts(maze) {
  const counts = { wall: 0, arrow: 0, portal: 0 };
  for (const cell of maze.cells) {
    if (cell === 'wall') counts.wall += 1;
    else if (cell === 'portal') counts.portal += 1;
    else if (isArrow(cell)) counts.arrow += 1;
  }
  return counts;
}

export function partsLeft(maze, limits) {
  const used = countParts(maze);
  return { wall: limits.wall - used.wall, arrow: limits.arrow - used.arrow, portal: limits.portal - used.portal };
}

function portalCells(maze) {
  return maze.cells.flatMap((cell, index) => (cell === 'portal' ? [index] : []));
}

/** The other portal of a complete pair, or null: a lone portal is just floor. */
function portalTwin(maze, index) {
  const portals = portalCells(maze);
  return portals.length === 2 && portals.includes(index) ? portals.find((other) => other !== index) : null;
}

const blocked = (from, reason) => ({ to: from, blocked: reason, teleported: false });

/** One move from `from` in direction `dir`. Never mutates; `blocked` says why a move failed. */
export function step(maze, from, dir) {
  if (isArrow(maze.cells[from]) && maze.cells[from] !== dir) return blocked(from, 'arrow');

  const x = (from % maze.cols) + DIRS[dir][0];
  const y = Math.floor(from / maze.cols) + DIRS[dir][1];
  if (x < 0 || y < 0 || x >= maze.cols || y >= maze.rows) return blocked(from, 'edge');

  const to = y * maze.cols + x;
  const target = maze.cells[to];
  if (target === 'wall') return blocked(from, 'wall');
  if (isArrow(target) && target !== dir) return blocked(from, 'arrow');

  const twin = target === 'portal' ? portalTwin(maze, to) : null;
  if (twin !== null && twin !== from) return { to: twin, blocked: null, teleported: true };
  return { to, blocked: null, teleported: false };
}

/** Where one move can take you. Nothing follows the Exit: reaching it ends the run. */
function destinations(maze, from) {
  if (from === maze.exit) return [];
  const reached = ARROWS.map((dir) => step(maze, from, dir)).filter((move) => !move.blocked);
  return [...new Set(reached.map((move) => move.to))];
}

/** Breadth-first search from `from`: who reached each cell first, and every move found. */
function explore(maze, from) {
  const parent = new Map([[from, -1]]);
  const moves = new Map();
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    moves.set(cell, destinations(maze, cell));
    for (const to of moves.get(cell)) {
      if (parent.has(to)) continue;
      parent.set(to, cell);
      queue.push(to);
    }
  }
  return { parent, moves, reachable: queue };
}

function traceBack(parent, to) {
  const path = [];
  for (let cell = to; cell !== -1; cell = parent.get(cell)) path.push(cell);
  return path.reverse();
}

/** Shortest list of cells from `from` to the Exit (a teleport counts as one step), or null. */
export function findRoute(maze, from = maze.start) {
  const { parent } = explore(maze, from);
  return parent.has(maze.exit) ? traceBack(parent, maze.exit) : null;
}

/** Every cell that can reach the Exit, found by following the recorded moves backwards. */
function cellsThatReachExit(maze, moves) {
  const sources = new Map();
  for (const [cell, targets] of moves) {
    for (const to of targets) sources.set(to, [...(sources.get(to) ?? []), cell]);
  }
  const reaching = new Set([maze.exit]);
  const queue = [maze.exit];
  for (let head = 0; head < queue.length; head += 1) {
    for (const cell of sources.get(queue[head]) ?? []) {
      if (reaching.has(cell)) continue;
      reaching.add(cell);
      queue.push(cell);
    }
  }
  return reaching;
}

/**
 * A maze is fair when the Exit can be reached ('sealed' otherwise) and the runner can never
 * wander into a spot with no way on ('pocket', with the stuck cells listed in `trapped`).
 */
export function validate(maze) {
  const { parent, moves, reachable } = explore(maze, maze.start);
  if (!parent.has(maze.exit)) return { ok: false, reason: 'sealed', route: null, trapped: [] };

  const reaching = cellsThatReachExit(maze, moves);
  const trapped = reachable.filter((cell) => !reaching.has(cell));
  if (trapped.length > 0) return { ok: false, reason: 'pocket', route: null, trapped };
  return { ok: true, reason: null, route: traceBack(parent, maze.exit), trapped: [] };
}

/** At the hand-over a lone portal is removed, so the runner never meets a portal that does nothing. */
export function lockIn(maze) {
  if (portalCells(maze).length !== 1) return maze;
  return { ...maze, cells: maze.cells.map((cell) => (cell === 'portal' ? 'floor' : cell)) };
}

/* ---------- Editing: every accepted edit leaves a fair maze ---------- */

/** The wall brush only swaps wall and floor, so dragging it never destroys an arrow or portal. */
const BRUSH_REPLACES_ONLY = { wall: 'floor', floor: 'wall' };
const DEFAULT_ARROW = 'right';

function withCell(maze, at, cell) {
  const cells = [...maze.cells];
  cells[at] = cell;
  return { ...maze, cells };
}

function overLimit(maze, limits) {
  const used = countParts(maze);
  return Object.keys(used).find((part) => used[part] > limits[part]);
}

const refused = (reason, trapped = []) => ({ ok: false, reason, trapped });
const unchanged = (maze) => ({ ok: true, changed: false, maze });
const isEnd = (maze, at) => at === maze.start || at === maze.exit;

function accept(candidate, limits) {
  const exceeded = overLimit(candidate, limits);
  if (exceeded) return refused(`limit-${exceeded}`);
  const verdict = validate(candidate);
  if (!verdict.ok) return refused(verdict.reason, verdict.trapped);
  return { ok: true, changed: true, maze: candidate, route: verdict.route };
}

function paint(maze, { at, cell }, limits) {
  if (isEnd(maze, at)) return refused('occupied');
  const current = maze.cells[at];
  const replaces = BRUSH_REPLACES_ONLY[cell];
  if (current === cell || (replaces !== undefined && current !== replaces)) return unchanged(maze);
  return accept(withCell(maze, at, cell), limits);
}

function erase(maze, { at }, limits) {
  if (isEnd(maze, at) || maze.cells[at] === 'floor') return unchanged(maze);
  return accept(withCell(maze, at, 'floor'), limits);
}

/** Tries each direction in turn and keeps the first that leaves a fair maze. */
function firstFairArrow(maze, at, directions, limits) {
  let firstRefusal = null;
  for (const dir of directions) {
    const result = accept(withCell(maze, at, dir), limits);
    if (result.ok) return result;
    firstRefusal ??= result;
  }
  return firstRefusal;
}

/** Places an arrow on a free square, or turns the arrow already there to the next fair direction. */
function arrow(maze, { at }, limits) {
  if (isEnd(maze, at)) return refused('occupied');
  const current = ARROWS.indexOf(maze.cells[at]);
  const first = current === -1 ? ARROWS.indexOf(DEFAULT_ARROW) : current + 1;
  const tries = current === -1 ? ARROWS.length : ARROWS.length - 1;
  const directions = Array.from({ length: tries }, (_, offset) => ARROWS[(first + offset) % ARROWS.length]);
  return firstFairArrow(maze, at, directions, limits);
}

function moveEnd(key, otherKey) {
  return (maze, { at }, limits) => {
    if (at === maze[key]) return unchanged(maze);
    if (at === maze[otherKey] || maze.cells[at] !== 'floor') return refused('bad-move');
    const result = accept({ ...maze, [key]: at }, limits);
    return result.ok ? result : refused('bad-move');
  };
}

const EDITS = {
  paint,
  erase,
  arrow,
  moveStart: moveEnd('start', 'exit'),
  moveExit: moveEnd('exit', 'start'),
};

/**
 * Applies one edit to a copy of the maze and keeps it only if the result is fair and within the
 * part limits. action: { type: 'paint', at, cell } | { type: 'erase', at } | { type: 'arrow', at }
 * | { type: 'moveStart', at } | { type: 'moveExit', at }.
 * Returns { ok: true, changed, maze, route? } or { ok: false, reason, trapped }.
 * reasons: 'sealed' | 'pocket' | 'limit-wall' | 'limit-arrow' | 'limit-portal' | 'occupied' | 'bad-move'.
 */
export function edit(maze, action, limits) {
  return EDITS[action.type](maze, action, limits);
}
