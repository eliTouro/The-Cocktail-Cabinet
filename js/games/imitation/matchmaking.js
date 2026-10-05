import { MATCHMAKING } from './config.js';

const OPENING_LINES = [
  'Looking for your partner…',
  'Checking who is online…',
];

const MIDDLE_LINES = [
  (rng) => `${rng.int(3, 19)} people in the lobby`,
  () => 'Skipping someone who just left…',
  () => 'Someone looks free, asking them…',
  () => 'They said maybe, waiting…',
  (rng) => `Trying another match (${rng.int(2, 6)} in the queue)`,
];

const CLOSING_LINE = 'Found them. Saying hello…';

/**
 * How long this round's simulated search lasts. The deceiver's browser picks it and sends it to
 * the judge's, so both screens finish searching together.
 */
export function pickMatchmakingDelayMs(rng) {
  return Math.round(rng.range(MATCHMAKING.minSeconds, MATCHMAKING.maxSeconds) * 1000);
}

/**
 * A believable search lasting `delayMs`: a status line every few seconds, the closing line at
 * delayMs. Pure: the same rng seed gives the same lines. Returns [{ atMs, text }].
 */
export function planMatchmaking(rng, delayMs) {
  const stepMs = MATCHMAKING.statusEverySeconds * 1000;
  const statuses = [{ atMs: 0, text: rng.pick(OPENING_LINES) }];
  const middle = shuffled(MIDDLE_LINES, rng);
  for (let atMs = stepMs, index = 0; atMs < delayMs - stepMs / 2; atMs += stepMs, index += 1) {
    statuses.push({ atMs, text: middle[index % middle.length](rng) });
  }
  statuses.push({ atMs: delayMs, text: CLOSING_LINE });
  return statuses;
}

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.int(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
