import { COLUMN_BUDGET, WIN_COLUMNS } from './config.js';
import { PHASE, SPLAT_CAUSE } from './rules.js';

const INTRO = {
  human: {
    title: 'Splat',
    detail: `Press Space or Up, click or tap to flap. Slip through the gap in every column and pass ${WIN_COLUMNS} columns to win. Touch a column, the floor or the ceiling and you splat.`,
  },
  computer: {
    title: 'Lay the columns',
    detail: `The computer flies the creature. Move the mouse (or press Up and Down) to place the gap, then click, tap or press Space to send the next column. Make it splat within ${COLUMN_BUDGET} columns to win. Every gap is passable, so you have to out-think it.`,
  },
};

const CAUSE_TEXT = {
  [SPLAT_CAUSE.column]: 'a column',
  [SPLAT_CAUSE.floor]: 'the floor',
  [SPLAT_CAUSE.ceiling]: 'the ceiling',
};

const columns = (count) => `${count} ${count === 1 ? 'column' : 'columns'}`;

export const startPanel = (modeId) => INTRO[modeId];

export function scoreLine(modeId, state) {
  return modeId === 'human' ? `Passed ${state.score} / ${WIN_COLUMNS}` : `Survived ${state.score} / ${COLUMN_BUDGET}`;
}

/** The result panel text for the finished round, written from the person's side. */
export function resultPanel(modeId, state, level) {
  const cause = CAUSE_TEXT[state.splat?.cause];
  if (modeId === 'human') {
    if (state.phase === PHASE.survived) return { title: 'You made it', detail: `You flew through all ${WIN_COLUMNS} columns, reaching level ${level}.` };
    return { title: 'Splat!', detail: `You hit ${cause} after passing ${columns(state.score)}, at level ${level}.` };
  }
  if (state.phase === PHASE.splat) {
    return { title: 'Splat! You win', detail: `The creature hit ${cause} after passing ${columns(state.score)}, at level ${level}.` };
  }
  return { title: 'It got through', detail: `The creature passed all ${COLUMN_BUDGET} columns, at level ${level}. Lay them trickier next time.` };
}
