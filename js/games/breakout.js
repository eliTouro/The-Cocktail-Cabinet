import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { elapsedAtLevel } from '../core/level.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { SECONDS_TO_HARDEST, difficultyAt, FIELD } from './breakout/config.js';
import { createComputerPlayer } from './breakout/computerPlayer.js';
import { createFeedback } from './breakout/feedback.js';
import { createHumanControls, railPosition } from './breakout/humanControls.js';
import { drawScene } from './breakout/render.js';
import { createGame, IDLE_INPUT, observe, pushesPastRail, step } from './breakout/rules.js';
import { isOver, resultPanel, scoreLine, startPanel } from './breakout/summary.js';

/** Wires the pure rules to the screen. Human mode: you hold the paddle. Computer mode: you hold the wall. */
export function mount(container, { mode }) {
  const canvas = createCanvas(container, FIELD);
  const overlay = createOverlay(container);
  const feedback = createFeedback(container, mode.id);
  const pointer = createPointer(canvas.canvas, FIELD);
  const keyboard = createKeyboard();
  const controls = createHumanControls({ pointer, keyboard });
  const rng = createRng();
  const humanHoldsPaddle = mode.id === 'human';

  let state = createGame(mode.id);
  let computer = createComputerPlayer(rng);
  let wallAim = null;
  let wasPushingPastRail = false;
  let roundInProgress = false;

  function wallInput(human) {
    wallAim = human.target === null ? null : railPosition(human.target);
    const pushing = pushesPastRail(state.wallX, human.direction);
    if (pushing && !wasPushingPastRail) feedback.refuseWallMove();
    wasPushingPastRail = pushing;
    return { target: wallAim, direction: human.direction };
  }

  function readInput(dt) {
    const human = controls.read();
    if (humanHoldsPaddle) return { paddle: human, wall: IDLE_INPUT.wall };
    const level = difficultyAt(mode.id, state.time);
    return { paddle: computer(observe(state), level, dt), wall: wallInput(human) };
  }

  function update(dt) {
    step(state, readInput(dt), dt);
    overlay.setScore(scoreLine(state));
    feedback.react(state);
    if (isOver(state)) finish();
  }

  const render = () => drawScene(canvas.context, state, { wallAim, showServePrompt: roundInProgress });
  const loop = createLoop({ update, render });

  function begin(startLevel) {
    state = createGame(mode.id, elapsedAtLevel(startLevel, SECONDS_TO_HARDEST));
    computer = createComputerPlayer(rng);
    controls.reset();
    wallAim = null;
    wasPushingPastRail = false;
    overlay.setScore(scoreLine(state));
    overlay.hide();
    roundInProgress = true;
    feedback.start(state);
    loop.start();
  }

  function finish() {
    loop.stop();
    roundInProgress = false;
    render();
    feedback.finish(state);
    overlay.show({ ...resultPanel(state), levelPicker: true, onAction: begin });
  }

  overlay.setScore(scoreLine(state));
  feedback.showIdle(state);
  render();
  overlay.show({ ...startPanel(mode.id, mode.label), levelPicker: true, onAction: begin });

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      feedback.destroy();
      overlay.destroy();
      canvas.destroy();
    },
  };
}
