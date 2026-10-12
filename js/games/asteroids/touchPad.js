import { HEIGHT, TOUCH_PAD, WIDTH } from './config.js';

const COARSE_POINTER_QUERY = '(pointer: coarse)';

export const hasTouchScreen = () => typeof window !== 'undefined' && window.matchMedia?.(COARSE_POINTER_QUERY).matches === true;

function buttonAt(point) {
  const hit = TOUCH_PAD.buttons.find((button) => Math.hypot(point.x - button.x, point.y - TOUCH_PAD.y) <= TOUCH_PAD.radius);
  return hit?.id ?? null;
}

/**
 * Multi-touch buttons for flying without a keyboard. Each finger holds the button it is on and
 * may slide to another, so one thumb can steer while another fires.
 * `isVisible()` turns on for touch devices, or the first time anything but a mouse touches the canvas.
 */
export function createTouchPad(canvas) {
  const heldByPointer = new Map();
  let isVisible = hasTouchScreen();

  function toLogical(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * WIDTH,
      y: ((event.clientY - box.top) / box.height) * HEIGHT,
    };
  }

  function onDown(event) {
    if (event.pointerType !== 'mouse') isVisible = true;
    const id = buttonAt(toLogical(event));
    if (id) heldByPointer.set(event.pointerId, id);
  }

  function onMove(event) {
    if (!heldByPointer.has(event.pointerId)) return;
    const id = buttonAt(toLogical(event));
    if (id) heldByPointer.set(event.pointerId, id);
    else heldByPointer.delete(event.pointerId);
  }

  const onEnd = (event) => heldByPointer.delete(event.pointerId);

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onEnd);
  canvas.addEventListener('pointercancel', onEnd);

  const heldButtons = () => new Set(heldByPointer.values());

  return {
    isVisible: () => isVisible,
    /** The same shape a keyboard pilot gives: rotate -1|0|1, thrust, fire. */
    read() {
      const down = heldButtons();
      return { rotate: Number(down.has('right')) - Number(down.has('left')), thrust: down.has('thrust'), fire: down.has('fire') };
    },
    /** Buttons to draw, each with whether a finger is on it. */
    buttons() {
      const down = heldButtons();
      return TOUCH_PAD.buttons.map((button) => ({ ...button, y: TOUCH_PAD.y, radius: TOUCH_PAD.radius, isPressed: down.has(button.id) }));
    },
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onEnd);
      canvas.removeEventListener('pointercancel', onEnd);
    },
  };
}
