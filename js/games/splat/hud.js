import { createHud } from '../../core/hud.js';
import { COLUMN_BUDGET, FLAP_COOLDOWN, WIN_COLUMNS } from './config.js';
import { EVENT, REFUSAL, canPlaceColumn, spacingProgress } from './rules.js';
import { LEVEL_UP } from './session.js';

const touchOnly = () => window.matchMedia('(pointer: coarse)').matches;

// Short lines: on a phone the help text shares a small stage with the playfield.
const COPY = {
  human: {
    goal: `Pass ${WIN_COLUMNS} columns without a splat`,
    controls: () => (touchOnly() ? 'Tap to flap' : 'Space, Up or click to flap'),
    ready: 'Get ready: flap to stay up',
    harder: 'faster, narrower gaps',
  },
  computer: {
    goal: `Splat it within ${COLUMN_BUDGET} columns`,
    controls: () => (touchOnly() ? 'Tap where you want the gap' : 'Mouse or Up/Down aims, click or Space sends'),
    ready: 'Aim the gap, then send a column',
    harder: 'it flies sharper',
  },
};

const REFUSALS = {
  [REFUSAL.spacing]: { text: 'Too soon: wait until Next column is ready', meter: 'next' },
  [REFUSAL.budget]: { text: 'No columns left. Watch it fly', meter: 'left' },
};

const CLAMP_HINT = 'Gap limited: it must stay passable';
const PERCENT = 100;
const HINT_SECONDS = { level: 2.2, clamp: 2.6 };

/** Splat's on-screen help: the goal, the controls and a meter for everything the player waits on or spends. */
export function createSplatHud(container, modeId) {
  const copy = COPY[modeId];
  const hud = createHud(container, { goal: copy.goal, controls: copy.controls() });
  let shownLevel = 0;
  let hasExplainedClamp = false;

  function showFlapMeter(state) {
    const { flapCooldown } = state.creature;
    hud.setMeter('flap', {
      label: 'Flap',
      value: FLAP_COOLDOWN - flapCooldown,
      max: FLAP_COOLDOWN,
      text: flapCooldown > 0 ? 'wait' : 'ready',
    });
  }

  function showLayingMeters(state) {
    const ready = canPlaceColumn(state);
    const isOutOfColumns = state.columnsPlaced >= state.goal;
    hud.setMeter('left', {
      label: 'Columns left',
      value: state.goal - state.columnsPlaced,
      max: state.goal,
    });
    hud.setMeter('next', {
      label: 'Next column',
      value: spacingProgress(state) * PERCENT,
      max: PERCENT,
      text: ready ? 'ready' : isOutOfColumns ? 'none' : 'wait',
    });
  }

  return {
    /** Call when a round begins so the level pill and the one-time hints start fresh. */
    start() {
      shownLevel = 0;
      hasExplainedClamp = false;
    },
    /** Refreshes the meters and the level pill from the running round. */
    refresh(session) {
      if (session.level() !== shownLevel) {
        shownLevel = session.level();
        hud.setLevel(shownLevel);
      }
      if (modeId === 'human') showFlapMeter(session.state);
      else showLayingMeters(session.state);
    },
    showReady: (seconds) => hud.showHint(copy.ready, seconds),
    showEvent(event) {
      if (event.type === LEVEL_UP) {
        hud.showHint(`Level ${event.level}: ${copy.harder}`, HINT_SECONDS.level);
      } else if (event.type === EVENT.refused) {
        const { text, meter } = REFUSALS[event.reason];
        hud.showHint(text);
        hud.flashMeter(meter);
      } else if (event.type === EVENT.placed && event.clamped && !hasExplainedClamp) {
        hasExplainedClamp = true;
        hud.showHint(CLAMP_HINT, HINT_SECONDS.clamp);
      }
    },
    destroy: () => hud.destroy(),
  };
}
