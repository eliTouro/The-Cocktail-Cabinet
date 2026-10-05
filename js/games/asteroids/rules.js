import {
  BULLET, HEIGHT, ROCK_TIERS, SAFE_RADIUS, SHIP, SPLIT, WIDTH,
} from './config.js';
import {
  circleHitsPolygon, nearestEdgePoint, normalizeAngle, pointInPolygon, polygonPoints,
  wrapCoordinate, wrapDelta, wrappedDistance,
} from './geometry.js';

export const PHASE = { playing: 'playing', lost: 'lost', won: 'won' };
export const SPAWN_REJECTION = {
  tooMany: 'too-many-rocks',
  cooldown: 'send-cooldown',
  budget: 'not-enough-budget',
  nearShip: 'inside-safe-radius',
  shipDown: 'ship-not-flying',
};

const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 };
const FACING_UP = -Math.PI / 2;
const BULLET_PATH_SAMPLES = [0, 0.5];
const ROCK_SPIN_PATTERN = [1, -1, 0.6, -0.6];

function createShip() {
  return {
    x: CENTER.x, y: CENTER.y, vx: 0, vy: 0, angle: FACING_UP,
    cooldown: 0, invulnerable: SHIP.invulnerableSeconds, alive: true, respawnIn: 0, thrusting: false,
  };
}

/** `surviveSeconds` is the time the ship must outlast to win; null means the game only ends by losing. */
export function createState({ surviveSeconds = null } = {}) {
  return {
    time: 0,
    phase: PHASE.playing,
    surviveSeconds,
    ship: createShip(),
    bullets: [],
    rocks: [],
    nextId: 1,
    score: 0,
    lives: SHIP.startingLives,
    rocksDestroyed: 0,
    rocksSent: 0,
    budget: 0,
    sendCooldown: 0,
  };
}

/** What a pilot may see: the ship, rocks and bullets, but none of the rules' bookkeeping. */
export function observe(state) {
  const copy = ({ x, y, vx, vy }) => ({ x, y, vx, vy });
  const { ship } = state;
  return {
    time: state.time,
    ship: { ...copy(ship), angle: ship.angle, cooldown: ship.cooldown, alive: ship.alive, invulnerable: ship.invulnerable },
    rocks: state.rocks.map((rock) => ({ ...copy(rock), tier: rock.tier, radius: ROCK_TIERS[rock.tier].radius })),
    bullets: state.bullets.map(copy),
  };
}

export function createRock(state, { tier, x, y, vx, vy }) {
  const id = state.nextId;
  state.nextId += 1;
  const spin = ROCK_SPIN_PATTERN[id % ROCK_SPIN_PATTERN.length] * SPLIT.spin;
  return { id, tier, x, y, vx, vy, angle: 0, spin, age: 0 };
}

/** A rock that enters at the screen edge nearest `target` and flies straight through it. */
export function launchToward(target, tier, speed) {
  const origin = nearestEdgePoint(target);
  const aimed = { x: target.x - origin.x, y: target.y - origin.y };
  const toward = Math.hypot(aimed.x, aimed.y) > 0 ? aimed : { x: CENTER.x - origin.x, y: CENTER.y - origin.y };
  const length = Math.hypot(toward.x, toward.y);
  return { tier, x: origin.x, y: origin.y, vx: (toward.x / length) * speed, vy: (toward.y / length) * speed, free: false };
}

/** Returns why a spawn is not allowed right now, or null. Free spawns (waves) skip the budget rules. */
export function spawnRejection(state, spawn, tuning) {
  if (!state.ship.alive) return SPAWN_REJECTION.shipDown;
  if (state.rocks.length >= tuning.maxRocks) return SPAWN_REJECTION.tooMany;
  const safeDistance = SAFE_RADIUS + ROCK_TIERS[spawn.tier].radius;
  if (wrappedDistance(state.ship, spawn) < safeDistance) return SPAWN_REJECTION.nearShip;
  if (spawn.free) return null;
  if (state.sendCooldown > 0) return SPAWN_REJECTION.cooldown;
  if (state.budget < ROCK_TIERS[spawn.tier].sendCost) return SPAWN_REJECTION.budget;
  return null;
}

function applySpawn(state, spawn, tuning) {
  if (spawnRejection(state, spawn, tuning)) return;
  state.rocks.push(createRock(state, spawn));
  if (spawn.free) return;
  state.rocksSent += 1;
  state.budget -= ROCK_TIERS[spawn.tier].sendCost;
  state.sendCooldown = tuning.sendCooldown;
}

function refillBudget(state, tuning, dt) {
  state.budget = Math.min(tuning.budgetCap, state.budget + tuning.budgetRefill * dt);
  state.sendCooldown = Math.max(0, state.sendCooldown - dt);
}

function limitSpeed(ship) {
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed <= SHIP.maxSpeed) return;
  ship.vx *= SHIP.maxSpeed / speed;
  ship.vy *= SHIP.maxSpeed / speed;
}

function flyShip(ship, input, dt) {
  ship.angle = normalizeAngle(ship.angle + input.rotate * SHIP.turnRate * dt);
  ship.thrusting = input.thrust;
  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * SHIP.thrust * dt;
    ship.vy += Math.sin(ship.angle) * SHIP.thrust * dt;
  }
  const drag = Math.max(0, 1 - SHIP.drag * dt);
  ship.vx *= drag;
  ship.vy *= drag;
  limitSpeed(ship);
  ship.x = wrapCoordinate(ship.x + ship.vx * dt, WIDTH);
  ship.y = wrapCoordinate(ship.y + ship.vy * dt, HEIGHT);
  ship.cooldown = Math.max(0, ship.cooldown - dt);
  ship.invulnerable = Math.max(0, ship.invulnerable - dt);
}

