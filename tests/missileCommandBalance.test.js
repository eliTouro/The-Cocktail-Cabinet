import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_COUNT } from '../js/core/level.js';
import { PHASE } from '../js/games/missile-command/rules.js';
import { playAttackMode, playDefendMode } from './missileCommandSimulation.js';

/*
 * Both roles are played by software through the same rules a person uses, so these numbers say how
 * a typical person fares on each side. "Defending" is the human-mode side (a defender against waves);
 * "attacking" is the computer-mode side (an attacker against the computer's defender). Seeds are
 * fixed, so the rates are repeatable; the bands only have to hold when someone retunes the game.
 */
const ROUNDS_PER_LEVEL = 40;
const seeds = Array.from({ length: ROUNDS_PER_LEVEL }, (_, index) => index + 1);

const shareOf = (runs, isWin) => runs.filter(isWin).length / runs.length;

function winRates(level) {
  return {
    defending: shareOf(seeds.map((seed) => playDefendMode({ seed, level })), (run) => run.phase === PHASE.survived),
    attacking: shareOf(seeds.map((seed) => playAttackMode({ seed, level })), (run) => run.phase === PHASE.citiesLost),
  };
}

const atLevel = { 1: winRates(1), 5: winRates(5), [LEVEL_COUNT]: winRates(LEVEL_COUNT) };

test('level 1 is easy: the person wins clearly on both sides, but not every time', () => {
  for (const [side, rate] of Object.entries(atLevel[1])) {
    assert.ok(rate >= 0.65 && rate <= 0.95, `${side} won ${rate}`);
  }
});

test('mid levels are balanced: neither side wins nearly always or nearly never', () => {
  for (const [side, rate] of Object.entries(atLevel[5])) {
    assert.ok(rate > 0.25 && rate < 0.75, `${side} won ${rate}`);
  }
});

test('the last level is hard but still winnable on both sides', () => {
  for (const [side, rate] of Object.entries(atLevel[LEVEL_COUNT])) {
    assert.ok(rate >= 0.1 && rate <= 0.5, `${side} won ${rate}`);
  }
});

test('each side gets harder as the level rises', () => {
  for (const side of ['defending', 'attacking']) {
    assert.ok(atLevel[1][side] > atLevel[5][side] && atLevel[5][side] > atLevel[LEVEL_COUNT][side], side);
  }
});
