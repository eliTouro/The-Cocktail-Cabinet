import { IDLE_NUDGE_MS, OPENER } from './config.js';
import { createFallbackBot } from './fallbackBot.js';
import { cleanReply, humanize, typingDelayMs } from './persona.js';

const NUDGES = ['u there?', 'hello?', 'lol ok', '??', 'helloooo'];

const realTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (id) => clearTimeout(id),
  now: () => performance.now(),
};

/**
 * Drives a chat engine as one side of a conversation, with human pacing: it may open, replies to
 * what it hears after a believable typing delay (one reply at a time, catching up on anything said
 * meanwhile), and nudges once if the chat goes quiet. Used for the AI stranger and for autopilot.
 *
 * `getEngine()` returns the engine to use right now; `timers` can be stubbed in tests.
 */
export function createStranger({ getEngine, persona, rng, onTyping, onSay, timers = realTimers }) {
  const script = createFallbackBot(rng);
  const history = [];
  const pending = new Set();
  let abort = null;
  let isBusy = false;
  let owesReply = false;
  let hasNudged = false;
  let isStopped = false;
  let nudgeTimer = null;
  let openerTimer = null;

  function later(callback, ms) {
    const id = timers.set(() => {
      pending.delete(id);
      callback();
    }, ms);
    pending.add(id);
    return id;
  }

  function cancel(id) {
    timers.clear(id);
    pending.delete(id);
  }

  function restartNudgeTimer() {
    if (nudgeTimer !== null) cancel(nudgeTimer);
    nudgeTimer = hasNudged ? null : later(nudge, IDLE_NUDGE_MS);
  }

  function nudge() {
    if (isBusy || isStopped) return;
    hasNudged = true;
    say(rng.pick(NUDGES));
  }

  function say(text) {
    history.push({ role: 'self', text });
    onSay(text);
    restartNudgeTimer();
  }

  async function respond() {
    if (isBusy) {
      owesReply = true;
      return;
    }
    isBusy = true;
    owesReply = false;
    abort = new AbortController();
    const startedAt = timers.now();
    onTyping(true);
    const line = await composeLine();
    if (isStopped) return;
    const text = humanize(line, persona, rng);
    const remaining = Math.max(typingDelayMs(text, rng) - (timers.now() - startedAt), 0);
    later(() => deliver(text), remaining);
  }

  /** The engine's line, or the scripted bot's when the engine fails or gives the game away. */
  async function composeLine() {
    try {
      const line = cleanReply(await getEngine().reply([...history], persona, { signal: abort.signal }));
      if (line) return line;
    } catch {
      // An interrupted or failed generation falls through to the script.
    }
    return script.reply(history, persona);
  }

  function deliver(text) {
    onTyping(false);
    isBusy = false;
    say(text);
    if (owesReply) respond();
  }

  return {
    start() {
      if (rng.next() < OPENER.chance) openerTimer = later(respond, rng.range(OPENER.minMs, OPENER.maxMs));
      restartNudgeTimer();
    },
    hear(text) {
      if (isStopped) return;
      if (openerTimer !== null) cancel(openerTimer);
      openerTimer = null;
      history.push({ role: 'other', text });
      restartNudgeTimer();
      respond();
    },
    history: () => [...history],
    stop() {
      isStopped = true;
      abort?.abort();
      pending.forEach((id) => timers.clear(id));
      pending.clear();
      onTyping(false);
    },
  };
}
