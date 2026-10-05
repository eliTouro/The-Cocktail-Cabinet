import { h } from '../../dom.js';
import { ROLE } from './config.js';
import { oppositeRole } from './match.js';
import { acceptInvite, createInvite } from './peer.js';
import { SignalCodeError, inviteLink } from './signal.js';

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

/**
 * Invite a friend or join one: two copy-paste codes, then a direct WebRTC channel. Calls
 * onConnected(link, isInviter) once the channel is open. `getRole()` is the viewer's role now.
 */
export function createLobby(view, { getRole, onConnected }) {
  let invite = null;
  let pendingReply = null;
  let isClosed = false;

  function show(errorText = '') {
    const role = getRole();
    const codeBox = h('textarea', { class: 'imx-code', rows: 3, placeholder: 'Paste an invite link or code', 'aria-label': 'Invite code' });
    const join = h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Join with this code');
    join.addEventListener('click', () => joinWith(codeBox.value));
    view.showCard({
      eyebrow: `Imitation · Be the ${role}`,
      title: 'Human or machine?',
      body: [
        ...INTRO[role].map((text) => h('p', { class: 'imx-card__text' }, text)),
        h('div', { class: 'imx-join' },
          h('label', { class: 'imx-label' }, 'Got an invite from a friend?', codeBox),
          join,
          h('p', { class: 'imx-error', role: 'alert' }, errorText)),
      ],
      actions: [{ label: 'Invite a friend', onClick: startInvite }],
    });
  }

  async function startInvite() {
    view.showCard({ title: 'Making your invite…', body: [h('p', { class: 'imx-card__text' }, 'Finding your network address. This takes a few seconds.')] });
    try {
      invite = await createInvite();
    } catch {
      if (!isClosed) show('Could not make an invite in this browser. Try another browser.');
      return;
    }
    if (isClosed) return;
    showInvite(inviteLink(window.location.href, oppositeRole(getRole()), invite.code));
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
        h('p', { class: 'imx-card__text' }, `They join as the ${oppositeRole(getRole())}.`),
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
      if (isClosed) return;
      button.disabled = false;
      button.textContent = 'Connect';
      error.textContent = problem.message || 'That reply code did not work. Start a new invite.';
    }
  }

  async function joinWith(input) {
    view.showCard({ title: 'Opening the invite…', body: [h('p', { class: 'imx-card__text' }, 'Writing your reply code. This takes a few seconds.')] });
    try {
      pendingReply = await acceptInvite(input);
    } catch (problem) {
      if (!isClosed) show(problem instanceof SignalCodeError ? problem.message : 'That invite did not work. Ask your friend for a fresh one.');
      return;
    }
    if (isClosed) return;
    showReplyCode(pendingReply.code);
    pendingReply.connected
      .then((opened) => onConnected(opened, false))
      .catch((problem) => !isClosed && show(problem.message));
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
