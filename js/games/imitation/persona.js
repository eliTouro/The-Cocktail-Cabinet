import { MAX_MESSAGE_LENGTH, PROMPT_HISTORY_LIMIT, TYPING } from './config.js';

/**
 * Who the AI pretends to be, and how its words are made to look typed by a person.
 * Pure: everything random comes from the rng passed in.
 *
 * History items are { role: 'self' | 'other', text }, seen from the speaker's side.
 */

const PLACES = ['ohio', 'leeds', 'toronto', 'melbourne', 'texas', 'dublin', 'portland', 'manchester'];
const JOBS = ['barista', 'nursing student', 'warehouse shifts', 'IT helpdesk', 'retail', 'high school senior', 'line cook', 'between jobs'];
const HOBBIES = ['skating', 'guitar', 'fantasy football', 'baking', 'anime', 'climbing', 'thrifting', 'video games'];
const MOODS = ['bored', 'tired', 'chill', 'a bit hyper', 'procrastinating'];

const SLANG = [
  [/\byou\b/g, 'u'],
  [/\bare\b/g, 'r'],
  [/\bto be honest\b/g, 'tbh'],
  [/\bi don't know\b/g, 'idk'],
  [/\bbecause\b/g, 'cuz'],
];

/** Things a small model says that no stranger in a chat room would. */
const GIVEAWAYS = /\b(as an ai|language model|ai model|i am an ai|i'm an ai|artificial intelligence|assistant|machine|chatbot|help you|assist|how can i|i'm here to|happy to help)\b/i;

/** `polish` (0..1, from the difficulty ramp) sets how much effort goes into seeming human. */
export function createPersona(rng, polish) {
  return {
    age: rng.int(17, 34),
    place: rng.pick(PLACES),
    job: rng.pick(JOBS),
    hobby: rng.pick(HOBBIES),
    mood: rng.pick(MOODS),
    polish,
    lowercase: rng.next() < 0.7 + 0.3 * polish,
    slangChance: 0.15 + 0.35 * polish,
    typoChance: 0.05 + 0.15 * polish,
  };
}

export function buildSystemPrompt(persona) {
  return [
    `You are a ${persona.age} year old from ${persona.place} chatting with a stranger on an anonymous chat site.`,
    `You do ${persona.job}, you are into ${persona.hobby}, and you feel ${persona.mood}.`,
    'Reply like a real person texting: one short line, under 12 words, casual, lowercase, no emojis, no lists.',
    'You are not here to help anyone. Ask a question back sometimes.',
    'Never say you are an AI, a bot or an assistant; if asked, laugh it off.',
    `Your style: "hey", "lol not much, kinda bored", "im from ${persona.place} hbu", "haha no im just slow at typing".`,
  ].join(' ');
}

/**
 * Chat messages for an instruct model: the persona as system prompt, recent history as turns.
 * Turns must alternate user/assistant and start with the user, so runs of messages are merged.
 */
export function toPromptMessages(history, persona) {
  const turns = [];
  for (const { role, text } of history.slice(-PROMPT_HISTORY_LIMIT)) {
    const speaker = role === 'self' ? 'assistant' : 'user';
    const previous = turns[turns.length - 1];
    if (previous?.role === speaker) previous.content += `\n${text}`;
    else turns.push({ role: speaker, content: text });
  }
  if (turns.length === 0 || turns[0].role === 'assistant') turns.unshift({ role: 'user', content: '(you are now connected, say hi)' });
  return [{ role: 'system', content: buildSystemPrompt(persona) }, ...turns];
}

/** One clean chat line from raw model output, or null if it would give the game away. */
export function cleanReply(raw) {
  const firstLine = String(raw).split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  const text = firstLine
    .replace(/^(stranger|me|you|assistant|user)\s*:\s*/i, '')
    .replace(/^["'“]+|["'”]+$/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .trim();
  if (!text || GIVEAWAYS.test(text)) return null;
  return text.slice(0, MAX_MESSAGE_LENGTH);
}

/** Make a reply look typed: lowercase, dropped full stops, slang and the odd typo. */
export function humanize(text, persona, rng) {
  let result = persona.lowercase ? text.toLowerCase() : text;
  result = result.replace(/\.$/, '').replace(/!+$/, rng.next() < 0.5 ? '!' : '');
  if (rng.next() < persona.slangChance) {
    for (const [pattern, short] of SLANG) result = result.replace(pattern, short);
  }
  if (rng.next() < persona.typoChance) result = swapTwoLetters(result, rng);
  return result;
}

function swapTwoLetters(text, rng) {
  const positions = [...text.matchAll(/[a-z](?=[a-z])/g)].map((match) => match.index);
  if (positions.length === 0) return text;
  const at = rng.pick(positions);
  return text.slice(0, at) + text[at + 1] + text[at] + text.slice(at + 2);
}

/** How long a person would take to think of and type `text`. */
export function typingDelayMs(text, rng) {
  const think = rng.range(TYPING.thinkMinMs, TYPING.thinkMaxMs);
  const typing = text.length * rng.range(TYPING.msPerCharMin, TYPING.msPerCharMax);
  return Math.round(Math.min(think + typing, TYPING.maxMs));
}
