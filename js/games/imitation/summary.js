import { ROLE, VERDICT } from './config.js';
import { oppositeRole } from './match.js';

/** Words for the goal strip, the score and the reveal. Pure, so the wording is testable and in one place. */

const whoWrote = (truth) => (truth === VERDICT.ai ? 'the AI' : 'a human');

/** `viewerRole` (optional) marks the viewer's own side with "(you)". */
export function scoreLine(score, viewerRole = null) {
  const side = (role, name) => `${name}${role === viewerRole ? ' (you)' : ''} ${score[role]}`;
  return `${side(ROLE.judge, 'Judge')} : ${side(ROLE.deceiver, 'Deceiver')}`;
}

/**
 * The viewer's goal this round, always on screen during the chat. The deceiver scores when the
 * judge calls it wrong, so their goal flips with their secret choice: a deceiver answering
 * themselves wants to be called an AI, and one letting the AI answer wants it called human.
 * `truth` is only passed on the deceiver's side; the judge never sees it.
 */
export function goalLine(role, truth = null) {
  if (role === ROLE.judge) {
    return 'Chat freely, then press "Make my call": was that a human or an AI? A right call is your point.';
  }
  return truth === VERDICT.ai
    ? 'The AI is answering for you this round. Your point if the judge calls it human.'
    : 'You are answering yourself this round. Your point if the judge calls you an AI.';
}

/** `result` is { verdict, truth, winner } from settleRound; `role` is the viewer's own role. */
export function revealLines(result, role, score) {
  const truthLine = role === ROLE.judge
    ? `Your partner's replies were written by ${whoWrote(result.truth)}.`
    : `Your replies were written by ${whoWrote(result.truth)}.`;
  const callLine = role === ROLE.judge
    ? `You said ${result.verdict === VERDICT.ai ? 'AI' : 'human'}.`
    : `The judge said ${result.verdict === VERDICT.ai ? 'AI' : 'human'}.`;
  const pointLine = result.winner === role ? 'The point is yours.' : `The point goes to the ${result.winner}.`;
  return [truthLine, `${callLine} ${pointLine}`, scoreLine(score, role)];
}

/** Who is ahead when the match ends: 'won', 'lost' or 'drawn', from the viewer's side. */
export function matchOutcome(score, role) {
  const mine = score[role];
  const theirs = score[oppositeRole(role)];
  if (mine === theirs) return 'drawn';
  return mine > theirs ? 'won' : 'lost';
}

/** Starts a wall-clock countdown; returns stop(). Calls onTick(secondsLeft, fractionLeft). */
export function startCountdown(seconds, { onTick, onDone }) {
  const endsAt = Date.now() + seconds * 1000;
  const tick = () => {
    const leftMs = endsAt - Date.now();
    onTick(Math.ceil(leftMs / 1000), leftMs / (seconds * 1000));
    if (leftMs <= 0) {
      clearInterval(timer);
      onDone();
    }
  };
  const timer = setInterval(tick, 250);
  tick();
  return () => clearInterval(timer);
}
