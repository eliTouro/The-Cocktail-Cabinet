import { EFFECTS, play } from '../../core/sound.js';
import { EVENT } from './rules.js';
import { LEVEL_UP } from './session.js';

const after = (recipe, seconds) => recipe.map((voice) => ({ ...voice, delay: (voice.delay ?? 0) + seconds }));

// Recipes are created once because sound.js limits how often the same recipe can repeat.
const START = [
  { wave: 'square', from: 330, to: 330, seconds: 0.07, volume: 0.12 },
  { wave: 'square', from: 440, to: 440, seconds: 0.07, volume: 0.12, delay: 0.08 },
  { wave: 'square', from: 660, to: 660, seconds: 0.14, volume: 0.12, delay: 0.16 },
];
const FLAP = [{ wave: 'sine', from: 300, to: 620, seconds: 0.07, volume: 0.14 }];
const COLUMN_PASSED = [{ wave: 'square', from: 880, to: 880, seconds: 0.05, volume: 0.09 }];
/** When the computer's creature clears a column the person laid, it sounds lower and duller. */
const COLUMN_CLEARED_BY_CREATURE = [{ wave: 'triangle', from: 260, to: 200, seconds: 0.09, volume: 0.16 }];
const SPLAT = [
  { wave: 'noise', from: 2600, to: 150, seconds: 0.4, volume: 0.3 },
  { wave: 'sine', from: 170, to: 50, seconds: 0.3, volume: 0.25 },
];

const AFTER_SPLAT_SECONDS = 0.3;
const SPLAT_THEN_LOSE = [...SPLAT, ...after(EFFECTS.lose, AFTER_SPLAT_SECONDS)];
const SPLAT_THEN_WIN = [...SPLAT, ...after(EFFECTS.win, AFTER_SPLAT_SECONDS)];

/** Which sound goes with each rules event, by mode. The person's own wins and losses use the win and lose jingles. */
const SOUND_FOR_EVENT = {
  human: {
    [EVENT.flap]: FLAP,
    [EVENT.passed]: COLUMN_PASSED,
    [EVENT.splat]: SPLAT_THEN_LOSE,
    [EVENT.survived]: 'win',
    [LEVEL_UP]: 'levelUp',
  },
  computer: {
    [EVENT.placed]: 'place',
    [EVENT.refused]: 'denied',
    [EVENT.passed]: COLUMN_CLEARED_BY_CREATURE,
    [EVENT.splat]: SPLAT_THEN_WIN,
    [EVENT.survived]: 'lose',
    [LEVEL_UP]: 'levelUp',
  },
};

export const playEvent = (modeId, event) => {
  const effect = SOUND_FOR_EVENT[modeId][event.type];
  if (effect) play(effect);
};

export const playStart = () => play(START);
