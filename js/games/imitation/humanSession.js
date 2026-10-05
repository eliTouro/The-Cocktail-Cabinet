import { h } from '../../dom.js';
import { CONNECT_PAUSE_MS, POINTS, TOTAL_ROUNDS, tuningForRound } from './config.js';
import { startEngine } from './engine.js';
import { PHASE, SIDE, createMatch, currentResult, endChat, fileVerdict, nextRound, startChat } from './match.js';
import { acceptInvite, createInvite } from './peer.js';
import { createPersona } from './persona.js';
import { MESSAGE, PROTOCOL_VERSION } from './protocol.js';
import { SignalCodeError, inviteLink, readInviteFromHash } from './signal.js';
import { createStranger } from './stranger.js';
import { finalSummary, revealLines, startCountdown } from './summary.js';

const PARTNER = 'Friend';
const LOBBY_HASH = '#/imitation/human';
const TYPING_SIGNAL_EVERY_MS = 2000;

const RULES = [
  `Chat with a friend in another browser for ${TOTAL_ROUNDS} rounds. After each round you both say whether the other was human or AI.`,
  'The twist: either of you may secretly be put on autopilot for a round. Then an AI in your own browser chats for you, and you watch. Autopilot gets more likely as rounds go on.',
  `Read: +${POINTS.read} for a right verdict. Pass: +${POINTS.pass} when your friend judges you human, autopilot or not.`,
  'Your browsers talk directly. A public address-lookup (STUN) server only helps them find each other; your messages go straight to your friend.',
];

