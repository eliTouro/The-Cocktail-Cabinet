import { h } from '../dom.js';

/**
 * Score line plus a start / game-over panel laid over the stage.
 * show({ title, detail, actionLabel, onAction }) opens the panel; hide() closes it.
 * setScore(text) updates the score line.
 */
export function createOverlay(container) {
  const scoreboard = h('p', { class: 'scoreboard' });
  const title = h('h2', { class: 'overlay__title' });
  const detail = h('p', { class: 'overlay__detail' });
  const action = h('button', { class: 'overlay__action', type: 'button' });
  const panel = h('div', { class: 'overlay', hidden: true }, title, detail, action);
  let onAction = () => {};

  action.addEventListener('click', () => onAction());
  container.append(scoreboard, panel);

  return {
    show(options) {
      title.textContent = options.title;
      detail.textContent = options.detail ?? '';
      action.textContent = options.actionLabel;
      onAction = options.onAction;
      panel.hidden = false;
      action.focus();
    },
    hide() {
      panel.hidden = true;
    },
    setScore(text) {
      scoreboard.textContent = text;
    },
    destroy() {
      scoreboard.remove();
      panel.remove();
    },
  };
}
