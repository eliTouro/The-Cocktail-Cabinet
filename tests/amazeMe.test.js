import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DNF_BONUS_SECONDS, FLARE, GRID, PART_LIMITS, SIGHT_RADIUS, SOLVE_SECONDS } from '../js/games/amaze-me/config.js';
import { createBuilder } from '../js/games/amaze-me/builder.js';
import {
  countParts, createMaze, edit, findRoute, lockIn, partsLeft, step, validate,
} from '../js/games/amaze-me/maze.js';
import {
  cleanName, createMatch, holdBy, holdScore, isMatchOver, matchWinner, recordRound, rematch, roles,
} from '../js/games/amaze-me/match.js';
import { createRun, moveRunner, revealAround, tickRun, useFlare } from '../js/games/amaze-me/run.js';

const cellAt = (x, y) => y * GRID.cols + x;
const freshMaze = () => createMaze(GRID);

function mazeWith(parts) {
  const maze = freshMaze();
  for (const [x, y, cell] of parts) maze.cells[cellAt(x, y)] = cell;
  return maze;
}

function newRun(maze, overrides = {}) {
  return createRun(maze, { seconds: SOLVE_SECONDS, sight: SIGHT_RADIUS, flares: FLARE.count, ...overrides });
}

/* ---------- maze: shape and routes ---------- */

test('a new maze is open, fair, and 11 steps from Start to Exit', () => {
  const maze = freshMaze();
  assert.equal(maze.start, cellAt(0, 4));
  assert.equal(maze.exit, cellAt(11, 4));
  const verdict = validate(maze);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.route.length - 1, 11);
  assert.deepEqual(partsLeft(maze, PART_LIMITS), PART_LIMITS);
});

test('a complete wall across the maze is refused as sealed, a partial one is accepted', () => {
  let maze = freshMaze();
  for (let y = 0; y < GRID.rows - 1; y += 1) {
    const result = edit(maze, { type: 'paint', at: cellAt(1, y), cell: 'wall' }, PART_LIMITS);
    assert.equal(result.ok, true, `row ${y} should be accepted`);
    maze = result.maze;
  }
  const lastGap = edit(maze, { type: 'paint', at: cellAt(1, GRID.rows - 1), cell: 'wall' }, PART_LIMITS);
  assert.equal(lastGap.ok, false);
  assert.equal(lastGap.reason, 'sealed');
});

test('edits never change the maze they are given', () => {
  const maze = freshMaze();
  edit(maze, { type: 'paint', at: cellAt(3, 3), cell: 'wall' }, PART_LIMITS);
  assert.equal(maze.cells[cellAt(3, 3)], 'floor');
});

/* ---------- maze: limits and protected squares ---------- */

function mazeWithWalls(count) {
  const maze = freshMaze();
  let placed = 0;
  for (let x = 2; x < GRID.cols - 2 && placed < count; x += 1) {
    for (let y = 0; y < GRID.rows && placed < count; y += 1) {
      if (y === 4) continue;
      maze.cells[cellAt(x, y)] = 'wall';
      placed += 1;
    }
  }
  return maze;
}

test('the 39th wall is refused', () => {
  const maze = mazeWithWalls(PART_LIMITS.wall);
  assert.equal(countParts(maze).wall, PART_LIMITS.wall);
  const result = edit(maze, { type: 'paint', at: cellAt(1, 0), cell: 'wall' }, PART_LIMITS);
  assert.equal(result.reason, 'limit-wall');
});

test('the 5th arrow and the 3rd portal are refused', () => {
  let maze = freshMaze();
  for (const x of [1, 3, 5, 7]) {
    const placed = edit(maze, { type: 'arrow', at: cellAt(x, 1) }, PART_LIMITS);
    assert.equal(placed.ok, true);
    maze = placed.maze;
  }
  assert.equal(edit(maze, { type: 'arrow', at: cellAt(9, 1) }, PART_LIMITS).reason, 'limit-arrow');

  maze = freshMaze();
  for (const x of [2, 4]) maze = edit(maze, { type: 'paint', at: cellAt(x, 6), cell: 'portal' }, PART_LIMITS).maze;
  assert.equal(edit(maze, { type: 'paint', at: cellAt(6, 6), cell: 'portal' }, PART_LIMITS).reason, 'limit-portal');
});