/** "Play another person": invite link and reply code, then rounds over a direct WebRTC channel. */
export function runHumanSession(view, rng) {
  let invite = null;
  let pendingReply = null;
  let link = null;
  let isHost = false;
  let engine = null;
  let match = createMatch({ totalRounds: TOTAL_ROUNDS });
  let pilot = null;
  let isAutopilot = false;
  let ready = { me: false, partner: false };
  let stopClock = () => {};
  let lastTypingSignal = 0;
  let isDestroyed = false;

  /* ---------- Lobby and signalling ---------- */

  function showLobby(errorText = '') {
    const codeBox = h('textarea', { class: 'imx-code', rows: 3, placeholder: 'Paste an invite link or code', 'aria-label': 'Invite code' });
    const error = h('p', { class: 'imx-error', role: 'alert' }, errorText);
    view.showCard({
      eyebrow: 'Imitation · Play another person',
      title: 'Human or machine?',
      body: [
        ...RULES.map((text) => h('p', { class: 'imx-card__text' }, text)),
        h('div', { class: 'imx-join' },
          h('label', { class: 'imx-label' }, 'Got an invite from a friend?', codeBox),
          joinButton(codeBox),
          error),
      ],
      actions: [{ label: 'Invite a friend', onClick: startInvite }],
    });
  }

  function joinButton(codeBox) {
    const button = h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Join with this code');
    button.addEventListener('click', () => join(codeBox.value));
    return button;
  }

  async function startInvite() {
    view.showCard({ title: 'Making your invite…', body: [h('p', { class: 'imx-card__text' }, 'Finding your network address. This takes a few seconds.')] });
    try {
      invite = await createInvite();
    } catch {
      if (!isDestroyed) showLobby('Could not make an invite in this browser. Try another browser.');
      return;
    }
    if (isDestroyed) return;
    showInvite(inviteLink(window.location.href, invite.code));
  }

  function showInvite(url) {
    const replyBox = h('textarea', { class: 'imx-code', rows: 3, placeholder: 'Paste the reply code here', 'aria-label': 'Reply code' });
    const error = h('p', { class: 'imx-error', role: 'alert' });
    const connect = h('button', { class: 'imx-button imx-button--solid', type: 'button' }, 'Connect');
    connect.addEventListener('click', () => connectWithReply(replyBox.value, error, connect));
    view.showCard({
      eyebrow: 'Step 1 of 2',
      title: 'Send your friend this link',
      body: [
        h('input', { class: 'imx-code imx-code--line', readonly: true, value: url, 'aria-label': 'Invite link' }),
        h('div', { class: 'imx-card__actions' },
          view.copyButton('Copy link', () => url),
          shareButton(url),
          view.copyButton(`Copy code only (${invite.code.length} characters)`, () => invite.code)),
        h('p', { class: 'imx-card__eyebrow' }, 'Step 2 of 2'),
        h('label', { class: 'imx-label' }, 'They get a reply code. Paste it here:', replyBox),
        h('div', { class: 'imx-card__actions' }, connect),
        error,
      ],
    });
  }

  function shareButton(url) {
    if (!navigator.share) return null;
    const button = h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Share…');
    button.addEventListener('click', () => navigator.share({ title: 'Imitation', text: 'Join me for a game of Imitation', url }).catch(() => {}));
    return button;
  }

  async function connectWithReply(input, error, button) {
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Connecting…';
    try {
      onConnected(await invite.acceptReply(input), true);
    } catch (problem) {
      if (isDestroyed) return;
      button.disabled = false;
      button.textContent = 'Connect';
      error.textContent = problem.message || 'That reply code did not work. Start a new invite.';
    }
  }

  async function join(input) {
    view.showCard({ title: 'Opening the invite…', body: [h('p', { class: 'imx-card__text' }, 'Writing your reply code. This takes a few seconds.')] });
    try {
      pendingReply = await acceptInvite(input);
    } catch (problem) {
      if (!isDestroyed) showLobby(problem instanceof SignalCodeError ? problem.message : 'That invite did not work. Ask your friend for a fresh one.');
      return;
    }
    if (isDestroyed) return;
    showReplyCode(pendingReply.code);
    pendingReply.connected
      .then((opened) => onConnected(opened, false))
      .catch((problem) => !isDestroyed && showLobby(problem.message));
  }

  function showReplyCode(code) {
    view.showCard({
      eyebrow: 'Almost there',
      title: 'Send this reply code back',
      body: [
        h('p', { class: 'imx-card__text' }, 'Your friend pastes it into their screen and the game starts by itself.'),
        h('textarea', { class: 'imx-code', rows: 3, readonly: true, 'aria-label': 'Reply code' }, code),
        h('div', { class: 'imx-card__actions' }, view.copyButton(`Copy reply code (${code.length} characters)`, () => code)),
        h('p', { class: 'imx-search__status' }, 'Waiting for your friend…'),
      ],
    });
  }

  function onConnected(openedLink, host) {
    if (isDestroyed) return openedLink.close();
    link = openedLink;
    isHost = host;
    link.onMessage(handleMessage);
    link.onClose(partnerLeft);
    link.send({ type: MESSAGE.hello, version: PROTOCOL_VERSION });
    engine ??= startEngine({ rng });
    match = createMatch({ totalRounds: TOTAL_ROUNDS });
    view.showCard({ title: 'Connecting…', body: [h('div', { class: 'imx-radar', 'aria-hidden': 'true' })] });
    if (isHost) view.after(CONNECT_PAUSE_MS, hostStartsRound);
  }

  /* ---------- Rounds ---------- */

  function handleMessage(message) {
    const handlers = {
      [MESSAGE.start]: () => !isHost && guestStartsRound(),
      [MESSAGE.chat]: () => hearPartner(message.text),
      [MESSAGE.typing]: () => match.phase === PHASE.chatting && view.setTyping(true),
      [MESSAGE.verdict]: () => partnerFiled(message),
      [MESSAGE.ready]: () => partnerReady(),
      [MESSAGE.bye]: partnerLeft,
    };
    handlers[message.type]?.();
  }

  function hostStartsRound() {
    link.send({ type: MESSAGE.start, round: match.round });
    beginRound();
  }

  function guestStartsRound() {
    if (match.phase === PHASE.over) match = createMatch({ totalRounds: TOTAL_ROUNDS });
    if (match.phase === PHASE.reveal) nextRound(match);
    beginRound();
  }

  function beginRound() {
    const tuning = tuningForRound(match.round);
    ready = { me: false, partner: false };
    isAutopilot = rng.next() < tuning.autopilotChance;
    startChat(match);
    view.showChat({ partnerLabel: PARTNER, round: match.round, totalRounds: TOTAL_ROUNDS });
    view.setScores(match.totals.me, match.totals.partner, PARTNER);
    if (isAutopilot) startAutopilot(tuning);
    else view.showComposer({ onSend: sendChat, onInput: signalTyping });
    stopClock = startCountdown(tuning.roundSeconds, { onTick: view.setClock, onDone: timeUp });
  }

  function startAutopilot(tuning) {
    view.addMessage('system', 'Autopilot round: the AI in your browser is chatting for you. Your friend does not know. Sit back.');
    view.showComposer({ onSend: () => {}, disabledReason: 'Autopilot is typing for you' });
    pilot = createStranger({
      getEngine: engine.current,
      persona: createPersona(rng, tuning.personaPolish),
      rng,
      onTyping: (isTyping) => isTyping && link.send({ type: MESSAGE.typing }),
      onSay: sendChat,
    });
    pilot.start();
  }

  function sendChat(text) {
    view.addMessage('me', text);
    link.send({ type: MESSAGE.chat, text });
  }

  function signalTyping() {
    const now = Date.now();
    if (now - lastTypingSignal < TYPING_SIGNAL_EVERY_MS) return;
    lastTypingSignal = now;
    link.send({ type: MESSAGE.typing });
  }

  function hearPartner(text) {
    if (match.phase !== PHASE.chatting) return;
    view.setTyping(false);
    view.addMessage('partner', text);
    pilot?.hear(text);
  }

  function timeUp() {
    pilot?.stop();
    pilot = null;
    endChat(match);
    view.showVerdict(PARTNER, (verdict) => {
      fileVerdict(match, SIDE.me, { verdict, wasAi: isAutopilot });
      link.send({ type: MESSAGE.verdict, round: match.round, verdict, wasAi: isAutopilot });
      if (match.phase === PHASE.reveal) showReveal();
      else view.showDockNote('Waiting for your friend\'s verdict…');
    });
  }

  function partnerFiled({ round, verdict, wasAi }) {
    const isOpen = match.phase === PHASE.chatting || match.phase === PHASE.verdict;
    if (round !== match.round || !isOpen) return;
    fileVerdict(match, SIDE.partner, { verdict, wasAi });
    if (match.phase === PHASE.reveal) showReveal();
  }

  function showReveal() {
    const result = currentResult(match);
    const isLast = match.round + 1 >= TOTAL_ROUNDS;
    view.setScores(match.totals.me, match.totals.partner, PARTNER);
    view.showReveal({
      partnerWasAi: result.filed.partner.wasAi,
      lines: [...revealLines(result, PARTNER), ...autopilotNotes(result)],
      actionLabel: isLast ? 'See final score' : 'Next round',
      onAction: isLast ? showFinal : markReady,
    });
  }

  function autopilotNotes({ filed }) {
    return [
      filed.partner.wasAi && 'Your friend was on autopilot: every line they sent was written by their AI.',
      filed.me.wasAi && 'You were on autopilot this round.',
    ].filter(Boolean);
  }

  function markReady() {
    ready.me = true;
    link.send({ type: MESSAGE.ready, round: match.round });
    view.showDockNote('Waiting for your friend…');
    if (isHost) advanceWhenBothReady();
  }

  function partnerReady() {
    ready.partner = true;
    if (isHost) advanceWhenBothReady();
  }

  function advanceWhenBothReady() {
    if (!ready.me || !ready.partner) return;
    if (match.phase === PHASE.over) match = createMatch({ totalRounds: TOTAL_ROUNDS });
    else nextRound(match);
    hostStartsRound();
  }

  function showFinal() {
    nextRound(match);
    view.showCard({
      eyebrow: 'Final score',
      title: `${match.totals.me} : ${match.totals.partner}`,
      body: [h('p', { class: 'imx-card__text' }, finalSummary(match.totals, PARTNER))],
      actions: [{ label: 'Rematch', onClick: requestRematch }],
    });
  }

  function requestRematch() {
    ready.me = true;
    link.send({ type: MESSAGE.ready, round: match.round });
    view.showCard({ title: 'Rematch', body: [h('p', { class: 'imx-search__status' }, 'Waiting for your friend to press Rematch…')] });
    if (isHost) advanceWhenBothReady();
  }

  function partnerLeft() {
    if (isDestroyed || !link) return;
    endConnection();
    view.showCard({
      title: 'Your friend left',
      body: [h('p', { class: 'imx-card__text' }, 'The connection closed. Start a new invite to play again.')],
      actions: [{ label: 'Back to the lobby', onClick: () => showLobby() }],
    });
  }

  function endConnection() {
    stopClock();
    pilot?.stop();
    pilot = null;
    link?.close();
    link = null;
    invite?.close();
    invite = null;
    pendingReply?.close();
    pendingReply = null;
  }

  const invitedWith = readInviteFromHash(window.location.hash);
  if (invitedWith) {
    window.history.replaceState(null, '', LOBBY_HASH);
    join(invitedWith);
  } else {
    showLobby();
  }

  return {
    destroy() {
      isDestroyed = true;
      link?.send({ type: MESSAGE.bye });
      endConnection();
      engine?.destroy();
    },
  };
}
