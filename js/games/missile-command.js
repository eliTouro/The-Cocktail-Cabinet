import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { createAi } from './missile-command/ai.js';
import {
  BASE_KEYS, HEIGHT, NUMPAD_BASE_KEYS, SURVIVE_SECONDS, TONE_COLORS, TUNING, WIDTH,
} from './missile-command/config.js';
import { createDefenderInput, createWarheadSender, createWaveGenerator } from './missile-command/controllers.js';
import { render } from './missile-command/render.js';
import {
  PHASE, createState, interceptorRejectionFor, interceptorRequest, observe, step, warheadRejectionFor,
} from './missile-command/rules.js';

const INTRO = {
  human: {
    title: 'Missile Command',
    detail: 'Warheads fall on your six cities. Click or tap the sky to fire a counter-missile from the nearest base with ammo, or press 1, 2 or 3 to fire from that base at the pointer. It bursts where you aim and the blast grows then fades, destroying any warhead it touches, so lead your targets. Each base holds 10 missiles and reloads between waves. Lose every city and it is over.',
  },
  computer: {
    title: 'Launch the attack',
    detail: `The computer defends. Click or tap anywhere to send a warhead from the top edge toward that spot on the ground. You have a refilling launch budget, a short cooldown and at most 9 warheads in the air. Destroy all 6 cities before the defender survives ${SURVIVE_SECONDS} seconds. Its bases hold limited ammo, so make it spend.`,
  },
};

const COLORS = {
  human: { defender: TONE_COLORS.human, attacker: TONE_COLORS.warhead, crosshair: TONE_COLORS.human },
  computer: { defender: TONE_COLORS.computer, attacker: TONE_COLORS.human, crosshair: TONE_COLORS.human },
};

const standing = (state) => state.cities.filter((city) => city.alive).length;
const ammoLine = (state) => state.bases.map((base) => (base.alive ? base.ammo : 'X')).join(' | ');

function gameOverText(mode, state) {
  if (mode.id === 'human') {
    return { title: 'The cities have fallen', detail: `You reached wave ${state.wave} and scored ${state.score}, stopping ${state.warheadsDestroyed} warheads.` };
  }
  if (state.phase === PHASE.citiesLost) {
    return { title: 'All cities destroyed. You win', detail: `You levelled them in ${Math.round(state.time)} seconds with ${state.warheadsSent} warheads.` };
  }
  return { title: 'The defender held', detail: `${standing(state)} of 6 cities survived ${SURVIVE_SECONDS} seconds. It shot down ${state.warheadsDestroyed} of your ${state.warheadsSent} warheads.` };
}

function scoreText(mode, state) {
  if (mode.id === 'human') return `Score ${state.score} · Wave ${state.wave} · Cities ${standing(state)}/6 · Ammo ${ammoLine(state)}`;
  return `Cities ${standing(state)}/6 · Survived ${Math.floor(state.time)} / ${SURVIVE_SECONDS} s · Launches ${Math.floor(state.budget)} · Defender ammo ${ammoLine(state)}`;
}

export function mount(container, { mode }) {
  const isHumanDefending = mode.id === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const tuning = TUNING[mode.id]();
  const colors = COLORS[mode.id];
  const surviveSeconds = isHumanDefending ? null : SURVIVE_SECONDS;

  let state = createState(tuning, { surviveSeconds });
  let isRunning = false;
  let readInput = () => ({ launches: [], startWave: 0 });

  function discardPendingInput() {
    pointer.consumePress();
    [...BASE_KEYS, ...NUMPAD_BASE_KEYS].forEach((code) => keyboard.consumeTap(code));
  }

  function startRun() {
    const rng = createRng();
    state = createState(tuning, { surviveSeconds });
    discardPendingInput();
    overlay.hide();
    overlay.setScore(scoreText(mode, state));
    isRunning = true;
    readInput = isHumanDefending ? humanDefends(rng) : computerDefends(rng);
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
    const position = pointer.position();
    const rejection = isHumanDefending
      ? interceptorRejectionFor(state, interceptorRequest(position))
      : warheadRejectionFor(state, { free: false }, tuning);
    return { position, canFire: rejection === null, budget: state.budget, budgetCap: tuning.budgetCap };
  }

  function endRun() {
    isRunning = false;
    overlay.show({ ...gameOverText(mode, state), actionLabel: 'Play again', onAction: startRun });
  }

  function update(dt) {
    if (!isRunning) return;
    step(state, readInput(), dt, tuning);
    overlay.setScore(scoreText(mode, state));
    if (state.phase !== PHASE.playing) endRun();
  }

  function draw() {
    render(stage.context, { state, preview: isRunning ? previewForHuman() : null, colors });
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
