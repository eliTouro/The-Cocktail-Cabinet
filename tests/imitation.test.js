import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRng } from '../js/core/rng.js';
import { MATCHMAKING, POINTS, TOTAL_ROUNDS, TYPING, VERDICT, tuningForRound } from '../js/games/imitation/config.js';
import { createFallbackBot } from '../js/games/imitation/fallbackBot.js';
import { humanityScore, judgeVerdict } from '../js/games/imitation/judge.js';
import {
  PHASE, SIDE, createMatch, currentResult, endChat, fileVerdict, nextRound, scoreRound, startChat,
} from '../js/games/imitation/match.js';
import { planMatchmaking } from '../js/games/imitation/matchmaking.js';
import { cleanReply, createPersona, humanize, toPromptMessages, typingDelayMs } from '../js/games/imitation/persona.js';
import { MESSAGE, PROTOCOL_VERSION, decodeMessage, encodeMessage } from '../js/games/imitation/protocol.js';
import {
  CODE_KIND, SignalCodeError, decodeSignal, encodeSignal, inviteLink, packSdp, readInviteFromHash,
} from '../js/games/imitation/signal.js';
import { createStranger } from '../js/games/imitation/stranger.js';

const FINGERPRINT = Array.from({ length: 32 }, (_, i) => (i * 7 + 3).toString(16).toUpperCase().padStart(2, '0')).join(':');

