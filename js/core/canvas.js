import { h } from '../dom.js';

/**
 * Adds a canvas with a fixed logical size (e.g. 640x480) to `container`. CSS scales it to fill
 * the stage; the backing store is scaled by devicePixelRatio so lines stay crisp. Draw in
 * logical units: (0,0) is the top-left, (width,height) the bottom-right.
 */
export function createCanvas(container, { width, height }) {
  const canvas = h('canvas', { class: 'game-canvas' });
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  container.append(canvas);

  return { canvas, context, width, height, destroy: () => canvas.remove() };
}
