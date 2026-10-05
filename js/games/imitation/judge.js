import { VERDICT } from './config.js';

/**
 * The AI's verdict on you in "Play the AI": a transparent heuristic for how human a set of chat
 * messages reads, from 0 (bot) to 1 (person). It rewards what people do in quick chats (short,
 * casual lines, questions back, variety) and penalises what assistants do (long, polished,
 * formal sentences). Deterministic, so players can learn it and it can be tested.
 */
const CASUAL_WORDS = /\b(lol|lmao|haha+|idk|tbh|ngl|omg|yeah|yea|nah|nope|kinda|gonna|wanna|u|ur|rn|btw|hmm+|ok|okay|bro|dude)\b/i;
const FORMAL_WORDS = /\b(certainly|additionally|furthermore|however,|as an ai|assist you|i am here to|feel free|in conclusion|overall,)\b/i;
const IDEAL_WORDS = { min: 2, max: 16 };
const LONG_WORDS = 30;

const WEIGHTS = {
  casual: 0.3,
  brevity: 0.25,
  curiosity: 0.15,
  variety: 0.15,
  engagement: 0.15,
};
const FORMAL_PENALTY = 0.3;
/** Messages needed for full engagement credit. */
const ENGAGED_MESSAGES = 4;

export function humanityScore(messages) {
  const texts = messages.map((text) => text.trim()).filter(Boolean);
  if (texts.length === 0) return 0;
  const share = (test) => texts.filter(test).length / texts.length;
  const words = (text) => text.split(/\s+/).length;

  const casual = share((text) => CASUAL_WORDS.test(text) || /^[a-z]/.test(text));
  const brevity = share((text) => words(text) >= IDEAL_WORDS.min && words(text) <= IDEAL_WORDS.max);
  const curiosity = texts.some((text) => text.includes('?')) ? 1 : 0;
  const variety = new Set(texts.map((text) => text.toLowerCase())).size / texts.length;
  const engagement = Math.min(texts.length / ENGAGED_MESSAGES, 1);
  const formality = share((text) => FORMAL_WORDS.test(text) || words(text) > LONG_WORDS);

  const score = WEIGHTS.casual * casual + WEIGHTS.brevity * brevity + WEIGHTS.curiosity * curiosity
    + WEIGHTS.variety * variety + WEIGHTS.engagement * engagement - FORMAL_PENALTY * formality;
  return Math.min(Math.max(score, 0), 1);
}

export function judgeVerdict(messages, bar) {
  return humanityScore(messages) >= bar ? VERDICT.human : VERDICT.ai;
}