const CHROME_OFFER = [
  'v=0',
  'o=- 4611731400430051336 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 54321 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 203.0.113.9',
  'a=candidate:842163049 1 udp 2122260223 3b1d5f0e-9a4c-4d1e-8c2b-7f6a5e4d3c2b.local 54321 typ host generation 0 network-cost 999',
  'a=candidate:842163049 1 udp 2122260223 3b1d5f0e-9a4c-4d1e-8c2b-7f6a5e4d3c2b.local 54321 typ host generation 0 network-cost 999',
  'a=candidate:1510613869 1 tcp 1518280447 192.168.1.20 9 typ host tcptype active generation 0',
  'a=candidate:3253228232 1 udp 1686052607 203.0.113.9 54321 typ srflx raddr 0.0.0.0 rport 0 generation 0',
  'a=ice-ufrag:Xy9q',
  'a=ice-pwd:aB3dE5fG7hI9jK1lM3nO5pQ7',
  'a=ice-options:trickle',
  `a=fingerprint:sha-256 ${FINGERPRINT}`,
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

/* ---------- Signalling codes ---------- */

test('an invite code round-trips the fields a data channel needs', async () => {
  const code = await encodeSignal({ type: 'offer', sdp: CHROME_OFFER });
  assert.equal(code[0], CODE_KIND.invite);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.ok(code.length < 200, `code is ${code.length} characters`);

  const decoded = await decodeSignal(code, CODE_KIND.invite);
  assert.equal(decoded.type, 'offer');
  assert.equal(packSdp(decoded.sdp), packSdp(CHROME_OFFER));
  for (const line of ['a=ice-ufrag:Xy9q', 'a=ice-pwd:aB3dE5fG7hI9jK1lM3nO5pQ7', `a=fingerprint:sha-256 ${FINGERPRINT}`, 'a=setup:actpass', 'a=mid:0']) {
    assert.ok(decoded.sdp.includes(line), line);
  }
  assert.equal(decoded.sdp.match(/a=candidate:/g).length, 2, 'duplicates and TCP candidates are dropped');
  assert.ok(decoded.sdp.includes('203.0.113.9 54321 typ srflx raddr 0.0.0.0 rport 0'));
});

test('a reply code keeps the answering DTLS role', async () => {
  const answer = CHROME_OFFER.replace('a=setup:actpass', 'a=setup:active');
  const code = await encodeSignal({ type: 'answer', sdp: answer });
  assert.equal(code[0], CODE_KIND.reply);
  const decoded = await decodeSignal(`  ${code.slice(0, 20)}\n${code.slice(20)}  `, CODE_KIND.reply);
  assert.equal(decoded.type, 'answer');
  assert.ok(decoded.sdp.includes('a=setup:active'));
});

test('codes in the wrong box or mangled get friendly errors', async () => {
  const invite = await encodeSignal({ type: 'offer', sdp: CHROME_OFFER });
  await assert.rejects(decodeSignal(invite, CODE_KIND.reply), (error) => error instanceof SignalCodeError && /your own invite/.test(error.message));
  await assert.rejects(decodeSignal('', CODE_KIND.reply), SignalCodeError);
  await assert.rejects(decodeSignal('hello there', CODE_KIND.invite), SignalCodeError);
  await assert.rejects(decodeSignal(invite.slice(0, 30), CODE_KIND.invite), (error) => /cut off/.test(error.message));
});

test('an invite link carries the code past the router and can be pasted whole', async () => {
  const code = await encodeSignal({ type: 'offer', sdp: CHROME_OFFER });
  const link = inviteLink('https://games.example/#/imitation/human', code);
  assert.equal(link, `https://games.example/#/imitation/human/join/${code}`);
  const hash = link.slice(link.indexOf('#'));
  const [gameId, modeId] = hash.replace(/^#\/?/, '').split('/');
  assert.deepEqual([gameId, modeId], ['imitation', 'human']);
  assert.equal(readInviteFromHash(hash), code);
  assert.equal(readInviteFromHash('#/imitation/human'), null);
  assert.equal((await decodeSignal(link, CODE_KIND.invite)).type, 'offer');
});

/* ---------- Matchmaking ---------- */

test('matchmaking waits between the configured bounds, with status lines in order', () => {
  for (let seed = 1; seed <= 300; seed += 1) {
    const { delayMs, statuses } = planMatchmaking(createRng(seed));
    assert.ok(delayMs >= MATCHMAKING.minSeconds * 1000 && delayMs <= MATCHMAKING.maxSeconds * 1000);
    assert.equal(statuses[0].atMs, 0);
    assert.equal(statuses[statuses.length - 1].atMs, delayMs);
    statuses.forEach((status, i) => i > 0 && assert.ok(status.atMs > statuses[i - 1].atMs));
    statuses.forEach((status) => assert.equal(typeof status.text, 'string'));
  }
});

test('matchmaking delays vary', () => {
  const delays = new Set(Array.from({ length: 20 }, (_, seed) => planMatchmaking(createRng(seed + 1)).delayMs));
  assert.ok(delays.size > 15);
});

/* ---------- Match and scoring ---------- */

test('scoring: read for a right verdict, pass for being judged human', () => {
  const score = scoreRound({
    me: { verdict: VERDICT.ai, wasAi: false },
    partner: { verdict: VERDICT.human, wasAi: true },
  });
  assert.deepEqual(score.me, { read: POINTS.read, pass: POINTS.pass, total: POINTS.read + POINTS.pass });
  assert.deepEqual(score.partner, { read: POINTS.read, pass: 0, total: POINTS.read });

  const fooled = scoreRound({
    me: { verdict: VERDICT.human, wasAi: false },
    partner: { verdict: VERDICT.ai, wasAi: true },
  });
  assert.deepEqual(fooled.me, { read: 0, pass: 0, total: 0 });
  assert.deepEqual(fooled.partner, { read: 0, pass: POINTS.pass, total: POINTS.pass });
});

test('a match runs matching -> chatting -> verdict -> reveal for every round, then ends', () => {
  const match = createMatch({ totalRounds: TOTAL_ROUNDS });
  for (let round = 0; round < TOTAL_ROUNDS; round += 1) {
    assert.equal(match.phase, PHASE.matching);
    assert.equal(match.round, round);
    startChat(match);
    endChat(match);
    fileVerdict(match, SIDE.me, { verdict: VERDICT.ai, wasAi: false });
    assert.equal(match.phase, PHASE.verdict, 'waits for the partner');
    fileVerdict(match, SIDE.partner, { verdict: VERDICT.human, wasAi: true });
    assert.equal(match.phase, PHASE.reveal);
    assert.equal(currentResult(match).round, round);
    nextRound(match);
  }
  assert.equal(match.phase, PHASE.over);
  assert.deepEqual(match.totals, { me: TOTAL_ROUNDS * 5, partner: TOTAL_ROUNDS * 2 });
});

test('a partner verdict that arrives before my clock runs out waits for mine', () => {
  const match = createMatch({ totalRounds: 1 });
  startChat(match);
  fileVerdict(match, SIDE.partner, { verdict: VERDICT.human, wasAi: false });
  assert.equal(match.phase, PHASE.chatting);
  endChat(match);
  fileVerdict(match, SIDE.me, { verdict: VERDICT.human, wasAi: false });
  assert.equal(match.phase, PHASE.reveal);
  assert.deepEqual(match.totals, { me: 5, partner: 5 });
});

test('the match refuses out-of-order steps and unknown verdicts', () => {
  const match = createMatch({ totalRounds: 1 });
  assert.throws(() => endChat(match));
  assert.throws(() => fileVerdict(match, SIDE.me, { verdict: VERDICT.ai, wasAi: false }));
  startChat(match);
  endChat(match);
  assert.throws(() => fileVerdict(match, SIDE.me, { verdict: 'maybe', wasAi: false }));
});

/* ---------- Chat protocol ---------- */

test('protocol messages encode, decode and are validated', () => {
  const samples = [
    { type: MESSAGE.hello, version: PROTOCOL_VERSION },
    { type: MESSAGE.start, round: 2 },
    { type: MESSAGE.chat, text: 'hey whats up' },
    { type: MESSAGE.typing },
    { type: MESSAGE.verdict, round: 0, verdict: VERDICT.ai, wasAi: true },
    { type: MESSAGE.ready, round: 1 },
    { type: MESSAGE.bye },
  ];
  for (const message of samples) assert.deepEqual(decodeMessage(encodeMessage(message)), message);

  assert.equal(decodeMessage('not json'), null);
  assert.equal(decodeMessage(JSON.stringify({ type: 'hack' })), null);
  assert.equal(decodeMessage(JSON.stringify({ type: MESSAGE.chat, text: '   ' })), null);
  assert.equal(decodeMessage(JSON.stringify({ type: MESSAGE.chat, text: 'x'.repeat(500) })), null);
  assert.equal(decodeMessage(JSON.stringify({ type: MESSAGE.verdict, round: -1, verdict: 'ai', wasAi: true })), null);
  assert.throws(() => encodeMessage({ type: MESSAGE.start, round: 'one' }));
});

/* ---------- Difficulty ---------- */

test('difficulty ramps monotonically from the first round to the last, within fair bounds', () => {
  const rounds = Array.from({ length: TOTAL_ROUNDS }, (_, round) => tuningForRound(round));
  for (let i = 1; i < rounds.length; i += 1) {
    assert.ok(rounds[i].roundSeconds < rounds[i - 1].roundSeconds);
    assert.ok(rounds[i].judgeBar > rounds[i - 1].judgeBar);
    assert.ok(rounds[i].personaPolish > rounds[i - 1].personaPolish);
    assert.ok(rounds[i].autopilotChance > rounds[i - 1].autopilotChance);
  }
  assert.ok(rounds[TOTAL_ROUNDS - 1].roundSeconds >= 60);
  assert.ok(rounds[TOTAL_ROUNDS - 1].judgeBar < 1 && rounds[0].judgeBar > 0);
  assert.ok(rounds[TOTAL_ROUNDS - 1].autopilotChance < 0.5 && rounds[0].autopilotChance > 0);
});

/* ---------- Judge ---------- */

test('the judge finds casual chat human and assistant prose robotic', () => {
  const casual = ['hey lol', 'nah im from ohio, u?', 'haha same, kinda tired tbh', 'what do u do for fun'];
  const formal = [
    'Certainly! I would be happy to assist you with any questions you might have about this topic today.',
    'Additionally, it is important to consider many different perspectives when discussing such matters in depth.',
  ];
  assert.ok(humanityScore(casual) > 0.8);
  assert.ok(humanityScore(formal) < 0.2);
  assert.equal(humanityScore([]), 0);
  assert.equal(judgeVerdict(casual, tuningForRound(TOTAL_ROUNDS - 1).judgeBar), VERDICT.human);
  assert.equal(judgeVerdict(formal, tuningForRound(0).judgeBar), VERDICT.ai);
  assert.equal(judgeVerdict([], tuningForRound(0).judgeBar), VERDICT.ai);
});

/* ---------- Persona and fallback bot ---------- */

test('replies are cleaned of speaker tags, and giveaways are rejected', () => {
  assert.equal(cleanReply('Stranger: "hey there"\nmore text'), 'hey there');
  assert.equal(cleanReply('As an AI language model, I cannot.'), null);
  assert.equal(cleanReply('Hi there! How can I help you today?'), null);
  assert.equal(cleanReply('   '), null);
});

test('the stranger swaps a giveaway from the model for a scripted line', async () => {
  const timers = createFakeTimers();
  const rng = createRng(8);
  const said = [];
  const stranger = createStranger({
    getEngine: () => ({ reply: async () => 'As an AI assistant I am happy to help you.' }),
    persona: createPersona(rng, 0.5),
    rng,
    timers,
    onTyping: () => {},
    onSay: (text) => said.push(text),
  });
  stranger.hear('hi');
  await timers.advance(2 * TYPING.maxMs);
  assert.equal(said.length, 1);
  assert.doesNotMatch(said[0], /assist|help|\bai\b/i);
});

test('the stranger re-rolls a rejected model line before falling back to the script', async () => {
  const timers = createFakeTimers();
  const rng = createRng(8);
  const replies = ['How can I assist you today?', 'inception is my fave'];
  const said = [];
  const stranger = createStranger({
    getEngine: () => ({ reply: async () => replies.shift() ?? 'lol' }),
    persona: { ...createPersona(rng, 0.5), lowercase: true, slangChance: 0, typoChance: 0 },
    rng,
    timers,
    onTyping: () => {},
    onSay: (text) => said.push(text),
  });
  stranger.hear('inception or star wars');
  await timers.advance(2 * TYPING.maxMs);
  assert.deepEqual(said, ['inception is my fave']);
});

test('a prompt always ends on the human turn, even when they type while the stranger is replying', async () => {
  const timers = createFakeTimers();
  const rng = createRng(3);
  const persona = createPersona(rng, 0.5);
  const lastRoles = [];
  const stranger = createStranger({
    getEngine: () => ({
      reply: async (history) => {
        lastRoles.push(toPromptMessages(history, persona).at(-1).role);
        return 'inception for sure';
      },
    }),
    persona,
    rng,
    timers,
    onTyping: () => {},
    onSay: () => {},
  });
  stranger.hear('hello');
  stranger.hear('are you a robot');
  stranger.hear('what movies do you like');
  await timers.advance(6 * TYPING.maxMs);
  assert.ok(lastRoles.length >= 2, 'the stranger answers the messages typed while it was busy');
  assert.deepEqual([...new Set(lastRoles)], ['user']);
});

test('humanize lowercases and drops the full stop for a casual persona', () => {
  const persona = { ...createPersona(createRng(1), 1), lowercase: true, slangChance: 0, typoChance: 0 };
  assert.equal(humanize('I live in Leeds.', persona, createRng(1)), 'i live in leeds');
});

test('prompt turns alternate and start with the user', () => {
  const persona = createPersona(createRng(2), 0.5);
  const messages = toPromptMessages([
    { role: 'self', text: 'hey' },
    { role: 'other', text: 'hi' },
    { role: 'other', text: 'where are you from' },
  ], persona);
  const roles = messages.slice(1).map((m) => m.role);
  assert.equal(messages[0].role, 'system');
  assert.equal(roles[0], 'user');
  roles.slice(1).forEach((role, index) => assert.notEqual(role, roles[index]));
  assert.deepEqual(roles.slice(-3), ['user', 'assistant', 'user']);
  assert.equal(messages.at(-1).content, 'hi\nwhere are you from');
});

test('example turns come before the real chat and use the persona job', () => {
  const persona = { ...createPersona(createRng(2), 0.5), job: 'line cook' };
  const messages = toPromptMessages([{ role: 'other', text: 'hello' }], persona);
  assert.ok(messages.some((m) => m.role === 'assistant' && m.content.includes('line cook')));
  assert.equal(messages.at(-1).content, 'hello');
});

test('typing delay grows with message length and stays capped', () => {
  const short = typingDelayMs('hi', createRng(9));
  const long = typingDelayMs('x'.repeat(60), createRng(9));
  assert.ok(long > short);
  assert.ok(typingDelayMs('x'.repeat(5000), createRng(9)) <= TYPING.maxMs);
});

test('the fallback bot answers from its persona and dodges the bot question', async () => {
  const rng = createRng(5);
  const bot = createFallbackBot(rng);
  const persona = createPersona(rng, 0.5);
  const ask = (text) => bot.reply([{ role: 'other', text }], persona);
  assert.match(await ask('where are you from?'), new RegExp(persona.place));
  assert.match(await ask('how old are you'), new RegExp(String(persona.age)));
  assert.doesNotMatch(await ask('are you a bot?'), /\b(yes|i am an ai)\b/i);
  assert.ok((await bot.reply([], persona)).length > 0);
});

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const queue = new Map();
  return {
    set(callback, ms) {
      const id = nextId++;
      queue.set(id, { at: now + ms, callback });
      return id;
    },
    clear: (id) => queue.delete(id),
    now: () => now,
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        await new Promise((resolve) => setImmediate(resolve));
        const due = [...queue.entries()].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].callback();
      }
      now = target;
    },
    pending: () => queue.size,
  };
}

