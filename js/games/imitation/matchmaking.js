import { MATCHMAKING } from './config.js';

const OPENING_LINES = [
  'Looking for someone to chat with…',
  'Checking who is online…',
];

const MIDDLE_LINES = [
  (rng) => `${rng.int(3, 19)} people in the lobby`,
  () => 'Skipping someone who just left…',
  () => 'Someone looks free, asking them…',
  () => 'They said maybe, waiting…',
  (rng) => `Trying another match (${rng.int(2, 6)} in the queue)`,
];

const CLOSING_LINE = 'Found someone. Saying hello…';

export const STILL_SEARCHING_LINE = 'Busy night. Still looking…';

/**
 * A believable search: a random wait between MATCHMAKING.minSeconds and maxSeconds, with a status
 * line every few seconds. Pure: the same rng seed gives the same schedule.
 * Returns { delayMs, statuses: [{ atMs, text }] } with the closing line at delayMs.
 */
export function planMatchmaking(rng) {
  const delayMs = Math.round(rng.range(MATCHMAKING.minSeconds, MATCHMAKING.maxSeconds) * 1000);
  const stepMs = MATCHMAKING.statusEverySeconds * 1000;
  const statuses = [{ atMs: 0, text: rng.pick(OPENING_LINES) }];
  const middle = shuffled(MIDDLE_LINES, rng);
  for (let atMs = stepMs, index = 0; atMs < delayMs - stepMs / 2; atMs += stepMs, index += 1) {
    statuses.push({ atMs, text: middle[index % middle.length](rng) });
  }
  statuses.push({ atMs: delayMs, text: CLOSING_LINE });
  return { delayMs, statuses };
}

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
