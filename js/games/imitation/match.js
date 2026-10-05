import { ROLE, VERDICT } from './config.js';

/**
 * One browser's view of the match, as a pure state machine. Roles never swap, and rounds are
 * open-ended: the score just accumulates until someone leaves.
 *
 *   connecting -> matchmaking -> choosing -> chatting -> verdict -> reveal -> matchmaking ...
 *
 * "choosing" is when the deceiver privately picks who writes their replies (themselves or the
 * AI); on the judge's side it is the "your partner is getting ready" wait. The judge only learns
 * the truth at the reveal.
 */
export const PHASE = {
  connecting: 'connecting',
  matchmaking: 'matchmaking',
  choosing: 'choosing',
  chatting: 'chatting',
  verdict: 'verdict',
  reveal: 'reveal',
};

export const SIDE = { me: 'me', partner: 'partner' };

export const oppositeRole = (role) => (role === ROLE.judge ? ROLE.deceiver : ROLE.judge);

/** The judge is right when the verdict names who really wrote the deceiver's replies. */
export const judgeIsRight = (verdict, truth) => verdict === truth;

export function createMatch(role) {
  if (!Object.values(ROLE).includes(role)) throw new Error(`unknown role ${role}`);
  return {
    role,
    round: 0,
    phase: PHASE.connecting,
    score: { [ROLE.judge]: 0, [ROLE.deceiver]: 0 },
    truth: null,
    ready: { me: false, partner: false },
    results: [],
  };
}

/** Starts the first round after connecting, or the next one after a reveal. */
export function startMatchmaking(match) {
  expectPhase(match, PHASE.connecting, PHASE.reveal);
  if (match.phase === PHASE.reveal) match.round += 1;
  match.phase = PHASE.matchmaking;
  match.truth = null;
  match.ready = { me: false, partner: false };
}

export function endMatchmaking(match) {
  expectPhase(match, PHASE.matchmaking);
  match.phase = PHASE.choosing;
}

/** The deceiver's secret: VERDICT.human ("I'll answer myself") or VERDICT.ai. */
export function chooseTruth(match, truth) {
  expectPhase(match, PHASE.choosing);
  if (match.role !== ROLE.deceiver) throw new Error('only the deceiver chooses');
  expectVerdict(truth);
  match.truth = truth;
}

export function startChat(match) {
  expectPhase(match, PHASE.choosing);
  if (match.role === ROLE.deceiver && !match.truth) throw new Error('the deceiver has not chosen');
  match.phase = PHASE.chatting;
}

export function endChat(match) {
  expectPhase(match, PHASE.chatting);
  match.phase = PHASE.verdict;
}

/** Scores the round: a point to the judge for a right call, otherwise to the deceiver. */
export function settleRound(match, { verdict, truth }) {
  expectPhase(match, PHASE.verdict);
  expectVerdict(verdict);
  expectVerdict(truth);
  const winner = judgeIsRight(verdict, truth) ? ROLE.judge : ROLE.deceiver;
  match.score[winner] += 1;
  match.truth = truth;
  const result = { round: match.round, verdict, truth, winner };
  match.results.push(result);
  match.phase = PHASE.reveal;
  return result;
}

/** "Play again" pressed on one side; returns true once both sides have pressed it. */
export function markReady(match, side) {
  expectPhase(match, PHASE.reveal);
  match.ready[side] = true;
  return match.ready.me && match.ready.partner;
}

function expectVerdict(value) {
  if (!Object.values(VERDICT).includes(value)) throw new Error(`unknown verdict ${value}`);
}

function expectPhase(match, ...phases) {
  if (!phases.includes(match.phase)) throw new Error(`expected ${phases.join(' or ')}, was ${match.phase}`);
}
