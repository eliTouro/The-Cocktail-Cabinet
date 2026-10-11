import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { elapsedAtLevel, levelAt } from '../core/level.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { createAi } from './asteroids/ai.js';
import {
  HEIGHT, SECONDS_TO_HARDEST, SIZE_KEYS, SURVIVE_SECONDS, TUNING, WIDTH,
} from './asteroids/config.js';
import {
  createRockSender, createShipInput, createWaveGenerator, tierAt,
} from './asteroids/controllers.js';
import { nearestEdgePoint } from './asteroids/geometry.js';
import { createAsteroidsHud } from './asteroids/hudView.js';
import { TONE_COLORS, render } from './asteroids/render.js';
import {
  EVENT, PHASE, createState, difficultyClock, launchToward, observe, spawnRejection, step,
} from './asteroids/rules.js';
import {
  THRUST_PULSE_SECONDS, playEvents, playLevelUp, playLose, playStart, playThrust, playWave, playWin,
} from './asteroids/sounds.js';
import { INTRO, REFUSAL, gameOverText } from './asteroids/texts.js';
import { createTouchPad, hasTouchScreen } from './asteroids/touchPad.js';

/** Phones: the HUD shows fewer meters (see createAsteroidsHud). */
const COMPACT_SCREEN_QUERY = '(max-width: 600px)';

export function mount(container, { mode }) {
  const isFlying = mode.id === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const tuning = TUNING[mode.id]();
  const touchPad = createTouchPad(stage.canvas);
  const hud = createAsteroidsHud(container, { isFlying, tuning, isTouch: hasTouchScreen(), isCompact: window.matchMedia(COMPACT_SCREEN_QUERY).matches });
  const colors = isFlying
    ? { shipColor: TONE_COLORS.human, rockColor: TONE_COLORS.rock }
    : { shipColor: TONE_COLORS.computer, rockColor: TONE_COLORS.human };

  let state = createState({ surviveSeconds: SURVIVE_SECONDS });
  let isRunning = false;
  let level = 1;
  let wavesSeen = 0;
  let secondsToNextThrustPuff = 0;
  let readInput = () => ({ rotate: 0, thrust: false, fire: false, spawns: [] });
  let readPreview = () => null;
  let waves = createWaveGenerator(createRng());

  function discardPendingInput() {
    pointer.consumePress();
    ['Space', ...SIZE_KEYS].forEach((code) => keyboard.consumeTap(code));
  }

  function startRun(startLevel) {
    const rng = createRng();
    level = startLevel;
    wavesSeen = 0;
    state = createState({ surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(startLevel, SECONDS_TO_HARDEST), budget: tuning.startingBudget });
    waves = createWaveGenerator(rng);
    discardPendingInput();
    overlay.hide();
    overlay.setScore(hud.scoreLine(state, waves.wave()));
    hud.setLevel(level);
    hud.update(state);
    isRunning = true;
    ({ readInput, readPreview } = isFlying ? humanFlies() : computerFlies(rng));
    playStart();
  }

  function humanFlies() {
    const shipInput = createShipInput(keyboard, touchPad);
    return {
      readInput: () => ({ ...shipInput.read(), spawns: waves.read(state) }),
      readPreview: () => null,
    };
  }

  function computerFlies(rng) {
    const ai = createAi(rng);
    const sender = createRockSender(keyboard, pointer);
    return {
      readInput: () => ({ ...ai.decide(observe(state)), spawns: sender.read(tuning).spawns }),
      readPreview: () => senderPreview(sender),
    };
  }

  function senderPreview(sender) {
    const target = pointer.position();
    const launch = launchToward(target, sender.tier(), tuning.rockSpeed);
    const isOverPlayfield = tierAt(target) === null;
    const refusal = isOverPlayfield ? spawnRejection(state, launch, tuning) : null;
    return {
      tier: sender.tier(),
      from: nearestEdgePoint(target),
      target,
      canSend: isOverPlayfield && refusal === null,
      budget: state.budget,
      refusalLabel: refusal && REFUSAL[refusal].short,
    };
  }

  function endRun() {
    isRunning = false;
    const humanWon = isFlying ? state.phase === PHASE.won : state.phase === PHASE.lost;
    if (humanWon) playWin();
    else playLose();
    const { title, detail } = gameOverText(mode, state);
    overlay.show({ title, detail, actionLabel: 'Play again', levelPicker: true, onAction: startRun });
  }

  /** A held thrust key puffs on its first frame, then every THRUST_PULSE_SECONDS, never per frame. */
  function pulseThrustSound(dt) {
    if (!state.ship.thrusting) {
      secondsToNextThrustPuff = 0;
      return;
    }
    secondsToNextThrustPuff -= dt;
    if (secondsToNextThrustPuff > 0) return;
    playThrust();
    secondsToNextThrustPuff = THRUST_PULSE_SECONDS;
  }

  function announceEvents() {
    playEvents(state.events);
    state.events.forEach((event) => {
      if (event.type === EVENT.launchRefused) hud.refuse(event.reason);
      if (event.type === EVENT.shipHit) hud.showHint(isFlying ? 'Hit! You respawn once the centre is clear.' : 'Direct hit! The ship lost a life.');
    });
  }

  function announceProgress() {
    if (waves.wave() > wavesSeen) {
      wavesSeen = waves.wave();
      if (wavesSeen > 1) playWave();
    }
    const reached = levelAt(difficultyClock(state), SECONDS_TO_HARDEST);
    if (reached <= level) return;
    level = reached;
    hud.setLevel(level);
    hud.showHint(`Level ${level}: it gets harder.`);
    playLevelUp();
  }

  function update(dt) {
    if (!isRunning) return;
    step(state, readInput(), dt, tuning);
    announceEvents();
    announceProgress();
    pulseThrustSound(dt);
    if (state.phase !== PHASE.playing) endRun();
  }

  function draw() {
    const preview = isRunning ? readPreview() : null;
    hud.update(state);
    overlay.setScore(hud.scoreLine(state, waves.wave()));
    const padButtons = isFlying && touchPad.isVisible() ? touchPad.buttons() : null;
    render(stage.context, { state, preview, padButtons, ...colors });
  }

  const loop = createLoop({ update, render: draw });
  overlay.setScore(hud.scoreLine(state, waves.wave()));
  overlay.show({ ...INTRO[mode.id], actionLabel: 'Start', levelPicker: true, onAction: startRun });
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      touchPad.destroy();
      hud.destroy();
      overlay.destroy();
      stage.destroy();
    },
  };
}
