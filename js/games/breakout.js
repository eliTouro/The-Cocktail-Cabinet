import { createCanvas } from '../core/canvas.js';
import { difficultyAt, FIELD } from './breakout/config.js';
import { createComputerPlayer } from './breakout/computerPlayer.js';
import { createHumanControls } from './breakout/humanControls.js';
import { drawScene } from './breakout/render.js';
import { createGame, IDLE_INPUT, observe, step } from './breakout/rules.js';
import { isOver, resultPanel, scoreLine, startPanel } from './breakout/summary.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';

/** Wires the pure rules to the screen. Human mode: you hold the paddle. Computer mode: you hold the wall. */
export function mount(container, { mode }) {
  const canvas = createCanvas(container, FIELD);
  const overlay = createOverlay(container);
  const pointer = createPointer(canvas.canvas, FIELD);
  const keyboard = createKeyboard();
  const controls = createHumanControls({ pointer, keyboard });
  const rng = createRng();
  const humanHoldsPaddle = mode.id === 'human';

  let state = createGame(mode.id);
  let computer = createComputerPlayer(rng);

  function readInput(dt) {
    const human = controls.read();
    if (humanHoldsPaddle) return { paddle: human, wall: IDLE_INPUT.wall };
    const level = difficultyAt(mode.id, state.time);
    return { paddle: computer(observe(state), level, dt), wall: human };
  }

  function update(dt) {
    const input = readInput(dt);
    step(state, input, dt);
    overlay.setScore(scoreLine(state));
    if (isOver(state)) finish();
  }

  const render = () => drawScene(canvas.context, state);
  const loop = createLoop({ update, render });

  function begin() {
    state = createGame(mode.id);
    computer = createComputerPlayer(rng);
    controls.reset();
    overlay.setScore(scoreLine(state));
    overlay.hide();
    loop.start();
  }

  function finish() {
    loop.stop();
    render();
    overlay.show({ ...resultPanel(state), onAction: begin });
  }

  overlay.setScore(scoreLine(state));
  render();
  overlay.show({ ...startPanel(mode.id, mode.label), onAction: begin });

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      overlay.destroy();
      canvas.destroy();
    },
  };
}
