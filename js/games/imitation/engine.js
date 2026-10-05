import { REPLY_MAX_TOKENS, REPLY_SAMPLING, WEBLLM_MODEL, WEBLLM_URL } from './config.js';
import { createFallbackBot } from './fallbackBot.js';
import { toPromptMessages } from './persona.js';

/**
 * Chat engines share one interface:
 *   { kind, reply(history, persona, { signal }) -> Promise<string>, destroy() }
 * 'webllm' is an open small language model running on the visitor's GPU through WebLLM: no key,
 * no server, nothing typed leaves the browser. 'script' is the fallback bot.
 *
 * startEngine() hands out the fallback straight away and swaps in the model when it has loaded,
 * so callers just ask current() for whichever is ready.
 */
export const ENGINE_STATE = { warming: 'warming', ready: 'ready', fallback: 'fallback' };

export function startEngine({ rng, onProgress = () => {} }) {
  const fallback = createFallbackBot(rng);
  let model = null;
  let isDestroyed = false;
  let state = ENGINE_STATE.warming;
  let failure = '';

  const settled = loadModel(onProgress)
    .then((loaded) => {
      if (isDestroyed) return loaded.destroy();
      model = loaded;
      state = ENGINE_STATE.ready;
    })
    .catch((error) => {
      state = ENGINE_STATE.fallback;
      failure = error.message;
    });

  return {
    current: () => model ?? fallback,
    state: () => state,
    failure: () => failure,
    settled,
    destroy() {
      isDestroyed = true;
      model?.destroy();
    },
  };
}

async function loadModel(onProgress) {
  if (!navigator.gpu) {
    throw new Error('This browser has no WebGPU (it needs a recent Chrome or Edge, on https or localhost), so the built-in chat script is used instead.');
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU is blocked on this device (check that hardware acceleration is on), so the built-in chat script is used instead.');
  }
  const webllm = await import(WEBLLM_URL);
  const engine = await webllm.CreateMLCEngine(WEBLLM_MODEL, {
    initProgressCallback: (report) => onProgress(report.progress),
  });
  return createModelEngine(engine);
}

function createModelEngine(engine) {
  return {
    kind: 'webllm',
    async reply(history, persona, { signal } = {}) {
      const interrupt = () => engine.interruptGenerate();
      signal?.addEventListener('abort', interrupt);
      try {
        const completion = await engine.chat.completions.create({
          messages: toPromptMessages(history, persona),
          max_tokens: REPLY_MAX_TOKENS,
          ...REPLY_SAMPLING,
        });
        return completion.choices[0]?.message?.content ?? '';
      } finally {
        signal?.removeEventListener('abort', interrupt);
      }
    },
    destroy() {
      engine.interruptGenerate();
      engine.unload();
    },
  };
}