test('Start and Exit cannot be covered, and can only move to open squares', () => {
  const maze = mazeWith([[5, 5, 'wall']]);
  assert.equal(edit(maze, { type: 'paint', at: maze.start, cell: 'wall' }, PART_LIMITS).reason, 'occupied');
  assert.equal(edit(maze, { type: 'arrow', at: maze.exit }, PART_LIMITS).reason, 'occupied');
  assert.equal(edit(maze, { type: 'moveStart', at: cellAt(5, 5) }, PART_LIMITS).reason, 'bad-move');
  assert.equal(edit(maze, { type: 'moveStart', at: maze.exit }, PART_LIMITS).reason, 'bad-move');

  const moved = edit(maze, { type: 'moveExit', at: cellAt(11, 0) }, PART_LIMITS);
  assert.equal(moved.ok, true);
  assert.equal(moved.maze.exit, cellAt(11, 0));
});

test('moving the Exit into a closed room is refused', () => {
  const maze = mazeWith([[10, 0, 'wall'], [11, 1, 'wall']]);
  assert.equal(edit(maze, { type: 'moveExit', at: cellAt(11, 0) }, PART_LIMITS).reason, 'bad-move');
});

test('the wall brush only swaps wall and floor, and erase clears any part', () => {
  const maze = mazeWith([[3, 2, 'right'], [4, 2, 'portal']]);
  assert.equal(edit(maze, { type: 'paint', at: cellAt(3, 2), cell: 'wall' }, PART_LIMITS).changed, false);
  assert.equal(edit(maze, { type: 'paint', at: cellAt(4, 2), cell: 'floor' }, PART_LIMITS).changed, false);
  const cleared = edit(maze, { type: 'erase', at: cellAt(3, 2) }, PART_LIMITS);
  assert.equal(cleared.maze.cells[cellAt(3, 2)], 'floor');
});

/* ---------- maze: arrows and pockets ---------- */

// A one-square nook off the main route: an arrow pointing into it would trap the runner there.
const nook = () => mazeWith([[4, 3, 'wall'], [6, 3, 'wall'], [5, 2, 'wall']]);

test('an arrow that would trap the runner is refused as a pocket, with the stuck cells listed', () => {
  const result = edit(nook(), { type: 'paint', at: cellAt(5, 3), cell: 'up' }, PART_LIMITS);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'pocket');
  assert.deepEqual(result.trapped, [cellAt(5, 3)]);
});

test('turning an arrow skips directions that would trap the runner', () => {
  const maze = nook();
  maze.cells[cellAt(5, 3)] = 'left';
  const turned = edit(maze, { type: 'arrow', at: cellAt(5, 3) }, PART_LIMITS);
  assert.equal(turned.ok, true);
  assert.equal(turned.maze.cells[cellAt(5, 3)], 'right', 'up would trap the runner, so it is skipped');
});

test('placing an arrow starts with right, and an arrow with no fair direction left is refused', () => {
  const maze = mazeWith([[0, 3, 'wall'], [0, 5, 'wall']]);
  const placed = edit(maze, { type: 'arrow', at: cellAt(1, 4) }, PART_LIMITS);
  assert.equal(placed.maze.cells[cellAt(1, 4)], 'right');
  const turned = edit(placed.maze, { type: 'arrow', at: cellAt(1, 4) }, PART_LIMITS);
  assert.equal(turned.ok, false, 'every other direction would seal the Start in');
  assert.equal(turned.reason, 'sealed');
});

/* ---------- maze: step ---------- */

test('step is blocked by edges, walls and wrong-way arrows, and allowed through right-way arrows', () => {
  const maze = mazeWith([[1, 4, 'wall'], [3, 4, 'right'], [5, 5, 'up']]);
  assert.equal(step(maze, cellAt(0, 4), 'left').blocked, 'edge');
  assert.equal(step(maze, cellAt(0, 4), 'right').blocked, 'wall');
  assert.equal(step(maze, cellAt(2, 4), 'right').blocked, null);
  assert.equal(step(maze, cellAt(4, 4), 'left').blocked, 'arrow');
  assert.equal(step(maze, cellAt(3, 3), 'down').blocked, 'arrow');
  assert.equal(step(maze, cellAt(3, 4), 'down').blocked, 'arrow', 'an arrow cell can only be left the way it points');
  assert.equal(step(maze, cellAt(3, 4), 'right').to, cellAt(4, 4));
});

/* ---------- maze: portals ---------- */

