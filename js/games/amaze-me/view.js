import { createCanvas } from '../../core/canvas.js';
import { h } from '../../dom.js';
import { TOOLS } from './builder.js';
import { CANVAS, GRID, MAX_NAME_LENGTH, REFUSAL_FLASH_SECONDS } from './config.js';
import { DEFAULT_NAMES, READY_BUTTON, TITLE, TOOL_LABELS, flareLabel } from './copy.js';

const PAD_BUTTONS = [
  { dir: 'left', glyph: '◀', label: 'Move left' },
  { dir: 'up', glyph: '▲', label: 'Move up' },
  { dir: 'down', glyph: '▼', label: 'Move down' },
  { dir: 'right', glyph: '▶', label: 'Move right' },
];

/**
 * Everything aMaze Me puts in the DOM: full-stage cards, and the play layout (top bar, canvas,
 * status line, bottom panel). It reports what the player did through `handlers` and never
 * touches the rules.
 *
 * handlers: onTool(id), onReady(), onCellDown(i), onCellEnter(i), onCellLeave(), onCellUp(),
 * onCanvasKey(event) -> handled?, onMove(dir, pressed), onFlare().
 */
export function createView(container, handlers) {
  const card = h('section', { class: 'am-card', hidden: true });
  const { play, parts } = buildPlay(handlers);
  container.append(card, play);
  let statusTimer = 0;
  let baseStatus = '';

  const { canvas, context, destroy: removeCanvas } = createCanvas(parts.board, CANVAS);
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('aria-label', 'Maze grid');
  canvas.classList.add('am-canvas');
  bindPointer(canvas, handlers);
  canvas.addEventListener('keydown', (event) => {
    if (handlers.onCanvasKey(event)) event.preventDefault();
  });

  let cardButtons = [];
  card.addEventListener('input', () => cardButtons.forEach((button) => button.refresh()));

  function showCard(spec) {
    const names = h('div', { class: 'am-names' }, DEFAULT_NAMES.map((fallback, index) => nameField(fallback, index)));
    const buttons = spec.buttons.map((button) => cardButton(button, () => readNames(card)));
    cardButtons = buttons;
    card.replaceChildren(...[
      h('h1', { class: 'am-card__title' }, spec.brand ? brandTitle() : spec.title),
      spec.lede ? h('p', { class: 'am-card__lede' }, spec.lede) : null,
      spec.steps ? h('ol', { class: 'am-steps' }, spec.steps.map(stepItem)) : null,
      spec.rows ? h('ul', { class: 'am-rows' }, spec.rows.map((row) => h('li', {}, row))) : null,
      spec.detail ? h('p', { class: 'am-card__detail' }, spec.detail) : null,
      spec.tally ? h('p', { class: 'am-card__tally' }, spec.tally) : null,
      spec.names ? names : null,
      h('div', { class: 'am-card__buttons' }, buttons.map((button) => button.element)),
    ].filter(Boolean));
    buttons.forEach((button) => button.refresh());
    play.hidden = true;
    card.hidden = false;
    buttons[0].element.focus({ preventScroll: true });
  }

  function showPlay(panel) {
    card.hidden = true;
    play.hidden = false;
    play.dataset.panel = panel;
    parts.panels.forEach((node, id) => { node.hidden = id !== panel; });
  }

  function setTopBar({ text, timerLabel, fraction, timeText, urgent }) {
    setText(parts.who, text);
    setText(parts.timerLabel, timerLabel);
    parts.timerFill.style.transform = `scaleX(${Math.min(Math.max(fraction, 0), 1)})`;
    setText(parts.timeText, timeText);
    parts.timer.toggleAttribute('data-urgent', urgent);
  }

  function setStatus(text) {
    baseStatus = text;
    clearTimeout(statusTimer);
    parts.status.textContent = text;
    parts.status.removeAttribute('data-alert');
  }

  /** Shows `text` in the status line for a moment, then goes back to the normal status. */
  function flashStatus(text) {
    parts.status.textContent = text;
    parts.status.setAttribute('data-alert', '');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => setStatus(baseStatus), REFUSAL_FLASH_SECONDS * 1000);
  }

  function setTools({ selected, left }) {
    for (const id of TOOLS) {
      const button = parts.tools.get(id);
      button.setAttribute('aria-pressed', String(id === selected));
      if (id !== 'erase') button.querySelector('.am-tool__left').textContent = left[id];
      button.toggleAttribute('data-empty', id !== 'erase' && left[id] <= 0);
    }
  }

  function showResult({ title, detail, buttonLabel, onClick }) {
    parts.resultTitle.textContent = title;
    parts.resultDetail.textContent = detail;
    parts.resultButton.textContent = buttonLabel;
    parts.resultButton.onclick = onClick;
    parts.resultButton.focus({ preventScroll: true });
  }

  return {
    canvas,
    context,
    showCard,
    showPlay,
    setTopBar,
    setStatus,
    flashStatus,
    setTools,
    setHelp: (text) => { parts.help.textContent = text; },
    setFlares: (count) => {
      parts.flare.textContent = flareLabel(count);
      parts.flare.toggleAttribute('data-empty', count <= 0);
    },
    showCountdown: (text) => {
      parts.countdown.textContent = text ?? '';
      parts.countdown.hidden = text === null;
      parts.countdown.removeAttribute('data-pop');
      void parts.countdown.offsetWidth;
      parts.countdown.setAttribute('data-pop', '');
    },
    showResult,
    destroy() {
      clearTimeout(statusTimer);
      removeCanvas();
      card.remove();
      play.remove();
    },
  };
}

