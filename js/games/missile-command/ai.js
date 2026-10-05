import {
  AI_SKILL, AI_TUNING, BLAST, GROUND_Y, IMPACT_RADIUS, INTERCEPTOR, MIN_TARGET_CLEARANCE, WIDTH,
} from './config.js';
import { interceptorRequest } from './rules.js';

const NO_LAUNCHES = { launches: [] };

/** Seconds until the warhead reaches the ground, if it keeps its course. */
export const secondsToImpact = (warhead) => (warhead.vy > 0 ? (GROUND_Y - warhead.y) / warhead.vy : Infinity);

export const positionAfter = (warhead, seconds) => ({
  x: warhead.x + warhead.vx * seconds,
  y: warhead.y + warhead.vy * seconds,
});

function threatenedStructure(observation, warhead) {
  const landingX = positionAfter(warhead, secondsToImpact(warhead)).x;
  const reach = IMPACT_RADIUS + AI_TUNING.threatMargin;
  const isInReach = (structure) => structure.alive && Math.abs(structure.x - landingX) <= reach;
  return observation.cities.some(isInReach) || observation.bases.some(isInReach);
}

/**
 * Where a base should detonate to catch the warhead: the interceptor's flight time depends on the
 * aim point, which depends on the flight time, so a few rounds of refinement settle it.
 * Null when the shot cannot arrive before the warhead lands or the point is out of bounds.
 */
export function interceptPlan(base, warhead) {
  const lead = AI_TUNING.leadSeconds;
  let flight = Math.hypot(warhead.x - base.x, warhead.y - GROUND_Y) / INTERCEPTOR.speed;
  let point = positionAfter(warhead, flight + lead);
  for (let round = 0; round < AI_TUNING.aimIterations; round += 1) {
    flight = Math.hypot(point.x - base.x, point.y - GROUND_Y) / INTERCEPTOR.speed;
    point = positionAfter(warhead, flight + lead);
  }
  const isOnTime = flight + lead + AI_TUNING.arrivalMargin < secondsToImpact(warhead);
  const isInBounds = point.x >= 0 && point.x <= WIDTH && point.y >= 0 && point.y <= GROUND_Y - MIN_TARGET_CLEARANCE;
  return isOnTime && isInBounds ? { point, flight } : null;
}

const totalAmmo = (observation) => observation.bases.reduce((sum, base) => sum + (base.alive ? base.ammo : 0), 0);

/**
 * The computer defender. It receives only `observe(state)` snapshots and outputs the same
 * interceptor requests a human gives, so base ammo, cooldowns, interceptor speed and blast
 * collisions bind it exactly as they bind a person. It notices warheads late, leads its shots
 * with an aim error, sometimes misjudges what a warhead threatens, and shuffles its priorities.
 */
export function createAi(rng, skillAt = AI_SKILL) {
  const judgements = new Map();
  const committedUntil = new Map();

  function judge(warhead, observation, skill) {
    if (!judgements.has(warhead.id)) {
      judgements.set(warhead.id, {
        seenAt: observation.time,
        isMisjudged: rng.next() < skill.mistakeRate,
        priorityShift: rng.range(-skill.priorityNoise, skill.priorityNoise),
      });
    }
    return judgements.get(warhead.id);
  }

  function isWorthEngaging(warhead, judgement, observation) {
    const seconds = secondsToImpact(warhead);
    const looksThreatening = threatenedStructure(observation, warhead) !== (judgement.isMisjudged && seconds > AI_TUNING.panicSeconds);
    if (!looksThreatening) return false;
    const isRationing = totalAmmo(observation) < AI_TUNING.rationBelowAmmo;
    return !isRationing || seconds <= AI_TUNING.rationHorizonSeconds;
  }

  function bestShot(observation, warhead) {
    const shots = observation.bases
      .map((base, index) => ({ base, index, plan: base.alive && base.ammo > 0 && base.cooldown === 0 ? interceptPlan(base, warhead) : null }))
      .filter((shot) => shot.plan);
    return shots.sort((a, b) => a.plan.flight - b.plan.flight)[0] ?? null;
  }

  function launchAt(shot, warhead, observation, skill) {
    committedUntil.set(warhead.id, observation.time + shot.plan.flight + BLAST.growSeconds + AI_TUNING.commitSeconds);
    const aimed = {
      x: shot.plan.point.x + rng.range(-skill.aimError, skill.aimError),
      y: shot.plan.point.y + rng.range(-skill.aimError, skill.aimError),
    };
    return { launches: [interceptorRequest(aimed, shot.index)] };
  }

  return {
    decide(observation) {
      if (observation.launchCooldown > 0) return NO_LAUNCHES;
      const skill = skillAt(observation.time);
      const candidates = observation.warheads
        .map((warhead) => ({ warhead, judgement: judge(warhead, observation, skill) }))
        .filter(({ judgement }) => observation.time - judgement.seenAt >= skill.reactionDelay)
        .filter(({ warhead }) => (committedUntil.get(warhead.id) ?? 0) <= observation.time)
        .filter(({ warhead, judgement }) => isWorthEngaging(warhead, judgement, observation))
        .sort((a, b) => (secondsToImpact(a.warhead) + a.judgement.priorityShift) - (secondsToImpact(b.warhead) + b.judgement.priorityShift));
      for (const { warhead } of candidates) {
        const shot = bestShot(observation, warhead);
        if (shot) return launchAt(shot, warhead, observation, skill);
      }
      return NO_LAUNCHES;
    },
  };
}
