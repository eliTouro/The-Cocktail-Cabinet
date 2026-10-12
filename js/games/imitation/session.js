import { h } from '../../dom.js';
import { ROLE, TYPING_SIGNAL_EVERY_MS, VERDICT, tuningForRound } from './config.js';
import { createGhostWriter } from './ghostWriter.js';
import { createLobby } from './lobby.js';
import {
  PHASE, SIDE, chooseTruth, createMatch, endChat, endMatchmaking, markReady, oppositeRole,
  settleRound, startChat, startMatchmaking,
} from './match.js';
import { pickMatchmakingDelayMs, planMatchmaking } from './matchmaking.js';
import { MESSAGE, PROTOCOL_VERSION } from './protocol.js';
import { readInviteFromHash, roleHash } from './signal.js';
import { cue as playCue } from './sounds.js';
import { goalLine, matchOutcome, revealLines, scoreLine, startCountdown } from './summary.js';
import { actionButton } from './view.js';

/** Lets "Found them" show for a moment before the next screen. */
const FOUND_PAUSE_MS = 700;
const PARTNER_LABEL = { [ROLE.judge]: 'Your partner', [ROLE.deceiver]: 'The judge' };
const CHAT_OPENING = {
  [ROLE.judge]: 'You are chatting with your partner. Either of you can type at any time.',
  [ROLE.deceiver]: 'The judge is listening. Either of you can type at any time.',
};
const AI_NOTE = 'The AI is reading the judge and typing for you. You cannot type this round; just watch.';
const SEARCH_NOTE = 'Every round starts with a short search. Its length is random, so it says nothing about who will answer.';
const MATCH_END = {
  won: { sound: 'matchWon', words: 'you won' },
  lost: { sound: 'matchLost', words: 'you lost' },
  drawn: { sound: 'matchDrawn', words: 'a draw' },
};

const text = (content) => h('p', { class: 'imx-card__text' }, content);
const radar = () => h('div', { class: 'imx-radar', 'aria-hidden': 'true' });

/**
 * Two friends, two roles, open-ended rounds over a direct WebRTC channel. The deceiver's browser
 * drives each round (it alone knows the truth); the judge's follows its messages.
 *
 * `deps` lets tests swap the lobby, the AI, the sounds and the page (history, hash, pagehide).
 */
