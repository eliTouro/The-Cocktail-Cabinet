import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEP_SECONDS } from '../js/core/loop.js';
import { createRng } from '../js/core/rng.js';
import { createAi, interceptPlan, positionAfter, secondsToImpact } from '../js/games/missile-command/ai.js';
import {
  AI_SKILL, AMMO_BONUS, BASE_XS, BLAST, CHAIN_BLAST, CITY_BONUS, CITY_XS, GROUND_Y, IMPACT_RADIUS,
  INTERCEPTOR, TUNING, WAVE,
} from '../js/games/missile-command/config.js';
import {
  PHASE, REJECTION, blastRadius, createBlast, createState, groundTarget, interceptorRequest, observe,
  step, warheadRequest,
} from '../js/games/missile-command/rules.js';

const STEP = STEP_SECONDS;
const HUMAN = TUNING.human();
const COMPUTER = TUNING.computer();
const NOTHING = { launches: [], startWave: 0 };

function run(state, seconds, tuning, input = NOTHING) {
  for (let elapsed = 0; elapsed < seconds; elapsed += STEP) step(state, input, STEP, tuning);
}

function fall(state, x, speed = 50, extra = {}) {
  step(state, { launches: [warheadRequest({ x, y: 0 }, groundTarget(x), speed, { free: true, ...extra })], startWave: 0 }, STEP, HUMAN);
  return state.warheads[state.warheads.length - 1];
}

test('a blast grows linearly to its maximum, then shrinks to nothing', () => {
  assert.equal(blastRadius({ age: 0, spec: BLAST }), 0);
  assert.ok(Math.abs(blastRadius({ age: BLAST.growSeconds / 2, spec: BLAST }) - BLAST.maxRadius / 2) < 1e-9);
  assert.equal(blastRadius({ age: BLAST.growSeconds, spec: BLAST }), BLAST.maxRadius);
  const halfway = BLAST.growSeconds + BLAST.shrinkSeconds / 2;
  assert.ok(Math.abs(blastRadius({ age: halfway, spec: BLAST }) - BLAST.maxRadius / 2) < 1e-9);
  assert.equal(blastRadius({ age: BLAST.growSeconds + BLAST.shrinkSeconds, spec: BLAST }), 0);
});

test('an interceptor flies at its speed to the target point and bursts there, then the blast disappears', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: BASE_XS[1], y: GROUND_Y - 150 })], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.interceptors.length, 1);
  const travelSeconds = 150 / INTERCEPTOR.speed;
  run(state, travelSeconds / 2, HUMAN);
  assert.ok(Math.abs((GROUND_Y - state.interceptors[0].y) - 75) < INTERCEPTOR.speed * STEP * 3);
  run(state, travelSeconds / 2 + 0.05, HUMAN);
  assert.equal(state.interceptors.length, 0);
  assert.equal(state.blasts.length, 1);
  assert.equal(state.blasts[0].y, GROUND_Y - 150);
  run(state, BLAST.growSeconds + BLAST.shrinkSeconds, HUMAN);
  assert.equal(state.blasts.length, 0);
});

test('a warhead flies a straight line to its target at its speed', () => {
  const state = createState(HUMAN);
  step(state, { launches: [warheadRequest({ x: 0, y: 0 }, groundTarget(300), 100, { free: true })], startWave: 0 }, STEP, HUMAN);
  const slanted = state.warheads[0];
  run(state, 1, HUMAN);
  assert.ok(Math.abs(slanted.x / slanted.y - 300 / GROUND_Y) < 0.02);
  assert.ok(Math.abs(Math.hypot(slanted.vx, slanted.vy) - 100) < 1e-9);
  assert.ok(Math.abs(Math.hypot(slanted.x, slanted.y) - 100) < 100 * STEP * 3);
});