test('the stranger replies after a human-like typing delay, one reply at a time', async () => {
  const timers = createFakeTimers();
  const rng = createRng(11);
  const said = [];
  const typing = [];
  const stranger = createStranger({
    getEngine: () => createFallbackBot(rng),
    persona: createPersona(rng, 0.5),
    rng,
    timers,
    onTyping: (isTyping) => typing.push(isTyping),
    onSay: (text) => said.push({ text, at: timers.now() }),
  });
  stranger.hear('hey');
  stranger.hear('where are you from?');
  await timers.advance(TYPING.thinkMinMs - 1);
  assert.equal(said.length, 0, 'nothing arrives instantly');
  await timers.advance(2 * TYPING.maxMs);
  assert.equal(said.length, 2, 'it catches up on both messages');
  assert.ok(said[0].at >= TYPING.thinkMinMs);
  assert.equal(typing[0], true);
  assert.equal(stranger.history().filter((item) => item.role === 'self').length, 2);
});

test('the stranger nudges once when the chat goes quiet, and stop() cancels everything', async () => {
  const timers = createFakeTimers();
  const rng = createRng(4);
  const said = [];
  const stranger = createStranger({
    getEngine: () => createFallbackBot(rng),
    persona: createPersona(rng, 0.5),
    rng: { ...rng, next: () => 0.99 },
    timers,
    onTyping: () => {},
    onSay: (text) => said.push(text),
  });
  stranger.start();
  await timers.advance(60000);
  assert.equal(said.length, 1, 'one nudge, no opener at this rng');
  stranger.hear('sorry');
  stranger.stop();
  await timers.advance(60000);
  assert.equal(said.length, 1);
  assert.equal(timers.pending(), 0);
});
