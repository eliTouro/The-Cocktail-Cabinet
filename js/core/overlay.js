import { h } from '../dom.js';
import { LEVEL_COUNT, clampLevel, startLevelFromUrl } from './level.js';

/**
 * Score line plus a start / game-over panel laid over the stage.
 * show({ title, detail, actionLabel, onAction, levelPicker }) opens the panel; hide() closes it.
 * With levelPicker: true the panel lets the player choose the level to start at, and onAction is
 * called with that level. The first choice comes from ?level= in the address.
 * setScore(text) updates the score line.
 */
export function createOverlay(container) {
  const scoreboard = h('p', { class: 'scoreboard' });
  const title = h('h2', { class: 'overlay__title' });
  const detail = h('p', { class: 'overlay__detail' });
  const levelName = h('span', { class: 'level-picker__name' });
  const lower = h('button', { class: 'level-picker__step', type: 'button', 'aria-label': 'Lower start level' }, '−');
  const higher = h('button', { class: 'level-picker__step', type: 'button', 'aria-label': 'Raise start level' }, '+');
  const picker = h('div', { class: 'level-picker', hidden: true }, lower, levelName, higher);
  const action = h('button', { class: 'overlay__action', type: 'button' });
  const panel = h('div', { class: 'overlay', hidden: true }, title, detail, picker, action);
  let onAction = () => {};
  let startLevel = startLevelFromUrl();

  function showLevel() {
    levelName.textContent = `Start at level ${startLevel} of ${LEVEL_COUNT}`;
  }

  lower.addEventListener('click', () => { startLevel = clampLevel(startLevel - 1); showLevel(); });
  higher.addEventListener('click', () => { startLevel = clampLevel(startLevel + 1); showLevel(); });
  action.addEventListener('click', () => onAction(startLevel));
  container.append(scoreboard, panel);

  return {
    show(options) {
      title.textContent = options.title;
      detail.textContent = options.detail ?? '';
      action.textContent = options.actionLabel;
      onAction = options.onAction;
      picker.hidden = !options.levelPicker;
      showLevel();
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
