import { ramp } from '../../core/difficulty.js';

/** The two roles. The route's mode is always the viewer's own role: #/imitation/<role>. */
export const ROLE = { judge: 'judge', deceiver: 'deceiver' };

/** A judge's verdict, and the truth about who wrote the deceiver's replies, share one vocabulary. */
export const VERDICT = { human: 'human', ai: 'ai' };

export const MAX_MESSAGE_LENGTH = 200;

/** Rounds are open-ended, so every difficulty knob reaches its hardest value here and holds. */
const RAMP_ROUNDS = 3;

/**
 * Difficulty per round (0-based), through core/difficulty ramp, the same in both browsers:
 * - roundSeconds: chat time shrinks 100 s -> 75 s, so the judge has less evidence; the judge can
 *   always call it early, and 75 s is still a real conversation.
 * - personaPolish: how hard the deceiver's AI works at sounding human (lowercase, slang, typos),
 *   0.4 -> 1, so "AI" gets harder to spot as the evening goes on.
 */
export function tuningForRound(round) {
  return {
    roundSeconds: Math.round(ramp(100, 75, RAMP_ROUNDS, round)),
    personaPolish: ramp(0.4, 1, RAMP_ROUNDS, round),
  };
}

/** Simulated matchmaking before every round: a random wait in this range, with status lines. */
export const MATCHMAKING = {
  minSeconds: 3,
  maxSeconds: 8,
  statusEverySeconds: 1.6,
};

/**
 * After the deceiver picks the AI, wait this long at most for the language model to load before
 * the chat opens; until it is ready the scripted bot answers. The model starts loading when the
 * round begins, so only a first-time download (about 0.9 GB) on a slow connection reaches the cap.
 */
export const ENGINE_WAIT = { capMs: 40000, pollMs: 500 };

/** People send a typing signal at most this often while typing; the AI's typing mimics it. */
export const TYPING_SIGNAL_EVERY_MS = 2000;

/**
 * The only third-party service: a public STUN server, used for stateless address discovery so two
 * browsers on different networks can find each other. Set to [] to play on the same network only.
 */
export const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
/** Stop waiting for ICE candidates after this, and use whatever was gathered. */
export const ICE_GATHER_TIMEOUT_MS = 4000;

export const WEBLLM_URL = 'https://esm.run/@mlc-ai/web-llm@0.2.85';
/**
 * Llama 3.2 1B (about 0.9 GB of GPU memory) chats far more coherently than the 0.5B model it
 * replaced. The 1.5B and 3B models were tried and crashed on an integrated GPU, so 1B is the
 * largest that loads reliably.
 */
export const WEBLLM_MODEL = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
export const REPLY_MAX_TOKENS = 30;
/** Low temperature, a nucleus cut and a repeat penalty keep a 1B model from rambling or looping. */
export const REPLY_SAMPLING = { temperature: 0.6, top_p: 0.9, frequency_penalty: 0.6 };
/** Tries per reply before the scripted bot steps in; a rejected line is usually fixed by a re-roll. */
export const REPLY_ATTEMPTS = 3;
/** Only the most recent messages go into the prompt; small models lose the plot on long context. */
export const PROMPT_HISTORY_LIMIT = 12;

/** Human-like reply timing. */
export const TYPING = {
  thinkMinMs: 900,
  thinkMaxMs: 2600,
  msPerCharMin: 70,
  msPerCharMax: 140,
  maxMs: 11000,
};

/** The AI speaks first in about half the rounds, and nudges the judge if they go quiet. */
export const OPENER = { chance: 0.5, minMs: 1500, maxMs: 5000 };
export const IDLE_NUDGE_MS = 22000;
