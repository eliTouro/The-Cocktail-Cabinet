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
import { revealLines, scoreLine, startCountdown } from './summary.js';
import { actionButton } from './view.js';

/** Lets "Found them" show for a moment before the next screen. */
const FOUND_PAUSE_MS = 700;
const PARTNER_LABEL = { [ROLE.judge]: 'Your partner', [ROLE.deceiver]: 'The judge' };
const CHAT_OPENING = {
  [ROLE.judge]: 'You are chatting with your partner. Ask anything, then call it: human or AI?',
  [ROLE.deceiver]: 'The judge is listening. Do not give yourself away.',
};
const AI_NOTE = 'The AI is answering for you. Sit back.';

const text = (content) => h('p', { class: 'imx-card__text' }, content);
const radar = () => h('div', { class: 'imx-radar', 'aria-hidden': 'true' });

/**
 * Two friends, two roles, open-ended rounds over a direct WebRTC channel. The deceiver's browser
 * drives each round (it alone knows the truth); the judge's follows its messages.
 */
export function runSession(view, rng, initialRole) {
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
  const ghost = createGhostWriter(rng);
  const lobby = createLobby(view, { getRole: () => role, onConnected });

  const send = (message) => link?.send(message);
  const roundEyebrow = () => `Round ${match.round + 1} · You are the ${role}`;

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
    view.showCard({ title: 'Connecting…', body: [radar()] });
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
    window.history.replaceState(null, '', roleHash(role));
  }

  function handleMessage(message) {
    const isJudge = role === ROLE.judge;
    const handlers = {
      [MESSAGE.hello]: () => hearHello(message.role),
      [MESSAGE.matchmake]: () => isJudge && judgeMatchmakes(message),
      [MESSAGE.deceiverReady]: () => isJudge && deceiverIsReady(message.round),
      [MESSAGE.chat]: () => hearPartner(message.text),
      [MESSAGE.typing]: () => match.phase === PHASE.chatting && view.setTyping(true),
      [MESSAGE.chatOver]: () => !isJudge && message.round === match.round && closeChat(),
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
    view.showCard({ eyebrow: roundEyebrow(), title: 'Finding your partner…', body: [radar(), status] });
    for (const { atMs, text: line } of planMatchmaking(rng, delayMs)) {
      later(atMs, () => { status.textContent = line; });
    }
    later(delayMs + FOUND_PAUSE_MS, () => {
      endMatchmaking(match);
      onFound();
    });
  }

  function showGettingReady() {
    view.showCard({
      eyebrow: roundEyebrow(),
      title: 'Your partner is getting ready…',
      body: [radar(), text('The chat opens as soon as they are set.')],
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
        text('The judge cannot see what you pick, and sees "typing…" either way.'),
        h('div', { class: 'imx-verdict__choices' },
          actionButton({ label: 'I\'ll answer myself', tone: 'human', onClick: () => decide(VERDICT.human) }),
          actionButton({ label: 'Let the AI answer for me', tone: 'computer', onClick: () => decide(VERDICT.ai) })),
        h('p', { class: 'imx-search__warm' }, 'The AI is a small language model that runs in your browser. The first load is about 0.9 GB.'),
      ],
    });
  }

  function decide(truth) {
    if (match.phase !== PHASE.choosing || match.truth) return;
    chooseTruth(match, truth);
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
    view.showChat({ partnerLabel: PARTNER_LABEL[role], heading: `Round ${match.round + 1}`, opening: CHAT_OPENING[role] });
    view.setScore(scoreLine(match.score));
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
    if (match.phase === PHASE.chatting) ghost.hear(message);
  }

  function clockRanOut() {
    if (role === ROLE.judge) judgeCalls('Time.');
    else closeChat();
  }

  /* ---------- Verdict, reveal, play again ---------- */

  function judgeCalls(lead) {
    if (match.phase !== PHASE.chatting) return;
    stopClock();
    endChat(match);
    view.setTyping(false);
    send({ type: MESSAGE.chatOver, round: match.round });
    view.showVerdict((verdict) => {
      send({ type: MESSAGE.verdict, round: match.round, verdict });
      view.showDockNote('Your call is in. Revealing…');
    }, lead);
  }

  /** Deceiver: the chat is over, by the clock or because the judge is making the call. */
  function closeChat() {
    if (match.phase !== PHASE.chatting) return;
    stopClock();
    ghost.stop();
    endChat(match);
    view.setTyping(false);
    view.showDockNote('The judge is making their call…');
  }

  function hearVerdict({ round, verdict }) {
    if (round !== match.round) return;
    closeChat();
    if (match.phase !== PHASE.verdict) return;
    const result = settleRound(match, { verdict, truth: match.truth });
    send({ type: MESSAGE.reveal, round, verdict, truth: result.truth });
    showReveal(result);
  }

  function hearReveal({ round, verdict, truth }) {
    if (round !== match.round || match.phase !== PHASE.verdict) return;
    showReveal(settleRound(match, { verdict, truth }));
  }

  function showReveal(result) {
    view.setScore(scoreLine(match.score));
    view.showReveal({
      truth: role === ROLE.judge ? result.truth : null,
      lines: revealLines(result, role, match.score),
      actionLabel: 'Play again',
      onAction: playAgain,
    });
  }

  function playAgain() {
    if (match.phase !== PHASE.reveal || match.ready.me) return;
    send({ type: MESSAGE.ready, round: match.round });
    view.showDockNote('Waiting for your friend…');
    startNextRoundIf(markReady(match, SIDE.me));
  }

  function partnerWantsAnother(round) {
    if (round !== match.round || match.phase !== PHASE.reveal) return;
    startNextRoundIf(markReady(match, SIDE.partner));
  }

  function startNextRoundIf(bothReady) {
    if (bothReady && role === ROLE.deceiver) beginRound();
  }

  /* ---------- Leaving ---------- */

  function partnerLeft() {
    if (isDestroyed || !link) return;
    endConnection();
    view.showCard({
      title: 'Your friend left',
      body: [text(`Final score: ${scoreLine(match.score)}. Start a new invite to play again.`)],
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

  const invitedWith = readInviteFromHash(window.location.hash);
  if (invitedWith) {
    window.history.replaceState(null, '', roleHash(role));
    lobby.join(invitedWith);
  } else {
    lobby.show();
  }

  return {
    destroy() {
      isDestroyed = true;
      send({ type: MESSAGE.bye });
      endConnection();
      ghost.destroy();
      lobby.destroy();
    },
  };
}
