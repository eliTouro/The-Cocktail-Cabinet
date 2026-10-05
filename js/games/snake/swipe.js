const MIN_SWIPE_PIXELS = 24;

/** Turns a finger or mouse drag across the canvas into 'up' | 'down' | 'left' | 'right'. */
export function createSwipe(canvas, onSwipe) {
  let start = null;

  function onDown(event) {
    start = { x: event.clientX, y: event.clientY };
  }

  function onUp(event) {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE_PIXELS) return;
    if (Math.abs(dx) > Math.abs(dy)) onSwipe(dx > 0 ? 'right' : 'left');
    else onSwipe(dy > 0 ? 'down' : 'up');
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);

  return {
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    },
  };
}
