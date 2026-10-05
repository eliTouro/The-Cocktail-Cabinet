import { ENGINE_WAIT, TYPING_SIGNAL_EVERY_MS } from './config.js';
import { ENGINE_STATE, startEngine } from './engine.js';
import { createPersona } from './persona.js';
import { createStranger } from './stranger.js';

/**
 * The deceiver's optional AI: answers the judge on the deceiver's behalf. The model starts loading
 * when a round begins on the deceiver's side (the judge cannot see this) and stays loaded for later
 * rounds, so it is usually ready by the time the deceiver picks it.
 *
 * While the AI "types", it sends a typing signal as often as a person typing would, so the judge's
 * screen looks the same whoever is answering.
 */
export function createGhostWriter(rng) {
  let engine = null;
  let progress = 0;
  let pilot = null;
  let pulse = null;
  let waitTimer = null;

  function ensureEngine() {
    engine ??= startEngine({ rng, onProgress: (value) => { progress = value; } });
  }

  /** What the deceiver should know about the engine right now, or '' when the model is ready. */
  function status() {
    if (!engine || engine.state() === ENGINE_STATE.ready) return '';
    if (engine.state() === ENGINE_STATE.fallback) return engine.failure();
    return `The AI model is loading in your browser (${Math.round(progress * 100)}%). A simpler script answers until it is ready.`;
  }

  /** Resolves when the model is ready, has failed, or ENGINE_WAIT.capMs has passed. */
  function warmUp(onStatus) {
    ensureEngine();
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        onStatus(status());
        const isWarming = engine.state() === ENGINE_STATE.warming;
        if (!isWarming || Date.now() - startedAt >= ENGINE_WAIT.capMs) return resolve();
        waitTimer = setTimeout(check, ENGINE_WAIT.pollMs);
      };
      check();
    });
  }

  function setTyping(isTyping, sendTyping) {
    clearInterval(pulse);
    pulse = null;
    if (!isTyping) return;
    sendTyping();
    pulse = setInterval(sendTyping, TYPING_SIGNAL_EVERY_MS);
  }

  function stop() {
    clearTimeout(waitTimer);
    pilot?.stop();
    pilot = null;
    clearInterval(pulse);
    pulse = null;
  }

  return {
    /** Starts loading the model without waiting, so it is ready by the time the AI is picked. */
    preload: ensureEngine,
    warmUp,
    status,
    /** Starts answering for this round. `polish` comes from the difficulty ramp. */
    start({ polish, onSay, sendTyping }) {
      ensureEngine();
      pilot = createStranger({
        getEngine: engine.current,
        persona: createPersona(rng, polish),
        rng,
        onTyping: (isTyping) => setTyping(isTyping, sendTyping),
        onSay,
      });
      pilot.start();
    },
    hear: (text) => pilot?.hear(text),
    stop,
    destroy() {
      stop();
      engine?.destroy();
    },
  };
}
