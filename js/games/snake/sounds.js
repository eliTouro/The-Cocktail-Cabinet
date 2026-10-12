import { EFFECTS, play } from '../../core/sound.js';

const after = (recipe, seconds) => recipe.map((voice) => ({ ...voice, delay: (voice.delay ?? 0) + seconds }));

const START = [
  { wave: 'square', from: 330, to: 330, seconds: 0.07, volume: 0.12 },
  { wave: 'square', from: 440, to: 440, seconds: 0.07, volume: 0.12, delay: 0.08 },
  { wave: 'square', from: 660, to: 660, seconds: 0.14, volume: 0.12, delay: 0.16 },
];

/** The computer's snake eating sounds lower and softer than the human's pickup, so the two are easy to tell apart. */
const SNAKE_EATS = [{ wave: 'triangle', from: 220, to: 330, seconds: 0.07, volume: 0.16 }];

const CRASH = [
  { wave: 'noise', from: 2400, to: 200, seconds: 0.35, volume: 0.3 },
  { wave: 'sawtooth', from: 200, to: 60, seconds: 0.3, volume: 0.14 },
];

const AFTER_CRASH_SECONDS = 0.3;
const CRASH_THEN_LOSE = [...CRASH, ...after(EFFECTS.lose, AFTER_CRASH_SECONDS)];
const CRASH_THEN_WIN = [...CRASH, ...after(EFFECTS.win, AFTER_CRASH_SECONDS)];

/** Which sound goes with each moment the session reports, by mode (see `onEvent` in session.js). */
const SOUND_FOR_EVENT = {
  human: {
    ate: 'pickup',
    'level-up': 'levelUp',
    'boxed-in': 'warn',
    dead: CRASH_THEN_LOSE,
    won: 'win',
  },
  computer: {
    ate: SNAKE_EATS,
    'level-up': 'levelUp',
    'near-escape': 'warn',
    dead: CRASH_THEN_WIN,
    escaped: 'lose',
  },
};

export const playEvent = (modeId, event) => {
  const effect = SOUND_FOR_EVENT[modeId][event];
  if (effect) play(effect);
};

export const playStart = () => play(START);
export const playApplePlaced = () => play('place');
export const playRefused = () => play('denied');
