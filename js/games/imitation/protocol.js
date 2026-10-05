import { MAX_MESSAGE_LENGTH, VERDICT } from './config.js';

export const PROTOCOL_VERSION = 1;

/**
 * Messages between two browsers over the data channel, as JSON. The inviter (host) starts each
 * round; both sides then follow the same rules. Every message is validated on the way in, since
 * the other end is someone else's browser.
 */
export const MESSAGE = {
  hello: 'hello',
  start: 'start',
  chat: 'chat',
  typing: 'typing',
  verdict: 'verdict',
  ready: 'ready',
  bye: 'bye',
};

const isRound = (value) => Number.isInteger(value) && value >= 0;
const isChatText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_MESSAGE_LENGTH;
const isVerdict = (value) => Object.values(VERDICT).includes(value);

const VALIDATORS = {
  [MESSAGE.hello]: (m) => m.version === PROTOCOL_VERSION,
  [MESSAGE.start]: (m) => isRound(m.round),
  [MESSAGE.chat]: (m) => isChatText(m.text),
  [MESSAGE.typing]: () => true,
  [MESSAGE.verdict]: (m) => isRound(m.round) && isVerdict(m.verdict) && typeof m.wasAi === 'boolean',
  [MESSAGE.ready]: (m) => isRound(m.round),
  [MESSAGE.bye]: () => true,
};

export function encodeMessage(message) {
  if (!isValid(message)) throw new Error(`invalid ${message?.type ?? 'message'}`);
  return JSON.stringify(message);
}

/** Returns the message, or null if it is not one we understand. */
export function decodeMessage(text) {
  try {
    const message = JSON.parse(text);
    return isValid(message) ? message : null;
  } catch {
    return null;
  }
}

function isValid(message) {
  const validate = message && typeof message === 'object' && VALIDATORS[message.type];
  return Boolean(validate && validate(message));
}
