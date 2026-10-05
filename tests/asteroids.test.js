import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STEP_SECONDS } from '../js/core/loop.js';
import {
  AI_SKILL, BULLET, HEIGHT, ROCK_TIERS, SAFE_RADIUS, SHIP, SURVIVE_SECONDS, TUNING, WAVE, WIDTH,
} from '../js/games/asteroids/config.js';
import { nearestEdgePoint, wrapDelta } from '../js/games/asteroids/geometry.js';
import {
  PHASE, SPAWN_REJECTION, createRock, createState, launchToward, observe, rockContainsPoint,
  rockHitsShip, spawnRejection, step,
} from '../js/games/asteroids/rules.js';
import { playClassicMode, playComputerMode } from './asteroidsSimulation.js';

const STEP = STEP_SECONDS;
const COMPUTER = TUNING.computer();
const HUMAN = TUNING.human();
const IDLE = { rotate: 0, thrust: false, fire: false, spawns: [] };
const HEXAGON = ROCK_TIERS.length - 1;

function stateWithRock(rock = {}) {
  const state = createState();
  state.ship.invulnerable = 0;
  state.rocks.push(createRock(state, { tier: HEXAGON, x: 100, y: 100, vx: 0, vy: 0, ...rock }));
  return state;
}

test('the ship rotates at its turn rate and keeps drifting after thrust stops', () => {
  const state = createState();
  const startAngle = state.ship.angle;
  step(state, { ...IDLE, rotate: 1 }, STEP, HUMAN);
  assert.ok(Math.abs(state.ship.angle - startAngle - SHIP.turnRate * STEP) < 1e-9);

  for (let i = 0; i < 30; i += 1) step(state, { ...IDLE, thrust: true }, STEP, HUMAN);
  const speedAfterThrust = Math.hypot(state.ship.vx, state.ship.vy);
  assert.ok(speedAfterThrust > 50);
  for (let i = 0; i < 30; i += 1) step(state, IDLE, STEP, HUMAN);
  const coasting = Math.hypot(state.ship.vx, state.ship.vy);
  assert.ok(coasting > speedAfterThrust * 0.6 && coasting < speedAfterThrust);
});

test('ship speed never exceeds the maximum', () => {
  const state = createState();
  for (let i = 0; i < 600; i += 1) step(state, { ...IDLE, thrust: true }, STEP, HUMAN);
  assert.ok(Math.hypot(state.ship.vx, state.ship.vy) <= SHIP.maxSpeed + 1e-9);
});

test('the ship, rocks and bullets wrap around the screen edges', () => {
  const state = createState();
  Object.assign(state.ship, { x: WIDTH - 1, vx: 120 });
  state.rocks.push(createRock(state, { tier: 0, x: 1, y: 5, vx: -120, vy: 0 }));
  state.ship.y = 200;
  step(state, IDLE, 0.1, HUMAN);
  assert.ok(state.ship.x < 20);
  assert.ok(state.rocks[0].x > WIDTH - 20);
});

test('wrapDelta takes the short way across the edge', () => {
  assert.ok(Math.abs(wrapDelta(630, 10, WIDTH) - 20) < 1e-9);
  assert.ok(Math.abs(wrapDelta(10, 630, WIDTH) + 20) < 1e-9);
});

test('firing respects the cooldown, and bullets expire after their lifetime', () => {
  const state = createState();
  step(state, { ...IDLE, fire: true }, STEP, HUMAN);
  step(state, { ...IDLE, fire: true }, STEP, HUMAN);
  assert.equal(state.bullets.length, 1);
  for (let i = 0; i < BULLET.cooldown / STEP; i += 1) step(state, { ...IDLE, fire: true }, STEP, HUMAN);
  assert.ok(state.bullets.length >= 2);
  for (let i = 0; i < (BULLET.lifetime / STEP) + 5; i += 1) step(state, IDLE, STEP, HUMAN);
  assert.equal(state.bullets.length, 0);
});

test('a bullet inherits the ship velocity', () => {
  const state = createState();
  state.ship.vx = 100;
  state.ship.angle = 0;
  step(state, { ...IDLE, fire: true }, STEP, HUMAN);
  assert.ok(state.bullets[0].vx > BULLET.speed);
});

