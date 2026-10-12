import { DNF_BONUS_SECONDS, SOLVE_SECONDS, TIE_RESOLUTION_SECONDS } from './config.js';

/**
 * A match is two rounds: each player builds one maze and runs the other's.
 * match = { names, firstBuilder, round, results, wins }, where `wins` counts matches won so far.
 * Every function returns a new match; none changes the one it is given.
 */

const ROUNDS_PER_MATCH = 2;

export function cleanName(typed, fallback) {
  return typed.trim() || fallback;
}

export function createMatch(names, firstBuilder = 0, wins = [0, 0]) {
  return { names, firstBuilder, round: 0, results: [], wins };
}

export function roles(match) {
  const builder = (match.firstBuilder + match.round) % 2;
  return { builder, runner: 1 - builder };
}

/** How long a maze held its runner: the escape time, or a full run plus the bonus if nobody got out. */
export function holdScore({ escaped, seconds }) {
  return escaped ? seconds : SOLVE_SECONDS + DNF_BONUS_SECONDS;
}

const tenths = (seconds) => Math.round(seconds / TIE_RESOLUTION_SECONDS);

export function isMatchOver(match) {
  return match.round >= ROUNDS_PER_MATCH;
}

/** The builder index (0 or 1) whose maze held longer, or 'draw'. Only meaningful once the match is over. */
export function matchWinner(match) {
  const [first, second] = match.results.map((result) => ({ builder: result.builder, hold: tenths(result.hold) }));
  if (first.hold === second.hold) return 'draw';
  return first.hold > second.hold ? first.builder : second.builder;
}

/** result: { escaped, seconds }. Stores it under the current builder and moves on to the next round. */
export function recordRound(match, result) {
  const { builder, runner } = roles(match);
  const finished = {
    ...match,
    round: match.round + 1,
    results: [...match.results, { builder, runner, escaped: result.escaped, seconds: result.seconds, hold: holdScore(result) }],
  };
  if (!isMatchOver(finished)) return finished;
  const winner = matchWinner(finished);
  const wins = finished.wins.map((count, player) => (player === winner ? count + 1 : count));
  return { ...finished, wins };
}

/** Same players and tally, swapped order. */
export function rematch(match) {
  return createMatch(match.names, 1 - match.firstBuilder, match.wins);
}

/** The hold score of the maze `builder` made, once that round is done. */
export function holdBy(match, builder) {
  return match.results.find((result) => result.builder === builder)?.hold;
}
