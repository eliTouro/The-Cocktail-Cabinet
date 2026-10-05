import { GAMES, findGame, findMode } from './games.js';
import { h } from './dom.js';
import { createIcon } from './icons.js';
import { hrefFor, onRouteChange } from './router.js';

const SITE_NAME = 'The Cocktail Cabinet';

let activeSession = null;
let renderCount = 0;

export function startCabinet(root) {
  let isFirstRender = true;
  onRouteChange((route) => {
    render(root, route);
    if (!isFirstRender) focusPage(root);
    isFirstRender = false;
  });
}

function render(root, { gameId, modeId }) {
  endActiveSession();
  const game = findGame(gameId);
  const mode = game && findMode(game, modeId);

  if (!game) {
    document.title = SITE_NAME;
    root.replaceChildren(...menuView());
  } else if (!mode) {
    document.title = `${game.name} · ${SITE_NAME}`;
    root.replaceChildren(...sidePickerView(game));
  } else {
    document.title = `${game.name}: ${mode.label} · ${SITE_NAME}`;
    showPlay(root, game, mode);
  }
}

function endActiveSession() {
  renderCount += 1;
  activeSession?.destroy();
  activeSession = null;
}

function focusPage(root) {
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ---------- Menu ---------- */

function menuView() {
  return [
    h('header', { class: 'hero' },
      h('h1', { class: 'hero__title' }, 'The Cocktail', h('span', { class: 'hero__title-accent' }, 'Cabinet')),
      h('p', { class: 'hero__lede' }, 'Seven arcade games. Play the classic side, or hand it to the computer and take the other.'),
      h('ul', { class: 'legend' },
        legendItem('human', 'You play the classic game'),
        legendItem('computer', 'The computer plays it, you take the other side'))),
    h('ul', { class: 'shelf' }, GAMES.map(gameCard)),
  ];
}

function legendItem(tone, text) {
  return h('li', { class: `legend__item tone-${tone}` }, h('span', { class: 'dot' }), text);
}

function gameCard(game, index) {
  return h('li', { class: 'card', style: `--i:${index}` },
    h('div', { class: 'card__icon' }, createIcon(game.id)),
    h('h2', { class: 'card__name' }, h('a', { class: 'card__link', href: hrefFor(game.id) }, game.name)),
    h('p', { class: 'card__tagline' }, game.tagline),
    h('div', { class: 'card__modes' }, game.modes.map((mode) => modeChip(game, mode))));
}

function modeChip(game, mode, { isCurrent = false } = {}) {
  return h('a', {
    class: `chip tone-${mode.tone}`,
    href: hrefFor(game.id, mode.id),
    'aria-current': isCurrent ? 'page' : false,
  }, h('span', { class: 'dot' }), mode.short);
}

/* ---------- Side picker ---------- */

function sidePickerView(game) {
  return [
    h('nav', { class: 'crumbs' }, backLink('All games', hrefFor())),
    h('section', { class: 'picker' },
      h('div', { class: 'picker__head' },
        h('div', { class: 'card__icon' }, createIcon(game.id)),
        h('div', {},
          h('h1', { class: 'picker__title' }, game.name),
          h('p', { class: 'picker__tagline' }, game.tagline))),
      h('p', { class: 'picker__prompt' }, 'Choose your side'),
      h('ul', { class: 'sides' }, game.modes.map((mode) => sideOption(game, mode)))),
  ];
}

function sideOption(game, mode) {
  return h('li', {},
    h('a', { class: `side tone-${mode.tone}`, href: hrefFor(game.id, mode.id) },
      h('span', { class: 'side__label' }, h('span', { class: 'dot' }), mode.label),
      h('span', { class: 'side__blurb' }, mode.blurb)));
}

function backLink(label, href) {
  return h('a', { class: 'back', href }, h('span', { 'aria-hidden': 'true' }, '←'), label);
}

/* ---------- Play ---------- */

async function showPlay(root, game, mode) {
  const stage = h('div', { class: 'stage', role: 'region', 'aria-label': `${game.name} game` });
  root.replaceChildren(
    h('nav', { class: 'crumbs' },
      backLink('All games', hrefFor()),
      h('div', { class: 'switcher', role: 'group', 'aria-label': 'Choose your side' },
        game.modes.map((option) => modeChip(game, option, { isCurrent: option.id === mode.id })))),
    stage);

  const session = renderCount;
  try {
    const { mount } = await game.load();
    if (session !== renderCount) return;
    activeSession = mount(stage, { game, mode });
  } catch {
    if (session !== renderCount) return;
    stage.replaceChildren(h('p', { class: 'notice' }, `${game.name} failed to load. Reload the page to try again.`));
  }
}
