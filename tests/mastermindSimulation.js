import { createRng } from '../js/core/rng.js';
import { chooseGuess } from '../js/games/mastermind/breaker.js';
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
