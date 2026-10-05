import {
  AMMO_BONUS, BASE_XS, BLAST, CHAIN_BLAST, CITY_BONUS, CITY_XS, GROUND_Y, IMPACT_FLASH_SECONDS,
  IMPACT_RADIUS, INTERCEPTOR, MIN_TARGET_CLEARANCE, WARHEAD_POINTS, WIDTH,
} from './config.js';

export const PHASE = { playing: 'playing', citiesLost: 'cities-lost', survived: 'survived' };
export const REJECTION = {
  cooldown: 'cooldown',
  noAmmo: 'no-ammo',
  budget: 'not-enough-budget',
  tooManyWarheads: 'too-many-warheads',
};

/** Where a warhead aimed at `x` lands; every warhead falls to the ground line. */
export const groundTarget = (x) => ({ x: Math.min(Math.max(x, 0), WIDTH), y: GROUND_Y });

/** A request to send a warhead from `from` toward `target`. `free` launches (waves) skip budget, cap and cooldown. */
export function warheadRequest(from, target, speed, extra = {}) {
  return { kind: 'warhead', from, target, speed, ...extra };
}

/** A request to fire an interceptor at `target`; `baseIndex` picks a base, otherwise the nearest usable one fires. */
export function interceptorRequest(target, baseIndex) {
  return { kind: 'interceptor', target, baseIndex };
}

export function createState(tuning, { surviveSeconds = null } = {}) {
  return {
    time: 0,
    phase: PHASE.playing,
    surviveSeconds,
    bases: BASE_XS.map((x) => ({ x, alive: true, ammo: tuning.ammoPerBase, cooldown: 0 })),
    cities: CITY_XS.map((x) => ({ x, alive: true })),
    interceptors: [],
    warheads: [],
    blasts: [],
    impacts: [],
    nextId: 1,
    score: 0,
    wave: 0,
    waveActive: false,
    unlaunched: 0,
    lastWaveBonus: 0,
    warheadsDestroyed: 0,
    warheadsSent: 0,
    budget: tuning.startBudget,
    launchCooldown: 0,
    ammoRefillProgress: 0,
  };
}

