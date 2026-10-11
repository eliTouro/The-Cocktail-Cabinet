import { FIELD } from './config.js';
import { wallBounds } from './rules.js';

const LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const LAUNCH_KEYS = ['Space', 'ArrowUp', 'KeyW'];

/**
 * The wall's rail is much shorter than the screen, so the pointer's position across the whole
 * screen is spread over the rail instead of leaving most of the screen stuck at one end.
 */
export function railPosition(pointerX) {
  const { min, max } = wallBounds();
  const share = Math.min(Math.max(pointerX / FIELD.width, 0), 1);
  return min + share * (max - min);
}

/**
 * Turns pointer and keyboard into one control: { target, direction, launch }.
 * The pointer steers (target x) once it moves; held arrow/A-D keys take over until it moves again.
 * The same control drives the paddle in human mode and the wall in computer mode.
 */
export function createHumanControls({ pointer, keyboard }) {
  let lastPointerX = pointer.position().x;
  let usingPointer = false;

  const anyDown = (codes) => codes.some((code) => keyboard.isDown(code));
  const anyTapped = (codes) => codes.map((code) => keyboard.consumeTap(code)).some(Boolean);

  function read() {
    const direction = (anyDown(RIGHT_KEYS) ? 1 : 0) - (anyDown(LEFT_KEYS) ? 1 : 0);
    const pointerX = pointer.position().x;
    if (direction !== 0) usingPointer = false;
    else if (pointerX !== lastPointerX) usingPointer = true;
    lastPointerX = pointerX;

    const launched = anyTapped(LAUNCH_KEYS) || pointer.consumePress() !== null;
    return { target: usingPointer ? pointerX : null, direction, launch: launched };
  }

  // Drops key taps and clicks made on the overlay so a new game does not launch by itself.
  function reset() {
    anyTapped(LAUNCH_KEYS);
    pointer.consumePress();
  }

  return { read, reset };
}
