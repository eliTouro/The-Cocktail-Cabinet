import { MATCHMAKING, MAX_MESSAGE_LENGTH, ROLE, VERDICT } from './config.js';

export const PROTOCOL_VERSION = 2;

/**
 * Messages between the two browsers over the data channel, as JSON. Every message is validated on
 * the way in, since the other end is someone else's browser.
 *
 *   hello        both    my role (the invited side adopts the opposite of the inviter's)
 *   matchmake    D -> J  a round starts: search for delayMs, then get ready
 *   deceiverReady D -> J the deceiver has secretly chosen; the chat opens
 *   chat, typing both
 *   chatOver     J -> D  the judge is making the call (early, or the clock ran out)
 *   verdict      J -> D  the judge's call
 *   reveal       D -> J  the call and the truth, so both score the round the same way
 *   ready        both    "Play again" pressed
 *   bye          both    leaving
 *
 * The deceiver's browser drives the rounds because it alone knows the truth.
 */
export const MESSAGE = {
  hello: 'hello',
  matchmake: 'matchmake',
  deceiverReady: 'deceiverReady',
  chat: 'chat',
  typing: 'typing',
  chatOver: 'chatOver',
  verdict: 'verdict',
  reveal: 'reveal',
  ready: 'ready',
  bye: 'bye',
};

const isRound = (value) => Number.isInteger(value) && value >= 0;
const isRole = (value) => Object.values(ROLE).includes(value);
const isVerdict = (value) => Object.values(VERDICT).includes(value);
const isChatText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_MESSAGE_LENGTH;
const isDelay = (value) => Number.isInteger(value)
  && value >= MATCHMAKING.minSeconds * 1000 && value <= MATCHMAKING.maxSeconds * 1000;

const VALIDATORS = {
  [MESSAGE.hello]: (m) => m.version === PROTOCOL_VERSION && isRole(m.role),
  [MESSAGE.matchmake]: (m) => isRound(m.round) && isDelay(m.delayMs),
  [MESSAGE.deceiverReady]: (m) => isRound(m.round),
  [MESSAGE.chat]: (m) => isChatText(m.text),
  [MESSAGE.typing]: () => true,
  [MESSAGE.chatOver]: (m) => isRound(m.round),
  [MESSAGE.verdict]: (m) => isRound(m.round) && isVerdict(m.verdict),
  [MESSAGE.reveal]: (m) => isRound(m.round) && isVerdict(m.verdict) && isVerdict(m.truth),
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
