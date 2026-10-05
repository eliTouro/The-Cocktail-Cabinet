import { breakerSkill, levelSettings } from './config.js';
import { chooseGuess } from './breaker.js';
import { randomCode } from './codemaker.js';
import { checkCode, createRound, submitGuess } from './rules.js';

/**
 * A run of levels. In 'human' mode the person breaks codes the computer made; in 'computer' mode
 * the person makes codes and the computer breaks them. Either way a level is cleared when the
 * person comes out ahead, and the run ends on the first level they do not clear.
 */
export function createRun({ modeId, rng }) {
  const personBreaks = modeId === 'human';
  let level = 1;
  let cleared = 0;
  let round = null;

  const isFinished = () => round !== null && round.status !== 'playing';
  const isLevelCleared = () => isFinished() && (personBreaks ? round.status === 'won' : round.status === 'lost');

  /** Scores a guess through the shared rules and keeps the new round if it was allowed. */
  function play(guess) {
    const result = submitGuess(round, guess);
    if (result.ok) round = result.round;
    return result;
  }

  return {
    get level() { return level; },
    get cleared() { return cleared; },
    get round() { return round; },
    get settings() { return levelSettings(level, { personBreaks }); },
    get finished() { return isFinished(); },
    get levelCleared() { return isLevelCleared(); },

    /** Human mode draws the computer's secret itself; computer mode needs the person's code. */
    startLevel(personCode) {
      const settings = levelSettings(level, { personBreaks });
      const secret = personBreaks ? randomCode(settings, rng) : personCode;
      const check = checkCode(secret, settings);
      if (check.ok) round = createRound(settings, secret);
      return check;
    },

    /** A guess typed by the person (human mode). */
    guess: play,

    /** The computer's next guess, chosen from the visible history alone (computer mode). */
    computerGuess() {
      const guess = chooseGuess({
        settings: round.settings,
        history: round.history,
        skill: breakerSkill(level),
        rng,
      });
      return { guess, ...play(guess) };
    },

    /** Call once a level is finished: counts it and moves on, or reports the run is over. */
    advance() {
      if (!isLevelCleared()) return { runOver: true };
      cleared += 1;
      level += 1;
      round = null;
      return { runOver: false };
    },
  };
}