/** The top bar updates every frame; writing only real changes keeps the page from churning. */
function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

/* ---------- Card pieces ---------- */

function brandTitle() {
  return [TITLE[0], h('b', {}, TITLE[1]), TITLE.slice(2)];
}

function stepItem({ lead, text }) {
  return h('li', {}, h('b', {}, `${lead}.`), ` ${text}`);
}

function nameField(fallback, index) {
  return h('label', { class: 'am-field' },
    h('span', { class: 'am-field__label' }, `Player ${index + 1} name`),
    h('input', { class: 'am-field__input', type: 'text', maxlength: MAX_NAME_LENGTH, placeholder: fallback, autocomplete: 'off', spellcheck: 'false' }));
}

function readNames(card) {
  return [...card.querySelectorAll('.am-field__input')].map((input) => input.value);
}

/** A card button; `label` may be a function of the typed names, so it can follow what is typed. */
function cardButton({ label, primary = true, onClick }, namesNow) {
  const element = h('button', { class: `am-button${primary ? ' am-button--primary' : ''}`, type: 'button' });
  element.addEventListener('click', () => onClick(namesNow()));
  return {
    element,
    refresh: () => { element.textContent = typeof label === 'function' ? label(namesNow()) : label; },
  };
}

/* ---------- Play layout ---------- */

function buildPlay(handlers) {
  const who = h('p', { class: 'am-who' });
  const timerLabel = h('span', { class: 'am-timer__label' });
  const timerFill = h('i', { class: 'am-timer__fill' });
  const timeText = h('span', { class: 'am-timer__time' });
  const timer = h('div', { class: 'am-timer', role: 'timer' }, timerLabel, h('span', { class: 'am-timer__track' }, timerFill), timeText);
  const board = h('div', { class: 'am-board' });
  const countdown = h('div', { class: 'am-countdown', 'aria-live': 'assertive', hidden: true });
  board.append(countdown);
  const status = h('p', { class: 'am-status', 'aria-live': 'polite' });
  const help = h('p', { class: 'am-help' });

  const tools = new Map(TOOLS.map((id) => [id, toolButton(id, handlers)]));
  const ready = h('button', { class: 'am-button am-button--primary', type: 'button' }, READY_BUTTON);
  ready.addEventListener('click', () => handlers.onReady());
  const buildPanel = h('div', { class: 'am-panel' },
    h('div', { class: 'am-tools', role: 'group', 'aria-label': 'Building tools' }, [...tools.values()]), ready);

  const flare = h('button', { class: 'am-button am-flare', type: 'button' });
  flare.addEventListener('click', () => handlers.onFlare());
  const runPanel = h('div', { class: 'am-panel' },
    h('div', { class: 'am-pad', role: 'group', 'aria-label': 'Move' }, PAD_BUTTONS.map((spec) => padButton(spec, handlers))),
    flare);

  const resultTitle = h('h2', { class: 'am-result__title' });
  const resultDetail = h('p', { class: 'am-result__detail' });
  const resultButton = h('button', { class: 'am-button am-button--primary', type: 'button' });
  const resultPanel = h('div', { class: 'am-panel am-panel--result' }, h('div', {}, resultTitle, resultDetail), resultButton);

  const play = h('div', { class: 'am-play', hidden: true },
    h('div', { class: 'am-top' }, who, timer), board, status, help, buildPanel, runPanel, resultPanel);

  const panels = new Map([['build', buildPanel], ['run', runPanel], ['result', resultPanel]]);
  return {
    play,
    parts: {
      who, timer, timerLabel, timerFill, timeText, board, countdown, status, help, tools, flare, panels,
      resultTitle, resultDetail, resultButton,
    },
  };
}

function toolButton(id, handlers) {
  const button = h('button', { class: 'am-tool', type: 'button', 'aria-pressed': 'false', 'data-tool': id },
    h('span', { class: 'am-tool__name' }, TOOL_LABELS[id]),
    id === 'erase' ? null : h('span', { class: 'am-tool__left', 'aria-label': 'left' }));
  button.addEventListener('click', () => handlers.onTool(id));
  return button;
}

function padButton({ dir, glyph, label }, handlers) {
  const button = h('button', { class: 'am-pad__button', type: 'button', 'aria-label': label }, glyph);
  const release = () => handlers.onMove(dir, false);
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handlers.onMove(dir, true);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) button.addEventListener(type, release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    handlers.onMove(dir, true);
    release();
  });
  return button;
}

/** Mouse, pen and touch all arrive as pointer events, so one code path covers every device. */
function bindPointer(canvas, handlers) {
  let lastCell = null;

  function cellAt(event) {
    const box = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - box.left) / box.width) * GRID.cols);
    const y = Math.floor(((event.clientY - box.top) / box.height) * GRID.rows);
    const inside = x >= 0 && y >= 0 && x < GRID.cols && y < GRID.rows;
    return inside ? y * GRID.cols + x : null;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    lastCell = cellAt(event);
    if (lastCell !== null) handlers.onCellDown(lastCell);
  });

  canvas.addEventListener('pointermove', (event) => {
    const cell = cellAt(event);
    if (cell === lastCell) return;
    lastCell = cell;
    if (cell === null) handlers.onCellLeave();
    else handlers.onCellEnter(cell);
  });

  canvas.addEventListener('pointerup', () => handlers.onCellUp());
  canvas.addEventListener('pointercancel', () => handlers.onCellUp());
  canvas.addEventListener('pointerleave', () => {
    lastCell = null;
    handlers.onCellLeave();
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