test('a blast destroys a warhead inside it and spares one outside it', () => {
  const state = createState(HUMAN);
  const inside = fall(state, 200);
  const outside = fall(state, 400);
  createBlast(state, inside.x, inside.y + 5, BLAST);
  run(state, BLAST.growSeconds, HUMAN);
  assert.ok(!state.warheads.some((warhead) => warhead.id === inside.id));
  assert.ok(state.warheads.some((warhead) => warhead.id === outside.id));
  assert.equal(state.warheadsDestroyed, 1);
});

test('a destroyed warhead explodes too, so one blast can chain to a warhead out of its own reach', () => {
  const state = createState(HUMAN);
  const first = fall(state, 200, 1);
  const second = fall(state, 225, 1);
  second.y = first.y;
  createBlast(state, first.x - 30, first.y, BLAST);
  assert.ok(Math.hypot(first.x - 30 - second.x, first.y - second.y) > BLAST.maxRadius);
  run(state, BLAST.growSeconds + CHAIN_BLAST.growSeconds, HUMAN);
  assert.equal(state.warheadsDestroyed, 2);
});

test('a warhead landing near a city destroys it and keeps it destroyed; farther cities survive', () => {
  const state = createState(HUMAN);
  fall(state, CITY_XS[0] + IMPACT_RADIUS - 2, 400);
  run(state, 2, HUMAN);
  assert.equal(state.cities[0].alive, false);
  assert.ok(state.cities.slice(1).every((city) => city.alive));
  run(state, 5, HUMAN);
  assert.equal(state.cities[0].alive, false);
});

test('a warhead landing on a base destroys it and its ammo', () => {
  const state = createState(HUMAN);
  fall(state, BASE_XS[1], 400);
  run(state, 2, HUMAN);
  assert.equal(state.bases[1].alive, false);
  assert.equal(state.bases[1].ammo, 0);
  assert.ok(state.bases[0].alive && state.bases[2].alive);
});

test('a click fires from the nearest base with ammo, spending one missile and starting that base cooldown', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: 60, y: 200 })], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.bases[0].ammo, HUMAN.ammoPerBase - 1);
  assert.equal(state.bases[1].ammo, HUMAN.ammoPerBase);
  assert.ok(state.bases[0].cooldown > 0);
});

test('a dry or destroyed base is skipped, and a chosen base fires only itself', () => {
  const state = createState(HUMAN);
  state.bases[0].ammo = 0;
  step(state, { launches: [interceptorRequest({ x: 60, y: 200 })], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.bases[1].ammo, HUMAN.ammoPerBase - 1);
  run(state, 1, HUMAN);
  step(state, { launches: [interceptorRequest({ x: 60, y: 200 }, 2)], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.bases[2].ammo, HUMAN.ammoPerBase - 1);
});

test('requests are refused with no ammo or during cooldown', () => {
  const state = createState(HUMAN);
  state.bases.forEach((base) => { base.ammo = 0; });
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 })], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.interceptors.length, 0);

  const ready = createState(HUMAN);
  step(ready, { launches: [interceptorRequest({ x: 300, y: 200 }, 1), interceptorRequest({ x: 310, y: 200 }, 1)], startWave: 0 }, STEP, HUMAN);
  assert.equal(ready.interceptors.length, 1);
  assert.equal(ready.bases[1].ammo, HUMAN.ammoPerBase - 1);
});

test('a base can fire again once its cooldown has passed', () => {
  const state = createState(HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 }, 1)], startWave: 0 }, STEP, HUMAN);
  run(state, HUMAN.baseCooldown + 0.05, HUMAN);
  step(state, { launches: [interceptorRequest({ x: 300, y: 200 }, 1)], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.bases[1].ammo, HUMAN.ammoPerBase - 2);
});

test('in computer mode a sent warhead costs one launch of budget and obeys cooldown and the in-flight cap', () => {
  const state = createState(COMPUTER);
  const send = () => step(state, { launches: [warheadRequest({ x: 100, y: 0 }, groundTarget(300), COMPUTER.warheadSpeed)], startWave: 0 }, STEP, COMPUTER);
  const before = state.budget;
  send();
  assert.equal(state.warheads.length, 1);
  assert.ok(state.budget < before - 0.9);
  send();
  assert.equal(state.warheads.length, 1, 'cooldown refuses an immediate second launch');

  state.budget = COMPUTER.budgetCap;
  for (let launched = 0; launched < COMPUTER.maxWarheads + 3; launched += 1) {
    run(state, COMPUTER.launchCooldown + 0.02, COMPUTER);
    state.budget = COMPUTER.budgetCap;
    send();
  }
  assert.ok(state.warheads.length <= COMPUTER.maxWarheads);
});

