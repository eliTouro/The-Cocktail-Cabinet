import { FLOOR_Y, PLACER_KEY_SPEED, SPAWN_X } from './config.js';
import { canPlaceColumn, centerRange, maxCenterShift } from './rules.js';

const FLAP_KEYS = ['Space', 'ArrowUp'];
const COLUMN_KEYS = ['Space', 'Enter'];
const FAIR_SHIFT_SHARE = 0.8;

/** Human pilot: Space, Up, click or tap asks for a flap. */
export function createFlapInput(keyboard, pointer) {
  return {
    read() {
      const keyed = FLAP_KEYS.map((code) => keyboard.consumeTap(code)).some(Boolean);
      const pressed = pointer.consumePress() !== null;
      return { flap: keyed || pressed, column: null };
    },
  };
}

/** Classic mode's course builder: random gaps that stay well inside what the rules allow. */
export function createColumnGenerator(rng) {
  return {
    read(state, tuning) {
      if (!canPlaceColumn(state)) return null;
      const previous = state.columns[state.columns.length - 1];
      const range = centerRange(tuning.gapSize);
      if (!previous) return rng.range(range.low, range.high);
      const reach = maxCenterShift(SPAWN_X - previous.x, previous.gapSize, tuning.gapSize) * FAIR_SHIFT_SHARE;
      return previous.gapCenter + rng.range(-reach, reach);
    },
  };
}

/**
 * Human course builder for the flipped mode. Mouse or touch position, or Up/Down, picks the gap's
 * centre; click, tap, Space or Enter sends the next column there. The rules clamp it to passable.
 */
export function createColumnPlacer(keyboard, pointer) {
  let aim = FLOOR_Y / 2;
  let lastPointerY = pointer.position().y;

  function followPointer() {
    const { y } = pointer.position();
    if (y !== lastPointerY) aim = y;
    lastPointerY = y;
  }

  function followKeys(dt) {
    const direction = Number(keyboard.isDown('ArrowDown')) - Number(keyboard.isDown('ArrowUp'));
    aim = Math.min(Math.max(aim + direction * PLACER_KEY_SPEED * dt, 0), FLOOR_Y);
  }

  return {
    aim: () => aim,
    read(dt) {
      followPointer();
      followKeys(dt);
      const press = pointer.consumePress();
      if (press) aim = press.y;
      const keyed = COLUMN_KEYS.map((code) => keyboard.consumeTap(code)).some(Boolean);
      return { flap: false, column: press || keyed ? aim : null };
    },
  };
}
