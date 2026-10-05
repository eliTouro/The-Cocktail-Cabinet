/** Small seeded random generator (mulberry32). A fixed seed makes a game replayable in tests. */
export function createRng(seed = Date.now()) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** Float in [0, 1). */
    next,
    /** Float in [min, max). */
    range: (min, max) => min + next() * (max - min),
    /** Integer in [min, maxExclusive). */
    int: (min, maxExclusive) => Math.floor(min + next() * (maxExclusive - min)),
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}