export function runSession(view, rng, initialRole, deps = {}) {
  const {
    makeLobby = createLobby, makeGhostWriter = createGhostWriter, cue = playCue, page = window,
  } = deps;
  let role = initialRole;
  let match = createMatch(role);
  let link = null;
  let isInviter = false;
  /** Bumped when a connection ends, so timers from that connection do nothing. */
  let generation = 0;
  let partnerChoseEarly = false;
  let stopClock = () => {};
  let lastTypingSignal = 0;
  let isDestroyed = false;
  const ghost = makeGhostWriter(rng);
  const lobby = makeLobby(view, { getRole: () => role, onConnected });

  const send = (message) => link?.send(message);
  const roundEyebrow = () => `Round ${match.round + 1} · You are the ${role}`;
  const showScore = () => view.setScore(scoreLine(match.score, role));

  function later(ms, callback) {
    const current = generation;
    view.after(ms, () => current === generation && callback());
  }

  /* ---------- Connection and role handshake ---------- */

  function onConnected(openedLink, inviter) {
    if (isDestroyed) return openedLink.close();
    link = openedLink;
    isInviter = inviter;
    match = createMatch(role);
    link.onMessage(handleMessage);
    link.onClose(partnerLeft);
    cue('connected');
    view.showCard({ title: 'Connected. Setting up…', body: [radar()] });
    if (isInviter) sayHello();
  }

  function sayHello() {
    send({ type: MESSAGE.hello, version: PROTOCOL_VERSION, role });
  }

  /** The inviter's role wins: an invited friend who opened the same role takes the other one. */
  function hearHello(partnerRole) {
    if (match.phase !== PHASE.connecting) return;
    if (!isInviter) {
      if (partnerRole === role) adoptRole(oppositeRole(role));
      sayHello();
    }
    if (role === ROLE.deceiver) beginRound();
  }

  function adoptRole(newRole) {
    role = newRole;
    match = createMatch(role);
    page.history.replaceState(null, '', roleHash(role));
  }

  function handleMessage(message) {
    const isJudge = role === ROLE.judge;
    const handlers = {
      [MESSAGE.hello]: () => hearHello(message.role),
      [MESSAGE.matchmake]: () => isJudge && judgeMatchmakes(message),
      [MESSAGE.deceiverReady]: () => isJudge && deceiverIsReady(message.round),
      [MESSAGE.chat]: () => hearPartner(message.text),
      [MESSAGE.typing]: () => match.phase === PHASE.chatting && view.setTyping(true),
      [MESSAGE.chatOver]: () => !isJudge && message.round === match.round && judgeIsCalling(),
      [MESSAGE.verdict]: () => !isJudge && hearVerdict(message),
      [MESSAGE.reveal]: () => isJudge && hearReveal(message),
      [MESSAGE.ready]: () => partnerWantsAnother(message.round),
      [MESSAGE.bye]: partnerLeft,
    };
    handlers[message.type]?.();
  }

  /* ---------- Matchmaking and the deceiver's secret choice ---------- */

  /** Deceiver: starts a round and tells the judge how long to "search" for. */
  function beginRound() {
    const delayMs = pickMatchmakingDelayMs(rng);
    ghost.preload();
    startMatchmaking(match);
    send({ type: MESSAGE.matchmake, round: match.round, delayMs });
    showMatchmaking(delayMs, showChoice);
  }

  function judgeMatchmakes({ round, delayMs }) {
    const isFirst = match.phase === PHASE.connecting;
    if (!isFirst && match.phase !== PHASE.reveal) return;
    if (round !== (isFirst ? 0 : match.round + 1)) return;
    startMatchmaking(match);
    partnerChoseEarly = false;
    showMatchmaking(delayMs, () => (partnerChoseEarly ? openChat() : showGettingReady()));
  }

  function showMatchmaking(delayMs, onFound) {
    const status = h('p', { class: 'imx-search__status', 'aria-live': 'polite' });
    view.showCard({
      eyebrow: roundEyebrow(),
      title: 'Finding your partner…',
      body: [radar(), status, h('p', { class: 'imx-search__warm' }, SEARCH_NOTE)],
    });
    const plan = planMatchmaking(rng, delayMs);
    plan.forEach(({ atMs, text: line }, index) => later(atMs, () => {
      status.textContent = line;
      cue(index === plan.length - 1 ? 'found' : 'searchTick');
    }));
    later(delayMs + FOUND_PAUSE_MS, () => {
      endMatchmaking(match);
      onFound();
    });
  }

  function showGettingReady() {
    view.showCard({
      eyebrow: roundEyebrow(),
      title: 'Your partner is getting ready…',
      body: [radar(), text('They are secretly choosing who answers you this round. The chat opens as soon as they are set.')],
    });
  }

  function deceiverIsReady(round) {
    if (round !== match.round) return;
    if (match.phase === PHASE.matchmaking) partnerChoseEarly = true;
    else if (match.phase === PHASE.choosing) openChat();
  }

  function showChoice() {
    view.showCard({
      eyebrow: roundEyebrow(),
      title: 'Who answers this round?',
      body: [
        text('Pick in secret. The judge cannot see your choice and sees "typing…" either way. You score when the judge calls it wrong.'),
        h('div', { class: 'imx-verdict__choices' },
          actionButton({ label: 'I\'ll answer myself', tone: 'human', onClick: () => decide(VERDICT.human) }),
          actionButton({ label: 'Let the AI answer for me', tone: 'computer', onClick: () => decide(VERDICT.ai) })),
        h('ul', { class: 'imx-steps imx-steps--plain' },
          h('li', {}, 'Answer myself: you type every reply. Try to seem like an AI.'),
          h('li', {}, 'Let the AI answer: a small language model in this browser types every reply for you, and you watch. It tries to seem human.')),
        h('p', { class: 'imx-search__warm' }, 'The AI runs on your device, nothing is sent anywhere. The first load is about 0.9 GB.'),
      ],
    });
  }

  /** The same sound for either choice, so nobody nearby can hear which way it went. */
  function decide(truth) {
    if (match.phase !== PHASE.choosing || match.truth) return;
    chooseTruth(match, truth);
    cue('secretLocked');
    if (truth === VERDICT.human) return deceiverGo();
    const note = h('p', { class: 'imx-search__warm', 'aria-live': 'polite' });
    view.showCard({ eyebrow: roundEyebrow(), title: 'Getting the AI ready…', body: [radar(), note] });
    const current = generation;
    ghost.warmUp((status) => { note.textContent = status; })
      .then(() => current === generation && deceiverGo());
  }

  function deceiverGo() {
    send({ type: MESSAGE.deceiverReady, round: match.round });
    openChat();
  }

  /* ---------- Chat ---------- */

  function openChat() {
    startChat(match);
    const tuning = tuningForRound(match.round);
    view.showChat({
      partnerLabel: PARTNER_LABEL[role],
      heading: `Round ${match.round + 1}`,
      opening: CHAT_OPENING[role],
      role,
      goal: goalLine(role, match.truth),
    });
    showScore();
    cue('roundStart');
    stopClock = startCountdown(tuning.roundSeconds, { onTick: view.setClock, onDone: clockRanOut });
    if (role === ROLE.judge) {
      view.showComposer({ onSend: sendChat, onInput: signalTyping, onCallIt: () => judgeCalls('Your call.') });
    } else if (match.truth === VERDICT.ai) {
      startGhost(tuning);
    } else {
      view.showComposer({ onSend: sendChat, onInput: signalTyping });
    }
  }

  function startGhost(tuning) {
    view.showDockNote(AI_NOTE);
    const status = ghost.status();
    if (status) view.addMessage('system', status);
    ghost.start({ polish: tuning.personaPolish, onSay: sendChat, sendTyping: () => send({ type: MESSAGE.typing }) });
  }

  function sendChat(message) {
    view.addMessage('me', message);
    cue('sent');
    send({ type: MESSAGE.chat, text: message });
  }

  function signalTyping() {
    const now = Date.now();
    if (now - lastTypingSignal < TYPING_SIGNAL_EVERY_MS) return;
    lastTypingSignal = now;
    send({ type: MESSAGE.typing });
  }

  function hearPartner(message) {
    if (match.phase !== PHASE.chatting && match.phase !== PHASE.verdict) return;
    view.setTyping(false);
    view.addMessage('partner', message);
    cue('received');
    if (match.phase === PHASE.chatting) ghost.hear(message);
  }

  function clockRanOut() {
    if (role === ROLE.judge) judgeCalls('Time.');
    else closeChat('Time is up. The judge is making their call…');
  }

  /* ---------- Verdict, reveal, play again ---------- */

  function judgeCalls(lead) {
    if (match.phase !== PHASE.chatting) return;
    stopClock();
    endChat(match);
    view.setTyping(false);
    send({ type: MESSAGE.chatOver, round: match.round });
    view.showVerdict((verdict) => {
      cue('call');
      send({ type: MESSAGE.verdict, round: match.round, verdict });
      view.showDockNote('Your call is in. Revealing…');
    }, lead);
  }

  /** The judge's chat closed first, by their clock (which can run a little behind ours) or early. */
  function judgeIsCalling() {
    closeChat('Chat over. The judge is making their call…');
  }

  /** Deceiver: the chat is over, by the clock or because the judge is making the call. */
  function closeChat(note) {
    if (match.phase !== PHASE.chatting) return;
    stopClock();
    ghost.stop();
    endChat(match);
    view.setTyping(false);
    view.showDockNote(note);
  }

  function hearVerdict({ round, verdict }) {
    if (round !== match.round) return;
    closeChat('The judge has called it.');
    if (match.phase !== PHASE.verdict) return;
    cue('call');
    const result = settleRound(match, { verdict, truth: match.truth });
    send({ type: MESSAGE.reveal, round, verdict, truth: result.truth });
    showReveal(result);
  }

  function hearReveal({ round, verdict, truth }) {
    if (round !== match.round || match.phase !== PHASE.verdict) return;
    showReveal(settleRound(match, { verdict, truth }));
  }

  function showReveal(result) {
    showScore();
    cue(result.winner === role ? 'pointWon' : 'pointLost');
    view.showReveal({
      truth: role === ROLE.judge ? result.truth : null,
      lines: revealLines(result, role, match.score),
      actionLabel: 'Play again',
      onAction: playAgain,
      note: 'Same roles next round; the score carries on.',
    });
  }

  const partnerReadyNote = () => `Your friend wants another round. Press Play again${role === ROLE.judge ? '' : ' to start it'}.`;

  function playAgain() {
    if (match.phase !== PHASE.reveal || match.ready.me) return;
    send({ type: MESSAGE.ready, round: match.round });
    view.setRevealNote('Waiting for your friend to press Play again…', { isWaiting: true });
    startNextRoundIf(markReady(match, SIDE.me));
  }

  function partnerWantsAnother(round) {
    if (round !== match.round || match.phase !== PHASE.reveal) return;
    const bothReady = markReady(match, SIDE.partner);
    if (!match.ready.me) view.setRevealNote(partnerReadyNote());
    startNextRoundIf(bothReady);
  }

  function startNextRoundIf(bothReady) {
    if (bothReady && role === ROLE.deceiver) beginRound();
  }

  /* ---------- Leaving ---------- */

  function partnerLeft() {
    if (isDestroyed || !link) return;
    endConnection();
    const end = MATCH_END[matchOutcome(match.score, role)];
    cue(end.sound);
    view.showCard({
      eyebrow: `Match over · ${end.words}`,
      title: 'Your friend left',
      body: [
        text(`Final score: ${scoreLine(match.score, role)}.`),
        text('To play again, go back to the lobby and send a new invite. The score starts from zero.'),
      ],
      actions: [{ label: 'Back to the lobby', onClick: () => lobby.show() }],
    });
  }

  function endConnection() {
    generation += 1;
    stopClock();
    ghost.stop();
    view.setTyping(false);
    link?.close();
    link = null;
    lobby.reset();
  }

  /** Closing the tab skips destroy(), so say goodbye here too; the friend is told straight away. */
  const sayBye = () => send({ type: MESSAGE.bye });
  page.addEventListener('pagehide', sayBye);

  const invitedWith = readInviteFromHash(page.location.hash);
  if (invitedWith) {
    page.history.replaceState(null, '', roleHash(role));
    lobby.join(invitedWith);
  } else {
    lobby.show();
  }

  return {
    destroy() {
      isDestroyed = true;
      page.removeEventListener('pagehide', sayBye);
      sayBye();
      endConnection();
      ghost.destroy();
      lobby.destroy();
    },
  };
}
