import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_COUNT, clampLevel, elapsedAtLevel, levelAt, startLevelFromUrl } from '../js/core/level.js';
import { EFFECTS, isMuted, play, setMuted } from '../js/core/sound.js';
import { parseHash } from '../js/router.js';

test('levels clamp into 1..LEVEL_COUNT and ignore junk', () => {
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel(99), LEVEL_COUNT);
  assert.equal(clampLevel('abc'), 1);
  assert.equal(clampLevel('7'), 7);
});

test('the level in the address is read after the mode', () => {
  assert.equal(startLevelFromUrl('#/snake/human?level=8'), 8);
  assert.equal(startLevelFromUrl('#/snake/human'), 1);
  assert.equal(startLevelFromUrl('#/snake/human?level=500'), LEVEL_COUNT);
});

test('a route keeps its game and mode when a level is added', () => {
  assert.deepEqual(parseHash('#/snake/human?level=8'), { gameId: 'snake', modeId: 'human' });
});

test('elapsedAtLevel and levelAt agree, and the last level is reached at the end of the ramp', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    assert.equal(levelAt(elapsedAtLevel(level, 120), 120), level);
  }
  assert.equal(elapsedAtLevel(1, 120), 0);
  assert.equal(elapsedAtLevel(LEVEL_COUNT, 120), 120);
  assert.equal(levelAt(10_000, 120), LEVEL_COUNT);
});

test('every shared sound effect is a valid recipe', () => {
  const waves = new Set(['square', 'sine', 'triangle', 'sawtooth', 'noise']);
  for (const [name, voices] of Object.entries(EFFECTS)) {
    assert.ok(voices.length > 0, name);
    for (const voice of voices) {
      assert.ok(waves.has(voice.wave), `${name} wave`);
      assert.ok(voice.from > 0 && voice.to > 0 && voice.seconds > 0, `${name} numbers`);
    }
  }
});

test('playing a sound without an audio device is a safe no-op, and mute is remembered', () => {
  setMuted(false);
  assert.doesNotThrow(() => play('click'));
  setMuted(true);
  assert.equal(isMuted(), true);
  setMuted(false);
});
