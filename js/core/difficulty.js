/**
 * Linear ramp from `from` to `to` over `seconds`, then held at `to`.
 * Games use this for every difficulty knob (speed, spawn rate, AI error) so the challenge
 * climbs gradually and identically whichever side the human or the computer plays.
 */
export function ramp(from, to, seconds, elapsedSeconds) {
  const progress = Math.min(Math.max(elapsedSeconds / seconds, 0), 1);
  return from + (to - from) * progress;
}
