import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { GRID, MOVE_REPEAT_SECONDS, PART_LIMITS, SOLVE_SECONDS } from '../js/games/amaze-me/config.js';
import { countParts, createMaze, lockIn, validate } from '../js/games/amaze-me/maze.js';
import { createMatch, holdBy, matchWinner, recordRound } from '../js/games/amaze-me/match.js';
import {
  buildDeviousMaze, buildRandomMaze, moveLimit, refereeAgreesWithStep, refereeSaysFair, refereeSaysFairQuickly,
  solveInFog,
} from './amazeMeBots.js';

const RANDOM_BUILDS = 80;
const EDITS_PER_BUILD = 400;
const DEVIOUS_BUILDS = 6;
const DEVIOUS_EDITS = 1500;
const DEVIOUS_SOLVE_LIMIT = 5000;
/** A careful human stops to think, so each step takes longer than a held key's repeat. */
const CAREFUL_SECONDS_PER_MOVE = 0.35;

const median = (numbers) => [...numbers].sort((a, b) => a - b)[Math.floor(numbers.length / 2)];

test('every edit the builder bot gets accepted leaves a maze an independent referee calls fair', () => {
  let acceptedEdits = 0;
  for (let seed = 1; seed <= RANDOM_BUILDS; seed += 1) {
    const finished = buildRandomMaze(createRng(seed), EDITS_PER_BUILD, (maze) => {
      acceptedEdits += 1;
      assert.equal(refereeSaysFairQuickly(maze), true, `seed ${seed}: unfair maze accepted`);
      assert.equal(validate(maze).ok, true);
      const used = countParts(maze);
      for (const part of Object.keys(PART_LIMITS)) assert.ok(used[part] <= PART_LIMITS[part]);
    });
    assert.equal(refereeSaysFair(finished), true, `seed ${seed}: the finished maze is not fair`);
  }
  assert.ok(acceptedEdits > RANDOM_BUILDS * 20, 'the bot should get plenty of edits accepted');
});

test('the quick referee agrees with the exhaustive one, and step agrees with both about where squares lead', () => {
  for (let seed = 1; seed <= 40; seed += 1) {
    const maze = buildRandomMaze(createRng(seed), EDITS_PER_BUILD);
    assert.equal(refereeSaysFairQuickly(maze), refereeSaysFair(maze));
    assert.equal(refereeAgreesWithStep(maze), true, `seed ${seed}`);
  }
});

test('a fog-limited solver escapes every maze the builder bot makes', (t) => {
  const movesNeeded = [];
  for (let seed = 1; seed <= RANDOM_BUILDS; seed += 1) {
    const maze = lockIn(buildRandomMaze(createRng(seed), EDITS_PER_BUILD));
    const outcome = solveInFog(maze);
    assert.equal(outcome.escaped, true, `seed ${seed}: solver stuck after ${outcome.moves} moves`);
    assert.ok(outcome.moves <= moveLimit(maze));
    movesNeeded.push(outcome.moves);
  }
  t.diagnostic(`random builder bot: median ${median(movesNeeded)} moves, worst ${Math.max(...movesNeeded)}`);
});

test('devious mazes are far harder than an empty one, yet still escapable inside the run time', (t) => {
  const emptyMazeMoves = solveInFog(createMaze(GRID)).moves;
  const movesNeeded = [];
  for (let seed = 1; seed <= DEVIOUS_BUILDS; seed += 1) {
    const maze = lockIn(buildDeviousMaze(createRng(seed), DEVIOUS_EDITS));
    assert.equal(refereeSaysFair(maze), true);
    const outcome = solveInFog(maze, { limit: DEVIOUS_SOLVE_LIMIT });
    assert.equal(outcome.escaped, true, `seed ${seed}: devious maze was not escapable`);
    movesNeeded.push(outcome.moves);
  }
  const quickPaceMoves = SOLVE_SECONDS / MOVE_REPEAT_SECONDS;
  const carefulPaceMoves = SOLVE_SECONDS / CAREFUL_SECONDS_PER_MOVE;
  const within = (limit) => `${movesNeeded.filter((moves) => moves <= limit).length}/${DEVIOUS_BUILDS}`;
  t.diagnostic(`empty maze: ${emptyMazeMoves} moves; devious mazes: ${[...movesNeeded].sort((a, b) => a - b).join(', ')}`);
  t.diagnostic(`escape within ${SOLVE_SECONDS} s: ${within(quickPaceMoves)} at ${MOVE_REPEAT_SECONDS} s/move, ${within(carefulPaceMoves)} at ${CAREFUL_SECONDS_PER_MOVE} s/move`);
  assert.ok(Math.max(...movesNeeded) >= emptyMazeMoves * 5, 'building must be able to make the run much harder');
  assert.ok(Math.min(...movesNeeded) <= quickPaceMoves, 'a determined runner must be able to get out in time');
});

test('bot results feed a sane match: hold scores in range, winner agrees with the scores', () => {
  const clockSeconds = (moves) => Math.min(moves * CAREFUL_SECONDS_PER_MOVE, SOLVE_SECONDS);
  for (let seed = 1; seed <= 30; seed += 1) {
    let match = createMatch(['A', 'B']);
    for (let round = 0; round < 2; round += 1) {
      const maze = lockIn(buildRandomMaze(createRng(seed * 2 + round), EDITS_PER_BUILD));
      const { escaped, moves } = solveInFog(maze);
      const seconds = clockSeconds(moves);
      match = recordRound(match, { escaped: escaped && seconds < SOLVE_SECONDS, seconds });
    }
    const [builderA, builderB] = [holdBy(match, 0), holdBy(match, 1)];
    for (const hold of [builderA, builderB]) assert.ok(hold > 0 && hold <= 120);
    const winner = matchWinner(match);
    if (winner === 'draw') assert.equal(Math.round(builderA * 10), Math.round(builderB * 10));
    else assert.equal(winner, builderA > builderB ? 0 : 1);
    assert.equal(match.round, 2);
  }
});
