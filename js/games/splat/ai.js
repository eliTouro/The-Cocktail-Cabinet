import { AI_FLAP_BELOW_TARGET, AI_SKILL, GRAVITY, HOVER_Y } from './config.js';

/**
 * The computer pilot. It only receives `observe(state)` snapshots, so it can see nothing a human
 * could not. It notices it is too low and flaps `reactionDelay` seconds later.
 * Its only output is a flap request, the same input a human gives.
 */
export function createAi(rng, skillAt = AI_SKILL) {
  let flapDueTime = null;
  const aimOffsets = new Map();

  function offsetFor(columnId, aimError) {
    if (!aimOffsets.has(columnId)) aimOffsets.set(columnId, rng.range(-aimError, aimError));
    return aimOffsets.get(columnId);
  }

  function targetY(observation, aimError) {
    const next = observation.columns[0];
    return next ? next.gapCenter + offsetFor(next.id, aimError) : HOVER_Y;
  }

  return {
    decide(observation) {
      const { reactionDelay, aimError } = skillAt(observation.time);
      if (flapDueTime !== null) {
        const isDue = observation.time >= flapDueTime;
        if (isDue) flapDueTime = null;
        return { flap: isDue };
      }
      if (shouldFlap(observation, targetY(observation, aimError), reactionDelay)) flapDueTime = observation.time + reactionDelay;
      return { flap: false };
    },
  };
}

/** Flap if, by the time the flap lands, the creature would have sagged below the target. */
export function shouldFlap({ y, vy }, targetY, reactionDelay) {
  const landedY = y + vy * reactionDelay;
  return landedY > targetY + AI_FLAP_BELOW_TARGET;
}
