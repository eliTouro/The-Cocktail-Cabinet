import { play } from '../../core/sound.js';
import { ROW_POINTS } from './config.js';

const TOP_ROW_PITCH = 1175;
const PITCH_DROP_PER_ROW = 135;

// Recipes are created once because sound.js limits how often the same recipe can repeat.
const LAUNCH = [{ wave: 'sawtooth', from: 300, to: 760, seconds: 0.14, volume: 0.12 }];
const PADDLE_HIT = [{ wave: 'triangle', from: 330, to: 250, seconds: 0.07, volume: 0.24 }];
const BORDER_HIT = [{ wave: 'sine', from: 200, to: 160, seconds: 0.04, volume: 0.14 }];
// The ball is lost: a sad drop for the paddle player.
const BALL_LOST = [
  { wave: 'sawtooth', from: 330, to: 110, seconds: 0.4, volume: 0.2 },
  { wave: 'noise', from: 900, to: 100, seconds: 0.3, volume: 0.14 },
];
// The wall player scores when the computer drops the ball: a bright rising pair.
const BALL_DROPPED_BY_COMPUTER = [
  { wave: 'square', from: 520, to: 520, seconds: 0.08, volume: 0.14 },
  { wave: 'square', from: 780, to: 1040, seconds: 0.16, volume: 0.14, delay: 0.08 },
];
const BRICK_BREAKS = ROW_POINTS.map((_, row) => [
  { wave: 'square', from: TOP_ROW_PITCH - row * PITCH_DROP_PER_ROW, to: 300, seconds: 0.09, volume: 0.15 },
  { wave: 'noise', from: 3500, to: 600, seconds: 0.07, volume: 0.1 },
]);

/** What a game event should sound like for the person holding `modeId`'s side, or null for silence. */
export function soundFor(event, modeId) {
  switch (event.type) {
    case 'launch': return LAUNCH;
    case 'paddle': return PADDLE_HIT;
    case 'border': return BORDER_HIT;
    case 'brick': return BRICK_BREAKS[event.row];
    case 'lifeLost': return modeId === 'human' ? BALL_LOST : BALL_DROPPED_BY_COMPUTER;
    default: return null;
  }
}

/** The result jingle: winning is clearing the wall for the paddle player, but the opposite for the wall player. */
export function resultSound(state) {
  const paddlePlayerWon = state.status === 'won';
  return paddlePlayerWon === (state.modeId === 'human') ? 'win' : 'lose';
}

export function playEvents(events, modeId) {
  for (const event of events) {
    const sound = soundFor(event, modeId);
    if (sound) play(sound);
  }
}