test('a pair of portals teleports, a lone portal is floor, and lockIn removes a lone portal', () => {
  const pair = mazeWith([[2, 1, 'portal'], [9, 7, 'portal']]);
  const jump = step(pair, cellAt(1, 1), 'right');
  assert.equal(jump.to, cellAt(9, 7));
  assert.equal(jump.teleported, true);

  const lone = mazeWith([[2, 1, 'portal']]);
  const walk = step(lone, cellAt(1, 1), 'right');
  assert.equal(walk.to, cellAt(2, 1));
  assert.equal(walk.teleported, false);
  assert.equal(lockIn(lone).cells[cellAt(2, 1)], 'floor');
  assert.equal(lockIn(pair), pair);
});

test('findRoute uses a portal when it is the shorter way', () => {
  const maze = mazeWith([[1, 4, 'portal'], [10, 4, 'portal']]);
  const route = findRoute(maze);
  assert.equal(route.length - 1, 2);
  assert.deepEqual(route, [cellAt(0, 4), cellAt(10, 4), cellAt(11, 4)]);
});

/* ---------- run ---------- */

test('a bump does not move the runner or mark the trail', () => {
  const run = newRun(mazeWith([[1, 4, 'wall']]));
  const result = moveRunner(run, 'right');
  assert.equal(result.moved, false);
  assert.equal(result.blocked, 'wall');
  assert.deepEqual(run.trail, [run.maze.start]);
});

test('the runner sees a 5 by 5 patch without its corners and remembers it', () => {
  const run = newRun(freshMaze());
  const seen = (x, y) => run.seen.has(cellAt(x, y));
  assert.equal(seen(2, 4), true);
  assert.equal(seen(2, 5), true);
  assert.equal(seen(2, 6), false);
  assert.equal(seen(3, 4), false);
  moveRunner(run, 'right');
  moveRunner(run, 'right');
  assert.equal(seen(4, 4), true);
  assert.equal(seen(2, 4), true, 'cells that were seen stay remembered');
});

test('a flare reveals a wide area, costs one flare, and stops when none are left', () => {
  const run = newRun(freshMaze());
  assert.equal(useFlare(run, FLARE.radius), true);
  assert.equal(run.seen.has(cellAt(4, 4)), true);
  assert.equal(run.seen.has(cellAt(5, 4)), false);
  assert.equal(useFlare(run, FLARE.radius), true);
  assert.equal(run.flaresLeft, 0);
  assert.equal(useFlare(run, FLARE.radius), false);
});

test('time running out loses the run, and reaching the Exit stops the clock', () => {
  const slow = newRun(freshMaze());
  tickRun(slow, SOLVE_SECONDS - 1);
  assert.equal(slow.outcome, null);
  tickRun(slow, 2);
  assert.equal(slow.outcome, 'lost');
  assert.equal(slow.timeLeft, 0);

  const quick = newRun(createMaze({ cols: 3, rows: 3 }));
  tickRun(quick, 0.5);
  assert.equal(moveRunner(quick, 'right').escaped, false);
  assert.equal(moveRunner(quick, 'right').escaped, true);
  assert.equal(quick.outcome, 'escaped');
  tickRun(quick, 5);
  assert.equal(quick.elapsed, 0.5);
  assert.equal(moveRunner(quick, 'left').moved, false);
});

test('a one-way arrow stops the runner going back, and a portal teleports with its new surroundings seen', () => {
  const arrowRun = newRun(mazeWith([[2, 4, 'right']]));
  moveRunner(arrowRun, 'right');
  moveRunner(arrowRun, 'right');
  assert.equal(moveRunner(arrowRun, 'left').blocked, 'arrow');

  const portalRun = newRun(mazeWith([[1, 4, 'portal'], [9, 2, 'portal']]));
  const jump = moveRunner(portalRun, 'right');
  assert.equal(jump.teleported, true);
  assert.equal(portalRun.pos, cellAt(9, 2));
  assert.equal(portalRun.seen.has(cellAt(10, 2)), true);
});

test('revealAround adds only cells inside the radius', () => {
  const run = newRun(freshMaze(), { sight: 0 });
  revealAround(run, cellAt(6, 4), 1);
  assert.equal(run.seen.size, 1 + 5);
});

/* ---------- match ---------- */

const result = (escaped, seconds) => ({ escaped, seconds });

test('players swap who builds, and a lost run scores a full run plus the bonus', () => {
  let match = createMatch(['Ada', 'Bo']);
  assert.deepEqual(roles(match), { builder: 0, runner: 1 });
  match = recordRound(match, result(false, SOLVE_SECONDS));
  assert.deepEqual(roles(match), { builder: 1, runner: 0 });
  assert.equal(holdBy(match, 0), SOLVE_SECONDS + DNF_BONUS_SECONDS);
  assert.equal(holdScore(result(true, 41.3)), 41.3);
});