/** What a defender may see: positions, velocities, bases (ammo, cooldown), cities and blasts, but no bookkeeping. */
export function observe(state) {
  return {
    time: state.time,
    launchCooldown: state.launchCooldown,
    bases: state.bases.map(({ x, alive, ammo, cooldown }) => ({ x, alive, ammo, cooldown })),
    cities: state.cities.map(({ x, alive }) => ({ x, alive })),
    warheads: state.warheads.map(({ id, x, y, vx, vy }) => ({ id, x, y, vx, vy })),
    interceptors: state.interceptors.map(({ x, y, tx, ty }) => ({ x, y, tx, ty })),
    blasts: state.blasts.map(({ x, y, age, spec }) => ({ x, y, age, radius: blastRadius({ age, spec }) })),
  };
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Radius of a blast at its current age: grows linearly, then shrinks linearly to nothing. */
export function blastRadius({ age, spec }) {
  if (age < spec.growSeconds) return spec.maxRadius * (age / spec.growSeconds);
  return spec.maxRadius * Math.max(0, 1 - (age - spec.growSeconds) / spec.shrinkSeconds);
}

const isBlastOver = (blast) => blast.age >= blast.spec.growSeconds + blast.spec.shrinkSeconds;

function headingFor(from, target, speed) {
  const length = distance(from, target) || 1;
  return { vx: ((target.x - from.x) / length) * speed, vy: ((target.y - from.y) / length) * speed, length };
}

function createFlyer(state, from, target, speed, extra) {
  const { vx, vy, length } = headingFor(from, target, speed);
  return {
    id: state.nextId++, x: from.x, y: from.y, fromX: from.x, fromY: from.y, vx, vy, speed,
    tx: target.x, ty: target.y, remaining: length, ...extra,
  };
}

function nearestUsableBase(state, target, baseIndex) {
  const pool = baseIndex === undefined ? state.bases : [state.bases[baseIndex]];
  const usable = pool.filter((base) => base.alive && base.ammo > 0 && base.cooldown === 0);
  return usable.sort((a, b) => Math.abs(a.x - target.x) - Math.abs(b.x - target.x))[0];
}

function interceptorRejection(state, baseIndex) {
  const pool = baseIndex === undefined ? state.bases : [state.bases[baseIndex]];
  const hasAmmo = pool.some((base) => base.alive && base.ammo > 0);
  return hasAmmo ? REJECTION.cooldown : REJECTION.noAmmo;
}

function clampTarget(target) {
  return { x: Math.min(Math.max(target.x, 0), WIDTH), y: Math.min(Math.max(target.y, 0), GROUND_Y - MIN_TARGET_CLEARANCE) };
}

/** Why an interceptor request would be refused right now, or null if it would fire. */
export function interceptorRejectionFor(state, request) {
  if (state.launchCooldown > 0) return REJECTION.cooldown;
  return nearestUsableBase(state, request.target, request.baseIndex) ? null : interceptorRejection(state, request.baseIndex);
}

function fireInterceptor(state, request, tuning) {
  const rejection = interceptorRejectionFor(state, request);
  if (rejection) return rejection;
  const target = clampTarget(request.target);
  const base = nearestUsableBase(state, target, request.baseIndex);
  base.ammo -= 1;
  base.cooldown = tuning.baseCooldown;
  state.launchCooldown = tuning.launchCooldown;
  const origin = { x: base.x, y: GROUND_Y };
  state.interceptors.push(createFlyer(state, origin, target, INTERCEPTOR.speed, {}));
  return null;
}

/** Why a warhead request would be refused right now, or null if it would launch. */
export function warheadRejectionFor(state, request, tuning) {
  if (request.free) return null;
  if (state.launchCooldown > 0) return REJECTION.cooldown;
  if (state.budget < 1) return REJECTION.budget;
  if (state.warheads.length >= tuning.maxWarheads) return REJECTION.tooManyWarheads;
  return null;
}

function launchWarhead(state, request, tuning) {
  const rejection = warheadRejectionFor(state, request, tuning);
  if (rejection) return rejection;
  if (!request.free) {
    state.budget -= 1;
    state.launchCooldown = tuning.launchCooldown;
  } else if (state.unlaunched > 0) {
    state.unlaunched -= 1;
  }
  state.warheads.push(createFlyer(state, request.from, request.target, request.speed, {
    splitAt: request.splitAt ?? null, children: request.children ?? [],
  }));
  state.warheadsSent += 1;
  return null;
}

function applyLaunches(state, launches, tuning) {
  launches.forEach((request) => {
    if (request.kind === 'interceptor') fireInterceptor(state, request, tuning);
    else launchWarhead(state, request, tuning);
  });
}

function tickClocks(state, dt, tuning) {
  state.launchCooldown = Math.max(0, state.launchCooldown - dt);
  state.bases.forEach((base) => { base.cooldown = Math.max(0, base.cooldown - dt); });
  state.budget = Math.min(tuning.budgetCap, state.budget + tuning.budgetRefill * dt);
  state.ammoRefillProgress += tuning.ammoRefillPerSecond * dt;
  while (state.ammoRefillProgress >= 1) {
    state.ammoRefillProgress -= 1;
    const needy = state.bases.filter((base) => base.alive && base.ammo < tuning.ammoPerBase);
    if (needy.length === 0) state.ammoRefillProgress = 0;
    else needy.sort((a, b) => a.ammo - b.ammo)[0].ammo += 1;
  }
}

/** Moves a flyer toward its target; true when it reaches it this step. */
function advance(flyer, dt) {
  const travelled = flyer.speed * dt;
  if (travelled >= flyer.remaining) {
    flyer.x = flyer.tx;
    flyer.y = flyer.ty;
    return true;
  }
  flyer.x += flyer.vx * dt;
  flyer.y += flyer.vy * dt;
  flyer.remaining -= travelled;
  return false;
}

export function createBlast(state, x, y, spec) {
  state.blasts.push({ id: state.nextId++, x, y, age: 0, spec });
}

function flyInterceptors(state, dt) {
  state.interceptors = state.interceptors.filter((interceptor) => {
    const arrived = advance(interceptor, dt);
    if (arrived) createBlast(state, interceptor.tx, interceptor.ty, BLAST);
    return !arrived;
  });
}

function splitWarhead(state, warhead) {
  const children = warhead.children.map((targetX) => createFlyer(state, warhead, groundTarget(targetX), warhead.speed, { splitAt: null, children: [] }));
  state.warheadsSent += children.length;
  warhead.children = [];
  warhead.splitAt = null;
  return children;
}

function strikeGround(state, warhead) {
  state.impacts.push({ x: warhead.x, y: warhead.y, age: 0 });
  [...state.cities, ...state.bases].forEach((structure) => {
    if (structure.alive && Math.abs(structure.x - warhead.x) <= IMPACT_RADIUS) {
      structure.alive = false;
      if ('ammo' in structure) structure.ammo = 0;
    }
  });
}

function flyWarheads(state, dt) {
  const spawned = [];
  const flying = state.warheads.filter((warhead) => {
    const landed = advance(warhead, dt);
    if (landed) strikeGround(state, warhead);
    else if (warhead.splitAt !== null && warhead.y >= warhead.splitAt) spawned.push(...splitWarhead(state, warhead));
    return !landed;
  });
  state.warheads = [...flying, ...spawned];
}

function ageBlastsAndImpacts(state, dt) {
  state.blasts.forEach((blast) => { blast.age += dt; });
  state.blasts = state.blasts.filter((blast) => !isBlastOver(blast));
  state.impacts.forEach((impact) => { impact.age += dt; });
  state.impacts = state.impacts.filter((impact) => impact.age < IMPACT_FLASH_SECONDS);
}

function destroyWarheadsInBlasts(state) {
  const survivors = [];
  state.warheads.forEach((warhead) => {
    const isHit = state.blasts.some((blast) => distance(blast, warhead) <= blastRadius(blast));
    if (!isHit) survivors.push(warhead);
    else {
      state.warheadsDestroyed += 1;
      state.score += WARHEAD_POINTS;
      createBlast(state, warhead.x, warhead.y, CHAIN_BLAST);
    }
  });
  state.warheads = survivors;
}

function isWaveCleared(state) {
  return state.waveActive && state.unlaunched === 0
    && state.warheads.length === 0 && state.interceptors.length === 0 && state.blasts.length === 0;
}

/** Surviving cities and unspent ammo are paid out, then every standing base is restocked. */
function settleWave(state, tuning) {
  const standing = state.cities.filter((city) => city.alive).length;
  const unspent = state.bases.reduce((sum, base) => sum + base.ammo, 0);
  state.lastWaveBonus = standing * CITY_BONUS + unspent * AMMO_BONUS;
  state.score += state.lastWaveBonus;
  state.bases.forEach((base) => { if (base.alive) base.ammo = tuning.ammoPerBase; });
  state.waveActive = false;
}

function updatePhase(state) {
  if (state.cities.every((city) => !city.alive)) state.phase = PHASE.citiesLost;
  else if (state.surviveSeconds !== null && state.time >= state.surviveSeconds) state.phase = PHASE.survived;
}

/**
 * One fixed step. `input` is { launches, startWave }: launches are interceptor or warhead requests
 * from whoever is playing, startWave (classic mode only) is how many warheads the new wave will send.
 */
export function step(state, input, dt, tuning) {
  if (state.phase !== PHASE.playing) return;
  state.time += dt;
  if (input.startWave) {
    state.wave += 1;
    state.waveActive = true;
    state.unlaunched = input.startWave;
  }
  tickClocks(state, dt, tuning);
  applyLaunches(state, input.launches, tuning);
  flyInterceptors(state, dt);
  flyWarheads(state, dt);
  ageBlastsAndImpacts(state, dt);
  destroyWarheadsInBlasts(state);
  if (tuning.waves && isWaveCleared(state)) settleWave(state, tuning);
  updatePhase(state);
}