test('with no budget left a warhead cannot be sent, and the budget refills but never above its cap', () => {
  const state = createState(COMPUTER);
  state.budget = 0.5;
  step(state, { launches: [warheadRequest({ x: 100, y: 0 }, groundTarget(300), COMPUTER.warheadSpeed)], startWave: 0 }, STEP, COMPUTER);
  assert.equal(state.warheads.length, 0);
  run(state, 200, COMPUTER);
  assert.equal(state.budget, COMPUTER.budgetCap);
});

test('the computer defender slowly regains ammo, but never beyond a full base', () => {
  const state = createState(COMPUTER);
  state.bases[0].ammo = 0;
  run(state, 1 / COMPUTER.ammoRefillPerSecond + 0.1, COMPUTER);
  assert.equal(state.bases[0].ammo, 1);
  run(state, 400, COMPUTER);
  assert.ok(state.bases.every((base) => base.ammo === COMPUTER.ammoPerBase));
});

test('a splitting warhead breaks into extra warheads at its split height', () => {
  const state = createState(HUMAN);
  fall(state, 300, 80, { splitAt: 150, children: [100, 500] });
  run(state, 2.5, HUMAN);
  assert.equal(state.warheads.length, 3);
  assert.deepEqual(state.warheads.slice(1).map((warhead) => warhead.tx).sort((a, b) => a - b), [100, 500]);
});

test('clearing a wave pays for surviving cities and ammo and restocks standing bases', () => {
  const state = createState(HUMAN);
  state.cities[0].alive = false;
  state.bases[0].ammo = 4;
  state.bases[2].alive = false;
  state.bases[2].ammo = 0;
  step(state, { launches: [], startWave: 1 }, STEP, HUMAN);
  const harmlessTarget = groundTarget((BASE_XS[1] + CITY_XS[3]) / 2);
  step(state, { launches: [warheadRequest({ x: 300, y: 0 }, harmlessTarget, 50, { free: true })], startWave: 0 }, STEP, HUMAN);
  assert.equal(state.waveActive, true);
  step(state, { launches: [interceptorRequest({ x: 100, y: 100 }, 1)], startWave: 0 }, STEP, HUMAN);
  run(state, 12, HUMAN);
  assert.equal(state.waveActive, false);
  assert.equal(state.lastWaveBonus, 5 * CITY_BONUS + (4 + HUMAN.ammoPerBase - 1) * AMMO_BONUS);
  assert.equal(state.score, state.lastWaveBonus);
  assert.equal(state.bases[0].ammo, HUMAN.ammoPerBase);
  assert.equal(state.bases[2].ammo, 0);
});

test('the game is lost when every city is gone and won by the defender when time runs out', () => {
  const lost = createState(HUMAN);
  lost.cities.forEach((city) => { city.alive = false; });
  step(lost, NOTHING, STEP, HUMAN);
  assert.equal(lost.phase, PHASE.citiesLost);

  const held = createState(COMPUTER, { surviveSeconds: 1 });
  run(held, 1.1, COMPUTER);
  assert.equal(held.phase, PHASE.survived);
});

test('a finished game ignores further steps', () => {
  const state = createState(COMPUTER, { surviveSeconds: 0.1 });
  run(state, 0.3, COMPUTER);
  const frozenAt = state.time;
  run(state, 1, COMPUTER);
  assert.equal(state.time, frozenAt);
});

test('observe shows warhead motion but not where a warhead is aimed', () => {
  const state = createState(HUMAN);
  fall(state, 300);
  const [seen] = observe(state).warheads;
  assert.deepEqual(Object.keys(seen).sort(), ['id', 'vx', 'vy', 'x', 'y']);
});

