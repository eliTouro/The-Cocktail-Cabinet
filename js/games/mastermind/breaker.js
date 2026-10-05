import { LOOKAHEAD_POOL_SIZE } from './config.js';
import { allCodes, scoreGuess } from './rules.js';
import { randomCode } from './codemaker.js';

const MAX_FRESH_ATTEMPTS = 20;

const sameFeedback = (a, b) => a.black === b.black && a.white === b.white;

const isConsistent = (code, history) =>
  history.every(({ guess, feedback }) => sameFeedback(scoreGuess(code, guess), feedback));

function sample(items, count, rng) {
  if (items.length <= count) return items;
  const pool = [...items];
  const picked = [];
  while (picked.length < count) picked.push(pool.splice(rng.int(0, pool.length), 1)[0]);
  return picked;
}

/** Largest group of possible codes that one reply to `guess` could leave behind. */
function worstCaseRemaining(guess, possible) {
  const groups = new Map();
  let largest = 0;
  for (const code of possible) {
    const { black, white } = scoreGuess(code, guess);
    const key = black * 10 + white;
    const size = (groups.get(key) ?? 0) + 1;
    groups.set(key, size);
    largest = Math.max(largest, size);
  }
  return largest;
}

function bestByWorstCase(candidates, lookahead, rng) {
  const possible = sample(candidates, LOOKAHEAD_POOL_SIZE, rng);
  let best = null;
  let bestScore = Infinity;
  for (const guess of sample(candidates, lookahead, rng)) {
    const score = worstCaseRemaining(guess, possible);
    if (score < bestScore) {
      best = guess;
      bestScore = score;
    }
  }
  return best;
}

const wasTried = (code, history) => history.some(({ guess }) => guess.every((colour, place) => colour === code[place]));

/** Even a careless breaker does not repeat a guess it has already seen answered. */
function randomUntried(settings, history, rng) {
  let code = randomCode(settings, rng);
  for (let attempt = 0; attempt < MAX_FRESH_ATTEMPTS && wasTried(code, history); attempt += 1) {
    code = randomCode(settings, rng);
  }
  return code;
}

function recentHistory(history, memory) {
  const keep = Math.max(1, Math.ceil(history.length * memory));
  return history.slice(history.length - keep);
}

/**
 * The computer's next guess. It is a function of what a human could see: the settings, the past
 * guesses with their pegs, and its own skill and randomness. It never receives the secret.
 */
export function chooseGuess({ settings, history, skill, rng }) {
  if (history.length === 0 || rng.next() < skill.ignoreRate) return randomUntried(settings, history, rng);
  const visible = recentHistory(history, skill.memory);
  const candidates = allCodes(settings).filter((code) => isConsistent(code, visible) && !wasTried(code, history));
  if (skill.lookahead > 1) return bestByWorstCase(candidates, skill.lookahead, rng);
  return rng.pick(candidates);
}
