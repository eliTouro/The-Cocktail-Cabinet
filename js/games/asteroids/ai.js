import { AI_SKILL, AI_TUNING, BULLET, BULLET_RANGE, HEIGHT, SHIP, WIDTH } from './config.js';
import { normalizeAngle, wrapDelta } from './geometry.js';

const IDLE = { rotate: 0, thrust: false, fire: false };
const AIM_REROLL_SECONDS = 0.6;
const SETTLE_SPEED = 45;
const AIM_DEADBAND = (SHIP.turnRate / 60) / 2;

/** Rock position and velocity relative to the ship, using the nearest wrapped copy of the rock. */
function relative(ship, rock) {
  return {
    px: wrapDelta(ship.x, rock.x, WIDTH),
    py: wrapDelta(ship.y, rock.y, HEIGHT),
    vx: rock.vx - ship.vx,
    vy: rock.vy - ship.vy,
  };
}

/** When the rock passes closest to the ship if neither changes course, and how close that is. */
export function assessThreat(ship, rock) {
  const { px, py, vx, vy } = relative(ship, rock);
  const speedSquared = vx * vx + vy * vy;
  const unclamped = speedSquared === 0 ? 0 : -(px * vx + py * vy) / speedSquared;
  const seconds = Math.min(Math.max(unclamped, 0), AI_TUNING.threatHorizon);
  const closeX = px + vx * seconds;
  const closeY = py + vy * seconds;
  const missBy = Math.hypot(closeX, closeY);
  const isDangerous = missBy < rock.radius + SHIP.radius + AI_TUNING.dangerMargin;
  return { rock, seconds, closeX, closeY, missBy, distance: Math.hypot(px, py), isDangerous };
}

/** Heading that lands a bullet on the rock, leading the shot; null when it cannot arrive in time. */
export function interceptHeading(ship, rock) {
  const { px, py, vx, vy } = relative(ship, rock);
  const a = vx * vx + vy * vy - BULLET.speed ** 2;
  const b = 2 * (px * vx + py * vy);
  const c = px * px + py * py;
  const seconds = solveSmallestPositiveRoot(a, b, c);
  if (seconds === null || seconds > BULLET.lifetime) return null;
  return Math.atan2(py + vy * seconds, px + vx * seconds);
}

function solveSmallestPositiveRoot(a, b, c) {
  if (Math.abs(a) < 1e-9) return b === 0 ? null : positiveOrNull(-c / b);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const roots = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter((t) => t > 0);
  return roots.length ? Math.min(...roots) : null;
}

const positiveOrNull = (value) => (value > 0 ? value : null);

function turnToward(ship, heading) {
  const difference = normalizeAngle(heading - ship.angle);
  const rotate = Math.abs(difference) < AIM_DEADBAND ? 0 : Math.sign(difference);
  return { difference, rotate };
}

/**
 * The computer pilot. It receives only `observe(state)` snapshots, sees rocks `reactionDelay`
 * seconds late, aims with a random error, and outputs the same rotate / thrust / fire input a
 * human gives, so it is bound by the same turn rate, thrust, inertia and fire cooldown.
 */
export function createAi(rng, skillAt = AI_SKILL) {
  const history = [];
  let aimOffset = 0;
  let aimOffsetExpires = 0;

  function remember(observation) {
    history.push(observation);
    while (history.length > 1 && observation.time - history[0].time > AI_TUNING.historySeconds) history.shift();
  }

  function rocksAsSeenNow(observation, reactionDelay) {
    const cutoff = observation.time - reactionDelay;
    const seen = history.filter((snapshot) => snapshot.time <= cutoff).pop() ?? history[0];
    return seen.rocks;
  }

  function currentAimOffset(time, aimError) {
    if (time >= aimOffsetExpires) {
      aimOffset = rng.range(-aimError, aimError);
      aimOffsetExpires = time + AIM_REROLL_SECONDS;
    }
    return aimOffset;
  }

  function dodge(ship, threat) {
    const away = Math.hypot(threat.closeX, threat.closeY) > 1e-6
      ? Math.atan2(-threat.closeY, -threat.closeX)
      : ship.angle + Math.PI / 2;
    const { difference, rotate } = turnToward(ship, away);
    return { rotate, thrust: Math.abs(difference) < AI_TUNING.thrustAlignment, fire: false };
  }

  function shoot(ship, threat, skill, time) {
    const heading = interceptHeading(ship, threat.rock);
    if (heading === null) return IDLE;
    const { difference, rotate } = turnToward(ship, heading + currentAimOffset(time, skill.aimError));
    const reach = Math.atan2(threat.rock.radius, Math.max(threat.distance, 1));
    const tolerance = Math.max(AI_TUNING.fireAlignmentFloor, reach);
    const inRange = threat.distance - threat.rock.radius <= BULLET_RANGE;
    return { rotate, thrust: false, fire: inRange && ship.cooldown === 0 && Math.abs(normalizeAngle(heading - ship.angle)) < tolerance && Math.abs(difference) < tolerance * 2 };
  }

  function settle(ship) {
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed < SETTLE_SPEED) return IDLE;
    const { difference, rotate } = turnToward(ship, Math.atan2(-ship.vy, -ship.vx));
    return { rotate, thrust: Math.abs(difference) < AI_TUNING.thrustAlignment / 2, fire: false };
  }

  return {
    decide(observation) {
      remember(observation);
      const { ship } = observation;
      if (!ship.alive) return IDLE;
      const skill = skillAt(observation.time);
      const threats = rocksAsSeenNow(observation, skill.reactionDelay)
        .map((rock) => assessThreat(ship, rock))
        .filter((threat) => threat.isDangerous)
        .sort((a, b) => a.seconds - b.seconds);
      const imminent = threats.find((threat) => threat.seconds <= AI_TUNING.dodgeSeconds && threat.distance <= AI_TUNING.dodgeDistance);
      if (imminent) return dodge(ship, imminent);
      if (threats.length > 0) return shoot(ship, threats[0], skill, observation.time);
      return settle(ship);
    },
  };
}
