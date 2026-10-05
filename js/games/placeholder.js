import { h } from '../dom.js';
import { createIcon } from '../icons.js';

/** Stand-in shown until a game has its real implementation. */
export function mountPlaceholder(container, { game, mode }) {
  const panel = h('div', { class: `placeholder tone-${mode.tone}` },
    h('div', { class: 'placeholder__icon' }, createIcon(game.id)),
    h('p', { class: 'placeholder__status' }, 'Coming soon'),
    h('h2', { class: 'placeholder__title' }, `${game.name}: ${mode.label}`),
    h('p', { class: 'placeholder__blurb' }, mode.blurb));
  container.append(panel);

  return { destroy: () => panel.remove() };
}
