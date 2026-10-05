import { LIVES, WALL } from './config.js';
import { bricksLeft, wallScore } from './rules.js';

const TOTAL_BRICKS = WALL.columns * WALL.rows;

export const isOver = (state) => state.status === 'won' || state.status === 'lost';

export function scoreLine(state) {
  if (state.modeId === 'human') return `Score ${state.score}  ·  Lives ${state.lives}/${LIVES}  ·  Bricks ${bricksLeft(state)}`;
  return `Your score ${wallScore(state)}  ·  Computer lives ${state.lives}/${LIVES}  ·  Bricks left ${bricksLeft(state)}`;
}

export function startPanel(modeId, label) {
  const detail = modeId === 'human'
    ? 'Move the mouse, drag a finger, or use the arrow keys or A and D to steer the paddle. Click, tap or press Space to launch. Hit the ball near the paddle edge to angle it. Clear all 50 bricks with 3 lives.'
    : 'The computer has the paddle and wants your wall gone. Slide the wall with the mouse, a finger, or the arrow keys or A and D. A moving wall also nudges the ball. Make the computer drop all 3 lives before it clears the wall.';
  return { title: label, detail, actionLabel: 'Start' };
}

export function resultPanel(state) {
  const broken = TOTAL_BRICKS - bricksLeft(state);
  if (state.modeId === 'human') {
    return state.status === 'won'
      ? { title: 'Wall cleared', detail: `Final score ${state.score}.`, actionLabel: 'Play again' }
      : { title: 'Out of lives', detail: `You broke ${broken} of ${TOTAL_BRICKS} bricks and scored ${state.score}.`, actionLabel: 'Play again' };
  }
  return state.status === 'lost'
    ? { title: 'You win', detail: `The computer lost all ${LIVES} lives with ${bricksLeft(state)} bricks left. Your score ${wallScore(state)}.`, actionLabel: 'Play again' }
    : { title: 'The computer wins', detail: `It cleared the wall after dropping ${state.livesLost} of ${LIVES} lives. Your score ${wallScore(state)}.`, actionLabel: 'Play again' };
}
