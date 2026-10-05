import { POINTS, VERDICT } from './config.js';

/**
 * The match as a pure state machine, the same for both modes and both sides:
 *   matching -> chatting -> verdict -> reveal -> (matching | over)
 * Each side files a verdict about the other ("human" or "ai") together with the truth about
 * itself (was an AI writing its messages?). Once both are in, the round is scored.
 */
export const PHASE = {
  matching: 'matching',
  chatting: 'chatting',
  verdict: 'verdict',
  reveal: 'reveal',
  over: 'over',
};

export const SIDE = { me: 'me', partner: 'partner' };

export function createMatch({ totalRounds }) {
  return {
    totalRounds,
    round: 0,
    phase: PHASE.matching,
    totals: { me: 0, partner: 0 },
    filed: { me: null, partner: null },
    results: [],
  };
}

export function startChat(match) {
  expectPhase(match, PHASE.matching);
  match.phase = PHASE.chatting;
  match.filed = { me: null, partner: null };
}

export function endChat(match) {
  expectPhase(match, PHASE.chatting);
  match.phase = PHASE.verdict;
}

/** `filing` is { verdict, wasAi }: the side's verdict on the other, and the truth about itself. */
export function fileVerdict(match, side, filing) {
  if (match.phase !== PHASE.verdict && match.phase !== PHASE.chatting) {
    throw new Error(`cannot file a verdict while ${match.phase}`);
  }
  if (!Object.values(VERDICT).includes(filing.verdict)) throw new Error('unknown verdict');
  match.filed[side] = { verdict: filing.verdict, wasAi: Boolean(filing.wasAi) };
  if (match.phase === PHASE.verdict && match.filed.me && match.filed.partner) reveal(match);
}

export function nextRound(match) {
  expectPhase(match, PHASE.reveal);
  if (match.round + 1 >= match.totalRounds) {
    match.phase = PHASE.over;
    return;
  }
  match.round += 1;
  match.phase = PHASE.matching;
}

export function currentResult(match) {
  return match.results[match.results.length - 1] ?? null;
}

/**
 * Read: your verdict on the partner was correct. Pass: the partner's verdict on you was "human".
 * Pass is the twist that keeps the game alive when the mode already says who is on the other end:
 * you score for coming across as human, judged by your friend or by the AI judge.
 */
export function scoreRound({ me, partner }) {
  return {
    me: scoreSide(me, partner),
    partner: scoreSide(partner, me),
  };
}

function scoreSide(self, other) {
  const read = self.verdict === truthOf(other) ? POINTS.read : 0;
  const pass = other.verdict === VERDICT.human ? POINTS.pass : 0;
  return { read, pass, total: read + pass };
}

function truthOf(filing) {
  return filing.wasAi ? VERDICT.ai : VERDICT.human;
}

function reveal(match) {
  const score = scoreRound(match.filed);
  match.totals.me += score.me.total;
  match.totals.partner += score.partner.total;
  match.results.push({ round: match.round, filed: match.filed, score });
  match.phase = PHASE.reveal;
}

function expectPhase(match, phase) {
  if (match.phase !== phase) throw new Error(`expected ${phase}, was ${match.phase}`);
}
