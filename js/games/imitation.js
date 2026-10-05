import { createRng } from '../core/rng.js';
import { runSession } from './imitation/session.js';
import { createView } from './imitation/view.js';

/**
 * Imitation: a chat Turing test between two friends in two browsers. The mode is your role:
 * 'judge' questions the other side and calls it, human or AI; 'deceiver' secretly answers each
 * round themselves or lets a language model in their browser answer for them.
 */
export function mount(container, { mode }) {
  const view = createView(container);
  const session = runSession(view, createRng(), mode.id);

  return {
    destroy() {
      session.destroy();
      view.destroy();
    },
  };
}
