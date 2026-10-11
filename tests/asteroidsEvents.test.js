import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEP_SECONDS } from '../js/core/loop.js';
import { ROCK_TIERS, SAFE_RADIUS, SHIP, TUNING } from '../js/games/asteroids/config.js';
import {
  EVENT, PHASE, SPAWN_REJECTION, createRock, createState, launchToward, step,
} from '../js/games/asteroids/rules.js';
import { soundForEvent } from '../js/games/asteroids/sounds.js';
import { REFUSAL } from '../js/games/asteroids/texts.js';

const STEP = STEP_SECONDS;
const HUMAN = TUNING.human();
const COMPUTER = TUNING.computer();
const IDLE = { rotate: 0, thrust: false, fire: false, spawns: [] };
const typesOf = (state) => state.events.map((event) => event.type);

test('firing, destroying a rock and getting hit each report an event, once, on the step they happen', () => {
  const state = createState();
  state.ship.invulnerable = 0;
  state.rocks.push(createRock(state, { tier: 1, x: 100, y: 100, vx: 0, vy: 0 }));
  state.bullets.push({ x: 100, y: 100, vx: 0, vy: 0, age: 0 });
  step(state, { ...IDLE, fire: true }, STEP, HUMAN);
  assert.deepEqual(typesOf(state).sort(), [EVENT.rockDestroyed, EVENT.shot].sort());
  assert.equal(state.events.find((event) => event.type === EVENT.rockDestroyed).tier, 1);

  step(state, IDLE, STEP, HUMAN);
  assert.deepEqual(typesOf(state), []);
});

test('losing a life reports a ship-hit, and the respawn reports its own event', () => {
  const state = createState();
  state.ship.invulnerable = 0;
  state.rocks.push(createRock(state, { tier: 2, x: state.ship.x, y: state.ship.y, vx: 0, vy: 0 }));
  step(state, IDLE, STEP, HUMAN);
  assert.deepEqual(typesOf(state), [EVENT.shipHit]);
  state.rocks = [];
  let sawRespawn = false;
  for (let tick = 0; tick < (SHIP.respawnDelay / STEP) + 5; tick += 1) {
    step(state, IDLE, STEP, HUMAN);
    sawRespawn ||= typesOf(state).includes(EVENT.shipRespawned);
  }
  assert.ok(sawRespawn);
});

test('a launch reports the rock sent, and a refused launch reports why', () => {
  const state = createState({ budget: 1 });
  const far = launchToward({ x: 60, y: 60 }, 0, COMPUTER.rockSpeed);
  step(state, { ...IDLE, spawns: [far] }, STEP, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.rockLaunched, tier: 0 }]);

  step(state, { ...IDLE, spawns: [far] }, STEP, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.launchRefused, reason: SPAWN_REJECTION.cooldown }]);

  state.sendCooldown = 0;
  state.budget = 0;
  step(state, { ...IDLE, spawns: [far] }, STEP, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.launchRefused, reason: SPAWN_REJECTION.budget }]);

  const near = { ...far, x: state.ship.x + SAFE_RADIUS - 1, y: state.ship.y };
  state.budget = 3;
  step(state, { ...IDLE, spawns: [near] }, STEP, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.launchRefused, reason: SPAWN_REJECTION.nearShip }]);
});

test('free spawns (waves) that cannot fit stay silent instead of raising a refusal', () => {
  const state = createState();
  const wave = { ...launchToward({ x: 60, y: 60 }, 2, 40), free: true, x: state.ship.x, y: state.ship.y };
  step(state, { ...IDLE, spawns: [wave] }, STEP, HUMAN);
  assert.deepEqual(typesOf(state), []);
});

test('every reason a launch can be refused has a hint, a short label and a known meter', () => {
  Object.values(SPAWN_REJECTION).forEach((reason) => {
    const text = REFUSAL[reason];
    assert.ok(text.hint.length > 0 && text.short.length > 0, reason);
    assert.ok(text.meter === null || ['budget', 'reload'].includes(text.meter), reason);
  });
});

test('the sender starts with the budget the round gives it', () => {
  assert.equal(createState({ budget: COMPUTER.startingBudget }).budget, COMPUTER.startingBudget);
  assert.ok(COMPUTER.startingBudget >= ROCK_TIERS[0].sendCost);
});

test('every kind of event has a sound', () => {
  const samples = [
    { type: EVENT.shot },
    { type: EVENT.rockDestroyed, tier: 0 },
    { type: EVENT.rockDestroyed, tier: 1 },
    { type: EVENT.rockDestroyed, tier: 2 },
    { type: EVENT.rockLaunched, tier: 1 },
    { type: EVENT.launchRefused, reason: SPAWN_REJECTION.budget },
    { type: EVENT.shipHit },
    { type: EVENT.shipRespawned },
  ];
  samples.forEach((event) => assert.ok(soundForEvent(event), event.type));
  assert.equal(soundForEvent({ type: 'unknown' }), null);
});

test('a ship that loses its last life on the survival deadline has lost, not won', () => {
  const state = createState({ surviveSeconds: 1 });
  state.ship.invulnerable = 0;
  state.lives = 1;
  state.time = 1 - STEP / 2;
  state.rocks.push(createRock(state, { tier: 2, x: state.ship.x, y: state.ship.y, vx: 0, vy: 0 }));
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.phase, PHASE.lost);
});
