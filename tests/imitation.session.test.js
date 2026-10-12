import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { MATCHMAKING, ROLE, VERDICT } from '../js/games/imitation/config.js';
import { MESSAGE } from '../js/games/imitation/protocol.js';
import { SOUNDS } from '../js/games/imitation/sounds.js';
import { EFFECTS } from '../js/core/sound.js';
import { connect, createClock, createPlayer, settle } from './imitationSession.js';

/** Long enough for any simulated matchmaking search to finish. */
const SEARCH_MS = MATCHMAKING.maxSeconds * 1000 + 1000;
const players = [];

afterEach(() => {
  players.splice(0).forEach((player) => player.session.destroy());
});

/** A judge who invites and a deceiver who joins, connected, through the first search. */
function startMatch({ inviterRole = ROLE.judge, inviteeRole = ROLE.deceiver } = {}) {
  const clock = createClock();
  const inviter = createPlayer(inviterRole, clock, { seed: 1 });
  const invitee = createPlayer(inviteeRole, clock, { seed: 2 });
  players.push(inviter, invitee);
  return { clock, wire: connect(inviter, invitee), inviter, invitee };
}

/** Runs the search, the deceiver's secret choice and opens the chat on both sides. */
async function reachChat({ clock, wire }, deceiver, truth) {
  clock.advance(SEARCH_MS);
  wire.pump();
  deceiver.clickCard(truth === VERDICT.ai ? 'Let the AI answer' : 'answer myself');
  await settle();
  wire.pump();
}

/** The judge calls it early, picks `verdict`, and the reveal travels both ways. */
function callIt({ wire }, judge, verdict) {
  judge.view.handlers.composer.onCallIt();
  wire.pump();
  judge.view.handlers.verdict(verdict);
  wire.pump();
  wire.pump();
}

function chatBothWays({ wire }, judge, deceiver, truth) {
  judge.view.handlers.composer.onSend('are you a bot');
  wire.pump();
  if (truth === VERDICT.ai) deceiver.ghost.say('lol no');
  else deceiver.view.handlers.composer.onSend('lol no');
  wire.pump();
}

/* ---------- A full round on both screens ---------- */

test('a full round: the chat opens on both sides, the judge calls it and both score it the same', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver } = match;
  await reachChat(match, deceiver, VERDICT.human);
  assert.equal(judge.view.seen.chats.length, 1, 'the judge\'s chat opened');
  assert.equal(deceiver.view.seen.chats.length, 1, 'the deceiver\'s chat opened');
  assert.match(judge.view.seen.chats[0].goal, /Make my call/);
  assert.match(deceiver.view.seen.chats[0].goal, /answering yourself.*calls you an AI/);

  chatBothWays(match, judge, deceiver, VERDICT.human);
  assert.deepEqual(judge.view.seen.messages.map((m) => m.from), ['me', 'partner']);
  callIt(match, judge, VERDICT.ai);

  const [judgeReveal] = judge.view.seen.reveals;
  const [deceiverReveal] = deceiver.view.seen.reveals;
  assert.equal(judgeReveal.truth, VERDICT.human, 'the judge sees the truth');
  assert.equal(deceiverReveal.truth, null, 'the deceiver already knew');
  assert.equal(judgeReveal.lines[2], 'Judge (you) 0 : Deceiver 1');
  assert.equal(deceiverReveal.lines[2], 'Judge 0 : Deceiver (you) 1');
  assert.ok(judge.cues.includes('pointLost') && deceiver.cues.includes('pointWon'));
});

test('play again keeps the roles, carries the score and needs both players', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver, wire } = match;
  await reachChat(match, deceiver, VERDICT.ai);
  callIt(match, judge, VERDICT.ai);

  judge.view.handlers.reveal.onAction();
  judge.view.handlers.reveal.onAction();
  wire.pump();
  assert.equal(wire.sentTypes(0).filter((type) => type === MESSAGE.ready).length, 1, 'a double press sends once');
  assert.equal(judge.view.seen.revealNotes.at(-1).isWaiting, true);
  assert.match(deceiver.view.seen.revealNotes.at(-1).text, /Your friend wants another round/);
  assert.equal(wire.sentTypes(1).filter((type) => type === MESSAGE.matchmake).length, 1, 'no new round yet');

  deceiver.view.handlers.reveal.onAction();
  wire.pump();
  assert.match(judge.view.card().eyebrow, /Round 2 · You are the judge/);
  assert.match(deceiver.view.card().eyebrow, /Round 2 · You are the deceiver/);

  await reachChat(match, deceiver, VERDICT.human);
  callIt(match, judge, VERDICT.ai);
  assert.equal(judge.view.seen.reveals.at(-1).lines[2], 'Judge (you) 1 : Deceiver 1');
  assert.equal(deceiver.view.seen.reveals.at(-1).lines[2], 'Judge 1 : Deceiver (you) 1');
});

/* ---------- Roles ---------- */

