import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ramp } from '../js/core/difficulty.js';
import { createRng } from '../js/core/rng.js';

test('ramp climbs linearly then holds', () => {
  assert.equal(ramp(1, 5, 10, 0), 1);
  assert.equal(ramp(1, 5, 10, 5), 3);
  assert.equal(ramp(1, 5, 10, 99), 5);
});

test('rng is repeatable for a given seed and stays in range', () => {
  const first = createRng(42);
  const second = createRng(42);
  for (let i = 0; i < 100; i += 1) {
    const value = first.next();
    assert.equal(value, second.next());
    assert.ok(value >= 0 && value < 1);
  }
  assert.ok(createRng(1).int(3, 7) >= 3);
});
