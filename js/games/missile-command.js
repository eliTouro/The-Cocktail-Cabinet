import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { elapsedAtLevel, levelAt } from '../core/level.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { createAi } from './missile-command/ai.js';
import {
  BASE_KEYS, HEIGHT, NUMPAD_BASE_KEYS, SECONDS_TO_HARDEST, SURVIVE_SECONDS, TONE_COLORS, TUNING, WIDTH,
} from './missile-command/config.js';
import { createDefenderInput, createWarheadSender, createWaveGenerator } from './missile-command/controllers.js';
import { createMissileHud } from './missile-command/hudView.js';
import { render } from './missile-command/render.js';
import {
  EVENT, PHASE, clampTarget, createState, difficultyClock, interceptorRejectionFor, interceptorRequest, observe,
  step, warheadRejectionFor,
} from './missile-command/rules.js';
import {
  playEvents, playLevelUp, playLose, playStart, playWin,
} from './missile-command/sounds.js';
import { INTRO, REFUSAL, gameOverText } from './missile-command/texts.js';

/** Phones: the HUD shows fewer meters (see createMissileHud). */
const COMPACT_SCREEN_QUERY = '(max-width: 600px)';

const COLORS = {
  human: { defender: TONE_COLORS.human, attacker: TONE_COLORS.warhead, crosshair: TONE_COLORS.human },
  computer: { defender: TONE_COLORS.computer, attacker: TONE_COLORS.human, crosshair: TONE_COLORS.human },
};

export function mount(container, { mode }) {
  const isDefending = mode.id === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const tuning = TUNING[mode.id]();
  const colors = COLORS[mode.id];
  const hud = createMissileHud(container, { isDefending, isCompact: window.matchMedia(COMPACT_SCREEN_QUERY).matches });

  let state = createState(tuning, { surviveSeconds: SURVIVE_SECONDS });
  let isRunning = false;
  let level = 1;
  let readInput = () => ({ launches: [], startWave: 0 });

  function discardPendingInput() {
    pointer.consumePress();
    [...BASE_KEYS, ...NUMPAD_BASE_KEYS].forEach((code) => keyboard.consumeTap(code));
  }

  function startRun(startLevel) {
    const rng = createRng();
    level = startLevel;
    state = createState(tuning, { surviveSeconds: SURVIVE_SECONDS, startElapsed: elapsedAtLevel(startLevel, SECONDS_TO_HARDEST) });
    discardPendingInput();
    overlay.hide();
    hud.setLevel(level);
    hud.update(state);
    overlay.setScore(hud.scoreLine(state));
    isRunning = true;
    readInput = isDefending ? humanDefends(rng) : computerDefends(rng);
    playStart();
  }

  function humanDefends(rng) {
    const defender = createDefenderInput(keyboard, pointer);
    const waves = createWaveGenerator(rng);
    return () => {
      const attack = waves.read(state);
      return { launches: [...defender.read().launches, ...attack.launches], startWave: attack.startWave };
    };
  }

  function computerDefends(rng) {
    const ai = createAi(rng);
    const sender = createWarheadSender(pointer, rng, tuning);
    return () => ({ launches: [...ai.decide(observe(state)).launches, ...sender.read().launches], startWave: 0 });
  }

  function previewForHuman() {
    const aimed = pointer.position();
    const kind = isDefending ? 'interceptor' : 'warhead';
    const position = isDefending ? clampTarget(aimed) : aimed;
    const rejection = isDefending
      ? interceptorRejectionFor(state, interceptorRequest(position))
      : warheadRejectionFor(state, { free: false }, tuning);
    return {
      position,
      showsReach: isDefending,
      canFire: rejection === null,
      refusalLabel: rejection && REFUSAL[kind][rejection].label,
    };
  }

  function endRun() {
    isRunning = false;
    const humanWon = isDefending ? state.phase === PHASE.survived : state.phase === PHASE.citiesLost;
    if (humanWon) playWin();
    else playLose();
    overlay.show({ ...gameOverText(mode, state), actionLabel: 'Play again', levelPicker: true, onAction: startRun });
  }

  /** Refusals are only the human's: the computer checks the rules before it acts. */
  function announceEvents() {
    playEvents(state.events);
    state.events.forEach((event) => {
      if (event.type === EVENT.refused) hud.refuse(event);
      if (event.type === EVENT.waveStarted) hud.showHint(`Wave ${state.wave} incoming.`);
      if (event.type === EVENT.waveCleared) hud.showHint(`Wave cleared: +${event.bonus} bonus. Bases restocked.`);
    });
  }

  function announceLevel() {
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
    announceLevel();
    if (state.phase !== PHASE.playing) endRun();
  }

  function draw() {
    hud.update(state);
    overlay.setScore(hud.scoreLine(state));
    render(stage.context, { state, preview: isRunning ? previewForHuman() : null, colors });
  }

  const loop = createLoop({ update, render: draw });
  overlay.setScore(hud.scoreLine(state));
  overlay.show({ ...INTRO[mode.id], actionLabel: 'Start', levelPicker: true, onAction: startRun });
  loop.start();

  return {
    destroy() {
      loop.stop();
      keyboard.destroy();
      pointer.destroy();
      hud.destroy();
      overlay.destroy();
      stage.destroy();
    },
  };
}
