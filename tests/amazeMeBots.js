import { GRID, PART_LIMITS, SIGHT_RADIUS } from '../js/games/amaze-me/config.js';
import { ARROWS, DIRS, createMaze, edit, step } from '../js/games/amaze-me/maze.js';
import { createRun, moveRunner } from '../js/games/amaze-me/run.js';

/* ---------- An independent referee: the movement rules written out again, from the spec ---------- */

/** Every cell one move from `from`. Deliberately does not call step(), so it can check it. */
function refereeMoves(maze, from) {
  if (from === maze.exit) return [];
  const portals = maze.cells.flatMap((cell, index) => (cell === 'portal' ? [index] : []));
  const reached = [];
  for (const [name, [dx, dy]] of Object.entries(DIRS)) {
    const here = maze.cells[from];
    if (here in DIRS && here !== name) continue;
    const x = (from % maze.cols) + dx;
    const y = Math.floor(from / maze.cols) + dy;
    if (x < 0 || y < 0 || x >= maze.cols || y >= maze.rows) continue;
    const to = y * maze.cols + x;
    const target = maze.cells[to];
    if (target === 'wall' || (target in DIRS && target !== name)) continue;
    const twin = target === 'portal' && portals.length === 2 ? portals.find((cell) => cell !== to) : null;
    reached.push(twin !== null && twin !== from ? twin : to);
  }
  return reached;
}

export function refereeReach(maze, from) {
  const seen = new Set([from]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    for (const to of refereeMoves(maze, queue[head])) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

/**
 * True when the Exit is reachable and every cell the runner can reach can still reach the Exit.
 * Asks the question the slow, obvious way: a separate search from every reachable cell.
 */
export function refereeSaysFair(maze) {
  const reachable = refereeReach(maze, maze.start);
  if (!reachable.has(maze.exit)) return false;
  return [...reachable].every((cell) => refereeReach(maze, cell).has(maze.exit));
}

/** The same verdict, quicker: one search from the Start, then one backwards from the Exit. */
export function refereeSaysFairQuickly(maze) {
  const reachable = refereeReach(maze, maze.start);
  if (!reachable.has(maze.exit)) return false;
  const arrivals = new Map();
  for (const from of reachable) {
    for (const to of refereeMoves(maze, from)) arrivals.set(to, [...(arrivals.get(to) ?? []), from]);
  }
  const canFinish = new Set([maze.exit]);
  const queue = [maze.exit];
  for (let head = 0; head < queue.length; head += 1) {
    for (const from of arrivals.get(queue[head]) ?? []) {
      if (!canFinish.has(from)) {
        canFinish.add(from);
        queue.push(from);
      }
    }
  }
  return [...reachable].every((cell) => canFinish.has(cell));
}

export function refereeAgreesWithStep(maze) {
  for (let cell = 0; cell < maze.cells.length; cell += 1) {
    if (cell === maze.exit) continue;
    const fromStep = ARROWS.map((dir) => step(maze, cell, dir)).filter((move) => !move.blocked).map((move) => move.to);
    if (new Set(fromStep).size !== new Set(refereeMoves(maze, cell)).size) return false;
  }
  return true;
}

/* ---------- Builder bots ---------- */

const DEVIOUS_MOVE_LIMIT = 1200;

const EDIT_KINDS = [
  (at) => ({ type: 'paint', at, cell: 'wall' }),
  (at) => ({ type: 'paint', at, cell: 'wall' }),
  (at) => ({ type: 'paint', at, cell: 'wall' }),
  (at) => ({ type: 'paint', at, cell: 'floor' }),
  (at) => ({ type: 'paint', at, cell: 'portal' }),
  (at) => ({ type: 'arrow', at }),
  (at) => ({ type: 'erase', at }),
  (at) => ({ type: 'moveStart', at }),
  (at) => ({ type: 'moveExit', at }),
];

export function randomEdit(rng) {
  return rng.pick(EDIT_KINDS)(rng.int(0, GRID.cols * GRID.rows));
}

/** Makes random edits; `onAccepted(maze)` runs after every edit the rules accepted. */
export function buildRandomMaze(rng, attempts, onAccepted = () => {}) {
  let maze = createMaze(GRID);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = edit(maze, randomEdit(rng), PART_LIMITS);
    if (!result.ok || !result.changed) continue;
    maze = result.maze;
    onAccepted(maze);
  }
  return maze;
}

/**
 * Keeps any random edit that does not make the fog solver's job easier, so mazes get steadily
 * nastier. This is the strongest builder the tests have: it shows how hard a good builder can be.
 */
export function buildDeviousMaze(rng, attempts) {
  const solve = (candidate) => solveInFog(candidate, { limit: DEVIOUS_MOVE_LIMIT }).moves;
  let maze = createMaze(GRID);
  let toughness = solve(maze);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = edit(maze, randomEdit(rng), PART_LIMITS);
    if (!result.ok || !result.changed) continue;
    const moves = solve(result.maze);
    if (moves < toughness) continue;
    maze = result.maze;
    toughness = moves;
  }
  return maze;
}

/* ---------- Solver bot: knows only what a runner has seen ---------- */

/** Unseen squares are guessed to be open floor, so the bot heads for the Exit and finds out on the way. */
function beliefOf(run) {
  const cells = run.maze.cells.map((cell, index) => (run.seen.has(index) ? cell : 'floor'));
  return { ...run.maze, cells };
}

function pathToNearest(belief, from, isGoal) {
  const parent = new Map([[from, -1]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (cell !== from && isGoal(cell)) {
      const path = [];
      for (let at = cell; at !== -1; at = parent.get(at)) path.push(at);
      return path.reverse();
    }
    if (cell === belief.exit) continue;
    for (const dir of ARROWS) {
      const move = step(belief, cell, dir);
      if (move.blocked || parent.has(move.to)) continue;
      parent.set(move.to, cell);
      queue.push(move.to);
    }
  }
  return null;
}

function nextDirection(run) {
  const belief = beliefOf(run);
  const path = pathToNearest(belief, run.pos, (cell) => cell === belief.exit)
    ?? pathToNearest(belief, run.pos, (cell) => !run.seen.has(cell))
    ?? pathToNearest(belief, run.pos, (cell) => run.maze.cells[cell] === 'portal');
  if (!path) return null;
  return ARROWS.find((dir) => step(belief, run.pos, dir).to === path[1]) ?? null;
}

export const moveLimit = (maze) => maze.cols * maze.rows * 4;

/** The bot runs the maze through the real run rules; returns { escaped, moves }. */
export function solveInFog(maze, { limit = moveLimit(maze) } = {}) {
  const run = createRun(maze, { seconds: Number.MAX_SAFE_INTEGER, sight: SIGHT_RADIUS, flares: 0 });
  let moves = 0;
  while (!run.outcome && moves < limit) {
    const dir = nextDirection(run);
    if (!dir) break;
    moves += 1;
    moveRunner(run, dir);
  }
  return { escaped: run.outcome === 'escaped', moves };
}
