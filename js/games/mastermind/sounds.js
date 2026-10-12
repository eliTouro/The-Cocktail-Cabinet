import { play } from '../../core/sound.js';

const PEG_GAP_SECONDS = 0.09;

const RED_PEG = { wave: 'square', from: 880, to: 880, seconds: 0.07, volume: 0.14 };
const WHITE_PEG = { wave: 'triangle', from: 440, to: 440, seconds: 0.07, volume: 0.2 };
const NO_PEGS = { wave: 'sawtooth', from: 160, to: 110, seconds: 0.18, volume: 0.12 };

const PICK = [{ wave: 'triangle', from: 560, to: 560, seconds: 0.05, volume: 0.16 }];
const LOCK = [
  { wave: 'square', from: 330, to: 330, seconds: 0.07, volume: 0.14 },
  { wave: 'square', from: 495, to: 495, seconds: 0.1, volume: 0.14, delay: 0.07 },
];
const THINK = [{ wave: 'sine', from: 260, to: 300, seconds: 0.12, volume: 0.1 }];

/** One blip per peg: high for each red, lower for each white, a low buzz if there are none. */
export function feedbackRecipe({ black, white }) {
  const pegs = [...Array(black).fill(RED_PEG), ...Array(white).fill(WHITE_PEG)];
  if (pegs.length === 0) return [NO_PEGS];
  return pegs.map((voice, index) => ({ ...voice, delay: index * PEG_GAP_SECONDS }));
}

export const sounds = {
  pickColour: () => play(PICK),
  editRow: () => play('click'),
  lockIn: () => play(LOCK),
  refused: () => play('denied'),
  think: () => play(THINK),
  feedback: (feedback) => play(feedbackRecipe(feedback)),
  levelCleared: () => play('win'),
  levelLost: () => play('lose'),
  nextLevel: () => play('levelUp'),
  start: () => play('click'),
};
