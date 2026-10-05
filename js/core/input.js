const KEYS_THAT_SCROLL_THE_PAGE = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

/**
 * Keyboard state by `KeyboardEvent.code` (e.g. 'ArrowLeft', 'KeyA', 'Space').
 * isDown(code): is the key held right now.
 * consumeTap(code): true once per fresh key press, then false until pressed again.
 */
export function createKeyboard(target = window) {
  const held = new Set();
  const tapped = new Set();

  function onKeyDown(event) {
    if (KEYS_THAT_SCROLL_THE_PAGE.has(event.code)) event.preventDefault();
    if (!held.has(event.code)) tapped.add(event.code);
    held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onBlur() {
    held.clear();
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  return {
    isDown: (code) => held.has(code),
    consumeTap: (code) => tapped.delete(code),
    destroy() {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}

/**
 * Mouse/touch position in the canvas's logical units, plus click/tap detection.
 * position(): { x, y } of the last pointer location.
 * consumePress(): { x, y } once per press (mouse down or touch), otherwise null.
 */
export function createPointer(canvas, { width, height }) {
  let position = { x: width / 2, y: height / 2 };
  let pendingPress = null;

  function toLogical(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * width,
      y: ((event.clientY - box.top) / box.height) * height,
    };
  }

  function onMove(event) {
    position = toLogical(event);
  }

  function onDown(event) {
    position = toLogical(event);
    pendingPress = position;
  }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);

  return {
    position: () => ({ ...position }),
    consumePress() {
      const press = pendingPress;
      pendingPress = null;
      return press;
    },
    destroy() {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    },
  };
}
