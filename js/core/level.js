/**
 * Levels give every game's difficulty ramp a name and a way to jump ahead for testing.
 * Level 1 is the easy start; level LEVEL_COUNT is where the ramp has fully climbed.
 * A game maps a level to elapsed seconds on its own ramp with `elapsedAtLevel`, starts its clock
 * there, and shows `levelAt(elapsed)` in the HUD as the round gets harder.
 *
 * Jump straight to a level by adding it to the address: #/snake/human?level=8
 */
export const LEVEL_COUNT = 10;

export function clampLevel(value) {
  const level = Math.round(Number(value));
  if (!Number.isFinite(level)) return 1;
  return Math.min(Math.max(level, 1), LEVEL_COUNT);
}

/** The level asked for in the page address, or 1. */
export function startLevelFromUrl(hash = window.location.hash) {
  const query = hash.split('?')[1] ?? '';
  return clampLevel(new URLSearchParams(query).get('level') ?? 1);
}

/** Seconds into a ramp that lasts `secondsToHardest` at which `level` begins. */
export function elapsedAtLevel(level, secondsToHardest) {
  return ((clampLevel(level) - 1) / (LEVEL_COUNT - 1)) * secondsToHardest;
}

/** Which level a round is at after `elapsedSeconds` of a ramp that lasts `secondsToHardest`. */
export function levelAt(elapsedSeconds, secondsToHardest) {
  const progress = Math.min(Math.max(elapsedSeconds / secondsToHardest, 0), 1);
  return clampLevel(1 + Math.floor(progress * (LEVEL_COUNT - 1) + 1e-9));
}
