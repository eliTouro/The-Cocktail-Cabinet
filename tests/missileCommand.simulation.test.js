import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AI_SKILL, SURVIVE_SECONDS, TUNING } from '../js/games/missile-command/config.js';
import { PHASE } from '../js/games/missile-command/rules.js';
import { playClassicMode, playComputerMode } from './missileCommandSimulation.js';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const NOVICE = () => AI_SKILL(0);
const EXPERT = () => AI_SKILL(1e6);

const outcomes = (options) => SEEDS.map((seed) => playComputerMode({ seed, ...options }));
const countWhere = (states, phase) => states.filter((state) => state.phase === phase).length;
const killRate = (state) => state.warheadsDestroyed / state.warheadsSent;

test('even the novice defender makes real progress: it shoots down most warheads through the real rules', () => {
  outcomes({ skillAt: NOVICE }).forEach((state) => {
    assert.ok(state.warheadsDestroyed >= 20);
    assert.ok(killRate(state) > 0.5);
  });
});

test('the novice defender is beatable by a patient salvo attacker, but the game does not end instantly', () => {
  const games = outcomes({ skillAt: NOVICE });
  assert.ok(countWhere(games, PHASE.citiesLost) >= 4);
  games.forEach((state) => assert.ok(state.time > 30));
});

test('the expert defender is beatable under worst-case salvo launching, yet does not collapse', () => {
  const games = outcomes({ skillAt: EXPERT });
  assert.ok(countWhere(games, PHASE.citiesLost) >= 1, 'the attacker can still win');
  assert.ok(countWhere(games, PHASE.survived) >= 1, 'the defender can still win');
  games.forEach((state) => assert.ok(killRate(state) > 0.7));
});

test('with the real skill ramp, both sides win some games against worst-case attacking', () => {
  const games = outcomes({});
  assert.ok(countWhere(games, PHASE.citiesLost) >= 1);
  assert.ok(countWhere(games, PHASE.survived) >= 1);
});

test('the defender never breaks its ammo rules and the attacker never exceeds its caps', () => {
  const tuning = TUNING.computer();
  playComputerMode({
    seed: 3,
    onStep(state) {
      state.bases.forEach((base) => assert.ok(base.ammo >= 0 && base.ammo <= tuning.ammoPerBase));
      assert.ok(state.warheads.length <= tuning.maxWarheads);
      assert.ok(state.budget >= 0 && state.budget <= tuning.budgetCap);
    },
  });
});

test('a game ends by the survival time at the latest', () => {
  assert.ok(playComputerMode({ seed: 5, skillAt: EXPERT }).time <= SURVIVE_SECONDS + 0.1);
});

test('the defender AI can also hold a classic wave game: waves clear, score accrues, cities stand', () => {
  const games = SEEDS.slice(0, 4).map((seed) => playClassicMode({ seed }));
  games.forEach((state) => {
    assert.ok(state.wave >= 4);
    assert.ok(state.score > 0);
  });
  assert.ok(games.filter((state) => state.phase === PHASE.playing).length >= 3);
});
