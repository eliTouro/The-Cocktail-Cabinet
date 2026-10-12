import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEIGHT, TOUCH_PAD, WIDTH } from '../js/games/asteroids/config.js';
import { createTouchPad } from '../js/games/asteroids/touchPad.js';

/** A canvas stand-in whose logical size equals its on-screen size, with handlers we can fire by hand. */
function fakeCanvas() {
  const handlers = {};
  return {
    addEventListener: (type, handler) => { handlers[type] = handler; },
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT }),
    fire: (type, event) => handlers[type](event),
  };
}

const centreOf = (id) => ({ clientX: TOUCH_PAD.buttons.find((button) => button.id === id).x, clientY: TOUCH_PAD.y });
const touch = (pointerId, id) => ({ pointerId, pointerType: 'touch', ...centreOf(id) });

test('two fingers can steer and fire at the same time, and lifting a finger releases its button', () => {
  const canvas = fakeCanvas();
  const pad = createTouchPad(canvas);
  canvas.fire('pointerdown', touch(1, 'left'));
  canvas.fire('pointerdown', touch(2, 'fire'));
  assert.deepEqual(pad.read(), { rotate: -1, thrust: false, fire: true });
  canvas.fire('pointerup', { pointerId: 1 });
  assert.deepEqual(pad.read(), { rotate: 0, thrust: false, fire: true });
});

test('a finger sliding from one button to another switches buttons, and off every button releases', () => {
  const canvas = fakeCanvas();
  const pad = createTouchPad(canvas);
  canvas.fire('pointerdown', touch(1, 'left'));
  canvas.fire('pointermove', touch(1, 'right'));
  assert.equal(pad.read().rotate, 1);
  canvas.fire('pointermove', { pointerId: 1, clientX: WIDTH / 2, clientY: 10 });
  assert.equal(pad.read().rotate, 0);
});

test('the pad appears the first time a finger, not a mouse, touches the canvas', () => {
  const canvas = fakeCanvas();
  const pad = createTouchPad(canvas);
  assert.equal(pad.isVisible(), false);
  canvas.fire('pointerdown', { pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 });
  assert.equal(pad.isVisible(), false);
  canvas.fire('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 0, clientY: 0 });
  assert.equal(pad.isVisible(), true);
});
