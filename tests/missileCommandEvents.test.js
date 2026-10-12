import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEP_SECONDS } from '../js/core/loop.js';
import { BASE_XS, BLAST, GROUND_Y, IMPACT_RADIUS, TUNING } from '../js/games/missile-command/config.js';
import {
  EVENT, REJECTION, createBlast, createState, groundTarget, interceptorRequest, step, warheadRequest,
} from '../js/games/missile-command/rules.js';
import { soundForEvent } from '../js/games/missile-command/sounds.js';
import { REFUSAL } from '../js/games/missile-command/texts.js';

const HUMAN = TUNING.human();
const COMPUTER = TUNING.computer();
const NOTHING = { launches: [], startWave: 0 };

const typesOf = (state) => state.events.map((event) => event.type);

function run(state, seconds, tuning, input = NOTHING) {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP_SECONDS) step(state, input, STEP_SECONDS, tuning);
}

function freeWarhead(x, speed = 50) {
  return warheadRequest({ x, y: 0 }, groundTarget(x), speed, { free: true });
}

test('firing a counter-missile reports a shot now and a detonation when it arrives', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: BASE_XS[1], y: GROUND_Y - 60 })], startWave: 0 }, STEP_SECONDS, HUMAN);
  assert.deepEqual(typesOf(state), [EVENT.interceptorFired]);
  const seen = [];
  for (let elapsed = 0; elapsed < 0.5; elapsed += STEP_SECONDS) {
    step(state, NOTHING, STEP_SECONDS, HUMAN);
    seen.push(...typesOf(state));
  }
  assert.deepEqual(seen, [EVENT.detonation]);
});

test('events cover one step only', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 })], startWave: 0 }, STEP_SECONDS, HUMAN);
  step(state, NOTHING, STEP_SECONDS, HUMAN);
  assert.deepEqual(state.events, []);
});

test('a click with every base empty reports a no-ammo refusal; one during a cooldown reports a cooldown refusal', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 })], startWave: 0 }, STEP_SECONDS, HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 }, 1)], startWave: 0 }, STEP_SECONDS, HUMAN);
  assert.deepEqual(state.events, [{ type: EVENT.refused, kind: 'interceptor', reason: REJECTION.cooldown }]);
  state.bases.forEach((base) => { base.ammo = 0; });
  run(state, 1, HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 })], startWave: 0 }, STEP_SECONDS, HUMAN);
  assert.deepEqual(state.events, [{ type: EVENT.refused, kind: 'interceptor', reason: REJECTION.noAmmo }]);
});

test('sending a warhead reports a launch; a refused send says why', () => {
  const state = createState(COMPUTER);
  const send = warheadRequest({ x: 100, y: 0 }, groundTarget(300), COMPUTER.warheadSpeed);
  step(state, { launches: [send], startWave: 0 }, STEP_SECONDS, COMPUTER);
  assert.deepEqual(typesOf(state), [EVENT.warheadLaunched]);
  step(state, { launches: [send], startWave: 0 }, STEP_SECONDS, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.refused, kind: 'warhead', reason: REJECTION.cooldown }]);
  state.budget = 0;
  run(state, COMPUTER.launchCooldown + 0.05, COMPUTER);
  state.budget = 0;
  step(state, { launches: [send], startWave: 0 }, STEP_SECONDS, COMPUTER);
  assert.deepEqual(state.events, [{ type: EVENT.refused, kind: 'warhead', reason: REJECTION.budget }]);
});

test('the defender firing never makes the attacker\'s launch in the same step wait, and the reverse', () => {
  const state = createState(COMPUTER);
  const shot = interceptorRequest({ x: 300, y: 200 });
  const send = warheadRequest({ x: 100, y: 0 }, groundTarget(300), COMPUTER.warheadSpeed);
  step(state, { launches: [shot, send], startWave: 0 }, STEP_SECONDS, COMPUTER);
  assert.deepEqual(typesOf(state), [EVENT.interceptorFired, EVENT.warheadLaunched]);
});

test('a blast destroying a warhead is reported, and the warhead\'s own explosion follows', () => {
  const state = createState(HUMAN);
  step(state, { launches: [freeWarhead(200)], startWave: 0 }, STEP_SECONDS, HUMAN);
  const [warhead] = state.warheads;
  createBlast(state, warhead.x, warhead.y + 5, BLAST);
  const seen = [];
  for (let elapsed = 0; elapsed < BLAST.growSeconds; elapsed += STEP_SECONDS) {
    step(state, NOTHING, STEP_SECONDS, HUMAN);
    seen.push(...typesOf(state));
  }
  assert.deepEqual(seen, [EVENT.warheadDestroyed]);
});

test('a warhead landing reports the city or base it destroys, once', () => {
  const state = createState(HUMAN);
  step(state, { launches: [freeWarhead(BASE_XS[1] + IMPACT_RADIUS - 1, 400), freeWarhead(200, 400)], startWave: 0 }, STEP_SECONDS, HUMAN);
  const seen = [];
  for (let elapsed = 0; elapsed < 2; elapsed += STEP_SECONDS) {
    step(state, NOTHING, STEP_SECONDS, HUMAN);
    seen.push(...typesOf(state));
  }
  assert.deepEqual(seen.sort(), [EVENT.baseDestroyed, EVENT.cityDestroyed].sort());
});

test('a wave reports its start and, once cleared, its bonus', () => {
  const state = createState(HUMAN);
  step(state, { launches: [], startWave: 1 }, STEP_SECONDS, HUMAN);
  assert.deepEqual(typesOf(state), [EVENT.waveStarted]);
  step(state, { launches: [freeWarhead(200, 400)], startWave: 0 }, STEP_SECONDS, HUMAN);
  const seen = [];
  for (let elapsed = 0; elapsed < 3; elapsed += STEP_SECONDS) {
    step(state, NOTHING, STEP_SECONDS, HUMAN);
    seen.push(...state.events);
  }
  const cleared = seen.filter((event) => event.type === EVENT.waveCleared);
  assert.equal(cleared.length, 1);
  assert.equal(cleared[0].bonus, state.lastWaveBonus);
});

test('every event type has a sound, and an empty base clicks differently from other refusals', () => {
  Object.values(EVENT).forEach((type) => assert.ok(soundForEvent({ type, reason: REJECTION.cooldown }), type));
  const dry = soundForEvent({ type: EVENT.refused, reason: REJECTION.noAmmo });
  assert.notEqual(dry, soundForEvent({ type: EVENT.refused, reason: REJECTION.cooldown }));
  assert.notEqual(dry, soundForEvent({ type: EVENT.refused, reason: REJECTION.budget }));
});

test('every refusal the rules can report has a hint, a cursor label and meters to flash', () => {
  const reasonsByKind = {
    interceptor: [REJECTION.noAmmo, REJECTION.cooldown],
    warhead: [REJECTION.cooldown, REJECTION.budget, REJECTION.tooManyWarheads],
  };
  Object.entries(reasonsByKind).forEach(([kind, reasons]) => reasons.forEach((reason) => {
    const { hint, label, meters } = REFUSAL[kind][reason];
    assert.ok(hint && label && Array.isArray(meters), `${kind} ${reason}`);
  }));
});
