import { h } from '../../dom.js';
import { ROLE } from './config.js';
import { oppositeRole } from './match.js';
import { acceptInvite, createInvite } from './peer.js';
import { SignalCodeError, inviteLink } from './signal.js';
import { cue } from './sounds.js';
import { actionButton } from './view.js';

const INTRO = {
  [ROLE.judge]: [
    'You are the judge. Invite a friend: they play the deceiver.',
    'Each round they secretly answer you themselves or let an AI answer for them. Chat, then call it: human or AI?',
    'A right call scores you a point; a wrong one scores them a point.',
  ],
  [ROLE.deceiver]: [
    'You are the deceiver. Invite a friend: they play the judge and question you.',
    'Each round, secretly answer yourself or let an AI in your browser answer for you.',
    'Every time the judge calls it wrong, you score a point.',
  ],
};

/** The connection is a real sequence, so the steps are numbered the same on both screens. */
const HOW_TO_CONNECT = [
  'One of you presses "Invite a friend" and sends the link (text, email, any chat app).',
  'The other opens the link, or pastes it below, and sends back the reply code it shows.',
  'The inviter pastes that reply code and presses Connect. The game starts on both screens.',
];

const STEPS = HOW_TO_CONNECT.length;
const CONNECT_TROUBLE = 'Could not reach your friend. Some school and office networks block direct connections: try a phone hotspot or both be on the same Wi-Fi, then press Start over.';
const STALLED_TIP = 'Nothing happening? Check your friend pasted this exact code. If it still will not connect, you both press Start over.';

/**
 * Invite a friend or join one: two copy-paste codes, then a direct WebRTC channel. Calls
 * onConnected(link, isInviter) once the channel is open. `getRole()` is the viewer's role now.
 */
