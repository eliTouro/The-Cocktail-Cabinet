import { createRng } from '../core/rng.js';
import { runAiSession } from './imitation/aiSession.js';
import { runHumanSession } from './imitation/humanSession.js';
import { createView } from './imitation/view.js';

const SESSIONS = { ai: runAiSession, human: runHumanSession };

/**
 * Imitation: a chat Turing test. 'ai' pairs you with a language model running in your browser
 * after simulated matchmaking; 'human' connects two browsers directly over WebRTC.
 */
export function mount(container, { mode }) {
  const view = createView(container);
  const session = SESSIONS[mode.id](view, createRng());

  return {
    destroy() {
      session.destroy();
      view.destroy();
    },
  };
}