test('the longer-held runner loses: the higher hold score wins the match', () => {
  let match = createMatch(['Ada', 'Bo']);
  match = recordRound(match, result(true, 30));
  assert.equal(isMatchOver(match), false);
  match = recordRound(match, result(true, 55));
  assert.equal(isMatchOver(match), true);
  assert.equal(matchWinner(match), 1);
  assert.deepEqual(match.wins, [0, 1]);
});

test('hold times within a tenth of a second are a dead heat, and a rematch flips the order and keeps the tally', () => {
  let match = createMatch(['Ada', 'Bo']);
  match = recordRound(match, result(true, 40.01));
  match = recordRound(match, result(true, 40.04));
  assert.equal(matchWinner(match), 'draw');
  assert.deepEqual(match.wins, [0, 0]);

  const won = recordRound(recordRound(createMatch(['Ada', 'Bo']), result(false, 90)), result(true, 12));
  assert.deepEqual(won.wins, [1, 0]);
  const again = rematch(won);
  assert.equal(again.firstBuilder, 1);
  assert.equal(again.round, 0);
  assert.deepEqual(again.wins, [1, 0]);
  assert.deepEqual(again.names, ['Ada', 'Bo']);
});

test('blank names fall back to the default', () => {
  assert.equal(cleanName('   ', 'Player 1'), 'Player 1');
  assert.equal(cleanName(' Ada ', 'Player 1'), 'Ada');
});

/* ---------- builder: what presses and drags do ---------- */

const newBuilder = (maze = freshMaze()) => createBuilder({ maze, limits: PART_LIMITS });

test('a wall drag paints floor, and a drag that starts on a wall erases walls instead', () => {
  const builder = newBuilder();
  builder.press(cellAt(3, 1));
  for (let y = 2; y <= 3; y += 1) builder.drag(cellAt(3, y));
  builder.release();
  assert.equal(countParts(builder.maze()).wall, 3);

  builder.press(cellAt(3, 2));
  builder.drag(cellAt(3, 3));
  builder.drag(cellAt(3, 4));
  builder.release();
  assert.equal(countParts(builder.maze()).wall, 1, 'the drag erased the walls it crossed');
  assert.equal(builder.maze().cells[cellAt(3, 4)], 'floor');
});

test('dragging a wall across an arrow or a portal leaves them alone', () => {
  const builder = newBuilder(mazeWith([[3, 2, 'right'], [3, 3, 'portal']]));
  builder.press(cellAt(3, 1));
  builder.drag(cellAt(3, 2));
  builder.drag(cellAt(3, 3));
  builder.release();
  assert.equal(builder.maze().cells[cellAt(3, 2)], 'right');
  assert.equal(builder.maze().cells[cellAt(3, 3)], 'portal');
});

test('one drag over refused squares gives one warning, not one per square', () => {
  const builder = newBuilder(mazeWithWalls(PART_LIMITS.wall));
  const first = builder.press(cellAt(1, 0));
  const second = builder.drag(cellAt(1, 1));
  builder.release();
  assert.equal(first.refusal.reason, 'limit-wall');
  assert.equal(second.refusal, null);
  assert.equal(builder.press(cellAt(1, 2)).refusal.reason, 'limit-wall', 'a new drag warns again');
});

test('Start and Exit are moved by dragging them, and dropping off the board cancels the move', () => {
  const builder = newBuilder();
  builder.press(builder.maze().start);
  builder.drag(cellAt(0, 6));
  assert.deepEqual(builder.movingEnd(), { key: 'start', at: cellAt(0, 6) });
  assert.equal(builder.release().changed, true);
  assert.equal(builder.maze().start, cellAt(0, 6));

  builder.press(builder.maze().exit);
  builder.drag(cellAt(11, 1));
  builder.leave();
  assert.equal(builder.release().changed, false);
  assert.equal(builder.maze().exit, cellAt(11, 4));
});

test('the arrow tool places and then turns an arrow, and the portal tool places one pair', () => {
  const builder = newBuilder();
  builder.select('arrow');
  builder.tap(cellAt(4, 2));
  assert.equal(builder.maze().cells[cellAt(4, 2)], 'right');
  builder.tap(cellAt(4, 2));
  assert.equal(builder.maze().cells[cellAt(4, 2)], 'down');
  assert.equal(builder.left().arrow, PART_LIMITS.arrow - 1);

  builder.select('portal');
  builder.tap(cellAt(2, 6));
  builder.tap(cellAt(8, 6));
  assert.equal(builder.tap(cellAt(5, 6)).refusal.reason, 'limit-portal');
});
