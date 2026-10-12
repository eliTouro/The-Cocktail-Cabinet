import { createHud } from '../../core/hud.js';
import { levelAt } from '../../core/level.js';
import { play } from '../../core/sound.js';
import { LIVES, SECONDS_TO_HARDEST, WALL } from './config.js';
import { playEvents, resultSound } from './sounds.js';

const TOTAL_BRICKS = WALL.columns * WALL.rows;
const LIFE_LOST_HINT_SECONDS = 2.4;
const LEVEL_UP_HINT_SECONDS = 2.2;

const touchOnly = () => window.matchMedia('(pointer: coarse)').matches;

// Short lines: on a phone the help text shares a small stage with the playfield.
const COPY = {
  human: {
    goal: `Clear all ${TOTAL_BRICKS} bricks with ${LIVES} balls`,
    controls: () => (touchOnly() ? 'Drag to move, tap to launch' : 'Mouse or arrow keys move, click or Space launches'),
    livesLabel: 'Lives',
    harder: 'faster ball, smaller paddle',
  },
  computer: {
    goal: `Make the computer drop ${LIVES} balls`,
    controls: () => (touchOnly() ? 'Drag to slide the wall' : 'Mouse or arrow keys slide the wall'),
    livesLabel: 'Computer lives',
    harder: 'faster ball, sharper computer',
  },
};

const livesText = (count) => `${count} ${count === 1 ? 'life' : 'lives'} left`;

/**
 * Everything the player sees and hears about the game besides the playfield itself: the help
 * lines, the lives and level readouts, hints and sound effects. `react(state)` takes the
 * events of the step that just ran; nothing here changes the rules.
 */
export function createFeedback(container, modeId) {
  const copy = COPY[modeId];
  const hud = createHud(container, { goal: copy.goal, controls: copy.controls() });
  let shownLevel = 0;
  let shownLives = -1;

  function showMeters(state) {
    if (state.lives !== shownLives) {
      hud.setMeter('lives', { label: copy.livesLabel, value: state.lives, max: LIVES });
      shownLives = state.lives;
    }
  }

  function showLevel(state, { announce }) {
    const level = levelAt(state.time, SECONDS_TO_HARDEST);
    if (level === shownLevel) return;
    const rising = level > shownLevel && shownLevel > 0;
    shownLevel = level;
    hud.setLevel(level);
    if (!rising || !announce) return;
    play('levelUp');
    hud.showHint(`Level ${level}: ${copy.harder}`, LEVEL_UP_HINT_SECONDS);
  }

  function announceLifeLost(state) {
    hud.flashMeter('lives');
    if (state.status !== 'serving') return;
    const who = modeId === 'human' ? 'Ball lost' : 'The computer dropped the ball';
    hud.showHint(`${who}, ${livesText(state.lives)}`, LIFE_LOST_HINT_SECONDS);
  }

  return {
    /** The meters as they stand before a round, behind the start panel. The level stays hidden until a round begins. */
    showIdle(state) {
      showMeters(state);
    },
    /** Call when a round begins (or restarts at any level). */
    start(state) {
      shownLevel = 0;
      shownLives = -1;
      play('pickup');
      hud.showHint('');
      showMeters(state);
      showLevel(state, { announce: false });
    },
    react(state) {
      playEvents(state.events, modeId);
      if (state.events.some(({ type }) => type === 'lifeLost')) announceLifeLost(state);
      showMeters(state);
      showLevel(state, { announce: true });
    },
    /** The wall player pushed against the end of the rail, so the wall could not move further. */
    refuseWallMove() {
      play('denied');
      hud.showHint('The wall cannot slide past the end of its rail');
    },
    finish(state) {
      play(resultSound(state));
    },
    destroy() {
      hud.destroy();
    },
  };
}
