import { ramp } from '../../core/difficulty.js';

export const TOTAL_ROUNDS = 5;
/** Rounds after the first over which every difficulty knob reaches its hardest value. */
const RAMP_ROUNDS = TOTAL_ROUNDS - 1;

export const POINTS = {
  /** Your verdict on the partner was right. */
  read: 2,
  /** The partner's verdict on you was "human". */
  pass: 3,
};

export const VERDICT = { human: 'human', ai: 'ai' };

export const MAX_MESSAGE_LENGTH = 200;
export const PARTNER_LABEL = 'Stranger';

/**
 * Difficulty per round (0-based), all through core/difficulty ramp, identical for both sides:
 * - roundSeconds: chat time shrinks 100 s -> 60 s, so there is less evidence to judge on.
 * - judgeBar (Play the AI): the humanness score your messages need to pass the AI judge, 0.35 -> 0.6.
 * - personaPolish: how hard the AI works at sounding human (typos, lowercase, slang), 0.4 -> 1.
 * - autopilotChance (Play another person): the chance a side is secretly ghost-written by the
 *   in-browser AI this round, 0.2 -> 0.45, so "human" stops being a safe guess.
 */
export function tuningForRound(round) {
  return {
    roundSeconds: Math.round(ramp(100, 60, RAMP_ROUNDS, round)),
    judgeBar: ramp(0.35, 0.6, RAMP_ROUNDS, round),
    personaPolish: ramp(0.4, 1, RAMP_ROUNDS, round),
    autopilotChance: ramp(0.2, 0.45, RAMP_ROUNDS, round),
  };
}

/** Simulated matchmaking: a random wait in this range, longer if the chat engine is still warming up. */
export const MATCHMAKING = {
  minSeconds: 4,
  maxSeconds: 11,
  statusEverySeconds: 1.6,
  /** Give up waiting for the language model after this and use the built-in chat script. */
  engineWaitCapSeconds: 90,
};

/** Short pause on "Connecting…" once a friend's data channel opens, so it reads like a real match. */
export const CONNECT_PAUSE_MS = 1200;

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

/** The stranger speaks first in about half the rounds, and nudges you if you go quiet. */
export const OPENER = { chance: 0.5, minMs: 1500, maxMs: 5000 };
export const IDLE_NUDGE_MS = 22000;
