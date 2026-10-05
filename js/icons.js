// Simple geometric pictograms, one per game. Static markup only: no user input reaches innerHTML.
const SHAPES = {
  snake: '<path d="M6 38h14V26h14V14h6"/><circle cx="41" cy="9" r="3" fill="currentColor" stroke="none"/>',
  breakout:
    '<rect x="6" y="8" width="10" height="5" rx="1"/><rect x="19" y="8" width="10" height="5" rx="1"/>' +
    '<rect x="32" y="8" width="10" height="5" rx="1"/><rect x="12" y="16" width="10" height="5" rx="1"/>' +
    '<rect x="26" y="16" width="10" height="5" rx="1"/><circle cx="24" cy="30" r="2.5" fill="currentColor" stroke="none"/>' +
    '<path d="M14 41h20"/>',
  splat:
    '<rect x="8" y="4" width="9" height="14" rx="1"/><rect x="8" y="30" width="9" height="14" rx="1"/>' +
    '<rect x="31" y="4" width="9" height="8" rx="1"/><rect x="31" y="24" width="9" height="20" rx="1"/>' +
    '<circle cx="24" cy="22" r="3" fill="currentColor" stroke="none"/>',
  asteroids: '<path d="M30 6l9 5v10l-9 5-9-5V11z"/><path d="M13 27l6 15-6-4-6 4z"/>',
  'missile-command':
    '<path d="M4 43h40"/><path d="M10 43L22 17M38 43L26 17"/><circle cx="24" cy="11" r="5"/>',
  imitation: '<path d="M6 7h22v14H16l-6 5v-5H6z"/><path d="M20 27h22v12h-4v5l-6-5H20z"/>',
  wildcard:
    '<path d="M17 17a7 7 0 1 1 10 6c-2 1.5-3 2.5-3 5"/><circle cx="24" cy="38" r="2" fill="currentColor" stroke="none"/>',
};

export function createIcon(gameId) {
  const template = document.createElement('template');
  template.innerHTML =
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHAPES[gameId]}</svg>`;
  return template.content.firstElementChild;
}
