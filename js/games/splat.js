import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { startLevelFromUrl } from '../core/level.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { GET_READY_SECONDS, HEIGHT, SPLAT_LINGER_SECONDS, WIDTH } from './splat/config.js';
import { createColumnPlacer, createFlapInput } from './splat/controllers.js';
import { createSplatHud } from './splat/hud.js';
import { TONE_COLORS, render } from './splat/render.js';
import { canPlaceColumn, clampCenter } from './splat/rules.js';
import { createSession } from './splat/session.js';
import { playEvent, playStart } from './splat/sounds.js';
import { resultPanel, scoreLine, startPanel } from './splat/summary.js';

/** Wires the pure rules to the screen. Fly-through mode: you flap. Lay mode: you place the columns. */
export function mount(container, { mode }) {
  const modeId = mode.id;
  const isHumanFlying = modeId === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  stage.canvas.style.touchAction = 'none';
  const overlay = createOverlay(container);
  const hud = createSplatHud(container, modeId);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const flapInput = createFlapInput(keyboard, pointer);
  const placer = createColumnPlacer(keyboard, pointer);
  const colors = {
    creatureColor: isHumanFlying ? TONE_COLORS.human : TONE_COLORS.computer,
    columnColor: isHumanFlying ? TONE_COLORS.computer : TONE_COLORS.human,
  };

  let session = newSession(startLevelFromUrl());
  let isRunning = false;
  let readyLeft = 0;
  let lingerLeft = 0;

  function newSession(startLevel) {
    return createSession({ modeId, rng: createRng(), startLevel, onEvent: announce });
  }

  function announce(event) {
    playEvent(modeId, event);
    hud.showEvent(event);
  }

  function discardPendingInput() {
    ['Space', 'ArrowUp', 'Enter'].forEach((code) => keyboard.consumeTap(code));
    pointer.consumePress();
  }

  function begin(startLevel) {
    session = newSession(startLevel);
    discardPendingInput();
    overlay.hide();
    hud.start();
    hud.refresh(session);
    hud.showReady(GET_READY_SECONDS);
    overlay.setScore(scoreLine(modeId, session.state));
    isRunning = true;
    readyLeft = GET_READY_SECONDS;
    lingerLeft = SPLAT_LINGER_SECONDS;
    playStart();
  }

  function readHuman(dt) {
    return isHumanFlying ? flapInput.read() : placer.read(dt);
  }

  function update(dt) {
    if (!isRunning) return;
    if (readyLeft > 0) {
      readyLeft -= dt;
      if (!isHumanFlying) placer.track(dt);
      return;
    }
    if (session.isOver()) {
      lingerLeft -= dt;
      if (lingerLeft <= 0) finish();
      return;
    }
    session.advance(dt, readHuman(dt));
    overlay.setScore(scoreLine(modeId, session.state));
    hud.refresh(session);
  }

  function finish() {
    isRunning = false;
    const { title, detail } = resultPanel(modeId, session.state, session.level());
    overlay.show({ title, detail, actionLabel: 'Play again', levelPicker: true, onAction: begin });
  }

  function previewColumn() {
    if (isHumanFlying || !isRunning || session.isOver()) return null;
    const { gapSize } = session.tuning();
    return {
      center: clampCenter(session.state, placer.aim(), gapSize),
      gapSize,
      isReady: canPlaceColumn(session.state),
    };
  }

  function draw() {
    render(stage.context, { state: session.state, preview: previewColumn(), ...colors });
  }

  const loop = createLoop({ update, render: draw });
  overlay.setScore(scoreLine(modeId, session.state));
  overlay.show({ ...startPanel(modeId), actionLabel: 'Start', levelPicker: true, onAction: begin });
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      overlay.destroy();
      hud.destroy();
      stage.destroy();
    },
  };
}
