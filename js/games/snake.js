import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { APPLE_RULES, CANVAS, ESCAPE_LENGTH, GRID, START_LENGTH } from './snake/config.js';
import { drawFrame } from './snake/render.js';
import { isDropTarget, isOutside } from './snake/rules.js';
import { createSession } from './snake/session.js';
import { createSwipe } from './snake/swipe.js';

const KEY_DIRECTIONS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const NOTICE_SECONDS = 1.2;
const REJECTION_NOTICES = {
  blocked: 'That cell is taken',
  unreachable: 'The snake cannot reach that cell',
  'too-many': `Only ${APPLE_RULES.maxApples} apples at a time`,
  cooldown: 'Wait a moment before the next apple',
};

const INTRO = {
  human: {
    detail: 'Steer with the arrow keys or WASD, or swipe. Eat the apples to grow. Hitting a wall or yourself ends the run.',
  },
  computer: {
    detail: `The computer steers the snake. Click or tap a cell to drop an apple, up to ${APPLE_RULES.maxApples} at a time. Bait it into a wall or its own tail before it grows to ${ESCAPE_LENGTH}.`,
  },
};

const cellAt = (point) => ({ x: Math.floor(point.x / GRID.cell), y: Math.floor(point.y / GRID.cell) });

export function mount(container, { mode }) {
  const modeId = mode.id;
  const surface = createCanvas(container, CANVAS);
  surface.canvas.style.touchAction = 'none';
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(surface.canvas, CANVAS);
  const swipe = modeId === 'human' ? createSwipe(surface.canvas, (direction) => session.queueTurn(direction)) : null;
  const loop = createLoop({ update, render });

  let session = createSession({ modeId, rng: createRng() });
  let playing = false;
  let notice = { text: '', secondsLeft: 0 };

  function begin() {
    session = createSession({ modeId, rng: createRng() });
    playing = true;
    overlay.hide();
    updateScore();
  }

  function update(seconds) {
    notice.secondsLeft -= seconds;
    if (!playing) return;
    readInput();
    session.update(seconds);
    updateScore();
    if (session.outcome) finish();
  }

  function readInput() {
    if (modeId === 'human') {
      for (const [code, direction] of Object.entries(KEY_DIRECTIONS)) {
        if (keyboard.consumeTap(code)) session.queueTurn(direction);
      }
      return;
    }
    const press = pointer.consumePress();
    if (press) tryPlaceApple(cellAt(press));
  }

  function tryPlaceApple(cell) {
    const result = session.requestApple(cell);
    if (!result.ok) notice = { text: REJECTION_NOTICES[result.reason], secondsLeft: NOTICE_SECONDS };
  }

  function updateScore() {
    const length = session.state.snake.length;
    overlay.setScore(modeId === 'human'
      ? `Apples ${length - START_LENGTH}`
      : `Snake ${length}/${ESCAPE_LENGTH}   Apples ${session.state.apples.length}/${APPLE_RULES.maxApples}`);
  }

  function finish() {
    playing = false;
    overlay.show({ ...endScreen(), actionLabel: 'Play again', onAction: begin });
  }

  function endScreen() {
    const length = session.state.snake.length;
    const seconds = Math.round(session.elapsed);
    if (session.outcome === 'cleared') return { title: 'Board cleared', detail: 'The snake fills every cell. Perfect run.' };
    if (modeId === 'human') return { title: 'Game over', detail: `You ate ${length - START_LENGTH} apples in ${seconds} seconds.` };
    if (session.outcome === 'dead') {
      return { title: 'You trapped it', detail: `The snake crashed at length ${length} after ${seconds} seconds.` };
    }
    return { title: 'The snake escaped', detail: `It reached length ${ESCAPE_LENGTH} in ${seconds} seconds. Try baiting it into corners.` };
  }

  function hoverCell() {
    if (modeId !== 'computer') return null;
    const cell = cellAt(pointer.position());
    if (isOutside(session.state, cell)) return null;
    return { ...cell, valid: isDropTarget(session.state, cell) };
  }

  function render() {
    drawFrame(surface.context, {
      session,
      hover: hoverCell(),
      notice: notice.secondsLeft > 0 ? notice.text : '',
    });
  }

  overlay.show({
    title: 'Snake',
    detail: INTRO[modeId].detail,
    actionLabel: 'Start',
    onAction: begin,
  });
  updateScore();
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      swipe?.destroy();
      overlay.destroy();
      surface.destroy();
    },
  };
}
