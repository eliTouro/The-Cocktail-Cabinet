import {
  HEIGHT, LARGEST_TIER, NUMPAD_SIZE_KEYS, ROCK_TIERS, SAFE_RADIUS, SENDER_PANEL, SIZE_KEYS, WAVE, WAVE_PAUSE, WIDTH,
} from './config.js';
import { wrappedDistance } from './geometry.js';
import { difficultyClock, launchToward } from './rules.js';

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const THRUST_KEYS = ['ArrowUp', 'KeyW'];
const FIRE_KEYS = ['Space'];
const WAVE_ENTRY_SPREAD = 0.5;
const MAX_PLACEMENT_TRIES = 20;

const anyDown = (keyboard, codes) => codes.some((code) => keyboard.isDown(code));

/** Human pilot: arrows or WASD rotate and thrust, Space fires; touch buttons do the same on a phone. */
export function createShipInput(keyboard, touchPad) {
  return {
    read() {
      const touch = touchPad.read();
      const rotate = Number(anyDown(keyboard, RIGHT_KEYS)) - Number(anyDown(keyboard, LEFT_KEYS)) + touch.rotate;
      return {
        rotate: Math.sign(rotate),
        thrust: anyDown(keyboard, THRUST_KEYS) || touch.thrust,
        fire: anyDown(keyboard, FIRE_KEYS) || touch.fire,
        spawns: [],
      };
    },
  };
}

export function sizeButtonBox(tier) {
  const { left, top, buttonWidth, buttonHeight, buttonGap } = SENDER_PANEL;
  return { x: left, y: top + tier * (buttonHeight + buttonGap), width: buttonWidth, height: buttonHeight };
}

/** The size button under a point on the field, or null when the point is on open playfield. */
export function tierAt(point) {
  const tier = ROCK_TIERS.findIndex((_, index) => {
    const box = sizeButtonBox(index);
    return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
  });
  return tier === -1 ? null : tier;
}

/**
 * Human sender for computer mode. Keys 1-3 (or the on-canvas buttons) pick the rock size; a click
 * or tap on the playfield launches that rock from the nearest screen edge toward the click.
 * The rules still enforce budget, cooldown, safe radius and the rock cap.
 */
export function createRockSender(keyboard, pointer) {
  let tier = 1;

  function pickSizeFromKeys() {
    [SIZE_KEYS, NUMPAD_SIZE_KEYS].forEach((codes) => {
      codes.forEach((code, index) => {
        if (keyboard.consumeTap(code)) tier = index;
      });
    });
  }

  return {
    tier: () => tier,
    read(tuning) {
      pickSizeFromKeys();
      const press = pointer.consumePress();
      const buttonTier = press ? tierAt(press) : null;
      if (buttonTier !== null) tier = buttonTier;
      const isLaunch = press && buttonTier === null;
      const spawns = isLaunch ? [launchToward(press, tier, tuning.rockSpeed)] : [];
      return { rotate: 0, thrust: false, fire: false, spawns };
    },
  };
}

function edgeStart(rng, ship) {
  for (let attempt = 0; attempt < MAX_PLACEMENT_TRIES; attempt += 1) {
    const alongX = rng.next() < 0.5;
    const point = alongX
      ? { x: rng.range(0, WIDTH), y: rng.next() < 0.5 ? 0 : HEIGHT }
      : { x: rng.next() < 0.5 ? 0 : WIDTH, y: rng.range(0, HEIGHT) };
    if (wrappedDistance(point, ship) > SAFE_RADIUS + ROCK_TIERS[LARGEST_TIER].radius) return point;
  }
  return { x: 0, y: 0 };
}

/** Classic mode's rock supplier: when the field is clear, a new wave of large rocks drifts in from the edges. */
export function createWaveGenerator(rng) {
  let wave = 0;
  let nextWaveTime = WAVE_PAUSE;

  function buildWave(state) {
    const { count, speed } = WAVE(difficultyClock(state));
    return Array.from({ length: count }, () => {
      const start = edgeStart(rng, state.ship);
      const heading = Math.atan2(HEIGHT / 2 - start.y, WIDTH / 2 - start.x) + rng.range(-WAVE_ENTRY_SPREAD, WAVE_ENTRY_SPREAD);
      return { tier: LARGEST_TIER, ...start, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed, free: true };
    });
  }

  return {
    wave: () => wave,
    read(state) {
      if (!state.ship.alive) return [];
      if (state.rocks.length > 0) {
        nextWaveTime = state.time + WAVE_PAUSE;
        return [];
      }
      if (state.time < nextWaveTime) return [];
      wave += 1;
      return buildWave(state);
    },
  };
}
