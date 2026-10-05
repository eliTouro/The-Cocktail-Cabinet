import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { createAi } from './splat/ai.js';
import { COLUMN_BUDGET, HEIGHT, TUNING, WIDTH } from './splat/config.js';
import { createColumnGenerator, createColumnPlacer, createFlapInput } from './splat/controllers.js';
import { TONE_COLORS, render } from './splat/render.js';
import { PHASE, canPlaceColumn, clampCenter, createState, observe, step } from './splat/rules.js';

const INTRO = {
  human: {
    title: 'Splat',
    detail: 'Press Space or Up, click or tap to flap. Slip through every gap. Touch a column, the floor or the ceiling and you splat.',
  },
  computer: {
    title: 'Lay the columns',
    detail: `Move the mouse (or press Up and Down) to place the gap, then click, tap or press Space to send the next column. The computer flies the creature. Make it splat within ${COLUMN_BUDGET} columns to win. Every gap is passable, so you have to out-think it.`,
  },
};

function gameOverText(mode, state) {
  if (mode.id === 'human') {
    return { title: 'Splat!', detail: `You passed ${state.score} ${state.score === 1 ? 'column' : 'columns'}.` };
  }
  if (state.phase === PHASE.splat) {
    return { title: 'Splat! You win', detail: `The creature splatted after ${state.score} ${state.score === 1 ? 'column' : 'columns'}.` };
  }
  return { title: 'It got through', detail: `The computer passed all ${COLUMN_BUDGET} columns. Lay them trickier next time.` };
}

function scoreText(mode, state) {
  return mode.id === 'human' ? `Columns ${state.score}` : `Survived ${state.score} / ${COLUMN_BUDGET}`;
}

export function mount(container, { mode }) {
  const isHumanFlying = mode.id === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const goal = isHumanFlying ? null : COLUMN_BUDGET;
  const colors = {
    creatureColor: isHumanFlying ? TONE_COLORS.human : TONE_COLORS.computer,
    columnColor: isHumanFlying ? TONE_COLORS.computer : TONE_COLORS.human,
  };

  let state = createState({ goal });
  let isRunning = false;
  let readInput;
  let readPreview = () => null;

  function discardPendingInput() {
    ['Space', 'ArrowUp', 'Enter'].forEach((code) => keyboard.consumeTap(code));
    pointer.consumePress();
  }

  function startRun() {
    const rng = createRng();
    state = createState({ goal });
    discardPendingInput();
    overlay.hide();
    overlay.setScore(scoreText(mode, state));
    isRunning = true;
    ({ readInput, readPreview } = isHumanFlying ? humanFlies(rng) : computerFlies(rng));
  }

  function humanFlies(rng) {
    const flapInput = createFlapInput(keyboard, pointer);
    const generator = createColumnGenerator(rng);
    return {
      readInput: (dt, tuning) => ({ ...flapInput.read(), column: generator.read(state, tuning) }),
      readPreview: () => null,
    };
  }

  function computerFlies(rng) {
    const ai = createAi(rng);
    const placer = createColumnPlacer(keyboard, pointer);
    return {
      readInput: (dt) => ({ flap: ai.decide(observe(state)).flap, column: placer.read(dt).column }),
      readPreview: (tuning) => ({
        center: clampCenter(state, placer.aim(), tuning.gapSize),
        gapSize: tuning.gapSize,
        isReady: canPlaceColumn(state),
      }),
    };
  }

  function endRun() {
    isRunning = false;
    const { title, detail } = gameOverText(mode, state);
    overlay.show({ title, detail, actionLabel: 'Play again', onAction: startRun });
  }

  function update(dt) {
    if (!isRunning) return;
    const tuning = TUNING[mode.id](state.time);
    step(state, readInput(dt, tuning), dt, tuning);
    overlay.setScore(scoreText(mode, state));
    if (state.phase !== PHASE.playing) endRun();
  }

  function draw() {
    const preview = isRunning ? readPreview(TUNING[mode.id](state.time)) : null;
    render(stage.context, { state, preview, ...colors });
  }

  const loop = createLoop({ update, render: draw });
  overlay.setScore(scoreText(mode, state));
  overlay.show({ ...INTRO[mode.id], actionLabel: 'Start', onAction: startRun });
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      overlay.destroy();
      stage.destroy();
    },
  };
}
