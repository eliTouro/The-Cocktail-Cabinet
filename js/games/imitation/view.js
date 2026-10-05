import { h } from '../../dom.js';
import { MAX_MESSAGE_LENGTH, VERDICT } from './config.js';

const STYLESHEET_HREF = 'css/imitation.css';
const COPIED_RESET_MS = 1800;
const TYPING_HOLD_MS = 3500;

/**
 * The chat UI, built from DOM elements inside the stage. It only draws and reports clicks; the
 * session decides what happens. Two layers: a chat (header, transcript, dock) and a card that
 * covers it for the lobby, matchmaking and the deceiver's secret choice.
 */
export function createView(container) {
  const stylesheet = h('link', { rel: 'stylesheet', href: STYLESHEET_HREF });
  document.head.append(stylesheet);
  container.classList.add('imx-stage');

  const partnerName = h('span', { class: 'imx-head__name' });
  const status = h('span', { class: 'imx-head__status', 'aria-live': 'polite' });
  const roundLabel = h('span', { class: 'imx-head__round' });
  const scoreLabel = h('span', { class: 'imx-head__score' });
  const clock = h('span', { class: 'imx-head__clock' });
  const timerFill = h('span', { class: 'imx-timer__fill' });
  const log = h('ol', { class: 'imx-log', 'aria-live': 'polite', 'aria-label': 'Chat' });
  const dock = h('div', { class: 'imx-dock' });
  const card = h('section', { class: 'imx-card', hidden: true });
  const avatar = h('span', { class: 'imx-avatar', 'aria-hidden': 'true' }, '?');
  const root = h('div', { class: 'imx' },
    h('header', { class: 'imx-head' },
      avatar,
      h('div', { class: 'imx-head__who' }, partnerName, status),
      h('div', { class: 'imx-head__meta' }, roundLabel, scoreLabel, clock),
      h('span', { class: 'imx-timer', 'aria-hidden': 'true' }, timerFill)),
    log, dock, card);
  container.append(root);

  const timeouts = new Set();
  let typingTimer = null;

  function after(ms, callback) {
    const id = setTimeout(() => {
      timeouts.delete(id);
      callback();
    }, ms);
    timeouts.add(id);
    return id;
  }

  function setTyping(isTyping) {
    clearTimeout(typingTimer);
    status.textContent = isTyping ? 'typing…' : 'online';
    status.classList.toggle('is-typing', isTyping);
    if (isTyping) typingTimer = setTimeout(() => setTyping(false), TYPING_HOLD_MS);
  }

  function scrollToEnd() {
    log.scrollTop = log.scrollHeight;
  }

  return {
    showCard({ eyebrow, title, body = [], actions = [] }) {
      card.replaceChildren(...[
        eyebrow && h('p', { class: 'imx-card__eyebrow' }, eyebrow),
        h('h2', { class: 'imx-card__title' }, title),
        ...body,
        actions.length > 0 && h('div', { class: 'imx-card__actions' }, actions.map(actionButton)),
      ].filter(Boolean));
      card.hidden = false;
      card.scrollTop = 0;
      card.querySelector('button, textarea')?.focus();
    },

    hideCard() {
      card.hidden = true;
    },

    /** `heading` labels the round in the header; `opening` is the chat's first, system line. */
    showChat({ partnerLabel, heading, opening }) {
      root.dataset.truth = '';
      avatar.textContent = '?';
      partnerName.textContent = partnerLabel;
      status.textContent = 'online';
      roundLabel.textContent = heading;
      log.replaceChildren(h('li', { class: 'imx-msg imx-msg--system' }, opening));
      card.hidden = true;
    },

    setScore(text) {
      scoreLabel.textContent = text;
    },

    addMessage(from, text) {
      log.append(h('li', { class: `imx-msg imx-msg--${from}` }, text));
      scrollToEnd();
    },

    setTyping,

    setClock(secondsLeft, fraction) {
      clock.textContent = formatClock(secondsLeft);
      timerFill.style.transform = `scaleX(${Math.max(fraction, 0)})`;
      root.classList.toggle('is-hurry', secondsLeft <= 10);
    },

    /** `onCallIt` adds a button to end the chat early and go straight to the verdict. */
    showComposer({ onSend, onInput = () => {}, onCallIt, disabledReason = '' }) {
      const input = h('input', {
        class: 'imx-input', type: 'text', maxlength: MAX_MESSAGE_LENGTH, autocomplete: 'off',
        'aria-label': 'Message', placeholder: disabledReason || 'Type a message', disabled: Boolean(disabledReason),
      });
      const send = h('button', { class: 'imx-send', type: 'submit', disabled: Boolean(disabledReason) }, 'Send');
      const callIt = onCallIt && h('button', { class: 'imx-button imx-button--ghost', type: 'button' }, 'Make my call');
      const form = h('form', { class: 'imx-composer' }, input, send, callIt);
      callIt?.addEventListener('click', onCallIt);
      input.addEventListener('input', onInput);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        onSend(text);
      });
      dock.replaceChildren(form);
      if (!disabledReason) input.focus({ preventScroll: true });
    },

    /** `lead` opens the question: 'Time.' when the clock ran out, 'Your call.' when ended early. */
    showVerdict(onVerdict, lead = 'Time.') {
      const choose = (verdict) => () => onVerdict(verdict);
      dock.replaceChildren(h('div', { class: 'imx-verdict' },
        h('p', { class: 'imx-verdict__ask' }, `${lead} Was your partner a human or an AI?`),
        h('div', { class: 'imx-verdict__choices' },
          actionButton({ label: 'Human', tone: 'human', onClick: choose(VERDICT.human) }),
          actionButton({ label: 'AI', tone: 'computer', onClick: choose(VERDICT.ai) }))));
      dock.querySelector('button').focus({ preventScroll: true });
    },

    showDockNote(text) {
      dock.replaceChildren(h('p', { class: 'imx-dock__note' }, text));
    },

    /**
     * `truth` (a VERDICT) colours the partner's bubbles by what they really were: the moment of
     * the reveal on the judge's screen. The deceiver already knows, and passes null.
     */
    showReveal({ truth, lines, actionLabel, onAction }) {
      root.dataset.truth = truth ?? '';
      if (truth) avatar.textContent = truth === VERDICT.ai ? 'AI' : 'H';
      dock.replaceChildren(h('div', { class: 'imx-reveal' },
        h('ul', { class: 'imx-reveal__lines' }, lines.map((line) => h('li', {}, line))),
        actionButton({ label: actionLabel, onClick: onAction })));
      dock.querySelector('button').focus({ preventScroll: true });
      scrollToEnd();
    },

    copyButton,
    after,

    destroy() {
      timeouts.forEach(clearTimeout);
      clearTimeout(typingTimer);
      root.remove();
      stylesheet.remove();
      container.classList.remove('imx-stage');
    },
  };

  function copyButton(label, getText) {
    const button = actionButton({
      label,
      variant: 'ghost',
      async onClick() {
        const copied = await copyText(getText());
        button.textContent = copied ? 'Copied' : 'Select and copy it';
        button.classList.toggle('is-done', copied);
        after(COPIED_RESET_MS, () => {
          button.textContent = label;
          button.classList.remove('is-done');
        });
      },
    });
    return button;
  }
}

function formatClock(seconds) {
  const safe = Math.max(seconds, 0);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

export function actionButton({ label, onClick, tone, variant = 'solid' }) {
  const button = h('button', { class: `imx-button imx-button--${variant}${tone ? ` tone-${tone}` : ''}`, type: 'button' }, label);
  button.addEventListener('click', onClick);
  return button;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