export function createLobby(view, { getRole, onConnected }) {
  let invite = null;
  let pendingReply = null;
  let isClosed = false;

  const text = (content) => h('p', { class: 'imx-card__text' }, content);
  const stepLabel = (step) => h('p', { class: 'imx-card__eyebrow' }, `Step ${step} of ${STEPS}`);
  const startOverButton = () => h('div', { class: 'imx-card__actions' },
    actionButton({ label: 'Start over', variant: 'ghost', onClick: startOver }));

  function show(errorText = '') {
    const role = getRole();
    const codeBox = h('textarea', { class: 'imx-code', rows: 3, placeholder: 'Paste an invite link or code', 'aria-label': 'Invite code' });
    const join = h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Join with this code');
    join.addEventListener('click', () => joinWith(codeBox.value));
    if (errorText) cue('error');
    // The error and the main button sit near the top: on a phone the rest of the card scrolls.
    view.showCard({
      eyebrow: `Imitation · Be the ${role}`,
      title: 'Human or machine?',
      body: [
        errorText && h('p', { class: 'imx-error', role: 'alert' }, errorText),
        ...INTRO[role].map(text),
        h('div', { class: 'imx-card__actions' }, actionButton({ label: 'Invite a friend', onClick: startInvite })),
        h('p', { class: 'imx-card__text' }, 'You need a friend on another device or browser window. How to connect:'),
        h('ol', { class: 'imx-steps' }, HOW_TO_CONNECT.map((step) => h('li', {}, step))),
        h('div', { class: 'imx-join' },
          h('label', { class: 'imx-label' }, 'Got an invite from a friend? Paste it here:', codeBox),
          join),
      ],
    });
  }

  function startOver() {
    reset();
    show();
  }

  async function startInvite() {
    view.showCard({ title: 'Making your invite…', body: [text('Finding your network address. This takes a few seconds.')] });
    try {
      invite = await createInvite();
    } catch {
      if (!isClosed) show('Could not make an invite in this browser. Try another browser.');
      return;
    }
    if (isClosed) return;
    cue('inviteReady');
    showInvite(inviteLink(window.location.href, oppositeRole(getRole()), invite.code));
  }

  function showInvite(url) {
    const replyBox = h('textarea', { class: 'imx-code', rows: 3, placeholder: 'Paste the reply code here', 'aria-label': 'Reply code' });
    const error = h('p', { class: 'imx-error', role: 'alert' });
    const connect = h('button', { class: 'imx-button imx-button--solid', type: 'button' }, 'Connect');
    connect.addEventListener('click', () => connectWithReply(replyBox.value, error, connect));
    view.showCard({
      eyebrow: `You invite · your friend plays the ${oppositeRole(getRole())}`,
      title: 'Send your friend this link',
      body: [
        stepLabel(1),
        text('Copy the link and send it to your friend however you like. Keep this screen open.'),
        h('input', { class: 'imx-code imx-code--line', readonly: true, value: url, 'aria-label': 'Invite link' }),
        h('div', { class: 'imx-card__actions' },
          view.copyButton('Copy link', () => url),
          shareButton(url),
          view.copyButton(`Copy code only (${invite.code.length} characters)`, () => invite.code)),
        stepLabel(2),
        text('Your friend opens the link. Their screen shows a reply code for them to send back to you.'),
        stepLabel(3),
        h('label', { class: 'imx-label' }, 'Paste their reply code here, then press Connect:', replyBox),
        h('div', { class: 'imx-card__actions' }, connect),
        error,
        startOverButton(),
      ],
    });
  }

  function shareButton(url) {
    if (!navigator.share) return null;
    const button = h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Share…');
    button.addEventListener('click', () => navigator.share({ title: 'Imitation', text: 'Join me for a game of Imitation', url }).catch(() => {}));
    return button;
  }

  /**
   * A mistyped code can be fixed and retried. Any other failure means this invite's connection is
   * spent (WebRTC cannot take a second reply), so the only way on is Start over.
   */
  async function connectWithReply(input, error, button) {
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Connecting…';
    const attempt = invite;
    try {
      onConnected(await attempt.acceptReply(input), true);
    } catch (problem) {
      if (isClosed || invite !== attempt) return;
      cue('error');
      const canRetry = problem instanceof SignalCodeError;
      button.disabled = !canRetry;
      button.textContent = 'Connect';
      error.textContent = canRetry ? problem.message : CONNECT_TROUBLE;
    }
  }

  async function joinWith(input) {
    view.showCard({ title: 'Opening the invite…', body: [text('Writing your reply code. This takes a few seconds.')] });
    try {
      pendingReply = await acceptInvite(input);
    } catch (problem) {
      if (!isClosed) show(problem instanceof SignalCodeError ? problem.message : 'That invite did not work. Ask your friend for a fresh one.');
      return;
    }
    if (isClosed) return;
    cue('inviteReady');
    showReplyCode(pendingReply.code);
    const attempt = pendingReply;
    attempt.connected
      .then((opened) => onConnected(opened, false))
      .catch(() => !isClosed && pendingReply === attempt && show(CONNECT_TROUBLE));
  }

  function showReplyCode(code) {
    view.showCard({
      eyebrow: 'You joined your friend\'s invite',
      title: 'Send this reply code back',
      body: [
        stepLabel(2),
        text('Copy this reply code and send it to the friend who invited you. They paste it on their screen and press Connect; the game then starts here by itself.'),
        h('textarea', { class: 'imx-code', rows: 3, readonly: true, 'aria-label': 'Reply code' }, code),
        h('div', { class: 'imx-card__actions' }, view.copyButton(`Copy reply code (${code.length} characters)`, () => code)),
        h('p', { class: 'imx-search__status' }, 'Waiting for your friend to connect…'),
        h('p', { class: 'imx-search__warm' }, STALLED_TIP),
        startOverButton(),
      ],
    });
  }

  /** Closes the peer connection this lobby made, whether or not it ever opened. */
  function reset() {
    invite?.close();
    invite = null;
    pendingReply?.close();
    pendingReply = null;
  }

  return {
    show,
    join: joinWith,
    reset,
    destroy() {
      isClosed = true;
      reset();
    },
  };
}
