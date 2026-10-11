import { createHud } from '../../core/hud.js';
import { APPLE_RULES, ESCAPE_LENGTH, WIN_APPLES } from './config.js';

const HELP = {
  human: {
    goal: `Eat ${WIN_APPLES} apples without crashing.`,
    controls: 'Arrows, WASD or swipe',
  },
  computer: {
    goal: `Trap the snake before it hits ${ESCAPE_LENGTH}.`,
    controls: 'Tap a cell to drop an apple',
  },
};

const REFUSALS = {
  blocked: { text: 'That cell is taken or off the board' },
  unreachable: { text: 'The snake cannot reach that cell' },
  'too-many': { text: `Only ${APPLE_RULES.maxApples} apples at a time`, meter: 'apples' },
  cooldown: { text: 'Next apple is not ready yet', meter: 'drop' },
};

const EVENT_HINTS = {
  'boxed-in': 'Boxed in: find a gap before you run out of room',
  'near-escape': 'Almost out! Trap it now',
};

/** Snake's on-screen help: the goal, the controls and a meter for everything the player waits on or spends. */
export function createSnakeHud(container, modeId) {
  const hud = createHud(container, HELP[modeId]);
  const primedBars = new Set();
  let shownLevel = 0;

  // The shared HUD only builds a bar's fill when a meter switches over from segments, so a bar
  // meter is first set as a one-segment meter.
  function setBar(id, meter) {
    if (!primedBars.has(id)) {
      hud.setMeter(id, { ...meter, value: 0, max: 1 });
      primedBars.add(id);
    }
    hud.setMeter(id, meter);
  }

  function showHumanMeters(session) {
    setBar('apples', { label: 'Apples', value: session.applesEaten(), max: WIN_APPLES });
  }

  function showComputerMeters(session) {
    const readySeconds = APPLE_RULES.cooldownSeconds - session.cooldownLeft;
    setBar('snake', { label: 'Snake', value: session.state.snake.length, max: ESCAPE_LENGTH });
    hud.setMeter('apples', { label: 'Apples left', value: session.applesLeftToPlace(), max: APPLE_RULES.maxApples });
    setBar('drop', {
      label: 'Drop',
      value: readySeconds,
      max: APPLE_RULES.cooldownSeconds,
      text: session.cooldownLeft > 0 ? `${session.cooldownLeft.toFixed(1)}s` : 'ready',
    });
  }

  return {
    refresh(session) {
      if (session.level() !== shownLevel) {
        shownLevel = session.level();
        hud.setLevel(shownLevel);
      }
      if (modeId === 'human') showHumanMeters(session);
      else showComputerMeters(session);
    },
    showRefusal(reason) {
      const { text, meter } = REFUSALS[reason];
      hud.showHint(text);
      if (meter) hud.flashMeter(meter);
    },
    showEvent(event) {
      if (EVENT_HINTS[event]) hud.showHint(EVENT_HINTS[event]);
    },
    showHint: (text, seconds) => hud.showHint(text, seconds),
    destroy: () => hud.destroy(),
  };
}
