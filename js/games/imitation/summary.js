import { ROLE, VERDICT } from './config.js';

/** Words for the reveal. Pure, so the wording is testable and in one place. */

const whoWrote = (truth) => (truth === VERDICT.ai ? 'the AI' : 'a human');

export function scoreLine(score) {
  return `Judge ${score[ROLE.judge]} : Deceiver ${score[ROLE.deceiver]}`;
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
  return [truthLine, `${callLine} ${pointLine}`, scoreLine(score)];
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
