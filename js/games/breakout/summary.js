import { LIVES, WALL } from './config.js';
import { bricksLeft, wallScore } from './rules.js';

const TOTAL_BRICKS = WALL.columns * WALL.rows;

export const isOver = (state) => state.status === 'won' || state.status === 'lost';

export function scoreLine(state) {
  const score = state.modeId === 'human' ? `Score ${state.score}` : `Your score ${wallScore(state)}`;
  return `${score}  ·  ${bricksLeft(state)} of ${TOTAL_BRICKS} bricks left`;
}

export function startPanel(modeId, label) {
  const detail = modeId === 'human'
    ? 'Hit the ball near the paddle edge to angle it. It speeds up and the paddle shrinks as the round goes on.'
    : 'A moving wall nudges the ball it hits. Do not let the computer clear the wall.';
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