test('a hexagon splits into two squares, a square into two triangles, a triangle vanishes', () => {
  const state = stateWithRock();
  const shoot = (rock) => {
    state.bullets.push({ x: rock.x, y: rock.y, vx: 0, vy: 0, age: 0 });
    step(state, IDLE, STEP, HUMAN);
  };
  shoot(state.rocks[0]);
  assert.deepEqual(state.rocks.map((rock) => ROCK_TIERS[rock.tier].name), ['square', 'square']);
  shoot(state.rocks[0]);
  assert.deepEqual(state.rocks.map((rock) => ROCK_TIERS[rock.tier].name).sort(), ['square', 'triangle', 'triangle']);
  while (state.rocks.some((rock) => rock.tier === 0 || rock.tier === 1)) {
    const target = state.rocks[0];
    state.bullets.push({ x: target.x, y: target.y, vx: 0, vy: 0, age: 0 });
    step(state, IDLE, STEP, HUMAN);
  }
  assert.equal(state.rocks.length, 0);
  assert.equal(state.rocksDestroyed, 7);
});

test('smaller rocks score more points and split children travel faster', () => {
  assert.ok(ROCK_TIERS[0].points > ROCK_TIERS[1].points && ROCK_TIERS[1].points > ROCK_TIERS[2].points);
  const state = stateWithRock({ vx: 40, vy: 0 });
  state.bullets.push({ x: 100, y: 100, vx: 0, vy: 0, age: 0 });
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.score, ROCK_TIERS[HEXAGON].points);
  assert.ok(state.rocks.every((rock) => Math.hypot(rock.vx, rock.vy) > 40));
});

test('collisions use the polygon drawn, not its bounding circle', () => {
  const triangle = createRock(createState(), { tier: 0, x: 200, y: 200, vx: 0, vy: 0 });
  const { radius } = ROCK_TIERS[0];
  const alongCorner = { x: 200 + radius * 0.9, y: 200 };
  const betweenCorners = { x: 200 - radius * 0.9, y: 200 };
  assert.ok(rockContainsPoint(triangle, alongCorner));
  assert.ok(!rockContainsPoint(triangle, betweenCorners));
});

test('a ship touching a rock corner collides; one just outside does not', () => {
  const square = createRock(createState(), { tier: 1, x: 200, y: 200, vx: 0, vy: 0 });
  const corner = ROCK_TIERS[1].radius;
  assert.ok(rockHitsShip(square, { x: 200 + corner + SHIP.radius - 1, y: 200 }));
  assert.ok(!rockHitsShip(square, { x: 200 + corner + SHIP.radius + 4, y: 200 }));
});

test('a collision costs a life, then the ship respawns shielded', () => {
  const state = stateWithRock({ x: state0().x, y: state0().y });
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.lives, SHIP.startingLives - 1);
  assert.equal(state.ship.alive, false);
  state.rocks = [];
  for (let i = 0; i < (SHIP.respawnDelay / STEP) + 5; i += 1) step(state, IDLE, STEP, HUMAN);
  assert.equal(state.ship.alive, true);
  assert.ok(state.ship.invulnerable > 0);
});

function state0() {
  return createState().ship;
}

test('an invulnerable ship passes through rocks', () => {
  const state = stateWithRock({ x: state0().x, y: state0().y });
  state.ship.invulnerable = 1;
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.lives, SHIP.startingLives);
  assert.equal(state.ship.alive, true);
});

test('the ship waits to respawn while a rock sits in the middle of the screen', () => {
  const state = stateWithRock({ x: WIDTH / 2, y: HEIGHT / 2 });
  state.ship.alive = false;
  state.ship.respawnIn = 0;
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.ship.alive, false);
});

test('losing the last life ends the game', () => {
  const state = stateWithRock({ x: state0().x, y: state0().y });
  state.lives = 1;
  step(state, IDLE, STEP, HUMAN);
  assert.equal(state.phase, PHASE.lost);
});

test('surviving the full time wins for the ship', () => {
  const state = createState({ surviveSeconds: 1 });
  while (state.phase === PHASE.playing) step(state, IDLE, STEP, COMPUTER);
  assert.equal(state.phase, PHASE.won);
});

test('sent rocks cost budget and the budget refills over time', () => {
  const state = createState();
  state.budget = COMPUTER.budgetCap;
  const spawn = launchToward({ x: 100, y: 100 }, HEXAGON, COMPUTER.rockSpeed);
  step(state, { ...IDLE, spawns: [spawn] }, STEP, COMPUTER);
  assert.equal(state.rocks.length, 1);
  assert.ok(state.budget < COMPUTER.budgetCap - ROCK_TIERS[HEXAGON].sendCost + 0.1);
  const afterSend = state.budget;
  for (let i = 0; i < 120; i += 1) step(state, IDLE, STEP, COMPUTER);
  assert.ok(state.budget > afterSend);
});