function fireBullet(state, input) {
  const { ship } = state;
  if (!input.fire || ship.cooldown > 0) return;
    const dx = Math.cos(ship.angle);
  const dy = Math.sin(ship.angle);
  state.bullets.push({
    x: wrapCoordinate(ship.x + dx * SHIP.noseOffset, WIDTH),
    y: wrapCoordinate(ship.y + dy * SHIP.noseOffset, HEIGHT),
    vx: ship.vx + dx * BULLET.speed,
    vy: ship.vy + dy * BULLET.speed,
    age: 0,
  });
  ship.cooldown = BULLET.cooldown;
}

function rockPolygonNear(rock, point) {
  const { sides, radius } = ROCK_TIERS[rock.tier];
  const x = point.x + wrapDelta(point.x, rock.x, WIDTH);
  const y = point.y + wrapDelta(point.y, rock.y, HEIGHT);
  return polygonPoints(x, y, radius, sides, rock.angle);
}

export const rockContainsPoint = (rock, point) => pointInPolygon(point, rockPolygonNear(rock, point));

export const rockHitsShip = (rock, ship) => circleHitsPolygon(ship, SHIP.radius, rockPolygonNear(rock, ship));

function moveBullets(state, dt) {
  state.bullets.forEach((bullet) => {
    bullet.x = wrapCoordinate(bullet.x + bullet.vx * dt, WIDTH);
    bullet.y = wrapCoordinate(bullet.y + bullet.vy * dt, HEIGHT);
    bullet.age += dt;
  });
  state.bullets = state.bullets.filter((bullet) => bullet.age < BULLET.lifetime);
}

function moveRocks(state, tuning, dt) {
  state.rocks.forEach((rock) => {
    rock.x = wrapCoordinate(rock.x + rock.vx * dt, WIDTH);
    rock.y = wrapCoordinate(rock.y + rock.vy * dt, HEIGHT);
    rock.angle += rock.spin * dt;
    rock.age += dt;
  });
  state.rocks = state.rocks.filter((rock) => rock.age < tuning.rockLifetime);
}

function splitRock(state, rock) {
  if (rock.tier === 0) return [];
  const speed = Math.hypot(rock.vx, rock.vy) * SPLIT.speedGain;
  const heading = Math.atan2(rock.vy, rock.vx);
  return [-1, 1].map((side) => createRock(state, {
    tier: rock.tier - 1,
    x: rock.x,
    y: rock.y,
    vx: Math.cos(heading + side * SPLIT.spread) * speed,
    vy: Math.sin(heading + side * SPLIT.spread) * speed,
  }));
}

/** A bullet's path this step is sampled at its end and midpoint so fast bullets cannot skip thin rocks. */
function bulletHitsRock(bullet, rock, dt) {
  return BULLET_PATH_SAMPLES.some((back) => rockContainsPoint(rock, {
    x: bullet.x - bullet.vx * dt * back,
    y: bullet.y - bullet.vy * dt * back,
  }));
}

function destroyRock(state, rock) {
  state.score += ROCK_TIERS[rock.tier].points;
  state.rocksDestroyed += 1;
  state.rocks = state.rocks.filter((other) => other !== rock).concat(splitRock(state, rock));
}

function resolveBulletHits(state, dt) {
  state.bullets = state.bullets.filter((bullet) => {
    const rock = state.rocks.find((candidate) => bulletHitsRock(bullet, candidate, dt));
    if (rock) destroyRock(state, rock);
    return !rock;
  });
}

function resolveShipHit(state) {
  const { ship } = state;
  if (!ship.alive || ship.invulnerable > 0) return;
  if (!state.rocks.some((rock) => rockHitsShip(rock, ship))) return;
  ship.alive = false;
  ship.thrusting = false;
  ship.respawnIn = SHIP.respawnDelay;
  state.lives -= 1;
  if (state.lives <= 0) state.phase = PHASE.lost;
}

function isCentreClear(state) {
  return state.rocks.every((rock) => wrappedDistance(rock, CENTER) > SHIP.respawnClearRadius + ROCK_TIERS[rock.tier].radius);
}

function tryRespawn(state, dt) {
  state.ship.respawnIn = Math.max(0, state.ship.respawnIn - dt);
  if (state.ship.respawnIn === 0 && isCentreClear(state)) state.ship = createShip();
}

function checkWin(state) {
  const goal = state.surviveSeconds;
  if (goal !== null && state.time >= goal) state.phase = PHASE.won;
}

/**
 * Advances the game by `dt` seconds. `input` is what any pilot or sender produces:
 *   { rotate: -1|0|1, thrust: boolean, fire: boolean, spawns: [{ tier, x, y, vx, vy, free }] }
 * `tuning` holds the mode's rock limits and send-budget numbers (see config TUNING).
 */
export function step(state, input, dt, tuning) {
  if (state.phase !== PHASE.playing) return;
  state.time += dt;
  refillBudget(state, tuning, dt);
  if (state.ship.alive) {
    flyShip(state.ship, input, dt);
    fireBullet(state, input);
  } else {
    tryRespawn(state, dt);
  }
  input.spawns.forEach((spawn) => applySpawn(state, spawn, tuning));
  moveBullets(state, dt);
  moveRocks(state, tuning, dt);
  resolveBulletHits(state, dt);
  resolveShipHit(state);
  checkWin(state);
}
