/**
 * A lightweight scripted stranger for browsers without WebGPU (or while the model is unavailable).
 * Same engine interface as the language model: reply(history, persona) -> Promise<string>.
 * It answers the usual small-talk topics from its persona, dodges "are you a bot", and otherwise
 * reacts and asks something back. Pure apart from the rng it is given.
 */
const TOPICS = [
  { pattern: /\b(bot|ai|robot|human|real person|computer|chatgpt)\b/i, lines: () => ['lol what', 'haha are YOU a bot', 'nah im real, just slow at typing', 'thats exactly what a bot would ask'] },
  { pattern: /\b(where|from|live)\b/i, lines: (p) => [`${p.place}, u?`, `${p.place} lol`, `im in ${p.place}. where r u`] },
  { pattern: /\b(old|age)\b/i, lines: (p) => [`${p.age}`, `${p.age} hbu`, `${p.age}, why`] },
  { pattern: /\b(job|work|school|study|do you do|do u do)\b/i, lines: (p) => [`${p.job}`, `${p.job} rn, its ok`, `${p.job}. not exciting lol`] },
  { pattern: /\b(fun|hobby|hobbies|free time|into|like to)\b/i, lines: (p) => [`${p.hobby} mostly`, `${p.hobby} when im not tired`, `${p.hobby}! u?`] },
  { pattern: /\b(how are|how r|how's it|hows it|wyd|what's up|whats up|sup)\b/i, lines: (p) => [`${p.mood} tbh`, `im ok, kinda ${p.mood}`, `${p.mood}. u?`] },
  { pattern: /^(hi+|hey+|hello|yo|hiya)\b/i, lines: () => ['hey', 'heyy', 'hi :)', 'yo whats up'] },
];

const OPENERS = ['hey', 'hi', 'heyy whats up', 'hello stranger', 'yo'];
const SHRUGS = ['hmm good question', 'idk honestly', 'depends tbh', 'thats a lot to think about lol'];
const REACTIONS = ['lol fair', 'oh nice', 'haha same', 'wait really', 'ok that makes sense', 'oh thats cool', 'damn'];
const FOLLOW_UPS = ['what about u?', 'where r u from', 'what u up to today', 'u like it?', 'how old r u'];
const FOLLOW_UP_CHANCE = 0.4;

export function createFallbackBot(rng) {
  function choose(options, history) {
    const used = new Set(history.filter((item) => item.role === 'self').map((item) => item.text));
    const fresh = options.filter((line) => !used.has(line));
    return rng.pick(fresh.length > 0 ? fresh : options);
  }

  function compose(history, persona) {
    const last = [...history].reverse().find((item) => item.role === 'other');
    if (!last) return choose(OPENERS, history);
    const topic = TOPICS.find(({ pattern }) => pattern.test(last.text));
    if (topic) return choose(topic.lines(persona), history);
    const base = choose(last.text.includes('?') ? SHRUGS : REACTIONS, history);
    return rng.next() < FOLLOW_UP_CHANCE ? `${base}. ${choose(FOLLOW_UPS, history)}` : base;
  }

  return {
    kind: 'script',
    reply: (history, persona) => Promise.resolve(compose(history, persona)),
    destroy() {},
  };
}