test('the AI aims ahead of a moving warhead and cannot pick a shot that arrives too late', () => {
  const warhead = { id: 1, x: 100, y: 100, vx: 80, vy: 60 };
  const plan = interceptPlan({ x: BASE_XS[1] }, warhead);
  assert.ok(plan.point.x > warhead.x, 'leads the target along its path');
  const flightPoint = positionAfter(warhead, plan.flight);
  assert.ok(Math.abs(Math.hypot(plan.point.x - BASE_XS[1], plan.point.y - GROUND_Y) / INTERCEPTOR.speed - plan.flight) < 0.05);
  assert.ok(flightPoint.x < plan.point.x);
  const nearlyLanded = { id: 2, x: 320, y: GROUND_Y - 10, vx: 0, vy: 60 };
  assert.equal(interceptPlan({ x: BASE_XS[0] }, nearlyLanded), null);
  assert.ok(secondsToImpact(nearlyLanded) < 0.2);
});

test('the AI does nothing until its reaction delay has passed, then fires at a threat', () => {
  const state = createState(COMPUTER);
  state.budget = COMPUTER.budgetCap;
  const warhead = { id: 9, x: 320, y: 20, vx: 0, vy: 50 };
  const skill = AI_SKILL(0);
  const ai = createAi(createRng(1), () => ({ ...skill, mistakeRate: 0, priorityNoise: 0 }));
  const seen = (time) => ({ ...observe(state), time, warheads: [warhead] });
  assert.equal(ai.decide(seen(0)).launches.length, 0);
  assert.equal(ai.decide(seen(skill.reactionDelay / 2)).launches.length, 0);
  assert.equal(ai.decide(seen(skill.reactionDelay + 0.05)).launches.length, 1);
});

test('the AI cannot fire without ammo', () => {
  const state = createState(COMPUTER);
  state.bases.forEach((base) => { base.ammo = 0; });
  const ai = createAi(createRng(1), () => ({ reactionDelay: 0, aimError: 0, mistakeRate: 0, priorityNoise: 0 }));
  const observation = { ...observe(state), warheads: [{ id: 1, x: 320, y: 20, vx: 0, vy: 50 }] };
  assert.equal(ai.decide(observation).launches.length, 0);
});

test('the AI ignores a warhead that will land harmlessly between targets', () => {
  const state = createState(COMPUTER);
  const ai = createAi(createRng(1), () => ({ reactionDelay: 0, aimError: 0, mistakeRate: 0, priorityNoise: 0 }));
  const harmless = { id: 1, x: 5, y: 20, vx: 0, vy: 50 };
  assert.equal(ai.decide({ ...observe(state), warheads: [harmless] }).launches.length, 0);
});

test('difficulty rises steadily: waves grow bigger, faster and start splitting; the defender gets sharper', () => {
  const times = [0, 60, 120, 240, 360, 480, 600];
  const waves = times.map(WAVE);
  const skills = [0, 15, 30, 45, 60, 90].map(AI_SKILL);
  const rises = (values) => values.every((value, index) => index === 0 || value >= values[index - 1]);
  assert.ok(rises(waves.map((wave) => wave.count)));
  assert.ok(rises(waves.map((wave) => wave.speed)));
  assert.ok(rises(waves.map((wave) => wave.splitChance)));
  assert.equal(waves[0].splitChance, 0);
  assert.ok(waves[0].count >= 3 && waves[waves.length - 1].count <= 20);
  assert.ok(rises(skills.map((skill) => -skill.reactionDelay)));
  assert.ok(rises(skills.map((skill) => -skill.aimError)));
  assert.ok(rises(skills.map((skill) => -skill.mistakeRate)));
  assert.ok(skills[skills.length - 1].reactionDelay > 0 && skills[skills.length - 1].aimError > 0);
});

test('every rejection reason is a distinct label', () => {
  assert.equal(new Set(Object.values(REJECTION)).size, Object.keys(REJECTION).length);
});
