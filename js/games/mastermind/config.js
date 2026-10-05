import { ramp } from '../../core/difficulty.js';

export const CODE_COLOURS = [
  { id: 'ruby', name: 'Red', letter: 'R', hex: '#ff5470' },
  { id: 'sun', name: 'Yellow', letter: 'Y', hex: '#ffd23f' },
  { id: 'leaf', name: 'Green', letter: 'G', hex: '#43d675' },
  { id: 'sky', name: 'Blue', letter: 'B', hex: '#4f8cff' },
  { id: 'plum', name: 'Purple', letter: 'P', hex: '#b66dff' },
  { id: 'tangerine', name: 'Orange', letter: 'O', hex: '#ff8a3d' },
  { id: 'ice', name: 'White', letter: 'W', hex: '#e8f1ff' },
];

/** The level at which every ramp below has reached its final value. */
export const FINAL_LEVEL = 10;

/**
 * Board curve by level (1-based), linear then rounded:
 *   pegs     4 -> 5   (the fifth peg appears around level 6)
 *   colours  4 -> 7   (a new colour about every three levels)
 *   guesses  12 -> 8  (about one fewer guess every 2-3 levels)
 * Repeated colours are allowed from REPEATS_FROM_LEVEL, which is the biggest single jump in
 * difficulty, so it arrives only after two levels of warm-up.
 */
const BOARD_RAMP = {
  pegs: { from: 4, to: 5 },
  colours: { from: 4, to: 7 },
  guesses: { from: 12, to: 8 },
};
const REPEATS_FROM_LEVEL = 3;

/**
 * Computer codebreaker skill by level. Early on it often ignores the pegs (a random guess) and
 * only remembers the latest part of the history; later it always uses all of it and picks, among
 * the codes still possible, the one whose worst-case reply leaves the fewest possibilities.
 * ignoreRate never reaches zero, so even the strongest solver can be stumped now and then.
 *   ignoreRate  chance a turn throws the feedback away and guesses blindly
 *   memory      share of the most recent guesses it still reads (at least one)
 *   lookahead   how many possible codes it compares by worst-case reply (0 = take any)
 */
const SKILL_RAMP = {
  ignoreRate: { from: 0.65, to: 0.25 },
  memory: { from: 0.3, to: 1 },
  lookahead: { from: 0, to: 6 },
};

/** Lookahead scores each candidate against at most this many possible codes, to stay fast. */
export const LOOKAHEAD_POOL_SIZE = 150;

const rampByLevel = (range, level) => ramp(range.from, range.to, FINAL_LEVEL - 1, level - 1);

/**
 * When the person MAKES the code, their job is to stump the computer, so the guess limit works the
 * other way round: a fixed 6 keeps the computer's failure rate against random codes falling from
 * about 50-70% at the early levels to about 20% at level 10 as its skill ramps (measured with the
 * seeded simulations in tests/mastermindSimulation.js). A person choosing codes on purpose does better.
 */
const MAKER_GUESSES = 6;

/** `personBreaks` is true when the person cracks the codes, false when they make them. */
export function levelSettings(level, { personBreaks = true } = {}) {
  const { pegs, colours, guesses } = BOARD_RAMP;
  return {
    pegs: Math.round(rampByLevel(pegs, level)),
    colours: Math.round(rampByLevel(colours, level)),
    guesses: personBreaks ? Math.round(rampByLevel(guesses, level)) : MAKER_GUESSES,
    repeats: level >= REPEATS_FROM_LEVEL,
  };
}

export function breakerSkill(level) {
  const { ignoreRate, memory, lookahead } = SKILL_RAMP;
  return {
    ignoreRate: rampByLevel(ignoreRate, level),
    memory: rampByLevel(memory, level),
    lookahead: Math.round(rampByLevel(lookahead, level)),
  };
}

/**
 * Pauses in milliseconds: before the computer shows a guess, between its guess and its pegs, and
 * after a level ends so the last row can be seen before the result panel covers the board.
 */
export const PAUSE_MS = { think: 900, reveal: 500, levelEnd: 1000 };
