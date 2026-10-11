import { createRng } from '../js/core/rng.js';
import { chooseGuess } from '../js/games/mastermind/breaker.js';
import { breakerSkill, levelSettings } from '../js/games/mastermind/config.js';
import { randomCode } from '../js/games/mastermind/codemaker.js';
import { createRound, submitGuess } from '../js/games/mastermind/rules.js';

/** The computer breaks one random secret through the real rules; returns the finished round. */
export function breakOneCode({ settings, skill, seed }) {
  const rng = createRng(seed);
  let round = createRound(settings, randomCode(settings, rng));
  while (round.status === 'playing') {
    const guess = chooseGuess({ settings, history: round.history, skill, rng });
    round = submitGuess(round, guess).round;
  }
  return round;
}

/** Share of `games` seeded secrets the computer fails to crack within the guess limit. */
export function failureRate({ settings, skill, games, firstSeed = 1 }) {
  let failures = 0;
  for (let seed = firstSeed; seed < firstSeed + games; seed += 1) {
    if (breakOneCode({ settings, skill, seed }).status === 'lost') failures += 1;
  }
  return failures / games;
}

/**
 * A casual person breaking the computer's code: about half the time they ignore the pegs and just
 * try something, and they only keep the last few guesses in mind. It uses the same chooseGuess
 * and the same rules as the computer, so it sees nothing a person could not.
 */
export const CASUAL_PERSON_SKILL = { ignoreRate: 0.5, memory: 0.4, lookahead: 0 };

/** Share of seeded random codes the casual person cracks within the level's guess limit. */
export function personBreakRate({ level, games, firstSeed = 1 }) {
  const settings = levelSettings(level, { personBreaks: true });
  let wins = 0;
  for (let seed = firstSeed; seed < firstSeed + games; seed += 1) {
    if (breakOneCode({ settings, skill: CASUAL_PERSON_SKILL, seed }).status === 'won') wins += 1;
  }
  return wins / games;
}

/** Share of seeded random codes a person who makes them stumps the level's computer breaker. */
export function personStumpRate({ level, games, firstSeed = 1 }) {
  const settings = levelSettings(level, { personBreaks: false });
  return failureRate({ settings, skill: breakerSkill(level), games, firstSeed });
}
