import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { startLevelFromUrl } from '../core/level.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { BOARD_TOP, CANVAS, ESCAPE_LENGTH, GET_READY_SECONDS, GRID, WIN_APPLES } from './snake/config.js';
import { createSnakeHud } from './snake/hud.js';
import { drawFrame } from './snake/render.js';
import { isDropTarget, isOutside } from './snake/rules.js';
import { createSession } from './snake/session.js';
import { playApplePlaced, playEvent, playRefused, playStart } from './snake/sounds.js';
import { createSwipe } from './snake/swipe.js';

const KEY_DIRECTIONS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

const INTRO = {
  human: `Eat ${WIN_APPLES} apples to win. Walls and your own tail are deadly.`,
  computer: `Drop apples to lure the snake into a wall or its own tail before it grows to ${ESCAPE_LENGTH}.`,
};

const cellAt = (point) => ({ x: Math.floor(point.x / GRID.cell), y: Math.floor((point.y - BOARD_TOP) / GRID.cell) });

export function mount(container, { mode }) {
  const modeId = mode.id;
  const surface = createCanvas(container, CANVAS);
  surface.canvas.style.touchAction = 'none';
  const overlay = createOverlay(container);
  const hud = createSnakeHud(container, modeId);
  const keyboard = createKeyboard();
  const pointer = createPointer(surface.canvas, CANVAS);
  const swipe = modeId === 'human' ? createSwipe(surface.canvas, (direction) => session.queueTurn(direction)) : null;
  const loop = createLoop({ update, render });

  let session = newSession(startLevelFromUrl());
  let playing = false;
  let readyLeft = 0;

  function newSession(startLevel) {
    return createSession({ modeId, rng: createRng(), startLevel, onEvent: announce });
  }

  function announce(event) {
    playEvent(modeId, event);
    hud.showEvent(event);
  }

  function discardInputFromBeforeTheRound() {
    Object.keys(KEY_DIRECTIONS).forEach((code) => keyboard.consumeTap(code));
    pointer.consumePress();
  }

  function begin(startLevel) {
    session = newSession(startLevel);
    discardInputFromBeforeTheRound();
    playing = true;
    readyLeft = GET_READY_SECONDS;
    overlay.hide();
    hud.refresh(session);
    hud.showHint('Get ready', GET_READY_SECONDS);
    playStart();
  }

  function update(seconds) {
    if (!playing) return;
    readInput();
    readyLeft -= seconds;
    if (readyLeft > 0) return;
    session.update(seconds);
    hud.refresh(session);
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
    if (result.ok) {
      playApplePlaced();
      return;
    }
    playRefused();
    hud.showRefusal(result.reason);
  }

  function finish() {
    playing = false;
    overlay.show({ ...endScreen(), actionLabel: 'Play again', levelPicker: true, onAction: begin });
  }

  function endScreen() {
    const level = `level ${session.level()}`;
    const hitWall = session.crashedInto === 'wall';
    if (session.outcome === 'won') return { title: 'You win', detail: `You ate ${WIN_APPLES} apples, reaching ${level}.` };
    if (session.outcome === 'escaped') return { title: 'The snake escaped', detail: `It reached length ${ESCAPE_LENGTH} at ${level}. Try baiting it into corners.` };
    if (modeId === 'human') {
      return { title: 'Game over', detail: `You hit ${hitWall ? 'the wall' : 'your own tail'} with ${session.applesEaten()} of ${WIN_APPLES} apples eaten, at ${level}.` };
    }
    return { title: 'You trapped it', detail: `The snake hit ${hitWall ? 'the wall' : 'its own tail'} at length ${session.state.snake.length}, at ${level}.` };
  }

  function hoverCell() {
    if (modeId !== 'computer' || !playing) return null;
    const cell = cellAt(pointer.position());
    if (isOutside(session.state, cell)) return null;
    return { ...cell, valid: isDropTarget(session.state, cell) };
  }

  function render() {
    drawFrame(surface.context, { session, hover: hoverCell() });
  }

  overlay.show({
    title: 'Snake',
    detail: INTRO[modeId],
    actionLabel: 'Start',
    levelPicker: true,
    onAction: begin,
  });
  hud.refresh(session);
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      swipe?.destroy();
      overlay.destroy();
      hud.destroy();
      surface.destroy();
    },
  };
}