test('a deceiver who invites gets a judge, even if the friend opened the deceiver page too', async () => {
  const match = startMatch({ inviterRole: ROLE.deceiver, inviteeRole: ROLE.deceiver });
  const { inviter: deceiver, invitee: judge } = match;
  assert.deepEqual(judge.page.hashes, ['#/imitation/judge'], 'the friend\'s page switches to the judge');
  await reachChat(match, deceiver, VERDICT.human);
  assert.match(judge.view.seen.chats[0].goal, /Make my call/);
  assert.ok(judge.view.handlers.composer.onCallIt, 'only the judge can make the call');
  assert.equal(deceiver.view.handlers.composer.onCallIt, undefined);
  callIt(match, judge, VERDICT.human);
  assert.equal(judge.view.seen.reveals[0].lines[2], 'Judge (you) 1 : Deceiver 0');
});

/* ---------- The AI path and the early call ---------- */

test('with the AI on, the ghost hears the judge, answers, and stops when the judge calls it early', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver } = match;
  await reachChat(match, deceiver, VERDICT.ai);
  assert.equal(deceiver.ghost.started, 1);
  assert.equal(deceiver.view.handlers.composer, null, 'the deceiver cannot type while the AI answers');
  assert.match(deceiver.view.seen.chats[0].goal, /AI is answering.*calls it human/);

  chatBothWays(match, judge, deceiver, VERDICT.ai);
  assert.deepEqual(deceiver.ghost.heard, ['are you a bot']);
  assert.deepEqual(judge.view.seen.messages.at(-1), { from: 'partner', text: 'lol no' });

  judge.view.handlers.composer.onCallIt();
  match.wire.pump();
  assert.equal(deceiver.ghost.stopped, 1, 'the AI stops typing once the judge is calling it');
  assert.match(deceiver.view.seen.notes.at(-1), /Chat over\. The judge is making their call/);
  assert.equal(judge.view.seen.verdictLead, 'Your call.');
});

/* ---------- Sounds never give the deceiver away ---------- */

async function judgeCuesFor(truth) {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver } = match;
  await reachChat(match, deceiver, truth);
  chatBothWays(match, judge, deceiver, truth);
  judge.view.handlers.composer.onCallIt();
  match.wire.pump();
  const judgeHeard = [...judge.cues];
  const deceiverHeard = deceiver.cues.slice(0, deceiver.cues.indexOf('roundStart') + 1);
  players.splice(0).forEach((player) => player.session.destroy());
  return { judgeHeard, deceiverHeard };
}

test('the judge hears exactly the same sounds whether the deceiver or the AI answers', async () => {
  const human = await judgeCuesFor(VERDICT.human);
  const ai = await judgeCuesFor(VERDICT.ai);
  assert.deepEqual(human.judgeHeard, ai.judgeHeard);
  assert.ok(human.judgeHeard.includes('received') && human.judgeHeard.includes('sent'));
  assert.deepEqual(human.deceiverHeard, ai.deceiverHeard, 'the secret choice sounds the same both ways');
  assert.ok(human.deceiverHeard.includes('secretLocked'));
});

test('every sound the game cues has a recipe', async () => {
  const match = startMatch();
  await reachChat(match, match.invitee, VERDICT.human);
  chatBothWays(match, match.inviter, match.invitee, VERDICT.human);
  callIt(match, match.inviter, VERDICT.human);
  match.wire.links[1].close();
  const cued = new Set([...match.inviter.cues, ...match.invitee.cues]);
  for (const name of cued) {
    const recipe = SOUNDS[name];
    assert.ok(Array.isArray(recipe) || recipe in EFFECTS, `sound "${name}"`);
  }
  for (const name of ['connected', 'searchTick', 'found', 'roundStart', 'sent', 'received', 'call', 'pointWon', 'pointLost', 'secretLocked', 'matchWon']) {
    assert.ok(cued.has(name), `"${name}" is cued`);
  }
});

/* ---------- Out-of-order, stale and duplicate messages ---------- */

test('stale and duplicate messages do not change the score or skip a step', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver, wire } = match;
  wire.inject(0, { type: MESSAGE.matchmake, round: 5, delayMs: 4000 });
  wire.inject(0, { type: MESSAGE.reveal, round: 0, verdict: VERDICT.ai, truth: VERDICT.ai });
  await reachChat(match, deceiver, VERDICT.human);
  assert.equal(judge.view.seen.reveals.length, 0, 'a reveal before the verdict is ignored');

  wire.inject(1, { type: MESSAGE.verdict, round: 3, verdict: VERDICT.ai });
  assert.equal(deceiver.view.seen.reveals.length, 0, 'a verdict for another round is ignored');

  callIt(match, judge, VERDICT.human);
  wire.inject(1, { type: MESSAGE.verdict, round: 0, verdict: VERDICT.ai });
  wire.inject(0, { type: MESSAGE.reveal, round: 0, verdict: VERDICT.ai, truth: VERDICT.ai });
  wire.pump();
  assert.equal(deceiver.view.seen.reveals.length, 1);
  assert.equal(judge.view.seen.reveals.length, 1);
  assert.equal(judge.view.seen.reveals[0].lines[2], 'Judge (you) 1 : Deceiver 0');
  assert.equal(judge.view.seen.scores.at(-1), 'Judge (you) 1 : Deceiver 0');
});

