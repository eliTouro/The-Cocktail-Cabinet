import { VERDICT } from './config.js';

/** Words for the reveal and the final score. Pure, so the wording is testable and in one place. */

const kindOf = (wasAi) => (wasAi ? 'an AI' : 'a human');
const verdictWord = (verdict) => (verdict === VERDICT.human ? 'human' : 'an AI');
const points = (value) => (value > 0 ? `+${value}` : '0');

/** `result` is a match result ({ filed, score }); `partnerLabel` names the other side. */
export function revealLines(result, partnerLabel) {
  const { filed, score } = result;
  const name = partnerLabel.toLowerCase();
  return [
    `The ${name} was ${kindOf(filed.partner.wasAi)}. You said ${verdictWord(filed.me.verdict)}: read ${points(score.me.read)}.`,
    `The ${name} judged you ${verdictWord(filed.partner.verdict)}: pass ${points(score.me.pass)}.`,
    `Round: you ${points(score.me.total)}, ${name} ${points(score.partner.total)}.`,
  ];
}

export function finalSummary(totals, partnerLabel) {
  const name = partnerLabel.toLowerCase();
  if (totals.me > totals.partner) return `You win, ${totals.me} to ${totals.partner}. You read the ${name} better than it read you.`;
  if (totals.me < totals.partner) return `The ${name} wins, ${totals.partner} to ${totals.me}. Sound more like yourself next time.`;
  return `A draw at ${totals.me} each.`;
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