test('sends are refused without budget, during cooldown, near the ship, or past the rock cap', () => {
  const far = launchToward({ x: 60, y: 60 }, 0, COMPUTER.rockSpeed);
  const state = createState();
  assert.equal(spawnRejection(state, far, COMPUTER), SPAWN_REJECTION.budget);

  state.budget = COMPUTER.budgetCap;
  assert.equal(spawnRejection(state, far, COMPUTER), null);

  state.sendCooldown = 0.3;
  assert.equal(spawnRejection(state, far, COMPUTER), SPAWN_REJECTION.cooldown);
  state.sendCooldown = 0;

  const near = { ...far, x: state.ship.x + SAFE_RADIUS - 1, y: state.ship.y };
  assert.equal(spawnRejection(state, near, COMPUTER), SPAWN_REJECTION.nearShip);

  state.rocks = Array.from({ length: COMPUTER.maxRocks }, () => createRock(state, { tier: 0, x: 0, y: 0, vx: 0, vy: 0 }));
  assert.equal(spawnRejection(state, far, COMPUTER), SPAWN_REJECTION.tooMany);
});

test('a rock is launched from the nearest edge toward the click', () => {
  const launch = launchToward({ x: 100, y: 240 }, 1, 100);
  assert.deepEqual(nearestEdgePoint({ x: 100, y: 240 }), { x: 0, y: 240 });
  assert.equal(launch.x, 0);
  assert.ok(Math.abs(launch.vx - 100) < 1e-9 && Math.abs(launch.vy) < 1e-9);
});

test('observe exposes positions and velocities but no rules bookkeeping', () => {
  const state = stateWithRock({ vx: 5 });
  const view = observe(state);
  assert.deepEqual(Object.keys(view.rocks[0]).sort(), ['radius', 'tier', 'vx', 'vy', 'x', 'y']);
  assert.equal(view.score, undefined);
  assert.equal(view.budget, undefined);
});

test('difficulty values rise monotonically: waves harden, the pilot sharpens', () => {
  const times = Array.from({ length: 40 }, (_, index) => index * 10);
  const waves = times.map(WAVE);
  const skills = times.map(AI_SKILL);
  waves.slice(1).forEach((wave, index) => {
    assert.ok(wave.count >= waves[index].count && wave.speed >= waves[index].speed);
  });
  skills.slice(1).forEach((skill, index) => {
    assert.ok(skill.reactionDelay <= skills[index].reactionDelay && skill.aimError <= skills[index].aimError);
  });
  assert.ok(waves.at(-1).count > waves[0].count && waves.at(-1).speed > waves[0].speed);
  assert.ok(skills.at(-1).aimError < skills[0].aimError && skills.at(-1).reactionDelay < skills[0].reactionDelay);
});

const SEEDS = Array.from({ length: 24 }, (_, index) => index + 1);
const percentage = (runs, predicate) => runs.filter(predicate).length / runs.length;

test('simulation: the pilot at its weakest still survives and destroys rocks', () => {
  const runs = SEEDS.map((seed) => playComputerMode({ seed, skillAt: () => AI_SKILL(0) }));
  const averageDestroyed = runs.reduce((sum, run) => sum + run.rocksDestroyed, 0) / runs.length;
  const averageTime = runs.reduce((sum, run) => sum + run.time, 0) / runs.length;
  assert.ok(averageDestroyed >= 8, `average rocks destroyed ${averageDestroyed}`);
  assert.ok(averageTime >= 15, `average survival ${averageTime}`);
  assert.ok(percentage(runs, (run) => run.phase === PHASE.lost) > 0.8, 'a weak pilot should usually be beaten');
});

test('simulation: the sharpest pilot is beatable even by a relentless sender, and still wins often', () => {
  const runs = SEEDS.map((seed) => playComputerMode({ seed, skillAt: () => AI_SKILL(1e6) }));
  const shipWins = percentage(runs, (run) => run.phase === PHASE.won);
  assert.ok(shipWins > 0.1 && shipWins < 0.9, `ship won ${shipWins}`);
  runs.forEach((run) => assert.ok(run.time <= SURVIVE_SECONDS + 1));
});

test('simulation: a sharp pilot lasts longer than a clumsy one', () => {
  const averageTime = (skillAt) => SEEDS.reduce((sum, seed) => sum + playComputerMode({ seed, skillAt }).time, 0) / SEEDS.length;
  assert.ok(averageTime(() => AI_SKILL(1e6)) > averageTime(() => AI_SKILL(0)) + 10);
});

test('simulation: the rules support a classic game, with the pilot scoring through waves', () => {
  const runs = [1, 2, 3, 4].map((seed) => playClassicMode({ seed, skillAt: () => AI_SKILL(1e6) }));
  runs.forEach((run) => assert.ok(run.score > 0 && run.phase === PHASE.playing));
});