test('a deceiver who picks before the judge\'s search ends opens the chat once the search is over', async () => {
  const match = startMatch();
  const { inviter: judge, wire, clock } = match;
  clock.advance(SEARCH_MS);
  wire.inject(0, { type: MESSAGE.deceiverReady, round: 0 });
  assert.equal(judge.view.seen.chats.length, 1, 'already choosing: the chat opens right away');

  const late = startMatch();
  late.wire.inject(0, { type: MESSAGE.deceiverReady, round: 0 });
  assert.equal(late.inviter.view.seen.chats.length, 0, 'still searching: wait');
  late.clock.advance(SEARCH_MS);
  assert.equal(late.inviter.view.seen.chats.length, 1, 'then open, never stuck on "getting ready"');
});

test('chat lines that arrive outside a chat are dropped, and a second hello is ignored', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver, wire } = match;
  wire.inject(0, { type: MESSAGE.chat, text: 'too early' });
  assert.equal(judge.view.seen.messages.length, 0);
  const matchmakes = wire.sentTypes(1).filter((type) => type === MESSAGE.matchmake).length;
  wire.inject(1, { type: MESSAGE.hello, version: 2, role: ROLE.judge });
  assert.equal(wire.sentTypes(1).filter((type) => type === MESSAGE.matchmake).length, matchmakes, 'no second round 1');
  await reachChat(match, deceiver, VERDICT.human);
  assert.equal(judge.view.seen.chats.length, 1);
});

/* ---------- Leaving ---------- */

test('when the friend disconnects mid-chat, both see it, timers stop and the score is final', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver, wire, clock } = match;
  await reachChat(match, deceiver, VERDICT.ai);
  assert.equal(deceiver.view.card(), null, 'the chat is on screen');
  wire.drop();
  for (const player of [judge, deceiver]) {
    assert.equal(player.view.card().title, 'Your friend left');
    assert.match(player.view.card().eyebrow, /Match over · a draw/);
    assert.equal(player.lobby.resets, 1);
  }
  assert.equal(deceiver.ghost.stopped >= 1, true, 'the AI stops');
  const seenBefore = JSON.stringify([judge.view.seen, deceiver.view.seen]);
  clock.advance(60000);
  assert.equal(JSON.stringify([judge.view.seen, deceiver.view.seen]), seenBefore, 'no timer from the old connection fires');
  assert.equal(wire.sent.at(-1).message.type, MESSAGE.deceiverReady, 'and nothing more is sent');
});

test('a drop during the search stops it: no choice card, no chat', () => {
  const { inviter: judge, invitee: deceiver, wire, clock } = startMatch();
  wire.drop();
  clock.advance(SEARCH_MS);
  assert.equal(deceiver.view.card().title, 'Your friend left');
  assert.equal(judge.view.card().title, 'Your friend left');
  assert.equal(judge.view.seen.chats.length + deceiver.view.seen.chats.length, 0);
});

test('the friend leaving after a round names the winner, and Back to the lobby reopens it', async () => {
  const match = startMatch();
  const { inviter: judge, invitee: deceiver, wire } = match;
  await reachChat(match, deceiver, VERDICT.human);
  callIt(match, judge, VERDICT.human);
  wire.inject(0, { type: MESSAGE.bye });
  assert.match(judge.view.card().eyebrow, /you won/);
  assert.match(judge.view.card().body[0].textContent, /Judge \(you\) 1 : Deceiver 0/);
  assert.equal(judge.cues.at(-1), 'matchWon');
  judge.view.card().actions[0].onClick();
  assert.equal(judge.lobby.shown, 2);
  assert.match(deceiver.view.card().eyebrow, /you lost/);
  assert.equal(deceiver.cues.at(-1), 'matchLost');
});

test('closing the tab says goodbye to the friend', () => {
  const { inviter: judge, invitee: deceiver, wire } = startMatch();
  judge.page.fire('pagehide');
  wire.pump();
  assert.equal(deceiver.view.card().title, 'Your friend left');
});

test('an invite link in the address bar joins straight away and tidies the address', () => {
  const clock = createClock();
  const friend = createPlayer(ROLE.deceiver, clock, { hash: '#/imitation/deceiver/join/I1abc' });
  players.push(friend);
  assert.deepEqual(friend.lobby.joined, ['I1abc']);
  assert.deepEqual(friend.page.hashes, ['#/imitation/deceiver']);
  assert.equal(friend.lobby.shown, 0);
});
