import { createCanvas } from '../core/canvas.js';
import { createKeyboard, createPointer } from '../core/input.js';
import { createLoop } from '../core/loop.js';
import { createOverlay } from '../core/overlay.js';
import { createRng } from '../core/rng.js';
import { createAi } from './asteroids/ai.js';
import { HEIGHT, SENDER_PANEL, SIZE_KEYS, SURVIVE_SECONDS, TUNING, WIDTH } from './asteroids/config.js';
import { createRockSender, createShipInput, createWaveGenerator } from './asteroids/controllers.js';
import { nearestEdgePoint } from './asteroids/geometry.js';
import { TONE_COLORS, render } from './asteroids/render.js';
import { PHASE, createState, launchToward, observe, spawnRejection, step } from './asteroids/rules.js';

const INTRO = {
  human: {
    title: 'Asteroids',
    detail: 'Left and Right (or A and D) rotate, Up (or W) thrusts, Space fires. Shoot the rocks: each hit splits a hexagon into two squares, a square into two triangles, and a triangle into nothing. You have 3 lives and a short shield after each crash.',
  },
  computer: {
    title: 'Send the asteroids',
    detail: `The computer flies the ship. Press 1, 2 or 3 (or tap a size button) to pick a triangle, square or hexagon, then click or tap the field to launch it from the nearest edge toward that spot. Bigger rocks cost more of your refilling budget, and none can start near the ship. Destroy its 3 lives before it survives ${SURVIVE_SECONDS} seconds.`,
  },
};

function gameOverText(mode, state) {
  if (mode.id === 'human') {
    return { title: 'Ship lost', detail: `You scored ${state.score} and destroyed ${state.rocksDestroyed} rocks.` };
  }
  if (state.phase === PHASE.lost) {
    return { title: 'Ship destroyed. You win', detail: `You took all 3 lives in ${Math.round(state.time)} seconds with ${state.rocksSent} rocks.` };
  }
  return { title: 'The ship survived', detail: `It outlasted ${SURVIVE_SECONDS} seconds and shot down ${state.rocksDestroyed} rocks. Aim your next sends better.` };
}

function scoreText(mode, state, waves) {
  if (mode.id === 'human') return `Score ${state.score} · Lives ${Math.max(state.lives, 0)} · Wave ${waves.wave()}`;
  return `Ship lives ${Math.max(state.lives, 0)} · Survived ${Math.floor(state.time)} / ${SURVIVE_SECONDS} s`;
}

export function mount(container, { mode }) {
  const isHumanFlying = mode.id === 'human';
  const stage = createCanvas(container, { width: WIDTH, height: HEIGHT });
  const overlay = createOverlay(container);
  const keyboard = createKeyboard();
  const pointer = createPointer(stage.canvas, { width: WIDTH, height: HEIGHT });
  const tuning = TUNING[mode.id]();
  const colors = isHumanFlying
    ? { shipColor: TONE_COLORS.human, rockColor: TONE_COLORS.rock }
    : { shipColor: TONE_COLORS.computer, rockColor: TONE_COLORS.human };
  const surviveSeconds = isHumanFlying ? null : SURVIVE_SECONDS;

  let state = createState({ surviveSeconds });
  let isRunning = false;
  let readInput = () => ({ rotate: 0, thrust: false, fire: false, spawns: [] });
  let readPreview = () => null;
  let waves = createWaveGenerator(createRng());

  function discardPendingInput() {
    pointer.consumePress();
    ['Space', ...SIZE_KEYS].forEach((code) => keyboard.consumeTap(code));
  }

  function startRun() {
    const rng = createRng();
    state = createState({ surviveSeconds });
    waves = createWaveGenerator(rng);
    discardPendingInput();
    overlay.hide();
    overlay.setScore(scoreText(mode, state, waves));
    isRunning = true;
    ({ readInput, readPreview } = isHumanFlying ? humanFlies() : computerFlies(rng));
  }

  function humanFlies() {
    const shipInput = createShipInput(keyboard);
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
    const isOverPlayfield = target.y < SENDER_PANEL.top;
    return {
      tier: sender.tier(),
      from: nearestEdgePoint(target),
      target,
      canSend: isOverPlayfield && spawnRejection(state, launch, tuning) === null,
      budget: state.budget,
      budgetCap: tuning.budgetCap,
      cooldownRatio: state.sendCooldown / tuning.sendCooldown,
    };
  }

  function endRun() {
    isRunning = false;
    const { title, detail } = gameOverText(mode, state);
    overlay.show({ title, detail, actionLabel: 'Play again', onAction: startRun });
  }

  function update(dt) {
    if (!isRunning) return;
    step(state, readInput(), dt, tuning);
    overlay.setScore(scoreText(mode, state, waves));
    if (state.phase !== PHASE.playing) endRun();
  }

  function draw() {
    const preview = isRunning ? readPreview() : null;
    render(stage.context, { state, preview, ...colors });
  }

  const loop = createLoop({ update, render: draw });
  overlay.setScore(scoreText(mode, state, waves));
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
