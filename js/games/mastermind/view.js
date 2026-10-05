import { h } from '../../dom.js';
import { CODE_COLOURS } from './config.js';
import { EMPTY } from './rules.js';

const SECRET_MASK = '?';

function describeSlot(place, colour) {
  return `Slot ${place + 1}: ${colour === EMPTY ? 'empty' : CODE_COLOURS[colour].name}`;
}

/** Colour a peg button or span: letter marker plus colour, or an empty ring. */
function paintPeg(peg, colour, { masked = false } = {}) {
  const isEmpty = colour === EMPTY;
  peg.classList.toggle('peg--empty', isEmpty || masked);
  peg.classList.toggle('peg--masked', masked);
  peg.style.setProperty('--peg', isEmpty || masked ? 'transparent' : CODE_COLOURS[colour].hex);
  peg.textContent = masked ? SECRET_MASK : isEmpty ? '' : CODE_COLOURS[colour].letter;
}

function createSlots(count, onSlot) {
  return Array.from({ length: count }, (_, place) => {
    const slot = h('button', { class: 'peg peg--slot', type: 'button', disabled: true });
    slot.addEventListener('mousedown', (event) => event.preventDefault());
    slot.addEventListener('click', () => onSlot(place));
    return slot;
  });
}

function createFeedbackDots(count) {
  return Array.from({ length: count }, () => h('span', { class: 'dot-peg' }));
}

function paintFeedback(dots, feedback) {
  dots.forEach((dot, index) => {
    const isBlack = feedback && index < feedback.black;
    const isWhite = feedback && !isBlack && index < feedback.black + feedback.white;
    dot.classList.toggle('dot-peg--black', Boolean(isBlack));
    dot.classList.toggle('dot-peg--white', Boolean(isWhite));
  });
}

function paintSlots(slots, code, { cursor = -1, enabled = false, masked = false } = {}) {
  slots.forEach((slot, place) => {
    const colour = code?.[place] ?? EMPTY;
    paintPeg(slot, colour, { masked });
    slot.disabled = !enabled;
    slot.classList.toggle('is-cursor', enabled && place === cursor);
    slot.setAttribute('aria-label', masked ? `Slot ${place + 1}: hidden` : describeSlot(place, colour));
  });
}

function createPalette(count, onColour) {
  return CODE_COLOURS.slice(0, count).map((colour, index) => {
    const button = h('button', {
      class: 'peg peg--swatch',
      type: 'button',
      'aria-label': `${colour.name}, key ${index + 1}`,
      title: `${colour.name} (${index + 1})`,
      'data-key': index + 1,
    }, colour.letter);
    button.style.setProperty('--peg', colour.hex);
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => onColour(index));
    return button;
  });
}

function createBoardRow(settings, number, onSlot) {
  const slots = createSlots(settings.pegs, onSlot);
  const dots = createFeedbackDots(settings.pegs);
  const element = h('li', { class: 'mm-row' },
    h('span', { class: 'mm-row__number', 'aria-hidden': 'true' }, String(number)),
    h('div', { class: 'mm-row__slots' }, slots),
    h('div', { class: 'mm-row__feedback', style: `--columns:${Math.ceil(settings.pegs / 2)}` }, dots));
  return { element, slots, dots };
}

const describeFeedback = ({ black, white }) => `${black} black, ${white} white`;

/**
 * The play surface. It only draws what it is told and reports clicks through `handlers`
 * ({ onColour, onSlot, onSecretSlot, onAction }); it knows nothing about the rules.
 */
export function createView(container, handlers) {
  const board = h('ol', { class: 'mm-board', 'aria-label': 'Guesses' });
  const secretTitle = h('p', { class: 'mm-label' });
  const secretSlotsBox = h('div', { class: 'mm-secret__slots' });
  const ruleLine = h('p', { class: 'mm-rules' });
  const message = h('p', { class: 'mm-message', role: 'status' });
  const thinking = h('p', { class: 'mm-thinking', hidden: true }, 'Computer is thinking', h('span', { class: 'mm-thinking__dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  const palette = h('div', { class: 'mm-palette', role: 'group', 'aria-label': 'Colours' });
  const actions = h('div', { class: 'mm-actions' });
  const panel = h('div', { class: 'mm-panel' },
    h('div', { class: 'mm-secret' }, secretTitle, secretSlotsBox), ruleLine, message, thinking, palette, actions);
  const root = h('div', { class: 'mm' }, board, panel);
  container.append(root);

  let rows = [];
  let secretSlots = [];

  return {
    /** Lay out an empty board and palette for a new level. */
    buildRound(settings, { secretLabel }) {
      rows = Array.from({ length: settings.guesses }, (_, index) =>
        createBoardRow(settings, index + 1, (place) => handlers.onSlot(place)));
      board.style.setProperty('--rows', settings.guesses);
      board.replaceChildren(...rows.map((row) => row.element));
      secretSlots = createSlots(settings.pegs, (place) => handlers.onSecretSlot(place));
      secretSlotsBox.replaceChildren(...secretSlots);
      secretTitle.textContent = secretLabel;
      palette.replaceChildren(...createPalette(settings.colours, (colour) => handlers.onColour(colour)));
      ruleLine.textContent = `${settings.pegs} pegs, ${settings.colours} colours, ${settings.repeats ? 'repeats allowed' : 'no repeats'}`;
    },

    /**
     * state: { history, pendingGuess, entry: { code, cursor } | null, secret: { code, masked, entry } }
     * `entry` is the row being built; `secret.entry` is set while the person is typing their code.
     */
    draw({ history, pendingGuess, entry, secret }) {
      rows.forEach((row, index) => {
        const played = history[index];
        const isNext = index === history.length;
        const showPending = isNext && pendingGuess;
        const showEntry = isNext && entry;
        const code = played?.guess ?? (showPending ? pendingGuess : showEntry ? entry.code : null);
        paintSlots(row.slots, code, { cursor: showEntry ? entry.cursor : -1, enabled: Boolean(showEntry) });
        paintFeedback(row.dots, played?.feedback);
        row.element.classList.toggle('is-current', isNext && Boolean(entry || pendingGuess));
        row.element.setAttribute('aria-label', played ? `Guess ${index + 1}: ${describeFeedback(played.feedback)}` : `Guess ${index + 1}`);
      });
      paintSlots(secretSlots, secret.entry?.code ?? secret.code, {
        cursor: secret.entry?.cursor,
        enabled: Boolean(secret.entry),
        masked: secret.masked,
      });
    },

    setMessage(text, { warning = false } = {}) {
      message.textContent = text;
      message.classList.toggle('is-warning', warning);
    },

    clearWarning() {
      if (!message.classList.contains('is-warning')) return;
      message.textContent = '';
      message.classList.remove('is-warning');
    },

    setThinking(isThinking) { thinking.hidden = !isThinking; },

    setPaletteVisible(isVisible) { palette.hidden = !isVisible; },

    /** actions: [{ label, primary, onClick }] */
    setActions(list) {
      actions.replaceChildren(...list.map(({ label, primary, onClick }) => {
        const button = h('button', { class: `mm-button${primary ? ' mm-button--primary' : ''}`, type: 'button' }, label);
        button.addEventListener('click', onClick);
        return button;
      }));
    },

    destroy() { root.remove(); },
  };
}
